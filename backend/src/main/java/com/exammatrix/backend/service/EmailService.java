package com.exammatrix.backend.service;

public interface EmailService {
    void sendRegistrationOtp(String recipientEmail, String fullName, String otpCode, int expirationMinutes);

    boolean sendNameWarningEmail(String recipientEmail, String fullName, String reason, String senderName);
}
