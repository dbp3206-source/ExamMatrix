package com.exammatrix.backend.service.impl;

import com.exammatrix.backend.dto.request.GenerationAdviceRequest;
import com.exammatrix.backend.dto.response.GenerationAdviceResponse;
import com.exammatrix.backend.dto.response.GenerationAdviceResponse.AllocationCell;
import com.exammatrix.backend.dto.response.GenerationAdviceResponse.BatchCellBreakdown;
import com.exammatrix.backend.dto.response.GenerationAdviceResponse.BatchHistoryItem;
import com.exammatrix.backend.dto.response.GenerationAdviceResponse.CellAdjustment;
import com.exammatrix.backend.dto.response.GenerationAdviceResponse.CellEvidenceItem;
import com.exammatrix.backend.dto.response.GenerationAdviceResponse.QuestionEvidenceItem;
import com.exammatrix.backend.entity.*;
import com.exammatrix.backend.entity.enums.*;
import com.exammatrix.backend.repository.*;
import com.exammatrix.backend.security.CurrentUserService;
import com.exammatrix.backend.service.GenerationAdviceService;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class GenerationAdviceServiceImpl implements GenerationAdviceService {
    private static final int MAX_COMPARABLE_BATCHES = 3;
    private static final int MIN_ELIGIBLE_STUDENTS = 5;
    private static final int MIN_DISTINCT_QUESTIONS_PER_STUDENT = 2;
    private static final int MIN_STRUGGLING_STUDENTS = 3;
    private static final int MIN_WRONG_QUESTIONS_FOR_STRUGGLING = 2;
    private static final int DONOR_CELL_FLOOR = 2;

    private static final List<QuestionType> OBJECTIVE_TYPES = List.of(
            QuestionType.SINGLE_CHOICE,
            QuestionType.MULTIPLE_CHOICE,
            QuestionType.TRUE_FALSE
    );

    private static final List<QuestionType> ESSAY_TYPES = List.of(QuestionType.ESSAY);

    private static final List<AttemptStatus> COMPARABLE_ATTEMPT_STATUSES = List.of(
            AttemptStatus.COMPLETED,
            AttemptStatus.SUBMITTED,
            AttemptStatus.WAITING_GRADING
    );

    private static final DateTimeFormatter BATCH_DATE_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private final ExamMatrixRepository examMatrixRepository;
    private final QuestionRepository questionRepository;
    private final TeacherClassRepository teacherClassRepository;
    private final StudentTeacherAssignmentRepository assignmentRepository;
    private final StudentExamAttemptRepository attemptRepository;
    private final StudentAttemptAnswerRepository attemptAnswerRepository;
    private final ExamGenerationRequestRepository generationRequestRepository;
    private final ExamPaperRepository examPaperRepository;
    private final CurrentUserService currentUserService;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private enum AnswerOutcome {
        CORRECT,
        WRONG,
        BLANK,
        PARTIAL,
        WAITING_GRADING
    }

    private record CellKey(Integer chapterId, Difficulty difficulty) implements Comparable<CellKey> {
        @Override
        public int compareTo(CellKey other) {
            int cmp = Integer.compare(this.chapterId, other.chapterId);
            if (cmp != 0) return cmp;
            return this.difficulty.compareTo(other.difficulty);
        }
    }

    private record StudentQuestionKey(UUID studentId, UUID questionId) {}

    private record LatestAnswerRecord(
            StudentAttemptAnswer answer,
            StudentExamAttempt attempt,
            UUID batchRequestId,
            LocalDateTime effectiveTime,
            AnswerOutcome outcome
    ) {}

    @Override
    public GenerationAdviceResponse getGenerationAdvice(UUID matrixId, GenerationAdviceRequest request) {
        User currentUser = currentUserService.getCurrentUser();
        ExamMatrix matrix = examMatrixRepository.findById(matrixId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Không tìm thấy ma trận có ID " + matrixId
                ));

        checkCanAccess(matrix, currentUser);
        int numberOfPapers = parseValidPaperCount(request != null ? request.getNumberOfPapers() : null);
        return evaluateForLockedMatrix(matrix, numberOfPapers);
    }

    @Override
    public GenerationAdviceResponse evaluateForLockedMatrix(ExamMatrix matrix, int numberOfPapers) {
        ExamType examType = matrix.getExamType() != null ? matrix.getExamType() : ExamType.OBJECTIVE;
        List<QuestionType> allowedTypes = (examType == ExamType.ESSAY) ? ESSAY_TYPES : OBJECTIVE_TYPES;

        int configSum = 0;
        Map<CellKey, Integer> currentCounts = new LinkedHashMap<>();
        Map<CellKey, String> chapterNames = new HashMap<>();
        Map<CellKey, Integer> bankAvailability = new HashMap<>();

        List<ExamMatrixConfig> sortedConfigs = new ArrayList<>(matrix.getConfigs());
        sortedConfigs.sort(Comparator
                .comparing((ExamMatrixConfig c) -> c.getChapter().getOrderIndex() != null ? c.getChapter().getOrderIndex() : 0)
                .thenComparing(c -> c.getChapter().getId())
                .thenComparing(ExamMatrixConfig::getDifficulty));

        for (ExamMatrixConfig config : sortedConfigs) {
            configSum += config.getQuantity();
            CellKey key = new CellKey(config.getChapter().getId(), config.getDifficulty());
            currentCounts.put(key, config.getQuantity());
            chapterNames.put(key, config.getChapter().getName());
            int available = questionRepository.findAllByChapter_IdAndDifficultyAndTypeIn(
                    config.getChapter().getId(),
                    config.getDifficulty(),
                    allowedTypes
            ).size();
            bankAvailability.put(key, available);
            if (available < config.getQuantity()) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "Chương " + config.getChapter().getName()
                                + " không đủ câu hỏi " + examType
                                + " mức " + config.getDifficulty()
                );
            }
        }

        if (configSum != matrix.getTotalQuestions()) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Tổng số câu cấu hình không khớp tổng số câu của ma trận"
            );
        }

        int totalQuestions = matrix.getTotalQuestions();
        BigDecimal totalPoints = BigDecimal.valueOf(totalQuestions);
        List<AllocationCell> currentAllocation = buildAllocationList(currentCounts, chapterNames, totalQuestions);

        if (examType != ExamType.OBJECTIVE) {
            String snap = computeSnapshotVersion(matrix, currentCounts, bankAvailability, null, 0L, List.of(), Map.of());
            return noRecommendation(
                    "UNSUPPORTED_EXAM_TYPE",
                    "Bản đầu chỉ áp dụng gợi ý điều chỉnh cho ma trận trắc nghiệm.",
                    snap, null, null, 0L, examType, totalQuestions, totalPoints, numberOfPapers,
                    List.of(), currentAllocation, List.of()
            );
        }

        Optional<TeacherClass> teacherClassOpt = teacherClassRepository.findByTeacher_Id(matrix.getTeacher().getId());
        if (teacherClassOpt.isEmpty()) {
            String snap = computeSnapshotVersion(matrix, currentCounts, bankAvailability, null, 0L, List.of(), Map.of());
            return noRecommendation(
                    "NO_TARGET_CLASS",
                    "Giáo viên chưa có lớp học xác định để đối chiếu dữ liệu lịch sử.",
                    snap, null, null, 0L, examType, totalQuestions, totalPoints, numberOfPapers,
                    List.of(), currentAllocation, List.of()
            );
        }

        TeacherClass teacherClass = teacherClassOpt.get();
        long classStudentCount = assignmentRepository.countByTeacherClass_IdAndStatus(
                teacherClass.getId(), StudentAssignmentStatus.APPROVED);

        List<StudentExamAttempt> allComparableAttempts = attemptRepository.findComparableAttemptsForAdvice(
                matrix.getTeacher().getId(),
                teacherClass.getId(),
                matrix.getSubject().getId(),
                ExamType.OBJECTIVE,
                COMPARABLE_ATTEMPT_STATUSES
        );

        if (allComparableAttempts.isEmpty()) {
            String snap = computeSnapshotVersion(matrix, currentCounts, bankAvailability, teacherClass.getId(), classStudentCount, List.of(), Map.of());
            return noRecommendation(
                    "INSUFFICIENT_DATA",
                    "Chưa có đợt thi đối chứng hợp lệ nào của lớp trong môn học này.",
                    snap, teacherClass.getId(), teacherClass.getName(), classStudentCount, examType,
                    totalQuestions, totalPoints, numberOfPapers, List.of(), currentAllocation, List.of()
            );
        }

        Map<UUID, List<StudentExamAttempt>> attemptsByBatch = allComparableAttempts.stream()
                .collect(Collectors.groupingBy(a -> a.getExamPaper().getGenerationRequestId()));

        List<UUID> allBatchIds = new ArrayList<>(attemptsByBatch.keySet());
        Map<UUID, ExamGenerationRequest> requestByBatchId = generationRequestRepository.findByRequestIdIn(allBatchIds)
                .stream()
                .collect(Collectors.toMap(ExamGenerationRequest::getRequestId, r -> r, (a, b) -> a));

        List<ExamPaper> allBatchPapers = examPaperRepository.findByGenerationRequestIdIn(allBatchIds);
        Map<UUID, List<ExamPaper>> papersByBatchId = allBatchPapers.stream()
                .collect(Collectors.groupingBy(ExamPaper::getGenerationRequestId));

        List<UUID> selectedBatchIds = allBatchIds.stream()
                .sorted(Comparator
                        .comparing((UUID reqId) -> resolveBatchTimestamp(reqId, requestByBatchId.get(reqId), papersByBatchId.get(reqId)), Comparator.reverseOrder())
                        .thenComparing(UUID::toString, Comparator.reverseOrder()))
                .limit(MAX_COMPARABLE_BATCHES)
                .toList();

        List<UUID> chronologicalBatchIds = new ArrayList<>(selectedBatchIds);
        Collections.reverse(chronologicalBatchIds);

        Map<UUID, String> batchLabels = new LinkedHashMap<>();
        List<BatchHistoryItem> batchHistory = new ArrayList<>();
        for (int i = 0; i < chronologicalBatchIds.size(); i++) {
            UUID batchId = chronologicalBatchIds.get(i);
            ExamGenerationRequest genReq = requestByBatchId.get(batchId);
            List<ExamPaper> batchPapers = papersByBatchId.getOrDefault(batchId, List.of());
            LocalDateTime ts = resolveBatchTimestamp(batchId, genReq, batchPapers);
            String label = "Đợt " + (i + 1) + (ts != null ? " (" + ts.format(BATCH_DATE_FMT) + ")" : "");
            batchLabels.put(batchId, label);
            batchHistory.add(buildBatchHistoryItem(batchId, label, genReq, batchPapers));
        }

        List<StudentExamAttempt> windowAttempts = selectedBatchIds.stream()
                .flatMap(bid -> attemptsByBatch.getOrDefault(bid, List.of()).stream())
                .toList();
        List<UUID> windowAttemptIds = windowAttempts.stream().map(StudentExamAttempt::getId).toList();

        List<StudentAttemptAnswer> windowAnswers = windowAttemptIds.isEmpty()
                ? List.of()
                : attemptAnswerRepository.findByAttempt_IdIn(windowAttemptIds);

        Map<StudentQuestionKey, LatestAnswerRecord> latestByStudentQuestion = new HashMap<>();
        for (StudentAttemptAnswer answer : windowAnswers) {
            if (answer.getQuestion() == null || answer.getQuestion().getChapter() == null) continue;
            if (answer.getQuestion().getType() == QuestionType.ESSAY) continue;
            StudentExamAttempt attempt = answer.getAttempt();
            UUID studentId = attempt.getStudent().getId();
            UUID questionId = answer.getQuestion().getId();
            UUID batchId = attempt.getExamPaper().getGenerationRequestId();
            LocalDateTime effTime = resolveAttemptTime(attempt);
            AnswerOutcome outcome = classifyAnswer(attempt, answer);

            StudentQuestionKey sqKey = new StudentQuestionKey(studentId, questionId);
            LatestAnswerRecord candidate = new LatestAnswerRecord(answer, attempt, batchId, effTime, outcome);
            latestByStudentQuestion.merge(sqKey, candidate, (existing, incoming) -> {
                int cmp = existing.effectiveTime().compareTo(incoming.effectiveTime());
                if (cmp < 0) return incoming;
                if (cmp > 0) return existing;
                return existing.attempt().getId().toString().compareTo(incoming.attempt().getId().toString()) < 0
                        ? incoming
                        : existing;
            });
        }

        String snapshotVersion = computeSnapshotVersion(
                matrix, currentCounts, bankAvailability, teacherClass.getId(), classStudentCount,
                chronologicalBatchIds, latestByStudentQuestion
        );

        Map<CellKey, CellStats> statsByCell = new LinkedHashMap<>();
        for (CellKey key : currentCounts.keySet()) {
            statsByCell.put(key, new CellStats(key, chapterNames.get(key)));
        }

        for (LatestAnswerRecord rec : latestByStudentQuestion.values()) {
            Question q = rec.answer().getQuestion();
            CellKey cellKey = new CellKey(q.getChapter().getId(), q.getDifficulty());
            CellStats stats = statsByCell.get(cellKey);
            if (stats == null) continue;
            stats.record(rec, batchLabels.getOrDefault(rec.batchRequestId(), "Đợt trước"));
        }

        List<CellStats> weakCells = new ArrayList<>();
        for (CellStats stats : statsByCell.values()) {
            if (stats.isWeak()) {
                weakCells.add(stats);
            }
        }

        if (weakCells.isEmpty()) {
            List<CellEvidenceItem> evidences = buildCellEvidences(statsByCell, null, null, classStudentCount, chronologicalBatchIds, batchLabels);
            return noRecommendation(
                    "NO_WEAK_CELL",
                    "Chưa có ô ma trận nào đạt ngưỡng cần tăng câu hỏi (≥ 5 học sinh đủ mẫu, ≥ 3 em và ≥ 50% sai ≥ 2 câu gốc).",
                    snapshotVersion, teacherClass.getId(), teacherClass.getName(), classStudentCount,
                    examType, totalQuestions, totalPoints, numberOfPapers,
                    batchHistory, currentAllocation, evidences
            );
        }

        List<CellStats> bankFeasibleWeakCells = weakCells.stream()
                .filter(ws -> bankAvailability.getOrDefault(ws.key, 0) >= currentCounts.getOrDefault(ws.key, 0) + 1)
                .toList();

        if (bankFeasibleWeakCells.isEmpty()) {
            List<CellEvidenceItem> evidences = buildCellEvidences(statsByCell, null, null, classStudentCount, chronologicalBatchIds, batchLabels);
            return noRecommendation(
                    "INSUFFICIENT_BANK",
                    "Ngân hàng câu hỏi ở ô cần tăng không đủ số lượng khả dụng để bổ sung thêm 1 câu.",
                    snapshotVersion, teacherClass.getId(), teacherClass.getName(), classStudentCount,
                    examType, totalQuestions, totalPoints, numberOfPapers,
                    batchHistory, currentAllocation, evidences
            );
        }

        record ProposalPair(CellStats increase, CellStats donor) {}
        List<ProposalPair> validPairs = new ArrayList<>();

        for (CellStats inc : bankFeasibleWeakCells) {
            Optional<CellStats> bestDonor = statsByCell.values().stream()
                    .filter(cand -> cand.key.difficulty() == inc.key.difficulty())
                    .filter(cand -> !cand.key.chapterId().equals(inc.key.chapterId()))
                    .filter(cand -> currentCounts.getOrDefault(cand.key, 0) >= DONOR_CELL_FLOOR)
                    .filter(cand -> !cand.isWeak())
                    .min(Comparator
                            .comparingDouble(CellStats::strugglingRatePercent)
                            .thenComparingInt(CellStats::strugglingStudents)
                            .thenComparingInt(c -> -currentCounts.getOrDefault(c.key, 0))
                            .thenComparing(c -> c.key.chapterId()));

            bestDonor.ifPresent(donor -> validPairs.add(new ProposalPair(inc, donor)));
        }

        if (validPairs.isEmpty()) {
            List<CellEvidenceItem> evidences = buildCellEvidences(statsByCell, null, null, classStudentCount, chronologicalBatchIds, batchLabels);
            return noRecommendation(
                    "NO_DONOR_CELL",
                    "Không có ô cùng độ khó nào đủ mức sàn (≥ 2 câu, còn lại tối thiểu 1 câu sau khi giảm) để chuyển 1 câu.",
                    snapshotVersion, teacherClass.getId(), teacherClass.getName(), classStudentCount,
                    examType, totalQuestions, totalPoints, numberOfPapers,
                    batchHistory, currentAllocation, evidences
            );
        }

        ProposalPair chosen = validPairs.stream()
                .min(Comparator
                        .comparingInt((ProposalPair p) -> -p.increase().repeatedBatchCount())
                        .thenComparingDouble(p -> -p.increase().coveragePercent(classStudentCount))
                        .thenComparingInt(p -> -p.increase().strugglingStudents())
                        .thenComparingDouble(p -> -p.increase().strugglingRatePercent())
                        .thenComparingInt(p -> p.increase().key.chapterId()))
                .orElseThrow();

        CellStats inc = chosen.increase();
        CellStats dec = chosen.donor();
        int incCurrent = currentCounts.get(inc.key);
        int decCurrent = currentCounts.get(dec.key);

        Map<CellKey, Integer> proposedCounts = new LinkedHashMap<>(currentCounts);
        proposedCounts.put(inc.key, incCurrent + 1);
        proposedCounts.put(dec.key, decCurrent - 1);

        List<AllocationCell> proposedAllocation = buildAllocationList(proposedCounts, chapterNames, totalQuestions);
        List<CellEvidenceItem> evidences = buildCellEvidences(
                statsByCell, inc.key, dec.key, classStudentCount, chronologicalBatchIds, batchLabels
        );

        String diffLabel = difficultyLabelVi(inc.key.difficulty());
        String actionTitle = String.format(
                "Chuyển 1 câu %s từ %s sang %s?",
                diffLabel,
                dec.chapterName,
                inc.chapterName
        );

        String incReason = String.format(
                "%d/%d học sinh đủ mẫu (%.0f%%) sai từ 2 câu gốc trở lên trong %d đợt gần nhất; ngân hàng còn %d câu khả dụng.",
                inc.strugglingStudents(),
                inc.eligibleStudents(),
                inc.strugglingRatePercent(),
                chronologicalBatchIds.size(),
                bankAvailability.getOrDefault(inc.key, 0)
        );

        String decReason = String.format(
                "Cùng mức %s, sau khi giảm 1 câu vẫn còn %d câu (đạt mức sàn tối thiểu ≥ 1 câu/chương) và bảo toàn tổng %d câu.",
                diffLabel,
                decCurrent - 1,
                totalQuestions
        );

        CellAdjustment increaseAdj = new CellAdjustment(
                inc.key.chapterId(),
                inc.chapterName,
                inc.key.difficulty(),
                incCurrent,
                incCurrent + 1,
                bankAvailability.getOrDefault(inc.key, 0),
                incReason,
                inc.eligibleStudents(),
                inc.strugglingStudents(),
                inc.observedStudents(),
                inc.strugglingRatePercent()
        );

        CellAdjustment decreaseAdj = new CellAdjustment(
                dec.key.chapterId(),
                dec.chapterName,
                dec.key.difficulty(),
                decCurrent,
                decCurrent - 1,
                bankAvailability.getOrDefault(dec.key, 0),
                decReason,
                dec.eligibleStudents(),
                dec.strugglingStudents(),
                dec.observedStudents(),
                dec.strugglingRatePercent()
        );

        return new GenerationAdviceResponse(
                true,
                "RECOMMENDED",
                "Có đề xuất điều chỉnh 1 câu dựa trên kết quả thực tế của lớp.",
                actionTitle,
                snapshotVersion,
                teacherClass.getId(),
                teacherClass.getName(),
                classStudentCount,
                examType,
                totalQuestions,
                totalPoints,
                numberOfPapers,
                increaseAdj,
                decreaseAdj,
                batchHistory,
                currentAllocation,
                proposedAllocation,
                evidences
        );
    }

    private GenerationAdviceResponse noRecommendation(
            String reasonCode,
            String reasonMessage,
            String snapshotVersion,
            UUID classId,
            String className,
            long classStudentCount,
            ExamType examType,
            int totalQuestions,
            BigDecimal totalPoints,
            int requestedNumberOfPapers,
            List<BatchHistoryItem> batchHistory,
            List<AllocationCell> currentAllocation,
            List<CellEvidenceItem> cellEvidences
    ) {
        return new GenerationAdviceResponse(
                false,
                reasonCode,
                reasonMessage,
                null,
                snapshotVersion,
                classId,
                className,
                classStudentCount,
                examType,
                totalQuestions,
                totalPoints,
                requestedNumberOfPapers,
                null,
                null,
                batchHistory,
                currentAllocation,
                currentAllocation,
                cellEvidences
        );
    }

    private BatchHistoryItem buildBatchHistoryItem(
            UUID batchId,
            String label,
            ExamGenerationRequest genReq,
            List<ExamPaper> batchPapers
    ) {
        LocalDateTime createdAt = resolveBatchTimestamp(batchId, genReq, batchPapers);
        String matrixTitle = batchPapers.isEmpty()
                ? (genReq != null && genReq.getExamMatrix() != null ? genReq.getExamMatrix().getTitle() : "Đợt trước")
                : batchPapers.get(0).getExamMatrix().getTitle();
        int paperCount = batchPapers.size();

        if (genReq != null && genReq.getAllocationSnapshot() != null && !genReq.getAllocationSnapshot().isBlank()) {
            try {
                List<AllocationCell> parsed = objectMapper.readValue(
                        genReq.getAllocationSnapshot(),
                        new TypeReference<List<AllocationCell>>() {}
                );
                int total = parsed.stream().mapToInt(AllocationCell::count).sum();
                return new BatchHistoryItem(
                        batchId, label, matrixTitle, createdAt, total,
                        paperCount > 0 ? paperCount : genReq.getNumberOfPapers(),
                        "ALLOCATION_SNAPSHOT",
                        parsed
                );
            } catch (Exception ignored) {

            }
        }

        if (!batchPapers.isEmpty()) {
            ExamPaper representative = batchPapers.get(0);
            Map<CellKey, Integer> counts = new LinkedHashMap<>();
            Map<CellKey, String> names = new HashMap<>();
            for (PaperQuestion pq : representative.getPaperQuestions()) {
                Question q = pq.getQuestion();
                if (q == null || q.getChapter() == null) continue;
                CellKey k = new CellKey(q.getChapter().getId(), q.getDifficulty());
                counts.merge(k, 1, Integer::sum);
                names.putIfAbsent(k, q.getChapter().getName());
            }
            int total = counts.values().stream().mapToInt(Integer::intValue).sum();
            return new BatchHistoryItem(
                    batchId, label, matrixTitle, createdAt, total, paperCount,
                    "RECONSTRUCTED_FROM_PAPERS",
                    buildAllocationList(counts, names, total)
            );
        }

        return new BatchHistoryItem(
                batchId, label, matrixTitle, createdAt, 0, paperCount,
                "RECONSTRUCTED_FROM_PAPERS",
                List.of()
        );
    }

    private List<AllocationCell> buildAllocationList(
            Map<CellKey, Integer> counts,
            Map<CellKey, String> chapterNames,
            int totalQuestions
    ) {
        List<AllocationCell> result = new ArrayList<>();
        for (Map.Entry<CellKey, Integer> entry : counts.entrySet()) {
            int count = entry.getValue();
            double pct = totalQuestions > 0 ? round1(count * 100.0 / totalQuestions) : 0.0;
            result.add(new AllocationCell(
                    entry.getKey().chapterId(),
                    chapterNames.getOrDefault(entry.getKey(), "Chương " + entry.getKey().chapterId()),
                    entry.getKey().difficulty(),
                    count,
                    pct
            ));
        }
        return result;
    }

    private List<CellEvidenceItem> buildCellEvidences(
            Map<CellKey, CellStats> statsByCell,
            CellKey increaseKey,
            CellKey decreaseKey,
            long classStudentCount,
            List<UUID> chronologicalBatchIds,
            Map<UUID, String> batchLabels
    ) {
        List<CellEvidenceItem> items = new ArrayList<>();
        for (CellStats stats : statsByCell.values()) {
            items.add(stats.toEvidenceItem(
                    stats.key.equals(increaseKey),
                    stats.key.equals(decreaseKey),
                    classStudentCount,
                    chronologicalBatchIds,
                    batchLabels
            ));
        }
        return items;
    }

    private AnswerOutcome classifyAnswer(StudentExamAttempt attempt, StudentAttemptAnswer answer) {
        boolean isBlank = answer.getChoices() == null || answer.getChoices().isEmpty();
        if (isBlank) {
            return AnswerOutcome.BLANK;
        }
        if (answer.getIsCorrect() == null) {
            return AnswerOutcome.WAITING_GRADING;
        }
        if (Boolean.TRUE.equals(answer.getIsCorrect())) {
            return AnswerOutcome.CORRECT;
        }
        if (answer.getAwardedScore() != null && answer.getAwardedScore().compareTo(BigDecimal.ZERO) > 0) {
            return AnswerOutcome.PARTIAL;
        }
        if (attempt.getStatus() == AttemptStatus.WAITING_GRADING) {
            return AnswerOutcome.WAITING_GRADING;
        }
        return AnswerOutcome.WRONG;
    }

    private LocalDateTime resolveAttemptTime(StudentExamAttempt attempt) {
        if (attempt.getGradedAt() != null) return attempt.getGradedAt();
        if (attempt.getSubmittedAt() != null) return attempt.getSubmittedAt();
        if (attempt.getStartedAt() != null) return attempt.getStartedAt();
        return LocalDateTime.MIN;
    }

    private LocalDateTime resolveBatchTimestamp(UUID batchId, ExamGenerationRequest genReq, List<ExamPaper> papers) {
        if (genReq != null && genReq.getCreatedAt() != null) return genReq.getCreatedAt();
        if (papers != null && !papers.isEmpty()) {
            return papers.stream()
                    .map(ExamPaper::getCreatedAt)
                    .filter(Objects::nonNull)
                    .min(LocalDateTime::compareTo)
                    .orElse(LocalDateTime.MIN);
        }
        return LocalDateTime.MIN;
    }

    private String computeSnapshotVersion(
            ExamMatrix matrix,
            Map<CellKey, Integer> currentCounts,
            Map<CellKey, Integer> bankAvailability,
            UUID classId,
            long classStudentCount,
            List<UUID> chronologicalBatchIds,
            Map<StudentQuestionKey, LatestAnswerRecord> latestRecords
    ) {
        StringBuilder sb = new StringBuilder();
        sb.append("m=").append(matrix.getId())
                .append("|tot=").append(matrix.getTotalQuestions())
                .append("|cls=").append(classId)
                .append("|cnt=").append(classStudentCount);
        currentCounts.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .forEach(e -> sb.append("|c:")
                        .append(e.getKey().chapterId()).append(':')
                        .append(e.getKey().difficulty()).append('=')
                        .append(e.getValue()).append('/')
                        .append(bankAvailability.getOrDefault(e.getKey(), 0)));
        for (UUID bid : chronologicalBatchIds) {
            sb.append("|b:").append(bid);
        }
        latestRecords.entrySet().stream()
                .sorted(Comparator
                        .comparing((Map.Entry<StudentQuestionKey, LatestAnswerRecord> e) -> e.getKey().studentId().toString())
                        .thenComparing(e -> e.getKey().questionId().toString()))
                .forEach(e -> sb.append("|r:")
                        .append(e.getKey().studentId()).append(':')
                        .append(e.getKey().questionId()).append(':')
                        .append(e.getValue().attempt().getId()).append(':')
                        .append(e.getValue().outcome().name()));

        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(sb.toString().getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder();
            for (int i = 0; i < 12 && i < hash.length; i++) {
                hex.append(String.format("%02x", hash[i]));
            }
            return hex.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }

    private int parseValidPaperCount(BigDecimal raw) {
        if (raw == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Số mã đề không được để trống");
        }
        final int count;
        try {
            count = raw.intValueExact();
        } catch (ArithmeticException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Số mã đề phải là số nguyên từ 1 đến 20");
        }
        if (count < 1 || count > 20) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Số mã đề phải từ 1 đến 20");
        }
        return count;
    }

    private void checkCanAccess(ExamMatrix matrix, User currentUser) {
        if ("ADMIN".equalsIgnoreCase(currentUser.getRole().getName())) {
            return;
        }
        boolean isOwner = "TEACHER".equalsIgnoreCase(currentUser.getRole().getName())
                && matrix.getTeacher().getId().equals(currentUser.getId());
        if (!isOwner) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bạn không có quyền xem gợi ý cho ma trận này");
        }
    }

    private static double round1(double value) {
        return Math.round(value * 10.0) / 10.0;
    }

    private static String difficultyLabelVi(Difficulty difficulty) {
        if (difficulty == Difficulty.EASY) return "Dễ";
        if (difficulty == Difficulty.MEDIUM) return "Trung bình";
        return "Khó";
    }

    private static class CellStats {
        final CellKey key;
        final String chapterName;
        final Set<UUID> observedStudentIds = new HashSet<>();
        final Map<UUID, Set<UUID>> definitiveQuestionsByStudent = new HashMap<>();
        final Map<UUID, Set<UUID>> wrongQuestionsByStudent = new HashMap<>();
        final Set<UUID> batchesWithWrong = new HashSet<>();
        int correctCount = 0;
        int wrongCount = 0;
        int blankCount = 0;
        int partialCount = 0;
        int waitingGradingCount = 0;

        final Map<UUID, Set<UUID>> batchStudents = new HashMap<>();
        final Map<UUID, Set<UUID>> batchQuestions = new HashMap<>();
        final Map<UUID, Integer> batchWrong = new HashMap<>();
        final Map<UUID, Integer> batchBlank = new HashMap<>();

        final Map<UUID, QuestionStats> questionStatsMap = new LinkedHashMap<>();

        CellStats(CellKey key, String chapterName) {
            this.key = key;
            this.chapterName = chapterName;
        }

        void record(LatestAnswerRecord rec, String batchLabel) {
            UUID studentId = rec.attempt().getStudent().getId();
            Question q = rec.answer().getQuestion();
            UUID qId = q.getId();
            UUID batchId = rec.batchRequestId();

            observedStudentIds.add(studentId);
            batchStudents.computeIfAbsent(batchId, k -> new HashSet<>()).add(studentId);
            batchQuestions.computeIfAbsent(batchId, k -> new HashSet<>()).add(qId);

            QuestionStats qs = questionStatsMap.computeIfAbsent(qId, k -> new QuestionStats(qId, snippet(q.getContent())));
            qs.batchLabels.add(batchLabel);
            qs.observedStudents.add(studentId);

            switch (rec.outcome()) {
                case CORRECT -> {
                    correctCount++;
                    qs.correctCount++;
                    definitiveQuestionsByStudent.computeIfAbsent(studentId, k -> new HashSet<>()).add(qId);
                }
                case WRONG -> {
                    wrongCount++;
                    qs.wrongCount++;
                    definitiveQuestionsByStudent.computeIfAbsent(studentId, k -> new HashSet<>()).add(qId);
                    wrongQuestionsByStudent.computeIfAbsent(studentId, k -> new HashSet<>()).add(qId);
                    batchesWithWrong.add(batchId);
                    batchWrong.merge(batchId, 1, Integer::sum);
                }
                case BLANK -> {
                    blankCount++;
                    qs.blankCount++;
                    batchBlank.merge(batchId, 1, Integer::sum);
                }
                case PARTIAL -> {
                    partialCount++;
                    qs.partialCount++;
                }
                case WAITING_GRADING -> {
                    waitingGradingCount++;
                    qs.waitingGradingCount++;
                }
            }
        }

        int observedStudents() {
            return observedStudentIds.size();
        }

        int eligibleStudents() {
            int count = 0;
            for (Set<UUID> qs : definitiveQuestionsByStudent.values()) {
                if (qs.size() >= MIN_DISTINCT_QUESTIONS_PER_STUDENT) {
                    count++;
                }
            }
            return count;
        }

        int strugglingStudents() {
            int count = 0;
            for (Map.Entry<UUID, Set<UUID>> entry : definitiveQuestionsByStudent.entrySet()) {
                if (entry.getValue().size() >= MIN_DISTINCT_QUESTIONS_PER_STUDENT) {
                    Set<UUID> wrong = wrongQuestionsByStudent.getOrDefault(entry.getKey(), Set.of());
                    if (wrong.size() >= MIN_WRONG_QUESTIONS_FOR_STRUGGLING) {
                        count++;
                    }
                }
            }
            return count;
        }

        double strugglingRatePercent() {
            int eligible = eligibleStudents();
            if (eligible == 0) return 0.0;
            return round1(strugglingStudents() * 100.0 / eligible);
        }

        double coveragePercent(long classStudentCount) {
            if (classStudentCount <= 0) return 0.0;
            return round1(Math.min(100.0, observedStudents() * 100.0 / classStudentCount));
        }

        int repeatedBatchCount() {
            return batchesWithWrong.size();
        }

        boolean isWeak() {
            int eligible = eligibleStudents();
            int struggling = strugglingStudents();
            return eligible >= MIN_ELIGIBLE_STUDENTS
                    && struggling >= MIN_STRUGGLING_STUDENTS
                    && (struggling * 2 >= eligible);
        }

        CellEvidenceItem toEvidenceItem(
                boolean isTargetIncrease,
                boolean isTargetDecrease,
                long classStudentCount,
                List<UUID> chronologicalBatchIds,
                Map<UUID, String> batchLabels
        ) {
            List<BatchCellBreakdown> breakdowns = new ArrayList<>();
            for (UUID bid : chronologicalBatchIds) {
                breakdowns.add(new BatchCellBreakdown(
                        bid,
                        batchLabels.getOrDefault(bid, "Đợt trước"),
                        batchStudents.getOrDefault(bid, Set.of()).size(),
                        batchQuestions.getOrDefault(bid, Set.of()).size(),
                        batchWrong.getOrDefault(bid, 0),
                        batchBlank.getOrDefault(bid, 0)
                ));
            }
            List<QuestionEvidenceItem> questionItems = questionStatsMap.values().stream()
                    .sorted(Comparator.comparingInt((QuestionStats qs) -> -qs.wrongCount)
                            .thenComparing(qs -> qs.questionId.toString()))
                    .map(QuestionStats::toDto)
                    .toList();

            return new CellEvidenceItem(
                    key.chapterId(),
                    chapterName,
                    key.difficulty(),
                    isTargetIncrease,
                    isTargetDecrease,
                    eligibleStudents(),
                    strugglingStudents(),
                    observedStudents(),
                    classStudentCount,
                    coveragePercent(classStudentCount),
                    strugglingRatePercent(),
                    repeatedBatchCount(),
                    correctCount,
                    wrongCount,
                    blankCount,
                    partialCount,
                    waitingGradingCount,
                    breakdowns,
                    questionItems
            );
        }

        private static String snippet(String content) {
            if (content == null) return "";
            String clean = content.replaceAll("\\s+", " ").trim();
            return clean.length() > 110 ? clean.substring(0, 107) + "..." : clean;
        }
    }

    private static class QuestionStats {
        final UUID questionId;
        final String snippet;
        final Set<String> batchLabels = new LinkedHashSet<>();
        final Set<UUID> observedStudents = new HashSet<>();
        int correctCount = 0;
        int wrongCount = 0;
        int blankCount = 0;
        int partialCount = 0;
        int waitingGradingCount = 0;

        QuestionStats(UUID questionId, String snippet) {
            this.questionId = questionId;
            this.snippet = snippet;
        }

        QuestionEvidenceItem toDto() {
            return new QuestionEvidenceItem(
                    questionId,
                    snippet,
                    new ArrayList<>(batchLabels),
                    observedStudents.size(),
                    correctCount,
                    wrongCount,
                    blankCount,
                    partialCount,
                    waitingGradingCount
            );
        }
    }
}
