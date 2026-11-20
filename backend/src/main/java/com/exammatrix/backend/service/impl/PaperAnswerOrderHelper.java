package com.exammatrix.backend.service.impl;

import com.exammatrix.backend.entity.Answer;
import com.exammatrix.backend.entity.Question;
import com.exammatrix.backend.entity.enums.QuestionType;

import java.util.*;

final class PaperAnswerOrderHelper {
    private PaperAnswerOrderHelper() {
    }

    static List<Answer> orderAnswersForPaper(UUID paperId, Question question) {
        if (question == null || question.getAnswers() == null || question.getAnswers().isEmpty()) {
            return Collections.emptyList();
        }
        List<Answer> answers = new ArrayList<>(question.getAnswers());
        answers.sort(Comparator.comparing(Answer::getId, Comparator.nullsLast(Comparator.naturalOrder())));

        if (question.getType() == QuestionType.TRUE_FALSE) {
            answers.sort((a, b) -> {
                String ca = a.getContent() != null ? a.getContent().trim().toLowerCase(Locale.ROOT) : "";
                String cb = b.getContent() != null ? b.getContent().trim().toLowerCase(Locale.ROOT) : "";
                if ("đúng".equals(ca) && !"đúng".equals(cb)) return -1;
                if (!"đúng".equals(ca) && "đúng".equals(cb)) return 1;
                return ca.compareTo(cb);
            });
            return answers;
        }

        if (paperId != null && question.getId() != null && answers.size() > 1) {
            long seed = paperId.getMostSignificantBits()
                    ^ paperId.getLeastSignificantBits()
                    ^ question.getId().getMostSignificantBits()
                    ^ question.getId().getLeastSignificantBits();
            Collections.shuffle(answers, new Random(seed));
        }
        return answers;
    }
}
