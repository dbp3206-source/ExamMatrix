package com.exammatrix.backend.service;

import com.exammatrix.backend.dto.request.SaveAttemptAnswerRequest;
import com.exammatrix.backend.dto.response.*;
import org.springframework.data.domain.Pageable;

import java.util.UUID;

public interface StudentExamService {
    PageResponse<StudentExamSummaryResponse> getAccessibleExams(Pageable pageable);

    PageResponse<StudentExamSummaryResponse> getAccessibleExams(
            Integer subjectId,
            String search,
            String sortBy,
            String sortDir,
            Pageable pageable
    );

    java.util.List<StudentSubjectExamCountResponse> getAccessibleExamSubjectCounts();

    StudentExamDetailResponse getExamDetail(UUID paperId);

    StartAttemptResponse startAttempt(UUID paperId);

    StartAttemptResponse startAttempt(UUID paperId, boolean forceNew);

    void saveAnswer(UUID attemptId, SaveAttemptAnswerRequest request);

    StudentAttemptResultResponse submitAttempt(UUID attemptId);

    StudentAttemptResultResponse getAttemptResult(UUID attemptId);
}
