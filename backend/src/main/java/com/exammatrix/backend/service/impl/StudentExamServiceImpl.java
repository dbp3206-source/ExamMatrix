package com.exammatrix.backend.service.impl;

import com.exammatrix.backend.dto.request.SaveAttemptAnswerRequest;
import com.exammatrix.backend.dto.response.*;
import com.exammatrix.backend.entity.*;
import com.exammatrix.backend.entity.enums.*;
import com.exammatrix.backend.repository.*;
import com.exammatrix.backend.security.CurrentUserService;
import com.exammatrix.backend.service.ScoreScaleService;
import com.exammatrix.backend.service.StudentExamService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class StudentExamServiceImpl implements StudentExamService {
    private final ExamPaperRepository examPaperRepository;
    private final StudentExamAttemptRepository attemptRepository;
    private final StudentAttemptAnswerRepository attemptAnswerRepository;
    private final StudentTeacherAssignmentRepository assignmentRepository;
    private final QuestionRepository questionRepository;
    private final AnswerRepository answerRepository;
    private final CurrentUserService currentUserService;
    private final ScoreScaleService scoreScaleService;

    @Override
    public PageResponse<StudentExamSummaryResponse> getAccessibleExams(Pageable pageable) {
        return getAccessibleExams(null, null, "publishedAt", "desc", pageable);
    }

    @Override
    public PageResponse<StudentExamSummaryResponse> getAccessibleExams(
            Integer subjectId,
            String search,
            String sortBy,
            String sortDir,
            Pageable pageable
    ) {
        User student = currentUserService.getCurrentUser();
        String normalizedSearch = search == null ? "" : search.trim();
        String normalizedField = switch (sortBy == null ? "publishedAt" : sortBy.trim()) {
            case "title" -> "title";
            case "examCode" -> "examCode";
            case "duration" -> "duration";
            default -> "publishedAt";
        };
        String normalizedDir = "asc".equalsIgnoreCase(sortDir) ? "asc" : "desc";
        String sortKey = normalizedField + "_" + normalizedDir;

        Page<ExamPaper> paperPage = examPaperRepository.searchAccessiblePapersForStudent(
                student.getId(), subjectId, normalizedSearch, sortKey, pageable);

        List<StudentExamSummaryResponse> responses = paperPage.getContent().stream()
                .map(paper -> {
                    Optional<StudentExamAttempt> attemptOpt = attemptRepository
                            .findByStudent_IdAndExamPaper_Id(student.getId(), paper.getId());

                    AttemptStatus attemptStatus = attemptOpt.map(StudentExamAttempt::getStatus).orElse(null);
                    UUID attemptId = attemptOpt.map(StudentExamAttempt::getId).orElse(null);
                    BigDecimal scoreOnTen = attemptOpt
                            .filter(a -> a.getStatus() == AttemptStatus.COMPLETED)
                            .map(a -> scoreScaleService.normalizeToTen(a.getScore(), a.getMaxScore(), a.getScoreOnTen()))
                            .orElse(null);

                    ExamMatrix matrix = paper.getExamMatrix();
                    return StudentExamSummaryResponse.builder()
                            .paperId(paper.getId())
                            .examCode(paper.getExamCode())
                            .title(matrix.getTitle())
                            .teacherName(matrix.getTeacher().getFullName())
                            .subjectId(matrix.getSubject().getId())
                            .subjectName(matrix.getSubject().getName())
                            .examType(matrix.getExamType())
                            .duration(matrix.getDuration())
                            .totalQuestions(paper.getPaperQuestions().size())
                            .accessType(paper.getAccessType())
                            .attemptStatus(attemptStatus)
                            .attemptId(attemptId)
                            .scoreOnTen(scoreOnTen)
                            .publishedAt(paper.getPublishedAt() != null ? paper.getPublishedAt() : paper.getCreatedAt())
                            .createdAt(paper.getCreatedAt())
                            .build();
                })
                .toList();

        return new PageResponse<>(
                responses,
                paperPage.getNumber(),
                paperPage.getSize(),
                paperPage.getTotalElements(),
                paperPage.getTotalPages()
        );
    }

    @Override
    public List<StudentSubjectExamCountResponse> getAccessibleExamSubjectCounts() {
        User student = currentUserService.getCurrentUser();
        return examPaperRepository.countAccessiblePapersBySubjectForStudent(student.getId())
                .stream()
                .map(row -> new StudentSubjectExamCountResponse(
                        ((Number) row[0]).intValue(),
                        (String) row[1],
                        (String) row[2],
                        ((Number) row[3]).longValue()
                ))
                .toList();
    }

    @Override
    public StudentExamDetailResponse getExamDetail(UUID paperId) {
        User student = currentUserService.getCurrentUser();
        ExamPaper paper = findExamPaperById(paperId);

        verifyStudentAccess(student, paper);

        ExamMatrix matrix = paper.getExamMatrix();
        List<StudentQuestionResponse> questions = paper.getPaperQuestions().stream()
                .sorted(Comparator.comparing(PaperQuestion::getQuestionOrder))
                .map(pq -> {
                    Question q = pq.getQuestion();
                    List<StudentAnswerChoiceResponse> answerChoices = PaperAnswerOrderHelper
                            .orderAnswersForPaper(paper.getId(), q)
                            .stream()
                            .map(a -> new StudentAnswerChoiceResponse(a.getId(), a.getContent()))
                            .toList();

                    return StudentQuestionResponse.builder()
                            .id(q.getId())
                            .questionOrder(pq.getQuestionOrder())
                            .content(q.getContent())
                            .type(q.getType())
                            .difficulty(q.getDifficulty())
                            .points(pq.getPoints())
                            .answers(answerChoices)
                            .build();
                })
                .toList();

        return StudentExamDetailResponse.builder()
                .paperId(paper.getId())
                .examCode(paper.getExamCode())
                .title(matrix.getTitle())
                .subjectName(matrix.getSubject().getName())
                .examType(matrix.getExamType())
                .duration(matrix.getDuration())
                .totalQuestions(questions.size())
                .teacherName(matrix.getTeacher().getFullName())
                .accessType(paper.getAccessType())
                .questions(questions)
                .build();
    }

    @Override
    @Transactional(noRollbackFor = ResponseStatusException.class)
    public StartAttemptResponse startAttempt(UUID paperId) {
        User student = currentUserService.getCurrentUserForUpdate();
        ExamPaper paper = examPaperRepository.findByIdForAttemptStart(paperId).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy đề thi"));

        verifyStudentAccess(student, paper);

        ExamMatrix matrix = paper.getExamMatrix();
        int durationMinutes = matrix.getDuration();

        Optional<StudentExamAttempt> existingOpt = attemptRepository
                .findForStart(student.getId(), paper.getId());

        if (existingOpt.isPresent()) {
            StudentExamAttempt existing = existingOpt.get();
            if (existing.getStatus() == AttemptStatus.IN_PROGRESS) {
                long elapsed = Duration.between(existing.getStartedAt(), LocalDateTime.now()).getSeconds();
                long remaining = Math.max(0, (durationMinutes * 60L) - elapsed);
                if (remaining <= 0) {
                    submitInternal(existing);
                    throw new ResponseStatusException(HttpStatus.CONFLICT, "Đã hết thời gian làm bài thi");
                }
                return StartAttemptResponse.builder()
                        .attemptId(existing.getId())
                        .startedAt(existing.getStartedAt())
                        .durationMinutes(durationMinutes)
                        .remainingSeconds(remaining)
                        .status(existing.getStatus())
                        .build();
            } else if (existing.getStatus() == AttemptStatus.CANCELLED) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Lượt làm bài đã bị hủy");
            } else {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Bạn đã hoàn thành bài thi này và không thể làm lại");
            }
        }

        BigDecimal maxScore = paper.getPaperQuestions().stream()
                .map(PaperQuestion::getPoints)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        TeacherClass snapshotClass = null;
        if (paper.getAccessType() == ExamAccessType.PRIVATE) {
            snapshotClass = assignmentRepository
                    .findFirstByStudent_IdAndTeacher_IdAndStatusOrderByReviewedAtDesc(
                            student.getId(),
                            matrix.getTeacher().getId(),
                            StudentAssignmentStatus.APPROVED
                    )
                    .map(StudentTeacherAssignment::getTeacherClass)
                    .orElse(null);
        }

        StudentExamAttempt attempt = StudentExamAttempt.builder()
                .examPaper(paper)
                .student(student)
                .teacher(matrix.getTeacher())
                .teacherClass(snapshotClass)
                .status(AttemptStatus.IN_PROGRESS)
                .startedAt(LocalDateTime.now())
                .maxScore(maxScore.compareTo(BigDecimal.ZERO) > 0 ? maxScore : BigDecimal.valueOf(10))
                .build();

        StudentExamAttempt saved = attemptRepository.save(attempt);

        return StartAttemptResponse.builder()
                .attemptId(saved.getId())
                .startedAt(saved.getStartedAt())
                .durationMinutes(durationMinutes)
                .remainingSeconds(durationMinutes * 60L)
                .status(saved.getStatus())
                .build();
    }

    @Override
    @Transactional(noRollbackFor = ResponseStatusException.class)
    public void saveAnswer(UUID attemptId, SaveAttemptAnswerRequest request) {
        User student = currentUserService.getCurrentUser();
        StudentExamAttempt attempt = attemptRepository.findByIdForUpdate(attemptId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy lượt làm bài"));

        if (!attempt.getStudent().getId().equals(student.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bạn không có quyền chỉnh sửa bài làm của người khác");
        }

        if (attempt.getStatus() == AttemptStatus.CANCELLED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Lượt làm bài đã bị hủy, không thể sửa câu trả lời");
        }
        if (attempt.getStatus() != AttemptStatus.IN_PROGRESS) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Bài thi đã nộp, không thể sửa câu trả lời");
        }

        int durationMinutes = attempt.getExamPaper().getExamMatrix().getDuration();
        long elapsedSeconds = Duration.between(attempt.getStartedAt(), LocalDateTime.now()).getSeconds();
        if (elapsedSeconds >= (durationMinutes * 60L)) {
            submitInternal(attempt);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Đã hết thời gian làm bài thi");
        }

        Question question = questionRepository.findById(request.getQuestionId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy câu hỏi"));

        boolean belongsToPaper = attempt.getExamPaper().getPaperQuestions().stream()
                .anyMatch(pq -> pq.getQuestion().getId().equals(question.getId()));
        if (!belongsToPaper) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Câu hỏi không thuộc đề thi này");
        }

        StudentAttemptAnswer answer = attemptAnswerRepository
                .findByAttempt_IdAndQuestion_Id(attempt.getId(), question.getId())
                .orElseGet(() -> StudentAttemptAnswer.builder()
                        .attempt(attempt)
                        .question(question)
                        .build()
                );

        List<UUID> selectedAnswerIds = request.getSelectedAnswerIds();
        if (question.getType() == QuestionType.ESSAY) {
            if (selectedAnswerIds != null && !selectedAnswerIds.isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Câu tự luận không có đáp án lựa chọn");
            }
            answer.setEssayAnswer(request.getEssayAnswer());
            answer.getChoices().clear();
        } else {
            if (request.getEssayAnswer() != null && !request.getEssayAnswer().isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Câu trắc nghiệm chỉ nhận đáp án lựa chọn");
            }
            List<Answer> selected = List.of();
            if (selectedAnswerIds != null && !selectedAnswerIds.isEmpty()) {
                Set<UUID> uniqueIds = new LinkedHashSet<>(selectedAnswerIds);
                if (uniqueIds.contains(null)) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "ID đáp án không được để trống");
                }
                if ((question.getType() == QuestionType.SINGLE_CHOICE || question.getType() == QuestionType.TRUE_FALSE)
                        && uniqueIds.size() > 1) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Câu hỏi này chỉ được chọn tối đa 1 đáp án");
                }
                selected = answerRepository.findAllById(uniqueIds);
                if (selected.size() != uniqueIds.size()) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Có đáp án không tồn tại");
                }
                boolean allBelongToQuestion = selected.stream()
                        .allMatch(a -> a.getQuestion() != null && a.getQuestion().getId().equals(question.getId()));
                if (!allBelongToQuestion) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Đáp án không thuộc câu hỏi này");
                }
            }
            answer.setEssayAnswer(null);
            answer.getChoices().clear();
            answer.getChoices().addAll(selected);
        }

        attemptAnswerRepository.save(answer);
    }

    @Override
    @Transactional
    public StudentAttemptResultResponse submitAttempt(UUID attemptId) {
        User student = currentUserService.getCurrentUser();
        StudentExamAttempt attempt = attemptRepository.findByIdForUpdate(attemptId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy lượt làm bài"));

        if (!attempt.getStudent().getId().equals(student.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bạn không có quyền nộp bài thi của người khác");
        }

        if (attempt.getStatus() == AttemptStatus.CANCELLED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Lượt làm bài đã bị hủy");
        }
        if (attempt.getStatus() != AttemptStatus.IN_PROGRESS) {
            return toResultResponse(attempt);
        }

        submitInternal(attempt);
        return toResultResponse(attempt);
    }

    @Override
    public StudentAttemptResultResponse getAttemptResult(UUID attemptId) {
        User currentUser = currentUserService.getCurrentUser();
        StudentExamAttempt attempt = attemptRepository.findById(attemptId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy kết quả bài thi"));

        boolean isStudent = "STUDENT".equalsIgnoreCase(currentUser.getRole().getName());
        boolean isOwnerTeacher = attempt.getTeacher().getId().equals(currentUser.getId());
        boolean isAdmin = com.exammatrix.backend.security.RolePolicy.isContentStaff(currentUser);

        if (isStudent && !attempt.getStudent().getId().equals(currentUser.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bạn không có quyền xem kết quả của sinh viên khác");
        }

        if (!isStudent && !isOwnerTeacher && !isAdmin) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bạn không có quyền xem kết quả này");
        }

        return toResultResponse(attempt);
    }

    private void submitInternal(StudentExamAttempt attempt) {
        attempt.setSubmittedAt(LocalDateTime.now());
        ExamPaper paper = attempt.getExamPaper();

        Map<UUID, StudentAttemptAnswer> existingAnswers = attemptAnswerRepository
                .findByAttempt_Id(attempt.getId())
                .stream()
                .collect(Collectors.toMap(a -> a.getQuestion().getId(), a -> a));

        boolean hasEssay = false;
        BigDecimal totalScore = BigDecimal.ZERO;
        int objectiveCount = 0;
        int correctCount = 0;

        for (PaperQuestion pq : paper.getPaperQuestions()) {
            Question q = pq.getQuestion();
            StudentAttemptAnswer answer = existingAnswers.get(q.getId());
            if (answer == null) {
                answer = StudentAttemptAnswer.builder()
                        .attempt(attempt)
                        .question(q)
                        .build();
            }

            if (q.getType() == QuestionType.ESSAY) {
                hasEssay = true;
                answer.setIsCorrect(null);
                answer.setAwardedScore(null);
            } else {
                objectiveCount++;
                Set<UUID> correctIds = q.getAnswers().stream()
                        .filter(a -> Boolean.TRUE.equals(a.getIsCorrect()))
                        .map(Answer::getId)
                        .collect(Collectors.toSet());

                Set<UUID> selectedIds = answer.getChoices().stream()
                        .map(Answer::getId)
                        .collect(Collectors.toSet());

                boolean correct = !correctIds.isEmpty() && correctIds.equals(selectedIds);
                if (correct) {
                    correctCount++;
                }
                answer.setIsCorrect(correct);
                BigDecimal scoreForQuestion = correct ? pq.getPoints() : BigDecimal.ZERO;
                answer.setAwardedScore(scoreForQuestion);
                totalScore = totalScore.add(scoreForQuestion);
            }

            attemptAnswerRepository.save(answer);
        }

        if (hasEssay) {
            attempt.setStatus(AttemptStatus.WAITING_GRADING);
            attempt.setScore(null);
            attempt.setScoreOnTen(null);
        } else {
            BigDecimal scoreOnTen = scoreScaleService.calculateObjectiveScoreOnTen(correctCount, objectiveCount);
            attempt.setStatus(AttemptStatus.COMPLETED);
            attempt.setScoreOnTen(scoreOnTen);
            if (attempt.getMaxScore() != null && attempt.getMaxScore().compareTo(ScoreScaleService.SCALE_MAX) == 0) {
                attempt.setScore(scoreOnTen);
            } else {
                attempt.setScore(totalScore);
            }
            attempt.setGradedAt(LocalDateTime.now());
        }

        attemptRepository.save(attempt);
    }

    @Transactional
    public void finalizeExpiredAttempt(UUID attemptId, LocalDateTime now) {
        attemptRepository.findByIdForUpdate(attemptId).ifPresent(attempt -> {
            if (attempt.getStatus() == AttemptStatus.IN_PROGRESS && !attempt.getStartedAt()
                    .plusMinutes(attempt.getExamPaper().getExamMatrix().getDuration()).isAfter(now)) {
                submitInternal(attempt);
            }
        });
    }

    private void verifyStudentAccess(User student, ExamPaper paper) {
        if (!Boolean.TRUE.equals(paper.getIsPublished())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Đề thi hiện chưa được phát hành");
        }

        if (paper.getAccessType() == ExamAccessType.PRIVATE) {
            UUID teacherId = paper.getExamMatrix().getTeacher().getId();
            boolean isApproved = assignmentRepository.existsByStudent_IdAndTeacher_IdAndStatus(
                    student.getId(),
                    teacherId,
                    StudentAssignmentStatus.APPROVED
            );
            if (!isApproved) {
                throw new ResponseStatusException(
                        HttpStatus.FORBIDDEN,
                        "Đề thi này yêu cầu tham gia lớp học của giáo viên sở hữu đề"
                );
            }
        }
    }

    private ExamPaper findExamPaperById(UUID paperId) {
        return examPaperRepository.findById(paperId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy đề thi"));
    }

    private StudentAttemptResultResponse toResultResponse(StudentExamAttempt attempt) {
        ExamPaper paper = attempt.getExamPaper();
        ExamMatrix matrix = paper.getExamMatrix();

        Map<UUID, PaperQuestion> pqMap = paper.getPaperQuestions().stream()
                .collect(Collectors.toMap(pq -> pq.getQuestion().getId(), pq -> pq));

        List<StudentAttemptAnswer> answerList = attemptAnswerRepository.findByAttempt_Id(attempt.getId());

        List<StudentAttemptAnswerDetailResponse> answerResponses = answerList.stream()
                .sorted(Comparator.comparing(a -> {
                    PaperQuestion pq = pqMap.get(a.getQuestion().getId());
                    return pq != null ? pq.getQuestionOrder() : 999;
                }))
                .map(a -> {
                    PaperQuestion pq = pqMap.get(a.getQuestion().getId());
                    int order = pq != null ? pq.getQuestionOrder() : 0;
                    BigDecimal maxPts = pq != null ? pq.getPoints() : BigDecimal.ONE;

                    List<UUID> selectedIds = a.getChoices().stream()
                            .map(Answer::getId)
                            .toList();

                    return StudentAttemptAnswerDetailResponse.builder()
                            .attemptAnswerId(a.getId())
                            .questionId(a.getQuestion().getId())
                            .questionOrder(order)
                            .content(a.getQuestion().getContent())
                            .type(a.getQuestion().getType())
                            .maxScore(maxPts)
                            .selectedAnswerIds(selectedIds)
                            .essayAnswer(a.getEssayAnswer())
                            .awardedScore(attempt.getStatus() == AttemptStatus.COMPLETED ? a.getAwardedScore() : null)
                            .feedback(attempt.getStatus() == AttemptStatus.COMPLETED ? a.getFeedback() : null)
                            .isCorrect(attempt.getStatus() == AttemptStatus.COMPLETED ? a.getIsCorrect() : null)
                            .build();
                })
                .toList();

        int correctCount = (int) answerList.stream()
                .filter(a -> Boolean.TRUE.equals(a.getIsCorrect()))
                .count();
        BigDecimal scoreOnTen = attempt.getStatus() == AttemptStatus.COMPLETED
                ? scoreScaleService.normalizeToTen(attempt.getScore(), attempt.getMaxScore(), attempt.getScoreOnTen())
                : null;

        return StudentAttemptResultResponse.builder()
                .attemptId(attempt.getId())
                .paperId(paper.getId())
                .examCode(paper.getExamCode())
                .paperTitle(matrix.getTitle())
                .subjectName(matrix.getSubject().getName())
                .examType(matrix.getExamType())
                .status(attempt.getStatus())
                .score(attempt.getStatus() == AttemptStatus.COMPLETED ? attempt.getScore() : null)
                .maxScore(attempt.getMaxScore())
                .scoreOnTen(scoreOnTen)
                .correctCount(attempt.getStatus() == AttemptStatus.COMPLETED ? correctCount : null)
                .totalQuestions(paper.getPaperQuestions().size())
                .startedAt(attempt.getStartedAt())
                .submittedAt(attempt.getSubmittedAt())
                .gradedAt(attempt.getGradedAt())
                .answers(answerResponses)
                .build();
    }
}
