package com.exammatrix.backend.dto.response;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record NotificationSummaryResponse(
        String role,
        long pendingClassRequestCount,
        long unreadFeedbackCount,
        long unreadNameWarningCount,
        List<ApprovedClassNotification> approvedClasses
) {
    public NotificationSummaryResponse(
            String role,
            long pendingClassRequestCount,
            long unreadFeedbackCount,
            List<ApprovedClassNotification> approvedClasses
    ) {
        this(role, pendingClassRequestCount, unreadFeedbackCount, 0L, approvedClasses);
    }

    public record ApprovedClassNotification(
            UUID assignmentId,
            String className,
            String classCode,
            String teacherName,
            LocalDateTime reviewedAt
    ) {}
}
