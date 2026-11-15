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
public class StudentAttemptAnswerDetailResponse {
    private UUID attemptAnswerId;
    private UUID questionId;
    private Integer questionOrder;
    private String content;
    private QuestionType type;
    private BigDecimal maxScore;
    private List<UUID> selectedAnswerIds;
    private String essayAnswer;
    private BigDecimal awardedScore;
    private String feedback;
    private Boolean isCorrect;
}
