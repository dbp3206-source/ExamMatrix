package com.exammatrix.backend.dto.response;

import com.exammatrix.backend.entity.enums.QuestionType;
import lombok.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GradingQuestionAnswerResponse {
    private UUID attemptAnswerId;
    private UUID questionId;
    private Integer questionOrder;
    private String content;
    private QuestionType type;
    private BigDecimal points;
    private String essayAnswer;
    private String referenceAnswer;
    private List<UUID> selectedAnswerIds;
    private List<AnswerResponse> options;
    private BigDecimal awardedScore;
    private String feedback;
    private Boolean isCorrect;
}
