package com.exammatrix.backend.controller;

import com.exammatrix.backend.dto.request.CompleteGradingRequest;
import com.exammatrix.backend.dto.request.GradeAnswerRequest;
import com.exammatrix.backend.dto.response.GradingAttemptDetailResponse;
import com.exammatrix.backend.dto.response.PageResponse;
import com.exammatrix.backend.dto.response.PendingGradingSummaryResponse;
import com.exammatrix.backend.dto.response.StudentAttemptResultResponse;
import com.exammatrix.backend.entity.enums.AttemptStatus;
import com.exammatrix.backend.service.TeacherGradingService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/teacher/grading")
@RequiredArgsConstructor
public class TeacherGradingController {
    private final TeacherGradingService teacherGradingService;

    @GetMapping("/pending")
    public ResponseEntity<PageResponse<PendingGradingSummaryResponse>> getPendingGrading(
            @RequestParam(required = false) AttemptStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.max(1, Math.min(size, 100)));
        return ResponseEntity.ok(teacherGradingService.getPendingGrading(status, pageable));
    }

    @GetMapping("/attempts/{attemptId}")
    public ResponseEntity<GradingAttemptDetailResponse> getGradingAttempt(@PathVariable UUID attemptId) {
        return ResponseEntity.ok(teacherGradingService.getGradingAttempt(attemptId));
    }

    @PatchMapping("/attempts/{attemptId}/answers/{answerId}")
    public ResponseEntity<Void> gradeAnswer(
            @PathVariable UUID attemptId,
            @PathVariable UUID answerId,
            @Valid @RequestBody GradeAnswerRequest request
    ) {
        teacherGradingService.gradeAnswer(attemptId, answerId, request);
        return ResponseEntity.ok().build();
    }

    @PatchMapping("/attempts/{attemptId}/complete")
    public ResponseEntity<StudentAttemptResultResponse> completeGrading(
            @PathVariable UUID attemptId,
            @RequestBody(required = false) CompleteGradingRequest request
    ) {
        return ResponseEntity.ok(teacherGradingService.completeGrading(
                attemptId,
                request != null ? request : new CompleteGradingRequest("COMPLETED")
        ));
    }
}
