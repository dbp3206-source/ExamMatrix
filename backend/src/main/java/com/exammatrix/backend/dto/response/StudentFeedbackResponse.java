package com.exammatrix.backend.dto.response;

import com.exammatrix.backend.entity.enums.FeedbackCategory;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record StudentFeedbackResponse(
        UUID id,
        UUID studentId,
        String studentName,
        String studentEmail,
        FeedbackCategory category,
        String title,
        String content,
        boolean isRead,
        List<String> recipientLabels,
        LocalDateTime createdAt
) {}
