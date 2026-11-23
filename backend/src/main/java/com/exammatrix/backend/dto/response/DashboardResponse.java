package com.exammatrix.backend.dto.response;

import lombok.*;

import java.io.Serializable;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DashboardResponse implements Serializable {
    private static final long serialVersionUID = 1L;

    private Long totalSubjects;
    private Long totalChapters;
    private Long totalQuestions;
    private Long totalMatrices;
    private Long totalPapers;
    private List<DifficultyCountResponse> difficulty;
    private List<ExamMatrixResponse> recentMatrices;
}
