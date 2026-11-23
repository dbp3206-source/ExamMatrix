package com.exammatrix.backend.dto.response;

import com.exammatrix.backend.entity.enums.ExamType;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

public record AdminResultRowResponse(
        UUID attemptId,
        UUID studentId,
        String studentName,
        String studentEmail,
        String className,
        String classCode,
        Integer subjectId,
        String subjectName,
        UUID paperId,
        String paperTitle,
        String examCode,
        ExamType examType,
        BigDecimal scoreOnTen,
        BigDecimal rawScore,
        BigDecimal maxScore,
        LocalDateTime gradedAt,
        LocalDateTime submittedAt,
        String gradedByName,
        boolean inTeacherClass,
        boolean isAssignedPaper,
        String relationLabel,
        Integer attemptNumber
) {}
