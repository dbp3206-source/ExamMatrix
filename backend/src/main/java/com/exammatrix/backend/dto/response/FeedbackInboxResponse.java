package com.exammatrix.backend.dto.response;

import java.util.List;

public record FeedbackInboxResponse(
        long unreadCount,
        List<StudentFeedbackResponse> items
) {}
