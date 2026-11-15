package com.exammatrix.backend.dto.response;

import com.exammatrix.backend.dto.request.AnswerRequest;
import com.exammatrix.backend.entity.enums.Difficulty;
import com.exammatrix.backend.entity.enums.QuestionType;
import lombok.*;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ImportQuestionItemResponse {
    private int itemIndex;
    private Integer chapterId;
    private String chapterName;
    private String content;
    private Difficulty difficulty;
    private QuestionType type;
    private String referenceAnswer;
    private List<AnswerRequest> answers;
    private boolean valid;
    private List<String> errors;
}
