package com.exammatrix.backend.dto.response;

import com.exammatrix.backend.entity.enums.ExamAccessType;
import com.exammatrix.backend.entity.enums.ExamType;

import java.time.LocalDateTime;
import java.util.UUID;

public record ExamPaperSummaryResponse(
        UUID id,
        UUID matrixId,
        String matrixTitle,
        Integer subjectId,
        String subjectCode,
        String subjectName,
        ExamType examType,
        String examCode,
        ExamAccessType accessType,
        Boolean isPublished,
        LocalDateTime createdAt,
        Integer questionCount
) {}
