package com.exammatrix.backend.service;

import com.exammatrix.backend.dto.request.CreateStudentNameWarningRequest;
import com.exammatrix.backend.dto.response.StudentNameWarningResponse;

import java.util.List;
import java.util.UUID;

public interface StudentNameWarningService {
    StudentNameWarningResponse sendWarning(UUID studentId, CreateStudentNameWarningRequest request);

    List<StudentNameWarningResponse> getWarningsForStudent(UUID studentId);

    List<StudentNameWarningResponse> getMyWarnings();

    StudentNameWarningResponse markMyWarningAsRead(UUID warningId);
}
