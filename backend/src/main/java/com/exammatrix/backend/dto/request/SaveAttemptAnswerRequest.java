package com.exammatrix.backend.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.util.List;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SaveAttemptAnswerRequest {
    @NotNull(message = "ID câu hỏi không được để trống")
    private UUID questionId;

    private List<UUID> selectedAnswerIds;

    private String essayAnswer;
}
