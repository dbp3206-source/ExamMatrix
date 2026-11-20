package com.exammatrix.backend.dto.response;

import com.exammatrix.backend.entity.enums.ClassJoinMode;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TeacherClassResponse {
    private UUID id;
    private UUID teacherId;
    private String teacherName;
    private String name;
    private String classCode;
    private ClassJoinMode joinMode;
    private long studentCount;
    private boolean hasPassword;
    private LocalDateTime createdAt;
}
