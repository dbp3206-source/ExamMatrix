package com.exammatrix.backend.dto.response;

import com.exammatrix.backend.entity.enums.AttemptStatus;
import com.exammatrix.backend.entity.enums.Difficulty;
import com.exammatrix.backend.entity.enums.ExamAccessType;
import com.exammatrix.backend.entity.enums.QuestionType;
import com.exammatrix.backend.entity.enums.UserStatus;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DashboardAnalyticsResponse {
    private String role;
    private String scope;
    private String period;
    private LocalDateTime generatedAt;

    private List<QuestionDistribution> questionDistribution;
    private List<ScoreBand> scoreDistribution;
    private long scoreSampleCount;
    private long scoreSourceCount;
    private int scoreSampleLimit;
    private long invalidScoreCount;
    private PageResponse<PendingGradingSummaryResponse> gradingQueue;

    private List<TeacherSubjectPieItem> teacherSubjectQuestionCounts;
    private Integer selectedSubjectId;
    private List<DifficultyCountResponse> teacherDifficultyBreakdown;
    private TeacherScoreHistogram teacherScoreHistogram;

    private List<SubjectCoverage> subjectCoverage;
    private List<MonthlyPaperCount> paperTimeline;
    private List<PaperVisibilityCount> paperVisibility;
    private List<UserRoleStatusCount> userStates;

    private AdminWeeklyVisits adminWeeklyVisits;
    private List<AdminTeacherRankItem> adminTeacherLeaderboard;
    private List<AdminStudentRankItem> adminStudentLeaderboard;

    private List<StudentAttemptSummary> studentAttempts;
    private long studentAttemptTotal;
    private List<StudentSubjectResult> studentSubjectResults;
    private List<ChapterAnswerProgress> studentChapterProgress;
    private long studentChapterAnswerCount;

    public record TeacherSubjectPieItem(Integer subjectId, String subjectName, long count) {}

    public record TeacherScoreHistogram(
            Integer subjectId,
            Integer days,
            long sampleSize,
            BigDecimal mean,
            BigDecimal median,
            List<ScoreBand> bins
    ) {}

    public record TopVisitor(UUID userId, String fullName, long visits) {}

    public record DailyVisitStat(
            LocalDate date,
            String dayLabel,
            long teacherVisits,
            long studentVisits,
            boolean dataCollected,
            TopVisitor topTeacher,
            TopVisitor topStudent
    ) {}

    public record AdminWeeklyVisits(
            LocalDate weekStart,
            LocalDate weekEnd,
            LocalDate earliestCollectedDate,
            List<DailyVisitStat> days
    ) {}

    public record AdminTeacherRankItem(
            int rank,
            UUID userId,
            String fullName,
            String email,
            long gradedEssaysCount,
            long publishedBatchCount,
            Integer previousRank,
            Integer rankDelta,
            boolean isNew,
            boolean isTopClimber
    ) {}

    public record AdminStudentRankItem(
            int rank,
            UUID userId,
            String fullName,
            String email,
            long totalAttempts,
            long highScoreCount,
            BigDecimal highScoreRate,
            BigDecimal highestScore,
            Integer previousRank,
            Integer rankDelta,
            boolean isNew,
            boolean isTopClimber
    ) {}

    public record QuestionDistribution(QuestionType type, Difficulty difficulty, long count) {}

    public record ScoreBand(
            String key,
            String label,
            BigDecimal lowerBound,
            BigDecimal upperBound,
            boolean includesUpperBound,
            long count
    ) {}

    public record SubjectCoverage(
            Integer subjectId,
            String subjectName,
            long chapterCount,
            long questionCount,
            long chaptersWithoutQuestions
    ) {}

    public record MonthlyPaperCount(String month, long count) {}

    public record PaperVisibilityCount(ExamAccessType accessType, boolean published, long count) {}

    public record UserRoleStatusCount(String role, UserStatus status, long count) {}

    public record StudentAttemptSummary(
            UUID attemptId,
            UUID paperId,
            String paperTitle,
            String examCode,
            Integer subjectId,
            String subjectName,
            AttemptStatus status,
            BigDecimal score,
            BigDecimal maxScore,
            BigDecimal scoreOnTen,
            LocalDateTime startedAt,
            LocalDateTime submittedAt,
            LocalDateTime gradedAt,
            Integer attemptNumber
    ) {}

    public record StudentSubjectResult(
            Integer subjectId,
            String subjectName,
            long attemptCount,
            BigDecimal earnedScore,
            BigDecimal maximumScore,
            BigDecimal averageOnTen
    ) {}

    public record ChapterAnswerProgress(
            Integer subjectId,
            String subjectName,
            Integer chapterId,
            String chapterName,
            long answeredCount,
            long correctCount,
            long incorrectCount
    ) {}
}
