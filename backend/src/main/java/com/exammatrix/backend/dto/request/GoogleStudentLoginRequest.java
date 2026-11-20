package com.exammatrix.backend.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record GoogleStudentLoginRequest(@NotBlank @Size(max = 8192) String credential) {}
