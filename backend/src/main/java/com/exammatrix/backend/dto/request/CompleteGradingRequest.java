package com.exammatrix.backend.dto.request;

import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CompleteGradingRequest {
    private String status;
}
