package com.exammatrix.backend.service;

import com.exammatrix.backend.dto.request.StudentRegisterRequest;
import com.exammatrix.backend.dto.response.AuthResponse;
import org.springframework.security.oauth2.jwt.Jwt;

public interface StudentAuthService {
    AuthResponse registerStudent(StudentRegisterRequest request);
    AuthResponse loginWithGoogle(Jwt identity);
}
