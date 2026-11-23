package com.exammatrix.backend.dto.response;

import com.exammatrix.backend.entity.enums.ExamType;
import lombok.*;

import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ExamMatrixResponse implements Serializable {
    private static final long serialVersionUID = 1L;

    private UUID id;
    private UUID teacherId;
    private Integer subjectId;
    private String title;
    private Integer duration;
    private Integer totalQuestions;
    private ExamType examType;
    private List<MatrixConfigResponse> configs;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
