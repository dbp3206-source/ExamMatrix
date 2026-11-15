package com.exammatrix.backend.dto.response;

import com.exammatrix.backend.entity.enums.StudentAssignmentStatus;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StudentAssignmentResponse {
    private UUID id;
    private UUID studentId;
    private String studentName;
    private String studentEmail;
    private UUID teacherId;
    private String teacherName;
    private String teacherEmail;
    private String classCode;
    private String className;
    private StudentAssignmentStatus status;
    private LocalDateTime requestedAt;
    private LocalDateTime reviewedAt;
    private String decisionNote;
}
