package com.exammatrix.backend.controller;

import com.exammatrix.backend.dto.request.CreateStudentFeedbackRequest;
import com.exammatrix.backend.dto.response.FeedbackInboxResponse;
import com.exammatrix.backend.dto.response.StudentFeedbackResponse;
import com.exammatrix.backend.service.FeedbackService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class FeedbackController {
    private final FeedbackService feedbackService;

    @PostMapping("/student/feedbacks")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<StudentFeedbackResponse> submitFeedback(
            @Valid @RequestBody CreateStudentFeedbackRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(feedbackService.submitFeedback(request));
    }

    @GetMapping("/student/feedbacks")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<List<StudentFeedbackResponse>> getMyFeedbacks() {
        return ResponseEntity.ok(feedbackService.getMyFeedbacks());
    }

    @GetMapping("/feedbacks/inbox")
    @PreAuthorize("hasAnyRole('ADMIN', 'TEACHER')")
    public ResponseEntity<FeedbackInboxResponse> getInbox() {
        return ResponseEntity.ok(feedbackService.getInbox());
    }

    @PatchMapping("/feedbacks/{id}/read")
    @PreAuthorize("hasAnyRole('ADMIN', 'TEACHER')")
    public ResponseEntity<StudentFeedbackResponse> markAsRead(@PathVariable UUID id) {
        return ResponseEntity.ok(feedbackService.markAsRead(id));
    }
}
