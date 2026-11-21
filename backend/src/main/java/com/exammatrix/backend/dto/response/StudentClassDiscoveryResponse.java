package com.exammatrix.backend.dto.response;

import com.exammatrix.backend.entity.enums.ClassJoinMode;

import java.util.List;
import java.util.UUID;

public record StudentClassDiscoveryResponse(
        StudentAssignmentResponse activeAssignment,
        StudentAssignmentResponse pendingAssignment,
        StudentAssignmentResponse latestAssignment,
        List<StudentAssignmentResponse> approvedClasses,
        List<StudentAssignmentResponse> pendingRequests,
        List<StudentAssignmentResponse> history,
        List<DiscoverableClassItem> availableClasses
) {
    public record DiscoverableClassItem(
            UUID classId,
            String className,
            String classCode,
            UUID teacherId,
            String teacherName,
            ClassJoinMode joinMode,
            boolean requiresPassword,
            long studentCount,
            boolean alreadyApproved,
            boolean alreadyPending
    ) {}
}
