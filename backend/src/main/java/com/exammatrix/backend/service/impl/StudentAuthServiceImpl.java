package com.exammatrix.backend.service.impl;

import com.exammatrix.backend.dto.request.StudentRegisterRequest;
import com.exammatrix.backend.dto.response.AuthResponse;
import com.exammatrix.backend.dto.response.UserResponse;
import com.exammatrix.backend.entity.Role;
import com.exammatrix.backend.entity.User;
import com.exammatrix.backend.entity.enums.UserStatus;
import com.exammatrix.backend.repository.RoleRepository;
import com.exammatrix.backend.repository.UserRepository;
import com.exammatrix.backend.security.JwtService;
import com.exammatrix.backend.service.StudentAuthService;
import com.exammatrix.backend.service.StudentOtpService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.Locale;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class StudentAuthServiceImpl implements StudentAuthService {
    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final StudentOtpService studentOtpService;

    @Override
    @Transactional(noRollbackFor = ResponseStatusException.class)
    public AuthResponse registerStudent(StudentRegisterRequest request) {
        String normalizedUsername = request.getUsername().trim().toLowerCase(Locale.ROOT);
        String normalizedEmail = request.getEmail().trim().toLowerCase(Locale.ROOT);

        if (userRepository.existsByUsernameIgnoreCase(normalizedUsername)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Tên đăng nhập đã tồn tại");
        }

        if (userRepository.existsByEmailIgnoreCase(normalizedEmail)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email đã được sử dụng");
        }

        studentOtpService.verifyAndConsumeOtp(normalizedEmail, request.getOtp());

        Role studentRole = roleRepository.findByNameIgnoreCase("STUDENT")
                .orElseGet(() -> roleRepository.save(Role.builder().name("STUDENT").build()));

        User user = User.builder()
                .username(normalizedUsername)
                .email(normalizedEmail)
                .password(passwordEncoder.encode(request.getPassword()))
                .fullName(request.getFullName().trim())
                .role(studentRole)
                .status(UserStatus.ACTIVE)
                .build();

        return createSession(userRepository.save(user));
    }

    @Override
    @Transactional
    public AuthResponse loginWithGoogle(Jwt identity) {
        User existing = userRepository.findByGoogleSubject(identity.getSubject()).orElse(null);
        if (existing != null) {
            if (!"STUDENT".equalsIgnoreCase(existing.getRole().getName())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Đăng nhập Google chỉ dành cho học sinh");
            }
            if (existing.getStatus() != UserStatus.ACTIVE) {
                throw new ResponseStatusException(HttpStatus.LOCKED, "Tài khoản đã bị khóa");
            }
            return createSession(existing);
        }

        String email = identity.getClaimAsString("email");
        if (email == null || email.isBlank() || email.trim().length() > 100) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email tài khoản Google không hợp lệ");
        }
        email = email.trim().toLowerCase(Locale.ROOT);
        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Email đã có tài khoản Exam Matrix. Vui lòng đăng nhập bằng tài khoản hiện có");
        }
        Role role = roleRepository.findByNameIgnoreCase("STUDENT").orElseThrow(() ->
                new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Chưa cấu hình vai trò học sinh"));
        String name = identity.getClaimAsString("name");
        String rawFullName = name == null || name.isBlank() ? email : name.strip();
        String cleanFullName = java.text.Normalizer.normalize(rawFullName, java.text.Normalizer.Form.NFC).replaceAll("[^\\p{L}\\p{M} ’'\\-]", "").replaceAll("\\s+", " ").strip();
        if (cleanFullName.isBlank()) {
            cleanFullName = "Học sinh";
        }
        int nameLength = Math.min(100, cleanFullName.codePointCount(0, cleanFullName.length()));
        String finalFullName = cleanFullName.substring(0, cleanFullName.offsetByCodePoints(0, nameLength));

        String emailPrefix = email.contains("@") ? email.substring(0, email.indexOf('@')) : email;
        String cleanPrefix = emailPrefix.replaceAll("[^a-zA-Z0-9_]", "").toLowerCase(Locale.ROOT);
        if (cleanPrefix.length() > 20) {
            cleanPrefix = cleanPrefix.substring(0, 20);
        }
        if (cleanPrefix.length() < 3) {
            cleanPrefix = "student";
        }
        String candidateUsername;
        int attempts = 0;
        do {
            String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 6);
            candidateUsername = cleanPrefix + "_" + suffix;
            attempts++;
        } while (userRepository.existsByUsernameIgnoreCase(candidateUsername) && attempts < 10);

        if (userRepository.existsByUsernameIgnoreCase(candidateUsername)) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Chưa tạo được tên đăng nhập. Vui lòng thử lại.");
        }

        User student = User.builder()
                .username(candidateUsername)
                .email(email)
                .fullName(finalFullName)
                .password(passwordEncoder.encode(UUID.randomUUID().toString()))
                .googleSubject(identity.getSubject())
                .role(role)
                .status(UserStatus.ACTIVE)
                .build();
        return createSession(userRepository.saveAndFlush(student));
    }

    private AuthResponse createSession(User savedUser) {
        String token = jwtService.generateToken(savedUser);

        UserResponse userResponse = new UserResponse(
                savedUser.getId(),
                savedUser.getUsername(),
                savedUser.getEmail(),
                savedUser.getFullName(),
                savedUser.getRole().getName(),
                savedUser.getStatus(),
                savedUser.getCreatedAt(),
                savedUser.getUpdatedAt()
        );

        return new AuthResponse(
                token,
                jwtService.computeExpiresAt(),
                jwtService.getExpirationSeconds(),
                userResponse
        );
    }
}
