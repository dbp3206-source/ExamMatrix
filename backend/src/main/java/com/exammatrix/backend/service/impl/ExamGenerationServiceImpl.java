package com.exammatrix.backend.service.impl;

import com.exammatrix.backend.dto.request.AdviceAdjustmentRequest;
import com.exammatrix.backend.dto.request.GenerateExamPapersRequest;
import com.exammatrix.backend.dto.response.AnswerResponse;
import com.exammatrix.backend.dto.response.ExamPaperDetailResponse;
import com.exammatrix.backend.dto.response.GenerationAdviceResponse;
import com.exammatrix.backend.dto.response.PaperQuestionResponse;
import com.exammatrix.backend.entity.*;
import com.exammatrix.backend.entity.enums.Difficulty;
import com.exammatrix.backend.entity.enums.ExamType;
import com.exammatrix.backend.entity.enums.ExamAccessType;
import com.exammatrix.backend.entity.enums.QuestionType;
import com.exammatrix.backend.repository.ExamGenerationRequestRepository;
import com.exammatrix.backend.repository.ExamMatrixRepository;
import com.exammatrix.backend.repository.ExamPaperRepository;
import com.exammatrix.backend.repository.QuestionRepository;
import com.exammatrix.backend.security.CurrentUserService;
import com.exammatrix.backend.service.ExamGenerationService;
import com.exammatrix.backend.service.GenerationAdviceService;
import com.exammatrix.backend.service.ScoreScaleService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.security.SecureRandom;
import java.util.*;

@Service
@RequiredArgsConstructor
public class ExamGenerationServiceImpl implements ExamGenerationService {
    private final ExamPaperRepository examPaperRepository;
    private final ExamMatrixRepository examMatrixRepository;
    private final QuestionRepository questionRepository;
    private final ExamGenerationRequestRepository generationRequestRepository;
    private final CurrentUserService currentUserService;
    private final GenerationAdviceService generationAdviceService;

    private final SecureRandom secureRandom = new SecureRandom();
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final ScoreScaleService scoreScaleService = new ScoreScaleService();

    private record EffectiveSlot(Chapter chapter, Difficulty difficulty, int quantity) {}

    private static final List<QuestionType> OBJECTIVE_TYPES = List.of(
            QuestionType.SINGLE_CHOICE,
            QuestionType.MULTIPLE_CHOICE,
            QuestionType.TRUE_FALSE
    );

    private static final List<QuestionType> ESSAY_TYPES = List.of(
            QuestionType.ESSAY
    );

    @Override
    @Transactional
    public List<ExamPaperDetailResponse> generateExamPapers(
            UUID matrixId,
            GenerateExamPapersRequest request
    ) {
        User currentUser = currentUserService.getCurrentUser();

        ExamMatrix matrix = examMatrixRepository.findByIdForUpdate(matrixId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Không tìm thấy ma trận có ID " + matrixId
                ));

        checkCanAccess(matrix, currentUser);

