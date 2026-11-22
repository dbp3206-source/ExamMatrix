package com.exammatrix.backend.service.impl;

import com.exammatrix.backend.service.EmailService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Service
@RequiredArgsConstructor
public class SmtpEmailServiceImpl implements EmailService {
    private static final URI BREVO_API_URI = URI.create("https://api.brevo.com/v3/smtp/email");
    private static final URI RESEND_API_URI = URI.create("https://api.resend.com/emails");
    private static final Pattern DISPLAY_ADDRESS_PATTERN = Pattern.compile("^(.*)<([^<>]+)>$");

    private final ObjectProvider<JavaMailSender> mailSenderProvider;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    @Value("${app.mail.from:}")
    private String configuredFrom;

    @Value("${spring.mail.username:}")
    private String mailUsername;

    @Value("${app.mail.brevo-api-key:}")
    private String brevoApiKey;

    @Value("${app.mail.resend-api-key:}")
    private String resendApiKey;

    @Override
    public void sendRegistrationOtp(String recipientEmail, String fullName, String otpCode, int expirationMinutes) {
        String subject = "[Exam Matrix] Mã OTP xác thực đăng ký tài khoản học sinh";
        String body = buildOtpEmailBody(fullName, otpCode, expirationMinutes);

        if (StringUtils.hasText(brevoApiKey)) {
            sendViaBrevo(recipientEmail, subject, body, true);
            return;
        }
        if (StringUtils.hasText(resendApiKey)) {
            sendViaResend(recipientEmail, subject, body, true);
            return;
        }

        JavaMailSender sender = mailSenderProvider.getIfAvailable();
        if (sender == null) {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "Hệ thống chưa cấu hình dịch vụ gửi email OTP. Vui lòng liên hệ quản trị viên."
            );
        }

        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(resolveSenderAddress());
        message.setTo(recipientEmail);
        message.setSubject(subject);
        message.setText(body);

