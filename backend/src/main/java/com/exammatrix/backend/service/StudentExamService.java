package com.exammatrix.backend.service;

import com.exammatrix.backend.dto.request.SaveAttemptAnswerRequest;
import com.exammatrix.backend.dto.response.*;
import org.springframework.data.domain.Pageable;

import java.util.UUID;

public interface StudentExamService {
    PageResponse<StudentExamSummaryResponse> getAccessibleExams(Pageable pageable);

    StudentExamDetailResponse getExamDetail(UUID paperId);

    StartAttemptResponse startAttempt(UUID paperId);

    void saveAnswer(UUID attemptId, SaveAttemptAnswerRequest request);

    StudentAttemptResultResponse submitAttempt(UUID attemptId);

    StudentAttemptResultResponse getAttemptResult(UUID attemptId);
}