        if (request == null || request.getNumberOfPapers() == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Số mã đề không được để trống"
            );
        }

        final int numberOfPapers;
        try {
            numberOfPapers = request.getNumberOfPapers().intValueExact();
        } catch (ArithmeticException exception) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Số mã đề phải là số nguyên từ 1 đến 20"
            );
        }

        if (numberOfPapers < 1 || numberOfPapers > 20) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Số mã đề phải từ 1 đến 20"
            );
        }
        UUID requestId = request.getRequestId();
        if (requestId != null) {
            Optional<ExamGenerationRequest> previousRequest = generationRequestRepository
                    .findByExamMatrix_IdAndRequestId(matrixId, requestId);
            List<ExamPaper> previous = examPaperRepository
                    .findByExamMatrix_IdAndGenerationRequestIdOrderByCreatedAtAscIdAsc(matrixId, requestId);
            if (previousRequest.isPresent() || !previous.isEmpty()) {
                int originalCount = previousRequest.map(ExamGenerationRequest::getNumberOfPapers)
                        .orElse(previous.size());
                if (originalCount != numberOfPapers) {
                    throw new ResponseStatusException(HttpStatus.CONFLICT, "Yêu cầu sinh đề đã được dùng với bộ mã khác");
                }
                if (previous.size() != originalCount) {
                    throw new ResponseStatusException(HttpStatus.CONFLICT,
                            "Bộ mã đề đã bị xóa một phần hoặc toàn bộ. Hãy gửi yêu cầu mới nếu muốn sinh lại");
                }
                if (previousRequest.isEmpty()) {
                    generationRequestRepository.save(new ExamGenerationRequest(matrix, requestId, originalCount));
                }
                return previous.stream().map(this::convertToResponse).toList();
            }
        }
        List<EffectiveSlot> effectiveSlots = resolveEffectiveSlots(matrix, numberOfPapers, request);
        List<List<Question>> candidatePools = loadCandidatePools(matrix, effectiveSlots);
        List<ExamPaper> generatedPapers = new ArrayList<>();
        Set<String> codesInCurrentRequest = new HashSet<>();

        for (int index = 0; index < numberOfPapers; index++) {
            List<Question> selectedQuestions = selectQuestionsForPaper(matrix, effectiveSlots, candidatePools);

            ExamPaper paper = new ExamPaper();
            paper.setExamMatrix(matrix);
            paper.setGenerationRequestId(requestId);
            paper.setExamCode(generateExamCode(matrix.getId(), codesInCurrentRequest));
            paper.setAccessType(ExamAccessType.PRIVATE);
            paper.setIsPublished(false);

            List<BigDecimal> distributedPoints = scoreScaleService.distributeEqualTenPoints(selectedQuestions.size());
            for (int qIndex = 0; qIndex < selectedQuestions.size(); qIndex++) {
                Question question = selectedQuestions.get(qIndex);

                PaperQuestion paperQuestion = new PaperQuestion();
                paperQuestion.setQuestion(question);
                paperQuestion.setQuestionOrder(qIndex + 1);
                BigDecimal pts = qIndex < distributedPoints.size() ? distributedPoints.get(qIndex) : BigDecimal.ONE;
                paperQuestion.setPoints(pts);

                paper.addPaperQuestion(paperQuestion);
            }

            ExamPaper savedPaper = examPaperRepository.save(paper);
            generatedPapers.add(savedPaper);
        }

        if (requestId != null) {
            String allocationSnapshotJson = serializeAllocationSnapshot(effectiveSlots, matrix.getTotalQuestions());
            generationRequestRepository.save(new ExamGenerationRequest(matrix, requestId, numberOfPapers, allocationSnapshotJson));
        }
        examPaperRepository.flush();

        List<ExamPaperDetailResponse> responses = new ArrayList<>();
        for (ExamPaper paper : generatedPapers) {
            responses.add(convertToResponse(paper));
        }

        return responses;
    }

    private List<EffectiveSlot> resolveEffectiveSlots(
            ExamMatrix matrix,
            int numberOfPapers,
            GenerateExamPapersRequest request
    ) {
        List<EffectiveSlot> baseSlots = matrix.getConfigs().stream()
                .map(c -> new EffectiveSlot(c.getChapter(), c.getDifficulty(), c.getQuantity()))
                .toList();

        AdviceAdjustmentRequest adjustment = request.getAdviceAdjustment();
        if (adjustment == null) {
            return baseSlots;
        }

        if (generationAdviceService == null) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Dịch vụ đối chiếu gợi ý chưa sẵn sàng trong giao dịch sinh đề"
            );
        }

        GenerationAdviceResponse freshAdvice = generationAdviceService.evaluateForLockedMatrix(matrix, numberOfPapers);
        if (request.getSnapshotVersion() == null
                || !request.getSnapshotVersion().equals(freshAdvice.snapshotVersion())) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Dữ liệu ma trận, ngân hàng câu hỏi hoặc kết quả lớp đã thay đổi trong lúc mở gợi ý. Vui lòng làm mới đề xuất trước khi sinh đề."
            );
        }

        if (!freshAdvice.recommended()
                || freshAdvice.increaseCell() == null
                || freshAdvice.decreaseCell() == null) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Đề xuất điều chỉnh không còn hiệu lực theo dữ liệu hiện tại. Vui lòng kiểm tra lại trước khi sinh đề."
            );
        }

        boolean matchesProposal = Objects.equals(adjustment.getIncreaseChapterId(), freshAdvice.increaseCell().chapterId())
                && Objects.equals(adjustment.getDecreaseChapterId(), freshAdvice.decreaseCell().chapterId())
                && adjustment.getDifficulty() == freshAdvice.increaseCell().difficulty()
                && adjustment.getDifficulty() == freshAdvice.decreaseCell().difficulty();

        if (!matchesProposal) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Phương án điều chỉnh gửi lên không khớp đề xuất mới nhất từ máy chủ. Vui lòng tải lại gợi ý."
            );
        }

        List<EffectiveSlot> adjusted = new ArrayList<>(baseSlots.size());
        boolean increased = false;
        boolean decreased = false;
        for (EffectiveSlot slot : baseSlots) {
            if (slot.difficulty() == adjustment.getDifficulty()
                    && Objects.equals(slot.chapter().getId(), adjustment.getIncreaseChapterId())) {
                adjusted.add(new EffectiveSlot(slot.chapter(), slot.difficulty(), slot.quantity() + 1));
                increased = true;
            } else if (slot.difficulty() == adjustment.getDifficulty()
                    && Objects.equals(slot.chapter().getId(), adjustment.getDecreaseChapterId())) {
                if (slot.quantity() < 2) {
                    throw new ResponseStatusException(
                            HttpStatus.CONFLICT,
                            "Ô giảm không còn đạt mức sàn tối thiểu (≥ 2 câu) để chuyển 1 câu"
                    );
                }
                adjusted.add(new EffectiveSlot(slot.chapter(), slot.difficulty(), slot.quantity() - 1));
                decreased = true;
            } else {
                adjusted.add(slot);
            }
        }

        if (!increased || !decreased) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Không tìm thấy đủ hai ô tăng/giảm tương ứng trong ma trận hiện tại"
            );
        }
        return adjusted;
    }

    private String serializeAllocationSnapshot(List<EffectiveSlot> slots, int totalQuestions) {
        try {
            List<GenerationAdviceResponse.AllocationCell> cells = slots.stream()
                    .map(s -> new GenerationAdviceResponse.AllocationCell(
                            s.chapter().getId(),
                            s.chapter().getName(),
                            s.difficulty(),
                            s.quantity(),
                            totalQuestions > 0 ? Math.round(s.quantity() * 1000.0 / totalQuestions) / 10.0 : 0.0
                    ))
                    .toList();
            return objectMapper.writeValueAsString(cells);
        } catch (Exception ignored) {
            return null;
        }
    }

    private List<List<Question>> loadCandidatePools(ExamMatrix matrix, List<EffectiveSlot> slots) {
        List<List<Question>> pools = new ArrayList<>();

        ExamType examType = matrix.getExamType() != null ? matrix.getExamType() : ExamType.OBJECTIVE;
        List<QuestionType> allowedTypes = (examType == ExamType.ESSAY) ? ESSAY_TYPES : OBJECTIVE_TYPES;

        for (EffectiveSlot slot : slots) {
            List<Question> candidates = questionRepository.findAllByChapter_IdAndDifficultyAndTypeIn(
                            slot.chapter().getId(),
                            slot.difficulty(),
                            allowedTypes
                    );

            if (candidates.size() < slot.quantity()) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "Chương " + slot.chapter().getName()
                                + " không đủ câu hỏi " + examType
                                + " mức " + slot.difficulty()
                );
            }
            pools.add(candidates);
        }
        return pools;
    }

    private List<Question> selectQuestionsForPaper(
            ExamMatrix matrix,
            List<EffectiveSlot> slots,
            List<List<Question>> candidatePools
    ) {
        List<Question> selectedQuestions = new ArrayList<>();
        Set<UUID> selectedQuestionIds = new HashSet<>();
        int poolIndex = 0;
        for (EffectiveSlot slot : slots) {
            List<Question> candidates = new ArrayList<>(candidatePools.get(poolIndex++));
            Collections.shuffle(candidates, secureRandom);

            int added = 0;
            for (Question candidate : candidates) {
                if (selectedQuestionIds.add(candidate.getId())) {
                    selectedQuestions.add(candidate);
                    added++;
                }

                if (added == slot.quantity()) {
                    break;
                }
            }

            if (added < slot.quantity()) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "Không chọn đủ câu hỏi không trùng lặp cho cấu hình ma trận"
                );
            }
        }

        if (selectedQuestions.size() != matrix.getTotalQuestions()) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Số câu chọn được không bằng tổng số câu ma trận yêu cầu"
            );
        }

        Collections.shuffle(selectedQuestions, secureRandom);

        return selectedQuestions;
    }

    private String generateExamCode(UUID matrixId, Set<String> codesInCurrentRequest) {
        for (int attempt = 0; attempt < 100; attempt++) {
            String code = String.format(
                    Locale.ROOT,
                    "%06d",
                    secureRandom.nextInt(1_000_000)
            );

            boolean alreadyUsed = codesInCurrentRequest.contains(code)
                    || examPaperRepository.existsByExamMatrix_IdAndExamCode(matrixId, code);

            if (!alreadyUsed) {
                codesInCurrentRequest.add(code);
                return code;
            }
        }

        throw new ResponseStatusException(
                HttpStatus.CONFLICT,
                "Không thể tạo mã đề duy nhất"
        );
    }

    private void checkCanAccess(ExamMatrix matrix, User currentUser) {
        if (isAdmin(currentUser)) {
            return;
        }

        boolean isTeacherOwner = "TEACHER".equalsIgnoreCase(currentUser.getRole().getName())
                && matrix.getTeacher().getId().equals(currentUser.getId());

        if (!isTeacherOwner) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Bạn không có quyền sinh đề cho ma trận này"
            );
        }
    }

    private boolean isAdmin(User user) {
        return com.exammatrix.backend.security.RolePolicy.isContentStaff(user);
    }

    private ExamPaperDetailResponse convertToResponse(ExamPaper paper) {
        List<PaperQuestion> sortedQuestions = new ArrayList<>(paper.getPaperQuestions());
        sortedQuestions.sort(Comparator.comparing(PaperQuestion::getQuestionOrder));

        List<PaperQuestionResponse> questionResponses = new ArrayList<>();

        for (PaperQuestion paperQuestion : sortedQuestions) {
            Question question = paperQuestion.getQuestion();
            boolean isEssay = question.getType() == QuestionType.ESSAY;

            List<AnswerResponse> answerResponses = new ArrayList<>();
            String referenceAnswer = null;

            if (isEssay) {
                referenceAnswer = question.getReferenceAnswer();
            } else {
                List<Answer> answers = PaperAnswerOrderHelper.orderAnswersForPaper(paper.getId(), question);

                for (Answer answer : answers) {
                    answerResponses.add(new AnswerResponse(
                            answer.getId(),
                            answer.getContent(),
                            answer.getIsCorrect()
                    ));
                }
            }

            BigDecimal points = paperQuestion.getPoints() != null ? paperQuestion.getPoints() : BigDecimal.ONE;
            questionResponses.add(new PaperQuestionResponse(
                    question.getId(),
                    paperQuestion.getQuestionOrder(),
                    question.getContent(),
                    question.getType(),
                    question.getDifficulty(),
                    answerResponses,
                    referenceAnswer,
                    points
            ));
        }

        return new ExamPaperDetailResponse(
                paper.getId(),
                paper.getExamMatrix().getId(),
                paper.getExamCode(),
                paper.getAccessType(),
                paper.getIsPublished(),
                paper.getCreatedAt(),
                questionResponses
        );
    }
}
