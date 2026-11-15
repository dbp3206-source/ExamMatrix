package com.exammatrix.backend.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import lombok.*;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ImportQuestionsConfirmRequest {
    private Integer subjectId;

    @NotEmpty(message = "Danh sách câu hỏi cần import không được để trống")
    @Valid
    private List<ImportQuestionItemRequest> items;
}
