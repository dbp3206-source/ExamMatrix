package com.exammatrix.backend.dto.request;

import com.exammatrix.backend.entity.enums.Difficulty;
import com.exammatrix.backend.entity.enums.QuestionType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ImportQuestionItemRequest {
    @NotNull(message = "ID chương không được để trống")
    private Integer chapterId;

    @NotBlank(message = "Nội dung câu hỏi không được để trống")
    private String content;

    @NotNull(message = "Độ khó không được để trống")
    private Difficulty difficulty;

    @NotNull(message = "Loại câu hỏi không được để trống")
    private QuestionType type;

    private String referenceAnswer;

    private List<AnswerRequest> answers;
}
