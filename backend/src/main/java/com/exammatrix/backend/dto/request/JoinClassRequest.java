package com.exammatrix.backend.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.*;

import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class JoinClassRequest {
    private UUID teacherId;
    private String classCode;

    @NotBlank(message = "Mật khẩu lớp học không được để trống")
    private String password;
}
