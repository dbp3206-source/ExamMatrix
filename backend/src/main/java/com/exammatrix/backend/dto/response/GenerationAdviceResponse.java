package com.exammatrix.backend.dto.response;

import com.exammatrix.backend.entity.enums.Difficulty;
import com.exammatrix.backend.entity.enums.ExamType;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record GenerationAdviceResponse(
        boolean recommended,
        String reasonCode,
        String reasonMessage,
        String actionTitle,
        String snapshotVersion,
        UUID classId,
        String className,
        long classStudentCount,
        ExamType examType,
        int totalQuestions,
        BigDecimal totalPoints,
        int requestedNumberOfPapers,
        CellAdjustment increaseCell,
        CellAdjustment decreaseCell,
        List<BatchHistoryItem> batchHistory,
        List<AllocationCell> currentAllocation,
        List<AllocationCell> proposedAllocation,
        List<CellEvidenceItem> cellEvidences
) {
    public record CellAdjustment(
            Integer chapterId,
            String chapterName,
            Difficulty difficulty,
            int currentCount,
            int proposedCount,
            int availableInBank,
            String reason,
            int eligibleStudents,
            int strugglingStudents,
            int observedStudents,
            double strugglingRatePercent
    ) {}

    public record AllocationCell(
            Integer chapterId,
            String chapterName,
            Difficulty difficulty,
            int count,
            double percent
    ) {}

    public record BatchHistoryItem(
            UUID requestId,
            String label,
            String matrixTitle,
            LocalDateTime createdAt,
            int totalQuestions,
            int paperCount,
            String source,
            List<AllocationCell> allocations
    ) {}

    public record BatchCellBreakdown(
            UUID requestId,
            String label,
            int studentCount,
            int distinctQuestionCount,
            int wrongCount,
            int blankCount
    ) {}

    public record QuestionEvidenceItem(
            UUID questionId,
            String questionSnippet,
            List<String> batchLabels,
            int observedStudents,
            int correctCount,
            int wrongCount,
            int blankCount,
            int partialCount,
            int waitingGradingCount
    ) {}

    public record CellEvidenceItem(
            Integer chapterId,
            String chapterName,
            Difficulty difficulty,
            boolean isTargetIncrease,
            boolean isTargetDecrease,
            int eligibleStudents,
            int strugglingStudents,
            int observedStudents,
            long classStudentCount,
            double coveragePercent,
            double strugglingRatePercent,
            int repeatedBatchCount,
            int correctCount,
            int wrongCount,
            int blankCount,
            int partialCount,
            int waitingGradingCount,
            List<BatchCellBreakdown> batchBreakdowns,
            List<QuestionEvidenceItem> questions
    ) {}
}
