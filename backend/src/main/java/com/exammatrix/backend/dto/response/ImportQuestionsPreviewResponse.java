package com.exammatrix.backend.dto.response;

import lombok.*;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ImportQuestionsPreviewResponse {
    private String fileName;
    private int totalParsed;
    private int validCount;
    private int errorCount;
    private List<ImportQuestionItemResponse> items;
}
