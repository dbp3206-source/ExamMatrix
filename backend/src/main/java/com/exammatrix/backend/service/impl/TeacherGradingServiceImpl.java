package com.exammatrix.backend.service.impl;

import com.exammatrix.backend.dto.request.CompleteGradingRequest;
import com.exammatrix.backend.dto.request.GradeAnswerRequest;
import com.exammatrix.backend.dto.response.*;
import com.exammatrix.backend.entity.*;
import com.exammatrix.backend.entity.enums.AttemptStatus;
import com.exammatrix.backend.entity.enums.QuestionType;
import com.exammatrix.backend.repository.StudentAttemptAnswerRepository;
import com.exammatrix.backend.repository.StudentExamAttemptRepository;
import com.exammatrix.backend.security.CurrentUserService;
import com.exammatrix.backend.service.TeacherGradingService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class TeacherGradingServiceImpl implements TeacherGradingService {
    private final StudentExamAttemptRepository attemptRepository;
    private final StudentAttemptAnswerRepository attemptAnswerRepository;
    private final CurrentUserService currentUserService;

    @Override
    public PageResponse<PendingGradingSummaryResponse> getPendingGrading(Pageable pageable) {
        User currentUser = currentUserService.getCurrentUser();
        boolean isAdmin = "ADMIN".equalsIgnoreCase(currentUser.getRole().getName());

        Page<StudentExamAttempt> page = isAdmin
                ? attemptRepository.findByStatus(AttemptStatus.WAITING_GRADING, pageable)
                : attemptRepository.findByTeacher_IdAndStatus(currentUser.getId(), AttemptStatus.WAITING_GRADING, pageable);

        List<PendingGradingSummaryResponse> responses = page.getContent().stream()
                .map(attempt -> PendingGradingSummaryResponse.builder()
                        .attemptId(attempt.getId())
                        .paperId(attempt.getExamPaper().getId())
                        .paperTitle(attempt.getExamPaper().getExamMatrix().getTitle())
                        .studentId(attempt.getStudent().getId())
                        .studentName(attempt.getStudent().getFullName())
                        .studentEmail(attempt.getStudent().getEmail())
                        .submittedAt(attempt.getSubmittedAt())
                        .status(attempt.getStatus())
                        .examType(attempt.getExamPaper().getExamMatrix().getExamType())
                        .build())
                .toList();

        return new PageResponse<>(
                responses,
                page.getNumber(),
                page.getSize(),
                page.getTotalElements(),
                page.getTotalPages()
        );
    }

    @Override
    public GradingAttemptDetailResponse getGradingAttempt(UUID attemptId) {
        User currentUser = currentUserService.getCurrentUser();
        StudentExamAttempt attempt = findAttemptAndVerifyTeacherAccess(attemptId, currentUser);

        ExamPaper paper = attempt.getExamPaper();
        ExamMatrix matrix = paper.getExamMatrix();

        Map<UUID, PaperQuestion> pqMap = paper.getPaperQuestions().stream()
                .collect(Collectors.toMap(pq -> pq.getQuestion().getId(), pq -> pq));

        List<StudentAttemptAnswer> answerList = attemptAnswerRepository.findByAttempt_Id(attempt.getId());
        Map<UUID, StudentAttemptAnswer> answerMap = answerList.stream()
                .collect(Collectors.toMap(a -> a.getQuestion().getId(), a -> a));

        List<GradingQuestionAnswerResponse> answers = paper.getPaperQuestions().stream()
                .sorted(Comparator.comparing(PaperQuestion::getQuestionOrder))
                .map(pq -> {
                    Question q = pq.getQuestion();
                    StudentAttemptAnswer a = answerMap.get(q.getId());

                    List<UUID> selectedChoices = a != null
                            ? a.getChoices().stream().map(Answer::getId).toList()
                            : Collections.emptyList();

                    return GradingQuestionAnswerResponse.builder()
                            .attemptAnswerId(a != null ? a.getId() : null)
                            .questionId(q.getId())
                            .questionOrder(pq.getQuestionOrder())
                            .content(q.getContent())
                            .type(q.getType())
                            .points(pq.getPoints())
                            .essayAnswer(a != null ? a.getEssayAnswer() : null)
                            .referenceAnswer(q.getReferenceAnswer())
                            .selectedAnswerIds(selectedChoices)
                            .awardedScore(a != null ? a.getAwardedScore() : null)
                            .feedback(a != null ? a.getFeedback() : null)
                            .isCorrect(a != null ? a.getIsCorrect() : null)
                            .build();
                })
                .toList();

        return GradingAttemptDetailResponse.builder()
                .attemptId(attempt.getId())
                .paperId(paper.getId())
                .paperTitle(matrix.getTitle())
                .studentId(attempt.getStudent().getId())
                .studentName(attempt.getStudent().getFullName())
                .studentEmail(attempt.getStudent().getEmail())
                .submittedAt(attempt.getSubmittedAt())
                .status(attempt.getStatus())
                .examType(matrix.getExamType())
                .score(attempt.getScore())
                .maxScore(attempt.getMaxScore())
                .answers(answers)
                .build();
    }

    @Override
    @Transactional
    public void gradeAnswer(UUID attemptId, UUID answerId, GradeAnswerRequest request) {
        User currentUser = currentUserService.getCurrentUser();
        StudentExamAttempt attempt = findAttemptAndVerifyTeacherAccess(attemptId, currentUser);

        if (attempt.getStatus() != AttemptStatus.WAITING_GRADING && attempt.getStatus() != AttemptStatus.SUBMITTED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Bài thi không ở trạng thái chờ chấm điểm");
        }

        StudentAttemptAnswer answer = attemptAnswerRepository.findById(answerId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy câu trả lời"));

        if (!answer.getAttempt().getId().equals(attempt.getId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Câu trả lời không thuộc về lượt thi này");
        }

        ExamPaper paper = attempt.getExamPaper();
        PaperQuestion pq = paper.getPaperQuestions().stream()
                .filter(p -> p.getQuestion().getId().equals(answer.getQuestion().getId()))
                .findFirst()
                .orElse(null);

        BigDecimal maxPoints = pq != null ? pq.getPoints() : BigDecimal.valueOf(10);
        if (request.getAwardedScore().compareTo(maxPoints) > 0) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Điểm chấm (" + request.getAwardedScore() + ") không được vượt quá điểm tối đa của câu hỏi (" + maxPoints + ")"
            );
        }

        answer.setAwardedScore(request.getAwardedScore());
        answer.setFeedback(request.getFeedback());
        answer.setGradedBy(currentUser);
        answer.setGradedAt(LocalDateTime.now());

        attemptAnswerRepository.save(answer);
    }

    @Override
    @Transactional
    public StudentAttemptResultResponse completeGrading(UUID attemptId, CompleteGradingRequest request) {
        User currentUser = currentUserService.getCurrentUser();
        StudentExamAttempt attempt = findAttemptAndVerifyTeacherAccess(attemptId, currentUser);

        ExamPaper paper = attempt.getExamPaper();
        List<StudentAttemptAnswer> answerList = attemptAnswerRepository.findByAttempt_Id(attempt.getId());
        Map<UUID, StudentAttemptAnswer> answerMap = answerList.stream()
                .collect(Collectors.toMap(a -> a.getQuestion().getId(), a -> a));

        // Check that all essay questions have been graded
        for (PaperQuestion pq : paper.getPaperQuestions()) {
            if (pq.getQuestion().getType() == QuestionType.ESSAY) {
                StudentAttemptAnswer a = answerMap.get(pq.getQuestion().getId());
                if (a == null || a.getAwardedScore() == null) {
                    throw new ResponseStatusException(
                            HttpStatus.BAD_REQUEST,
                            "Vui lòng chấm điểm cho tất cả các câu hỏi tự luận trước khi hoàn tất"
                    );
                }
            }
        }

        // Calculate total score
        BigDecimal totalScore = BigDecimal.ZERO;
        for (StudentAttemptAnswer a : answerList) {
            if (a.getAwardedScore() != null) {
                totalScore = totalScore.add(a.getAwardedScore());
            }
        }

        attempt.setScore(totalScore);
        attempt.setStatus(AttemptStatus.COMPLETED);
        attempt.setGradedAt(LocalDateTime.now());
        attemptRepository.save(attempt);

        return toResultResponse(attempt, answerList);
    }

    private StudentExamAttempt findAttemptAndVerifyTeacherAccess(UUID attemptId, User currentUser) {
        StudentExamAttempt attempt = attemptRepository.findById(attemptId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy lượt làm bài"));

        boolean isAdmin = "ADMIN".equalsIgnoreCase(currentUser.getRole().getName());
        boolean isOwner = attempt.getTeacher().getId().equals(currentUser.getId());

        if (!isAdmin && !isOwner) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bạn không có quyền chấm bài thi của giáo viên khác");
        }

        return attempt;
    }

    private StudentAttemptResultResponse toResultResponse(StudentExamAttempt attempt, List<StudentAttemptAnswer> answerList) {
        ExamPaper paper = attempt.getExamPaper();
        ExamMatrix matrix = paper.getExamMatrix();

        Map<UUID, PaperQuestion> pqMap = paper.getPaperQuestions().stream()
                .collect(Collectors.toMap(pq -> pq.getQuestion().getId(), pq -> pq));

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
                            .awardedScore(a.getAwardedScore())
                            .feedback(a.getFeedback())
                            .isCorrect(a.getIsCorrect())
                            .build();
                })
                .toList();

        return StudentAttemptResultResponse.builder()
                .attemptId(attempt.getId())
                .paperId(paper.getId())
                .examCode(paper.getExamCode())
                .paperTitle(matrix.getTitle())
                .subjectName(matrix.getSubject().getName())
                .examType(matrix.getExamType())
                .status(attempt.getStatus())
                .score(attempt.getScore())
                .maxScore(attempt.getMaxScore())
                .startedAt(attempt.getStartedAt())
                .submittedAt(attempt.getSubmittedAt())
                .gradedAt(attempt.getGradedAt())
                .answers(answerResponses)
                .build();
    }
}
