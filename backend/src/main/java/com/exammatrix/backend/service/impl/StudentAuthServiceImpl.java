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
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.Locale;

@Service
@RequiredArgsConstructor
public class StudentAuthServiceImpl implements StudentAuthService {
    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    @Override
    @Transactional
    public AuthResponse registerStudent(StudentRegisterRequest request) {
        String normalizedUsername = request.getUsername().trim().toLowerCase(Locale.ROOT);
        String normalizedEmail = request.getEmail().trim().toLowerCase(Locale.ROOT);

        if (userRepository.existsByUsernameIgnoreCase(normalizedUsername)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Tên đăng nhập đã tồn tại");
        }

        if (userRepository.existsByEmailIgnoreCase(normalizedEmail)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email đã được sử dụng");
        }

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

        User savedUser = userRepository.save(user);
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

        return new AuthResponse(token, userResponse);
    }
}
