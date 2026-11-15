package com.exammatrix.backend.dto.response;

import com.exammatrix.backend.entity.enums.ExamAccessType;
import com.exammatrix.backend.entity.enums.ExamType;
import lombok.*;

import java.util.List;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StudentExamDetailResponse {
    private UUID paperId;
    private String examCode;
    private String title;
    private String subjectName;
    private ExamType examType;
    private Integer duration;
    private Integer totalQuestions;
    private String teacherName;
    private ExamAccessType accessType;
    private List<StudentQuestionResponse> questions;
}
