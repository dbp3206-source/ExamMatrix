package com.exammatrix.backend.service;

import com.exammatrix.backend.dto.request.ReviewStudentAssignmentRequest;
import com.exammatrix.backend.dto.request.UpdateTeacherClassRequest;
import com.exammatrix.backend.dto.response.PageResponse;
import com.exammatrix.backend.dto.response.StudentAssignmentResponse;
import com.exammatrix.backend.dto.response.TeacherClassResponse;
import com.exammatrix.backend.entity.enums.StudentAssignmentStatus;
import org.springframework.data.domain.Pageable;

import java.util.UUID;

public interface TeacherClassService {
    TeacherClassResponse getOrCreateCurrentTeacherClass();

    TeacherClassResponse updateCurrentTeacherClass(UpdateTeacherClassRequest request);

    PageResponse<StudentAssignmentResponse> getTeacherStudents(
            StudentAssignmentStatus status,
            Pageable pageable
    );

    StudentAssignmentResponse reviewStudentAssignment(
            UUID assignmentId,
            ReviewStudentAssignmentRequest request
    );
}
