package com.exammatrix.backend.controller;

import com.exammatrix.backend.dto.request.ChangePasswordRequest;
import com.exammatrix.backend.dto.request.GoogleStudentLoginRequest;
import com.exammatrix.backend.dto.request.LoginRequest;
import com.exammatrix.backend.dto.request.StudentRegisterRequest;
import com.exammatrix.backend.dto.request.UpdateProfileRequest;
import com.exammatrix.backend.dto.response.AuthResponse;
import com.exammatrix.backend.dto.response.UserResponse;
import com.exammatrix.backend.service.AuthService;
import com.exammatrix.backend.service.StudentAuthService;
import com.exammatrix.backend.security.GoogleStudentTokenVerifier;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {
    private static final String GOOGLE_NONCE_COOKIE = "exam_google_nonce";
    private static final String GOOGLE_LOGIN_PATH = "/google/student";
    private final AuthService authService;
    private final StudentAuthService studentAuthService;
    private final GoogleStudentTokenVerifier googleVerifier;

    @Value("${app.google.secure-cookie:false}")
    private boolean googleSecureCookie;

    @PostMapping(GOOGLE_LOGIN_PATH + "/challenge")
    public ResponseEntity<Map<String, String>> googleChallenge(HttpServletResponse response) {
        String clientId = googleVerifier.getClientId();
        String nonce = UUID.randomUUID().toString();
        response.addHeader(HttpHeaders.SET_COOKIE, googleNonceCookie(nonce, Duration.ofMinutes(5)));
        return ResponseEntity.ok().header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(Map.of("clientId", clientId, "nonce", nonce));
    }

    @PostMapping(value = GOOGLE_LOGIN_PATH, consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<AuthResponse> googleStudentLogin(
            @Valid @RequestBody GoogleStudentLoginRequest request,
            @CookieValue(value = GOOGLE_NONCE_COOKIE, required = false) String nonce,
            HttpServletResponse response
    ) {
        var identity = googleVerifier.verify(request.credential(), nonce);
        response.addHeader(HttpHeaders.SET_COOKIE, googleNonceCookie("", Duration.ZERO));
        return ResponseEntity.ok().header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(studentAuthService.loginWithGoogle(identity));
    }

    private String googleNonceCookie(String value, Duration lifetime) {
        return ResponseCookie.from(GOOGLE_NONCE_COOKIE, value)
                .httpOnly(true).secure(googleSecureCookie).sameSite("Lax")
                .path("/auth" + GOOGLE_LOGIN_PATH).maxAge(lifetime).build().toString();
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    @PostMapping("/register/student")
    public ResponseEntity<AuthResponse> registerStudent(@Valid @RequestBody StudentRegisterRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(studentAuthService.registerStudent(request));
    }

    @GetMapping("/me")
    public ResponseEntity<UserResponse> getCurrentUser() {
        return ResponseEntity.ok(authService.getCurrentUser());
    }

    @PatchMapping("/profile")
    public ResponseEntity<UserResponse> updateProfile(@Valid @RequestBody UpdateProfileRequest request) {
        return ResponseEntity.ok(authService.updateProfile(request));
    }

    @PatchMapping("/password")
    public ResponseEntity<Void> changePassword(@Valid @RequestBody ChangePasswordRequest request) {
        authService.changePassword(request);

        return ResponseEntity.noContent().build();
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout() {
        authService.logout();

        return ResponseEntity.noContent().build();
    }
}
