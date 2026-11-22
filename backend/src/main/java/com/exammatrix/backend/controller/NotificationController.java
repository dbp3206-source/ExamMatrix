package com.exammatrix.backend.controller;

import com.exammatrix.backend.dto.response.NotificationSummaryResponse;
import com.exammatrix.backend.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/notifications")
@RequiredArgsConstructor
public class NotificationController {
    private final NotificationService notificationService;

    @GetMapping("/summary")
    @PreAuthorize("hasAnyRole('ADMIN', 'CONTENT_ADMIN', 'TEACHER', 'STUDENT')")
    public ResponseEntity<NotificationSummaryResponse> getSummary() {
        return ResponseEntity.ok(notificationService.getSummary());
    }
}
