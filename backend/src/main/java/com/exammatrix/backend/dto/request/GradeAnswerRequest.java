package com.exammatrix.backend.dto.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GradeAnswerRequest {
    @NotNull(message = "Điểm chấm không được để trống")
    @DecimalMin(value = "0.0", message = "Điểm phải lớn hơn hoặc bằng 0")
    private BigDecimal awardedScore;

    private String feedback;
}
