package com.exammatrix.backend.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UpdateTeacherClassRequest {
    @NotBlank(message = "Tên lớp không được để trống")
    @Size(max = 100, message = "Tên lớp không được vượt quá 100 ký tự")
    private String name;

    @NotBlank(message = "Mã lớp không được để trống")
    @Size(max = 50, message = "Mã lớp không được vượt quá 50 ký tự")
    private String classCode;

    private String password;
}
