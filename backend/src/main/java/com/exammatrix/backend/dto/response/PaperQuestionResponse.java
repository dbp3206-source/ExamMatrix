package com.exammatrix.backend.dto.response;

import com.exammatrix.backend.entity.enums.Difficulty;
import com.exammatrix.backend.entity.enums.QuestionType;
import lombok.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PaperQuestionResponse {
    private UUID id;
    private Integer questionOrder;
    private String content;
    private QuestionType type;
    private Difficulty difficulty;
    private List<AnswerResponse> answers;
    private String referenceAnswer;
    private BigDecimal points;

    public PaperQuestionResponse(
            UUID id,
            Integer questionOrder,
            String content,
            QuestionType type,
            Difficulty difficulty,
            List<AnswerResponse> answers,
            String referenceAnswer
    ) {
        this.id = id;
        this.questionOrder = questionOrder;
        this.content = content;
        this.type = type;
        this.difficulty = difficulty;
        this.answers = answers;
        this.referenceAnswer = referenceAnswer;
        this.points = null;
    }
}
