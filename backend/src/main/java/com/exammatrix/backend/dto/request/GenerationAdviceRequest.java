package com.exammatrix.backend.dto.request;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GenerationAdviceRequest {
    @NotNull(message = "Số mã đề không được để trống")
    @DecimalMin(value = "1", message = "Phải sinh ít nhất 1 mã đề")
    @DecimalMax(value = "20", message = "Chỉ được sinh tối đa 20 mã đề một lần")
    private BigDecimal numberOfPapers;
}
