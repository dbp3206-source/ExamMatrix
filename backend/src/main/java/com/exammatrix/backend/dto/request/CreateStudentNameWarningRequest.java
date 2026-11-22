package com.exammatrix.backend.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CreateStudentNameWarningRequest {
    @NotBlank(message = "Nội dung cảnh báo không được để trống")
    @Size(max = 500, message = "Nội dung cảnh báo không được vượt quá 500 ký tự")
    private String reason;
}
