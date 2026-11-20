package com.exammatrix.backend.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.math.BigDecimal;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GenerateExamPapersRequest {
    @NotNull(message = "Số mã đề không được để trống")
    @DecimalMin(value = "1", message = "Phải sinh ít nhất 1 mã đề")
    @DecimalMax(value = "20", message = "Chỉ được sinh tối đa 20 mã đề một lần")
    private BigDecimal numberOfPapers;
    private UUID requestId;
    private String snapshotVersion;
    @Valid
    private AdviceAdjustmentRequest adviceAdjustment;

    public GenerateExamPapersRequest(BigDecimal numberOfPapers) {
        this.numberOfPapers = numberOfPapers;
    }

    public GenerateExamPapersRequest(BigDecimal numberOfPapers, UUID requestId) {
        this.numberOfPapers = numberOfPapers;
        this.requestId = requestId;
    }
}
