package com.exammatrix.backend.dto.request;

import com.exammatrix.backend.entity.enums.ExamAccessType;
import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UpdateExamPaperAccessRequest {
    private ExamAccessType accessType;
    private Boolean isPublished;
}
