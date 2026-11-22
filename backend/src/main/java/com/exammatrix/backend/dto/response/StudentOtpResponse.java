package com.exammatrix.backend.dto.response;

public record StudentOtpResponse(
        String email,
        int expirationMinutes,
        int remainingResends,
        int cooldownSeconds,
        String message
) {}
