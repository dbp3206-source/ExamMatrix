package com.exammatrix.backend.service.impl;

import com.exammatrix.backend.dto.request.GenerateExamPapersRequest;
import com.exammatrix.backend.dto.request.UpdateExamPaperAccessRequest;
import com.exammatrix.backend.dto.response.*;
import com.exammatrix.backend.entity.*;
import com.exammatrix.backend.entity.enums.ExamAccessType;
import com.exammatrix.backend.entity.enums.ExamType;
import com.exammatrix.backend.repository.ExamPaperRepository;
import com.exammatrix.backend.repository.StudentExamAttemptRepository;
import com.exammatrix.backend.security.CurrentUserService;
import com.exammatrix.backend.service.ExamGenerationService;
import com.exammatrix.backend.service.ExamPaperService;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ExamPaperServiceImpl implements ExamPaperService {
    private final ExamPaperRepository examPaperRepository;
    private final StudentExamAttemptRepository studentExamAttemptRepository;
    private final CurrentUserService currentUserService;
    private final ExamGenerationService examGenerationService;

    @Override
    public PageResponse<ExamPaperDetailResponse> getAllExamPapers(
            UUID matrixId,
            Integer page,
            Integer size
    ) {
        User currentUser = currentUserService.getCurrentUser();

        int safePage = page == null || page < 0 ? 0 : page;
        int safeSize = size == null || size < 1 ? 10 : Math.min(size, 100);

        UUID teacherFilter = isAdmin(currentUser) ? null : currentUser.getId();

        Pageable pageable = PageRequest.of(
                safePage,
                safeSize,
                Sort.by(Sort.Order.desc("createdAt"))
        );

        Page<ExamPaper> paperPage = examPaperRepository.searchExamPapers(
                matrixId,
                teacherFilter,
                pageable
        );

        List<ExamPaperDetailResponse> responses = new ArrayList<>();

        for (ExamPaper paper : paperPage.getContent()) {
            responses.add(convertToResponse(paper));
        }

        return new PageResponse<>(
                responses,
                paperPage.getNumber(),
                paperPage.getSize(),
                paperPage.getTotalElements(),
                paperPage.getTotalPages()
        );
    }

    @Override
    public PageResponse<ExamPaperSummaryResponse> getExamPaperSummaries(
            UUID matrixId, Integer subjectId, ExamType examType, ExamAccessType accessType,
            Boolean isPublished, String search, Integer page, Integer size) {
        User currentUser = currentUserService.getCurrentUser();
        String searchText = search == null ? "" : search.strip();
        if (searchText.length() > 160) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Từ khóa không được vượt quá 160 ký tự");
        }
        int safePage = page == null || page < 0 ? 0 : page;
        int safeSize = size == null || size < 1 ? 20 : Math.min(size, 100);
        UUID teacherId = isAdmin(currentUser) ? null : currentUser.getId();
        Pageable pageable = PageRequest.of(safePage, safeSize,
                Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id")));
        Page<ExamPaperSummaryResponse> result = examPaperRepository.searchExamPaperSummaries(
                teacherId, matrixId, subjectId, examType, accessType, isPublished, searchText, pageable);
        return new PageResponse<>(result.getContent(), result.getNumber(), result.getSize(),
                result.getTotalElements(), result.getTotalPages());
    }

    @Override
    public ExamPaperDetailResponse getExamPaperById(UUID id) {
        User currentUser = currentUserService.getCurrentUser();

        ExamPaper paper = findExamPaperById(id);

        checkCanAccess(paper.getExamMatrix(), currentUser);

        return convertToResponse(paper);
    }

    @Override
    @Transactional(readOnly = false)
    public List<ExamPaperDetailResponse> generateExamPapers(
            UUID matrixId,
            GenerateExamPapersRequest request
    ) {
        return examGenerationService.generateExamPapers(matrixId, request);
    }

    @Override
    @Transactional
    public void deleteExamPaper(UUID id) {
        User currentUser = currentUserService.getCurrentUser();

        ExamPaper paper = findPaperForUpdate(id);

        checkCanAccess(paper.getExamMatrix(), currentUser);

        if (studentExamAttemptRepository.existsByExamPaper_Id(id)) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Không thể xóa đề thi đã có học sinh làm bài"
            );
        }

        try {
            examPaperRepository.delete(paper);
            examPaperRepository.flush();
        } catch (DataIntegrityViolationException exception) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Không thể xóa đề thi đang được sử dụng"
            );
        }
    }

    @Override
    @Transactional
    public ExamPaperDetailResponse updateExamPaperAccess(UUID id, UpdateExamPaperAccessRequest request) {
        User currentUser = currentUserService.getCurrentUser();

        ExamPaper paper = findPaperForUpdate(id);

        checkCanAccess(paper.getExamMatrix(), currentUser);

        if (request.getAccessType() != null) {
            paper.setAccessType(request.getAccessType());
        }

        if (request.getIsPublished() != null) {
            boolean wasPublished = Boolean.TRUE.equals(paper.getIsPublished());
            paper.setIsPublished(request.getIsPublished());
            if (Boolean.TRUE.equals(request.getIsPublished()) && (!wasPublished || paper.getPublishedAt() == null)) {
                paper.setPublishedAt(java.time.LocalDateTime.now());
            }
        }

        ExamPaper saved = examPaperRepository.save(paper);
        return convertToResponse(saved);
    }

    private ExamPaper findExamPaperById(UUID id) {
        return examPaperRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Không tìm thấy đề thi có ID " + id
                ));
    }

    private ExamPaper findPaperForUpdate(UUID id) {
        return examPaperRepository.findByIdForUpdate(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy đề thi có ID " + id));
    }

    private void checkCanAccess(ExamMatrix matrix, User currentUser) {
        if (isAdmin(currentUser)) {
            return;
        }

        boolean isTeacherOwner = "TEACHER".equalsIgnoreCase(currentUser.getRole().getName())
                        && matrix.getTeacher()
                        .getId()
                        .equals(currentUser.getId());

        if (!isTeacherOwner) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Bạn không có quyền truy cập đề thi này"
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
            boolean isEssay = question.getType() == com.exammatrix.backend.entity.enums.QuestionType.ESSAY;

            List<AnswerResponse> answerResponses = new ArrayList<>();
            String referenceAnswer = null;

            if (isEssay) {
                referenceAnswer = question.getReferenceAnswer();
            } else {
                for (Answer answer : PaperAnswerOrderHelper.orderAnswersForPaper(paper.getId(), question)) {
                    answerResponses.add(new AnswerResponse(
                                answer.getId(),
                                answer.getContent(),
                                answer.getIsCorrect()
                        )
                    );
                }
            }

            questionResponses.add(new PaperQuestionResponse(
                        question.getId(),
                        paperQuestion.getQuestionOrder(),
                        question.getContent(),
                        question.getType(),
                        question.getDifficulty(),
                        answerResponses,
                        referenceAnswer,
                        paperQuestion.getPoints()
                )
            );
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
