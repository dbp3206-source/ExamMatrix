package com.exammatrix.backend.dto.request;

import com.exammatrix.backend.entity.enums.Difficulty;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AdviceAdjustmentRequest {
    @NotNull(message = "Thiếu chương tăng câu hỏi")
    private Integer increaseChapterId;

    @NotNull(message = "Thiếu chương giảm câu hỏi")
    private Integer decreaseChapterId;

    @NotNull(message = "Thiếu độ khó điều chỉnh")
    private Difficulty difficulty;
}
