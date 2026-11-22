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

@Slf4j
@Service
@RequiredArgsConstructor
public class SmtpEmailServiceImpl implements EmailService {
    private final ObjectProvider<JavaMailSender> mailSenderProvider;

    @Value("${app.mail.from:}")
    private String configuredFrom;

    @Value("${spring.mail.username:}")
    private String mailUsername;

    @Override
    public void sendRegistrationOtp(String recipientEmail, String fullName, String otpCode, int expirationMinutes) {
        JavaMailSender sender = mailSenderProvider.getIfAvailable();
        if (sender == null) {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "Hệ thống chưa cấu hình máy chủ gửi email OTP. Vui lòng liên hệ quản trị viên."
            );
        }

        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(resolveSenderAddress());
        message.setTo(recipientEmail);
        message.setSubject("[Exam Matrix] Mã OTP xác thực đăng ký tài khoản học sinh");
        message.setText(buildOtpEmailBody(fullName, otpCode, expirationMinutes));

        try {
            sender.send(message);
        } catch (MailException ex) {
            log.warn("Failed to deliver student registration OTP email");
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "Không thể gửi mã OTP tới email đã nhập. Vui lòng kiểm tra địa chỉ email hoặc thử lại sau."
            );
        }
    }

    @Override
    public boolean sendNameWarningEmail(String recipientEmail, String fullName, String reason, String senderName) {
        JavaMailSender sender = mailSenderProvider.getIfAvailable();
        if (sender == null || !StringUtils.hasText(recipientEmail)) {
            return false;
        }

        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(resolveSenderAddress());
        message.setTo(recipientEmail);
        message.setSubject("[Exam Matrix] Cảnh báo yêu cầu cập nhật tên hiển thị tài khoản");
        message.setText(buildNameWarningEmailBody(fullName, reason, senderName));

        try {
            sender.send(message);
            return true;
        } catch (MailException ex) {
            log.warn("Failed to deliver student name warning email");
            return false;
        }
    }

    private String resolveSenderAddress() {
        if (StringUtils.hasText(configuredFrom)) {
            return configuredFrom.trim();
        }
        if (StringUtils.hasText(mailUsername)) {
            return mailUsername.trim();
        }
        return "no-reply@exammatrix.local";
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
