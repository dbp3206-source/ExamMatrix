package com.exammatrix.backend.dto.response;

public record StudentSubjectExamCountResponse(
        Integer subjectId,
        String subjectCode,
        String subjectName,
        long examCount
) {}
