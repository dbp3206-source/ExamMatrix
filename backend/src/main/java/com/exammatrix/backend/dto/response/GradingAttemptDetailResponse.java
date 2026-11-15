package com.exammatrix.backend.dto.response;

import com.exammatrix.backend.entity.enums.AttemptStatus;
import com.exammatrix.backend.entity.enums.ExamType;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GradingAttemptDetailResponse {
    private UUID attemptId;
    private UUID paperId;
    private String paperTitle;
    private UUID studentId;
    private String studentName;
    private String studentEmail;
    private LocalDateTime submittedAt;
    private AttemptStatus status;
    private ExamType examType;
    private BigDecimal score;
    private BigDecimal maxScore;
    private List<GradingQuestionAnswerResponse> answers;
}
