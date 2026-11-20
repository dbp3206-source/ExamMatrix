package com.exammatrix.backend.dto.request;

import lombok.*;

import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class JoinClassRequest {
    private UUID teacherId;
    private String classCode;
    private String password;
}
