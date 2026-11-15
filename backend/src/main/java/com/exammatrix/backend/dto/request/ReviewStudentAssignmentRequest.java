package com.exammatrix.backend.dto.request;

import com.exammatrix.backend.entity.enums.StudentAssignmentStatus;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ReviewStudentAssignmentRequest {
    @NotNull(message = "Trạng thái không được để trống")
    private StudentAssignmentStatus status;

    @Size(max = 500, message = "Ghi chú tối đa 500 ký tự")
    private String decisionNote;
}
