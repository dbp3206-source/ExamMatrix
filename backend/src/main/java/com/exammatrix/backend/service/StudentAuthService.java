package com.exammatrix.backend.service;

import com.exammatrix.backend.dto.request.StudentRegisterRequest;
import com.exammatrix.backend.dto.response.AuthResponse;

public interface StudentAuthService {
    AuthResponse registerStudent(StudentRegisterRequest request);
}
