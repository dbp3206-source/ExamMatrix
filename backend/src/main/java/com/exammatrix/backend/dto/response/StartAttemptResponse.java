package com.exammatrix.backend.dto.response;

import com.exammatrix.backend.entity.enums.AttemptStatus;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StartAttemptResponse {
    private UUID attemptId;
    private LocalDateTime startedAt;
    private Integer durationMinutes;
    private Long remainingSeconds;
    private AttemptStatus status;
}
