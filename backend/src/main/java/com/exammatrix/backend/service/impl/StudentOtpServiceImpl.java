package com.exammatrix.backend.service.impl;

import com.exammatrix.backend.dto.request.RequestStudentOtpRequest;
import com.exammatrix.backend.dto.request.ResendStudentOtpRequest;
import com.exammatrix.backend.dto.response.StudentOtpResponse;
import com.exammatrix.backend.entity.StudentRegistrationOtp;
import com.exammatrix.backend.repository.StudentRegistrationOtpRepository;
import com.exammatrix.backend.repository.UserRepository;
import com.exammatrix.backend.service.EmailService;
import com.exammatrix.backend.service.StudentOtpService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class StudentOtpServiceImpl implements StudentOtpService {
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final StudentRegistrationOtpRepository otpRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final EmailService emailService;

    @Value("${app.otp.expiration-minutes:5}")
    private int expirationMinutes;

    @Value("${app.otp.max-attempts:5}")
    private int maxAttempts;

    @Value("${app.otp.max-resends:3}")
    private int maxResends;

    @Value("${app.otp.resend-cooldown-seconds:60}")
    private int resendCooldownSeconds;

    @Override
    @Transactional
    public StudentOtpResponse requestOtp(RequestStudentOtpRequest request) {
        String normalizedUsername = request.getUsername().trim().toLowerCase(Locale.ROOT);
        String normalizedEmail = request.getEmail().trim().toLowerCase(Locale.ROOT);

        if (userRepository.existsByUsernameIgnoreCase(normalizedUsername)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Tên đăng nhập đã tồn tại");
        }
        if (userRepository.existsByEmailIgnoreCase(normalizedEmail)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email đã được sử dụng");
        }

        LocalDateTime now = LocalDateTime.now();
        StudentRegistrationOtp record = otpRepository.findByEmailIgnoreCase(normalizedEmail).orElse(null);

        if (record == null) {
            String rawOtp = generateNumericOtp();
            record = StudentRegistrationOtp.builder()
                    .email(normalizedEmail)
                    .otpHash(passwordEncoder.encode(rawOtp))
                    .expiresAt(now.plusMinutes(expirationMinutes))
                    .attempts(0)
                    .resendCount(0)
                    .lastSentAt(now)
                    .build();
            otpRepository.save(record);
            emailService.sendRegistrationOtp(normalizedEmail, request.getFullName(), rawOtp, expirationMinutes);
            return buildResponse(normalizedEmail, record.getResendCount(), "Mã OTP đã được gửi đến email của bạn.");
        }

        enforceResendQuota(record, now);

        String rawOtp = generateNumericOtp();
        record.setOtpHash(passwordEncoder.encode(rawOtp));
        record.setExpiresAt(now.plusMinutes(expirationMinutes));
        record.setAttempts(0);
        record.setResendCount(record.getResendCount() + 1);
        record.setLastSentAt(now);
        otpRepository.save(record);
        emailService.sendRegistrationOtp(normalizedEmail, request.getFullName(), rawOtp, expirationMinutes);
        return buildResponse(normalizedEmail, record.getResendCount(), "Đã gửi lại mã OTP mới đến email của bạn.");
    }

    @Override
    @Transactional
    public StudentOtpResponse resendOtp(ResendStudentOtpRequest request) {
        String normalizedEmail = request.getEmail().trim().toLowerCase(Locale.ROOT);
        if (userRepository.existsByEmailIgnoreCase(normalizedEmail)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email đã được sử dụng");
        }

        StudentRegistrationOtp record = otpRepository.findByEmailIgnoreCase(normalizedEmail)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Email chưa có yêu cầu xác thực OTP. Vui lòng gửi mã OTP trước."
                ));

        LocalDateTime now = LocalDateTime.now();
        enforceResendQuota(record, now);

        String rawOtp = generateNumericOtp();
        record.setOtpHash(passwordEncoder.encode(rawOtp));
        record.setExpiresAt(now.plusMinutes(expirationMinutes));
        record.setAttempts(0);
        record.setResendCount(record.getResendCount() + 1);
        record.setLastSentAt(now);
        otpRepository.save(record);
        emailService.sendRegistrationOtp(normalizedEmail, null, rawOtp, expirationMinutes);
        return buildResponse(normalizedEmail, record.getResendCount(), "Đã gửi lại mã OTP mới đến email của bạn.");
    }

    @Override
    @Transactional(noRollbackFor = ResponseStatusException.class)
    public void verifyAndConsumeOtp(String email, String rawOtp) {
        String normalizedEmail = email.trim().toLowerCase(Locale.ROOT);
        String trimmedOtp = rawOtp == null ? "" : rawOtp.trim();

        StudentRegistrationOtp record = otpRepository.findByEmailIgnoreCase(normalizedEmail)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Chưa có mã OTP hợp lệ cho email này. Vui lòng yêu cầu gửi mã OTP."
                ));

        LocalDateTime now = LocalDateTime.now();
        if (now.isAfter(record.getExpiresAt())) {
            otpRepository.delete(record);
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Mã OTP đã hết hạn. Vui lòng gửi lại mã OTP mới."
            );
        }

        if (record.getAttempts() >= maxAttempts) {
            throw new ResponseStatusException(
                    HttpStatus.TOO_MANY_REQUESTS,
                    "Bạn đã nhập sai mã OTP quá số lần cho phép. Vui lòng gửi lại mã OTP mới."
            );
        }

        if (!passwordEncoder.matches(trimmedOtp, record.getOtpHash())) {
            int nextAttempts = record.getAttempts() + 1;
            record.setAttempts(nextAttempts);
            otpRepository.save(record);

            int remaining = Math.max(0, maxAttempts - nextAttempts);
            if (remaining == 0) {
                throw new ResponseStatusException(
                        HttpStatus.TOO_MANY_REQUESTS,
                        "Bạn đã nhập sai mã OTP quá số lần cho phép. Vui lòng gửi lại mã OTP mới."
                );
            }
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Mã OTP không chính xác. Bạn còn " + remaining + " lần thử."
            );
        }

        otpRepository.delete(record);
    }

    private void enforceResendQuota(StudentRegistrationOtp record, LocalDateTime now) {
        if (record.getResendCount() >= maxResends) {
            throw new ResponseStatusException(
                    HttpStatus.TOO_MANY_REQUESTS,
                    "Bạn đã vượt quá số lần gửi lại mã OTP cho phép (" + maxResends + " lần)."
            );
        }
        long elapsedSeconds = Duration.between(record.getLastSentAt(), now).getSeconds();
        if (elapsedSeconds < resendCooldownSeconds) {
            long waitSeconds = resendCooldownSeconds - Math.max(0, elapsedSeconds);
            throw new ResponseStatusException(
                    HttpStatus.TOO_MANY_REQUESTS,
                    "Vui lòng đợi " + waitSeconds + " giây trước khi gửi lại mã OTP."
            );
        }
    }

    private StudentOtpResponse buildResponse(String email, int resendCount, String message) {
        int remaining = Math.max(0, maxResends - resendCount);
        return new StudentOtpResponse(email, expirationMinutes, remaining, resendCooldownSeconds, message);
    }

    private String generateNumericOtp() {
        return String.format("%06d", SECURE_RANDOM.nextInt(1_000_000));
    }
}
