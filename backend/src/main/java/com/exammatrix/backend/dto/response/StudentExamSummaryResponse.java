package com.exammatrix.backend.dto.response;

import com.exammatrix.backend.entity.enums.AttemptStatus;
import com.exammatrix.backend.entity.enums.ExamAccessType;
import com.exammatrix.backend.entity.enums.ExamType;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StudentExamSummaryResponse {
    private UUID paperId;
    private String examCode;
    private String title;
    private String teacherName;
    private String subjectName;
    private ExamType examType;
    private Integer duration;
    private Integer totalQuestions;
    private ExamAccessType accessType;
    private AttemptStatus attemptStatus;
    private UUID attemptId;
    private LocalDateTime createdAt;
}
