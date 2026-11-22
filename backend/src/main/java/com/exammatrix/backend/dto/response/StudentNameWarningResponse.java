package com.exammatrix.backend.dto.response;

import java.time.LocalDateTime;
import java.util.UUID;

public record StudentNameWarningResponse(
        UUID id,
        UUID studentId,
        String studentUsername,
        String studentFullName,
        UUID senderId,
        String senderName,
        String reason,
        boolean read,
        LocalDateTime createdAt,
        boolean emailDelivered
) {}
