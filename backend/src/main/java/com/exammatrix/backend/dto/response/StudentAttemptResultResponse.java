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
public class StudentAttemptResultResponse {
    private UUID attemptId;
    private Integer attemptNumber;
    private UUID paperId;
    private String examCode;
    private String paperTitle;
    private String subjectName;
    private ExamType examType;
    private AttemptStatus status;
    private BigDecimal score;
    private BigDecimal maxScore;
    private BigDecimal scoreOnTen;
    private Integer correctCount;
    private Integer totalQuestions;
    private LocalDateTime startedAt;
    private LocalDateTime submittedAt;
    private LocalDateTime gradedAt;
    private List<StudentAttemptAnswerDetailResponse> answers;
}
