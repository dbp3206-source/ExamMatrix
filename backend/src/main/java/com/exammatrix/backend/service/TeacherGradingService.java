package com.exammatrix.backend.service;

import com.exammatrix.backend.dto.request.CompleteGradingRequest;
import com.exammatrix.backend.dto.request.GradeAnswerRequest;
import com.exammatrix.backend.dto.response.GradingAttemptDetailResponse;
import com.exammatrix.backend.dto.response.PageResponse;
import com.exammatrix.backend.dto.response.PendingGradingSummaryResponse;
import com.exammatrix.backend.dto.response.StudentAttemptResultResponse;
import org.springframework.data.domain.Pageable;

import java.util.UUID;

public interface TeacherGradingService {
    PageResponse<PendingGradingSummaryResponse> getPendingGrading(Pageable pageable);

    GradingAttemptDetailResponse getGradingAttempt(UUID attemptId);

    void gradeAnswer(UUID attemptId, UUID answerId, GradeAnswerRequest request);

    StudentAttemptResultResponse completeGrading(UUID attemptId, CompleteGradingRequest request);
}
