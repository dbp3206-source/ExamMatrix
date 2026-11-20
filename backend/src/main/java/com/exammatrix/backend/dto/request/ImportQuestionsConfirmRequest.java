package com.exammatrix.backend.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.*;

import java.util.List;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ImportQuestionsConfirmRequest {
    private UUID requestId;

    private Integer subjectId;

    @NotEmpty(message = "Danh sách câu hỏi cần import không được để trống")
    @Valid
    @Size(max = 500, message = "Mỗi lần chỉ được nhập tối đa 500 câu hỏi")
    private List<@NotNull(message = "Câu hỏi import không được để trống") ImportQuestionItemRequest> items;
}
