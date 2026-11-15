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
public class StudentQuestionResponse {
    private UUID id;
    private Integer questionOrder;
    private String content;
    private QuestionType type;
    private Difficulty difficulty;
    private BigDecimal points;
    private List<StudentAnswerChoiceResponse> answers;
}
