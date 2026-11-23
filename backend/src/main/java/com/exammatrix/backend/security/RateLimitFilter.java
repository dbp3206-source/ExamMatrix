package com.exammatrix.backend.security;

import com.exammatrix.backend.service.RateLimiterService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;

@Slf4j
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 5)
@RequiredArgsConstructor
public class RateLimitFilter extends OncePerRequestFilter {

    private final RateLimiterService rateLimiterService;

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {

        String method = request.getMethod();
        String uri = request.getRequestURI();

        if ("OPTIONS".equalsIgnoreCase(method)) {
            filterChain.doFilter(request, response);
            return;
        }

        String clientIp = extractClientIp(request);

        // 1. Anti-brute-force on login
        if ("POST".equalsIgnoreCase(method) && uri.endsWith("/auth/login")) {
            String key = "rl:login:" + clientIp;
            if (!rateLimiterService.tryAcquire(key, 15, Duration.ofMinutes(1))) {
                rejectRateLimited(response, "Quá nhiều yêu cầu đăng nhập từ thiết bị của bạn. Vui lòng thử lại sau 1 phút.");
                return;
            }
        }

        // 2. Anti-spam on OTP request & resend
        if ("POST".equalsIgnoreCase(method) && (uri.contains("/register/student/request-otp") || uri.contains("/register/student/resend-otp"))) {
            String key = "rl:otp:" + clientIp;
            if (!rateLimiterService.tryAcquire(key, 5, Duration.ofMinutes(1))) {
                rejectRateLimited(response, "Quá nhiều yêu cầu gửi mã OTP từ thiết bị của bạn. Vui lòng đợi 1 phút trước khi thử lại.");
                return;
            }
        }

        // 3. Anti-spam on student registration
        if ("POST".equalsIgnoreCase(method) && uri.endsWith("/auth/register/student")) {
            String key = "rl:reg:" + clientIp;
            if (!rateLimiterService.tryAcquire(key, 5, Duration.ofMinutes(1))) {
                rejectRateLimited(response, "Quá nhiều yêu cầu đăng ký tài khoản từ địa chỉ của bạn. Vui lòng thử lại sau ít phút.");
                return;
            }
        }

        // 4. Anti-spam on feedbacks/posts
        if ("POST".equalsIgnoreCase(method) && uri.contains("/feedbacks")) {
            String key = "rl:feedback:" + clientIp;
            if (!rateLimiterService.tryAcquire(key, 6, Duration.ofMinutes(1))) {
                rejectRateLimited(response, "Bạn đang gửi góp ý quá nhanh. Vui lòng thử lại sau ít phút.");
                return;
            }
        }

        // 5. Anti-stress on exam attempts creation
        if ("POST".equalsIgnoreCase(method) && uri.contains("/attempts")) {
            String key = "rl:attempt:" + clientIp;
            if (!rateLimiterService.tryAcquire(key, 12, Duration.ofMinutes(1))) {
                rejectRateLimited(response, "Yêu cầu phòng thi đang được xử lý. Vui lòng không nhấn liên tục.");
                return;
            }
        }

        filterChain.doFilter(request, response);
    }

    private void rejectRateLimited(HttpServletResponse response, String message) throws IOException {
        response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        String json = String.format("{\"status\":429,\"error\":\"Too Many Requests\",\"message\":\"%s\"}", message);
        response.getWriter().write(json);
    }

    private String extractClientIp(HttpServletRequest request) {
        String xf = request.getHeader("X-Forwarded-For");
        if (xf != null && !xf.isBlank()) {
            return xf.split(",")[0].trim();
        }
        String xr = request.getHeader("X-Real-IP");
        if (xr != null && !xr.isBlank()) {
            return xr.trim();
        }
        return request.getRemoteAddr();
    }
}
