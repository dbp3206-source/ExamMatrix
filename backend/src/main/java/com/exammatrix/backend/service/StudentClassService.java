package com.exammatrix.backend.service;

import com.exammatrix.backend.dto.request.JoinClassRequest;
import com.exammatrix.backend.dto.response.StudentAssignmentResponse;
import com.exammatrix.backend.dto.response.StudentClassDiscoveryResponse;
import com.exammatrix.backend.dto.response.UserResponse;

import java.util.List;

public interface StudentClassService {
    List<UserResponse> getAvailableTeachers();

    StudentAssignmentResponse getCurrentAssignment();

    StudentClassDiscoveryResponse getClassDiscovery();

    StudentAssignmentResponse joinClass(JoinClassRequest request);
}