        try {
            sender.send(message);
        } catch (MailException ex) {
            log.warn("Failed to deliver student registration OTP email via SMTP: {}", ex.getClass().getSimpleName());
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "Không thể gửi mã OTP qua máy chủ SMTP. Trên hạ tầng cloud có thể cổng SMTP bị chặn; vui lòng thử lại hoặc dùng API gửi mail HTTPS."
            );
        }
    }

    @Override
    public boolean sendNameWarningEmail(String recipientEmail, String fullName, String reason, String senderName) {
        if (!StringUtils.hasText(recipientEmail)) {
            return false;
        }

        String subject = "[Exam Matrix] Cảnh báo yêu cầu cập nhật tên hiển thị tài khoản";
        String body = buildNameWarningEmailBody(fullName, reason, senderName);

        if (StringUtils.hasText(brevoApiKey)) {
            return sendViaBrevo(recipientEmail, subject, body, false);
        }
        if (StringUtils.hasText(resendApiKey)) {
            return sendViaResend(recipientEmail, subject, body, false);
        }

        JavaMailSender sender = mailSenderProvider.getIfAvailable();
        if (sender == null) {
            return false;
        }

        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(resolveSenderAddress());
        message.setTo(recipientEmail);
        message.setSubject(subject);
        message.setText(body);

        try {
            sender.send(message);
            return true;
        } catch (MailException ex) {
            log.warn("Failed to deliver student name warning email via SMTP: {}", ex.getClass().getSimpleName());
            return false;
        }
    }

    private boolean sendViaBrevo(String recipientEmail, String subject, String body, boolean throwOnError) {
        String senderRaw = resolveSenderAddress();
        String senderEmail = extractEmail(senderRaw);
        String senderName = extractDisplayName(senderRaw);

        Map<String, Object> payload = Map.of(
                "sender", Map.of("name", senderName, "email", senderEmail),
                "to", List.of(Map.of("email", recipientEmail)),
                "subject", subject,
                "textContent", body
        );

        return sendHttpEmail(
                BREVO_API_URI,
                "api-key",
                brevoApiKey.trim(),
                payload,
                "Brevo",
                throwOnError
        );
    }

    private boolean sendViaResend(String recipientEmail, String subject, String body, boolean throwOnError) {
        Map<String, Object> payload = Map.of(
                "from", resolveSenderAddress(),
                "to", List.of(recipientEmail),
                "subject", subject,
                "text", body
        );

        return sendHttpEmail(
                RESEND_API_URI,
                "Authorization",
                "Bearer " + resendApiKey.trim(),
                payload,
                "Resend",
                throwOnError
        );
    }

    private boolean sendHttpEmail(
            URI endpoint,
            String authHeaderName,
            String authHeaderValue,
            Map<String, Object> payload,
            String providerName,
            boolean throwOnError
    ) {
        try {
            String json = objectMapper.writeValueAsString(payload);
            HttpRequest request = HttpRequest.newBuilder(endpoint)
                    .timeout(Duration.ofSeconds(15))
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/json")
                    .header(authHeaderName, authHeaderValue)
                    .POST(HttpRequest.BodyPublishers.ofString(json))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() >= 200 && response.statusCode() < 300) {
                return true;
            }
            log.warn("{} email delivery returned HTTP {}", providerName, response.statusCode());
        } catch (Exception ex) {
            log.warn("{} email delivery failed: {}", providerName, ex.getClass().getSimpleName());
        }

        if (throwOnError) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "Không thể gửi mã OTP tới email đã nhập qua " + providerName + ". Vui lòng thử lại sau."
            );
        }
        return false;
    }

    private String resolveSenderAddress() {
        if (StringUtils.hasText(configuredFrom)) {
            return configuredFrom.trim();
        }
        if (StringUtils.hasText(mailUsername)) {
            return mailUsername.trim();
        }
        return "Exam Matrix <no-reply@exammatrix.local>";
    }

    private String extractEmail(String raw) {
        Matcher matcher = DISPLAY_ADDRESS_PATTERN.matcher(raw.trim());
        if (matcher.matches()) {
            return matcher.group(2).trim();
        }
        return raw.trim();
    }

    private String extractDisplayName(String raw) {
        Matcher matcher = DISPLAY_ADDRESS_PATTERN.matcher(raw.trim());
        if (matcher.matches()) {
            String name = matcher.group(1).trim();
            if (!name.isEmpty()) {
                return name;
            }
        }
        return "Exam Matrix";
    }

    private String buildOtpEmailBody(String fullName, String otpCode, int expirationMinutes) {
        String safeName = StringUtils.hasText(fullName) ? fullName.trim() : "bạn";
        return String.format(
                "Xin chào %s,%n%n"
                        + "Mã OTP xác thực đăng ký tài khoản học sinh Exam Matrix của bạn là: %s%n"
                        + "Mã có hiệu lực trong vòng %d phút.%n%n"
                        + "Vui lòng không chia sẻ mã này cho bất kỳ ai. Nếu bạn không thực hiện yêu cầu này, hãy bỏ qua email.",
                safeName,
                otpCode,
                expirationMinutes
        );
    }

    private String buildNameWarningEmailBody(String fullName, String reason, String senderName) {
        String safeName = StringUtils.hasText(fullName) ? fullName.trim() : "học sinh";
        return String.format(
                "Xin chào %s,%n%n"
                        + "Quản trị viên (%s) đã gửi cảnh báo yêu cầu bạn cập nhật lại tên hiển thị trong hệ thống Exam Matrix.%n"
                        + "Nội dung cảnh báo: %s%n%n"
                        + "Vui lòng đăng nhập vào Exam Matrix, mở mục Hồ sơ cá nhân để đổi lại họ tên phù hợp. "
                        + "Việc đổi tên giữ nguyên toàn bộ kết quả thi và lịch sử học tập của bạn.",
                safeName,
                senderName,
                reason
        );
    }
}
