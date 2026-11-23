package com.exammatrix.backend.dto.response;

import com.exammatrix.backend.entity.enums.AttemptStatus;
import com.exammatrix.backend.entity.enums.ExamType;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

public record TeacherResultRowResponse(
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
        AttemptStatus status,
        BigDecimal scoreOnTen,
        BigDecimal rawScore,
        BigDecimal maxScore,
        LocalDateTime startedAt,
        LocalDateTime submittedAt,
        LocalDateTime gradedAt,
        String gradedByName,
        String relationLabel,
        Integer attemptNumber
) {
}
