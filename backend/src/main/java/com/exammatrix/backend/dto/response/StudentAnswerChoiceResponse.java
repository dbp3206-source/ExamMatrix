package com.exammatrix.backend.dto.response;

import lombok.*;

import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StudentAnswerChoiceResponse {
    private UUID id;
    private String content;
}
