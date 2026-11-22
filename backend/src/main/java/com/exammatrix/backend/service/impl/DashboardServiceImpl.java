package com.exammatrix.backend.service.impl;

import com.exammatrix.backend.dto.response.*;
import com.exammatrix.backend.entity.ExamMatrix;
import com.exammatrix.backend.entity.ExamMatrixConfig;
import com.exammatrix.backend.entity.StudentAttemptAnswer;
import com.exammatrix.backend.entity.StudentExamAttempt;
import com.exammatrix.backend.entity.User;
import com.exammatrix.backend.entity.enums.*;
import com.exammatrix.backend.repository.*;
import com.exammatrix.backend.security.CurrentUserService;
import com.exammatrix.backend.security.RolePolicy;
import com.exammatrix.backend.service.DashboardService;
import com.exammatrix.backend.service.ScoreScaleService;
import com.exammatrix.backend.service.TeacherGradingService;
import com.exammatrix.backend.service.UserVisitSessionService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.temporal.TemporalAdjusters;
import java.util.*;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DashboardServiceImpl implements DashboardService {
    private static final int SCORE_SAMPLE_LIMIT = 500;
    private static final int STUDENT_ATTEMPT_SAMPLE_LIMIT = 20;
    private static final int LEADERBOARD_LIMIT = 10;
    private static final String[] VIETNAMESE_DAYS = {
            "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ nhật"
    };

    private final SubjectRepository subjectRepository;
    private final ChapterRepository chapterRepository;
    private final QuestionRepository questionRepository;
    private final ExamMatrixRepository examMatrixRepository;
    private final ExamPaperRepository examPaperRepository;
    private final UserRepository userRepository;
    private final StudentExamAttemptRepository studentExamAttemptRepository;
    private final StudentAttemptAnswerRepository studentAttemptAnswerRepository;
    private final UserVisitSessionRepository userVisitSessionRepository;
    private final TeacherGradingService teacherGradingService;
    private final ScoreScaleService scoreScaleService;
    private final CurrentUserService currentUserService;

    @Override
    public DashboardResponse getSummary() {
        User currentUser = currentUserService.getCurrentUser();
        boolean admin = isAdmin(currentUser);

        long totalSubjects = subjectRepository.count();
        long totalChapters = chapterRepository.count();
        long totalQuestions = questionRepository.count();

        long totalMatrices;
        long totalPapers;
        List<ExamMatrix> recentMatrices;

        if (admin) {
            totalMatrices = examMatrixRepository.count();
            totalPapers = examPaperRepository.count();
            recentMatrices = examMatrixRepository.findTop5ByOrderByUpdatedAtDesc();
        } else {
            totalMatrices = examMatrixRepository.countByTeacher_Id(currentUser.getId());
            totalPapers = examPaperRepository.countByExamMatrix_Teacher_Id(currentUser.getId());
            recentMatrices = examMatrixRepository.findTop5ByTeacher_IdOrderByUpdatedAtDesc(currentUser.getId());
        }

        List<DifficultyCountResponse> difficulty = new ArrayList<>();
        for (Difficulty value : Difficulty.values()) {
            long count = questionRepository.countByDifficulty(value);
            difficulty.add(new DifficultyCountResponse(value, count));
        }

        List<ExamMatrixResponse> recentResponses = new ArrayList<>();
        for (ExamMatrix matrix : recentMatrices) {
            recentResponses.add(convertMatrixToResponse(matrix));
        }

        return new DashboardResponse(
                totalSubjects,
                totalChapters,
                totalQuestions,
                totalMatrices,
                totalPapers,
                difficulty,
                recentResponses
        );
    }

    @Override
    public DashboardAnalyticsResponse getAnalytics() {
        return getAnalytics(null, null, null);
    }

    @Override
    public DashboardAnalyticsResponse getAnalytics(LocalDate weekStart, Integer subjectId, Integer days) {
        User currentUser = currentUserService.getCurrentUser();
        if (isAdmin(currentUser)) return getAdminAnalytics(weekStart);
        if (isTeacher(currentUser)) return getTeacherAnalytics(currentUser, subjectId, days);
        if (isStudent(currentUser)) return getStudentAnalytics(currentUser);
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Vai trò hiện tại không có dashboard");
    }

    private DashboardAnalyticsResponse getAdminAnalytics(LocalDate requestedWeekStart) {
        LocalDateTime now = LocalDateTime.now(UserVisitSessionService.VIETNAM_ZONE);
        LocalDate today = now.toLocalDate();
        LocalDate monday = (requestedWeekStart != null ? requestedWeekStart : today)
                .with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        LocalDate sunday = monday.plusDays(6);

        LocalDate earliestCollected = userVisitSessionRepository.findEarliestVisitDate();

        Map<String, Long> visitCounts = new HashMap<>();
        for (Object[] row : userVisitSessionRepository.countVisitsByDateAndRole(monday, sunday)) {
            LocalDate date = (LocalDate) row[0];
            String role = (String) row[1];
            visitCounts.put(date + ":" + role, numberAsLong(row[2]));
        }

        Map<String, DashboardAnalyticsResponse.TopVisitor> topVisitorMap = new HashMap<>();
        for (Object[] row : userVisitSessionRepository.countVisitsByDateRoleAndUser(monday, sunday)) {
            LocalDate date = (LocalDate) row[0];
            String role = (String) row[1];
            UUID userId = (UUID) row[2];
            String fullName = (String) row[3];
            long count = numberAsLong(row[4]);
            String key = date + ":" + role;
            DashboardAnalyticsResponse.TopVisitor currentTop = topVisitorMap.get(key);
            if (currentTop == null
                    || count > currentTop.visits()
                    || (count == currentTop.visits() && userId.compareTo(currentTop.userId()) < 0)) {
                topVisitorMap.put(key, new DashboardAnalyticsResponse.TopVisitor(userId, fullName, count));
            }
        }

        List<DashboardAnalyticsResponse.DailyVisitStat> dailyStats = new ArrayList<>(7);
        for (int i = 0; i < 7; i++) {
            LocalDate date = monday.plusDays(i);
            boolean collected = earliestCollected != null && !date.isBefore(earliestCollected) && !date.isAfter(today);
            long teacherVisits = visitCounts.getOrDefault(date + ":TEACHER", 0L);
            long studentVisits = visitCounts.getOrDefault(date + ":STUDENT", 0L);
            dailyStats.add(new DashboardAnalyticsResponse.DailyVisitStat(
                    date,
                    VIETNAMESE_DAYS[i],
                    teacherVisits,
                    studentVisits,
                    collected,
                    topVisitorMap.get(date + ":TEACHER"),
                    topVisitorMap.get(date + ":STUDENT")
            ));
        }

        DashboardAnalyticsResponse.AdminWeeklyVisits weeklyVisits = new DashboardAnalyticsResponse.AdminWeeklyVisits(
                monday, sunday, earliestCollected, dailyStats
        );

        LocalDateTime startOfToday = today.atStartOfDay();
        List<StudentExamAttempt> allCompleted = studentExamAttemptRepository.findAllCompletedWithDetails();
        List<Object[]> publishedPapers = examPaperRepository.findPublishedPapersForBatchCounting();

        List<DashboardAnalyticsResponse.AdminTeacherRankItem> teacherLeaderboard =
                buildTeacherLeaderboard(allCompleted, publishedPapers, startOfToday);
        List<DashboardAnalyticsResponse.AdminStudentRankItem> studentLeaderboard =
                buildStudentLeaderboard(allCompleted, startOfToday);

        LocalDateTime firstMonth = YearMonth.from(now).minusMonths(5).atDay(1).atStartOfDay();
        List<DashboardAnalyticsResponse.SubjectCoverage> coverage = questionRepository
                .summarizeCoverageBySubject()
                .stream()
                .map(row -> new DashboardAnalyticsResponse.SubjectCoverage(
                        ((Number) row[0]).intValue(),
                        (String) row[1],
                        numberAsLong(row[2]),
                        numberAsLong(row[3]),
                        numberAsLong(row[4])
                ))
                .toList();

        Map<YearMonth, Long> papersByMonth = new HashMap<>();
        for (Object[] row : examPaperRepository.countCreatedByMonthSince(firstMonth)) {
            YearMonth month = YearMonth.of(numberAsInt(row[0]), numberAsInt(row[1]));
            papersByMonth.put(month, numberAsLong(row[2]));
        }
        List<DashboardAnalyticsResponse.MonthlyPaperCount> paperTimeline = new ArrayList<>();
        YearMonth currentMonth = YearMonth.from(now);
        for (int offset = 5; offset >= 0; offset--) {
            YearMonth month = currentMonth.minusMonths(offset);
            paperTimeline.add(new DashboardAnalyticsResponse.MonthlyPaperCount(
                    month.toString(), papersByMonth.getOrDefault(month, 0L)
            ));
        }

        Map<String, Long> visibilityCounts = new HashMap<>();
        for (Object[] row : examPaperRepository.countByVisibilityState()) {
            visibilityCounts.put(visibilityKey(row[0], row[1]), numberAsLong(row[2]));
        }
        List<DashboardAnalyticsResponse.PaperVisibilityCount> visibility = new ArrayList<>();
        for (ExamAccessType accessType : ExamAccessType.values()) {
            for (boolean published : List.of(false, true)) {
                visibility.add(new DashboardAnalyticsResponse.PaperVisibilityCount(
                        accessType, published, visibilityCounts.getOrDefault(visibilityKey(accessType, published), 0L)
                ));
            }
        }

        List<DashboardAnalyticsResponse.UserRoleStatusCount> userStates = userRepository.countByRoleAndStatus()
                .stream()
                .map(row -> new DashboardAnalyticsResponse.UserRoleStatusCount(
                        (String) row[0], (UserStatus) row[1], numberAsLong(row[2])
                ))
                .toList();

        return DashboardAnalyticsResponse.builder()
                .role("ADMIN")
                .scope("Toàn hệ thống")
                .period(monday + " – " + sunday)
                .generatedAt(now)
                .subjectCoverage(coverage)
                .paperTimeline(paperTimeline)
                .paperVisibility(visibility)
                .userStates(userStates)
                .adminWeeklyVisits(weeklyVisits)
                .adminTeacherLeaderboard(teacherLeaderboard)
                .adminStudentLeaderboard(studentLeaderboard)
                .build();
    }

    private List<DashboardAnalyticsResponse.AdminTeacherRankItem> buildTeacherLeaderboard(
            List<StudentExamAttempt> allCompleted,
            List<Object[]> publishedPapers,
            LocalDateTime startOfToday
    ) {
        List<User> teachers = userRepository.findByRole_NameIgnoreCaseAndStatusOrderByFullNameAsc("TEACHER", UserStatus.ACTIVE);
        Map<UUID, User> teacherById = new HashMap<>();
        for (User t : teachers) {
            teacherById.put(t.getId(), t);
        }

        record TeacherScore(User user, long gradedEssays, long publishedBatches) {}

        Map<UUID, Long> todayGraded = new HashMap<>();
        Map<UUID, Long> yesterdayGraded = new HashMap<>();
        for (StudentExamAttempt a : allCompleted) {
            if (a.getExamPaper().getExamMatrix().getExamType() != ExamType.ESSAY) continue;
            User grader = a.getGradedBy() != null ? a.getGradedBy() : a.getTeacher();
            if (grader == null || !teacherById.containsKey(grader.getId())) continue;
            todayGraded.merge(grader.getId(), 1L, Long::sum);
            LocalDateTime ts = a.getGradedAt() != null ? a.getGradedAt() : a.getSubmittedAt();
            if (ts != null && ts.isBefore(startOfToday)) {
                yesterdayGraded.merge(grader.getId(), 1L, Long::sum);
            }
        }

        Map<UUID, Set<UUID>> todayBatches = new HashMap<>();
        Map<UUID, Set<UUID>> yesterdayBatches = new HashMap<>();
        for (Object[] row : publishedPapers) {
            UUID teacherId = (UUID) row[0];
            if (!teacherById.containsKey(teacherId)) continue;
            UUID batchKey = row[1] != null ? (UUID) row[1] : (UUID) row[2];
            LocalDateTime ts = (LocalDateTime) row[3];
            todayBatches.computeIfAbsent(teacherId, k -> new HashSet<>()).add(batchKey);
            if (ts != null && ts.isBefore(startOfToday)) {
                yesterdayBatches.computeIfAbsent(teacherId, k -> new HashSet<>()).add(batchKey);
            }
        }

        Comparator<TeacherScore> comparator = Comparator
                .comparingLong(TeacherScore::gradedEssays).reversed()
                .thenComparing(Comparator.comparingLong(TeacherScore::publishedBatches).reversed())
                .thenComparing(ts -> ts.user().getId());

        List<TeacherScore> todayRanked = teachers.stream()
                .map(t -> new TeacherScore(
                        t,
                        todayGraded.getOrDefault(t.getId(), 0L),
                        todayBatches.getOrDefault(t.getId(), Set.of()).size()
                ))
                .filter(ts -> ts.gradedEssays() > 0 || ts.publishedBatches() > 0)
                .sorted(comparator)
                .toList();

        List<TeacherScore> yesterdayRanked = teachers.stream()
                .map(t -> new TeacherScore(
                        t,
                        yesterdayGraded.getOrDefault(t.getId(), 0L),
                        yesterdayBatches.getOrDefault(t.getId(), Set.of()).size()
                ))
                .filter(ts -> ts.gradedEssays() > 0 || ts.publishedBatches() > 0)
                .sorted(comparator)
                .toList();

        Map<UUID, Integer> yesterdayRankById = new HashMap<>();
        for (int i = 0; i < yesterdayRanked.size(); i++) {
            yesterdayRankById.put(yesterdayRanked.get(i).user().getId(), i + 1);
        }

        int maxPositiveDelta = 0;
        Map<UUID, Integer> deltaById = new HashMap<>();
        for (int i = 0; i < todayRanked.size(); i++) {
            UUID uid = todayRanked.get(i).user().getId();
            Integer prev = yesterdayRankById.get(uid);
            if (prev != null) {
                int delta = prev - (i + 1);
                deltaById.put(uid, delta);
                if (delta > maxPositiveDelta) {
                    maxPositiveDelta = delta;
                }
            }
        }

        final int topDelta = maxPositiveDelta;
        List<DashboardAnalyticsResponse.AdminTeacherRankItem> result = new ArrayList<>();
        int limit = Math.min(LEADERBOARD_LIMIT, todayRanked.size());
        for (int i = 0; i < limit; i++) {
            TeacherScore ts = todayRanked.get(i);
            UUID uid = ts.user().getId();
            Integer prev = yesterdayRankById.get(uid);
            Integer delta = deltaById.get(uid);
            boolean isNew = prev == null;
            boolean isTopClimber = topDelta > 0 && delta != null && delta == topDelta;
            result.add(new DashboardAnalyticsResponse.AdminTeacherRankItem(
                    i + 1,
                    uid,
                    ts.user().getFullName(),
                    ts.user().getEmail(),
                    ts.gradedEssays(),
                    ts.publishedBatches(),
                    prev,
                    delta,
                    isNew,
                    isTopClimber
            ));
        }
        return result;
    }

    private List<DashboardAnalyticsResponse.AdminStudentRankItem> buildStudentLeaderboard(
            List<StudentExamAttempt> allCompleted,
            LocalDateTime startOfToday
    ) {
        List<User> students = userRepository.findByRole_NameIgnoreCaseAndStatusOrderByFullNameAsc("STUDENT", UserStatus.ACTIVE);
        Map<UUID, User> studentById = new HashMap<>();
        for (User s : students) {
            studentById.put(s.getId(), s);
        }

        Map<UUID, long[]> todayStats = new HashMap<>();
        Map<UUID, BigDecimal> todayBest = new HashMap<>();
        Map<UUID, long[]> yesterdayStats = new HashMap<>();
        Map<UUID, BigDecimal> yesterdayBest = new HashMap<>();

        for (StudentExamAttempt a : allCompleted) {
            if (a.getStudent() == null || !studentById.containsKey(a.getStudent().getId())) continue;
            BigDecimal scoreOnTen = scoreScaleService.normalizeToTen(a.getScore(), a.getMaxScore(), a.getScoreOnTen());
            if (scoreOnTen == null) continue;
            boolean high = scoreScaleService.isHighScore(scoreOnTen);
            UUID sid = a.getStudent().getId();
            long[] t = todayStats.computeIfAbsent(sid, k -> new long[2]);
            t[0]++;
            if (high) t[1]++;
            todayBest.merge(sid, scoreOnTen, (prev, cur) -> cur.compareTo(prev) > 0 ? cur : prev);

            LocalDateTime ts = a.getGradedAt() != null ? a.getGradedAt() : a.getSubmittedAt();
            if (ts != null && ts.isBefore(startOfToday)) {
                long[] y = yesterdayStats.computeIfAbsent(sid, k -> new long[2]);
                y[0]++;
                if (high) y[1]++;
                yesterdayBest.merge(sid, scoreOnTen, (prev, cur) -> cur.compareTo(prev) > 0 ? cur : prev);
            }
        }

        record StudentScore(User user, long total, long highCount, BigDecimal rate, BigDecimal highestScore) {}

        Comparator<StudentScore> comparator = Comparator
                .comparing(StudentScore::highestScore).reversed()
                .thenComparing(Comparator.comparingLong(StudentScore::highCount).reversed())
                .thenComparing(Comparator.comparingLong(StudentScore::total).reversed())
                .thenComparing(ss -> ss.user().getId());

        List<StudentScore> todayRanked = students.stream()
                .filter(s -> todayStats.containsKey(s.getId()))
                .map(s -> {
                    long[] st = todayStats.get(s.getId());
                    BigDecimal rate = BigDecimal.valueOf(st[1] * 100L)
                            .divide(BigDecimal.valueOf(st[0]), 1, RoundingMode.HALF_UP);
                    BigDecimal best = todayBest.getOrDefault(s.getId(), BigDecimal.ZERO)
                            .setScale(2, RoundingMode.HALF_UP);
                    return new StudentScore(s, st[0], st[1], rate, best);
                })
                .sorted(comparator)
                .toList();

        List<StudentScore> yesterdayRanked = students.stream()
                .filter(s -> yesterdayStats.containsKey(s.getId()))
                .map(s -> {
                    long[] st = yesterdayStats.get(s.getId());
                    BigDecimal rate = BigDecimal.valueOf(st[1] * 100L)
                            .divide(BigDecimal.valueOf(st[0]), 1, RoundingMode.HALF_UP);
                    BigDecimal best = yesterdayBest.getOrDefault(s.getId(), BigDecimal.ZERO)
                            .setScale(2, RoundingMode.HALF_UP);
                    return new StudentScore(s, st[0], st[1], rate, best);
                })
                .sorted(comparator)
                .toList();

        Map<UUID, Integer> yesterdayRankById = new HashMap<>();
        for (int i = 0; i < yesterdayRanked.size(); i++) {
            yesterdayRankById.put(yesterdayRanked.get(i).user().getId(), i + 1);
        }

        int maxPositiveDelta = 0;
        Map<UUID, Integer> deltaById = new HashMap<>();
        for (int i = 0; i < todayRanked.size(); i++) {
            UUID uid = todayRanked.get(i).user().getId();
            Integer prev = yesterdayRankById.get(uid);
            if (prev != null) {
                int delta = prev - (i + 1);
                deltaById.put(uid, delta);
                if (delta > maxPositiveDelta) {
                    maxPositiveDelta = delta;
                }
            }
        }

        final int topDelta = maxPositiveDelta;
        List<DashboardAnalyticsResponse.AdminStudentRankItem> result = new ArrayList<>();
        int limit = Math.min(LEADERBOARD_LIMIT, todayRanked.size());
        for (int i = 0; i < limit; i++) {
            StudentScore ss = todayRanked.get(i);
            UUID uid = ss.user().getId();
            Integer prev = yesterdayRankById.get(uid);
            Integer delta = deltaById.get(uid);
            boolean isNew = prev == null;
            boolean isTopClimber = topDelta > 0 && delta != null && delta == topDelta;
            result.add(new DashboardAnalyticsResponse.AdminStudentRankItem(
                    i + 1,
                    uid,
                    ss.user().getFullName(),
                    ss.user().getEmail(),
                    ss.total(),
                    ss.highCount(),
                    ss.rate(),
                    ss.highestScore(),
                    prev,
                    delta,
                    isNew,
                    isTopClimber
            ));
        }
        return result;
    }

    private DashboardAnalyticsResponse getTeacherAnalytics(User teacher, Integer subjectId, Integer days) {
        LocalDateTime now = LocalDateTime.now(UserVisitSessionService.VIETNAM_ZONE);

        List<DashboardAnalyticsResponse.TeacherSubjectPieItem> teacherSubjectPie = questionRepository
                .countBySubjectForTeacher(teacher.getId())
                .stream()
                .map(row -> new DashboardAnalyticsResponse.TeacherSubjectPieItem(
                        ((Number) row[0]).intValue(),
                        (String) row[1],
                        numberAsLong(row[2])
                ))
                .toList();

        Integer effectiveSubjectId = subjectId;
        if (effectiveSubjectId == null && !teacherSubjectPie.isEmpty()) {
            effectiveSubjectId = teacherSubjectPie.get(0).subjectId();
        }

        Map<Difficulty, Long> diffMap = new EnumMap<>(Difficulty.class);
        if (effectiveSubjectId != null) {
            for (Object[] row : questionRepository.countByDifficultyForTeacherAndSubject(teacher.getId(), effectiveSubjectId)) {
                diffMap.put((Difficulty) row[0], numberAsLong(row[1]));
            }
        }
        List<DifficultyCountResponse> difficultyBreakdown = List.of(
                new DifficultyCountResponse(Difficulty.EASY, diffMap.getOrDefault(Difficulty.EASY, 0L)),
                new DifficultyCountResponse(Difficulty.MEDIUM, diffMap.getOrDefault(Difficulty.MEDIUM, 0L)),
                new DifficultyCountResponse(Difficulty.HARD, diffMap.getOrDefault(Difficulty.HARD, 0L))
        );

        LocalDateTime since = (days != null && days > 0) ? now.minusDays(days) : LocalDateTime.of(1970, 1, 1, 0, 0);
        List<StudentExamAttempt> filteredAttempts = subjectId != null
                ? studentExamAttemptRepository.findCompletedForTeacherHistogramBySubject(teacher.getId(), subjectId, since)
                : studentExamAttemptRepository.findCompletedForTeacherHistogramAllSubjects(teacher.getId(), since);

        List<BigDecimal> validScores = new ArrayList<>();
        long[] tenBins = new long[10];
        long[] legacySixBins = new long[6];
        long invalidScoreCount = 0;

        for (StudentExamAttempt attempt : filteredAttempts) {
            BigDecimal onTen = scoreScaleService.normalizeToTen(
                    attempt.getScore(), attempt.getMaxScore(), attempt.getScoreOnTen());
            if (onTen == null) {
                invalidScoreCount++;
                continue;
            }
            validScores.add(onTen);
            int binIdx = onTen.compareTo(BigDecimal.TEN) >= 0 ? 9 : onTen.intValue();
            if (binIdx < 0) binIdx = 0;
            if (binIdx > 9) binIdx = 9;
            tenBins[binIdx]++;
            int legacyIdx = onTen.compareTo(BigDecimal.TEN) == 0 ? 5
                    : onTen.compareTo(BigDecimal.valueOf(2)) < 0 ? 0
                    : onTen.compareTo(BigDecimal.valueOf(4)) < 0 ? 1
                    : onTen.compareTo(BigDecimal.valueOf(6)) < 0 ? 2
                    : onTen.compareTo(BigDecimal.valueOf(8)) < 0 ? 3 : 4;
            legacySixBins[legacyIdx]++;
        }

        List<DashboardAnalyticsResponse.ScoreBand> legacyScoreBands = new ArrayList<>(6);
        String[] legacyLabels = {"0–<2", "2–<4", "4–<6", "6–<8", "8–<10", "10"};
        for (int i = 0; i < 6; i++) {
            legacyScoreBands.add(new DashboardAnalyticsResponse.ScoreBand(
                    "band-" + i,
                    legacyLabels[i],
                    BigDecimal.valueOf(i * 2L),
                    i == 5 ? BigDecimal.TEN : BigDecimal.valueOf((i + 1) * 2L),
                    i == 5,
                    legacySixBins[i]
            ));
        }

        List<DashboardAnalyticsResponse.ScoreBand> histogramBins = new ArrayList<>(10);
        for (int i = 0; i < 10; i++) {
            boolean last = (i == 9);
            String label = last ? "9–10" : i + "–<" + (i + 1);
            histogramBins.add(new DashboardAnalyticsResponse.ScoreBand(
                    "bin-" + i,
                    label,
                    BigDecimal.valueOf(i),
                    BigDecimal.valueOf(i + 1),
                    last,
                    tenBins[i]
            ));
        }

        BigDecimal mean = null;
        BigDecimal median = null;
        if (!validScores.isEmpty()) {
            BigDecimal sum = validScores.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
            mean = sum.divide(BigDecimal.valueOf(validScores.size()), 2, RoundingMode.HALF_UP);
            validScores.sort(Comparator.naturalOrder());
            int mid = validScores.size() / 2;
            if (validScores.size() % 2 == 1) {
                median = validScores.get(mid).setScale(2, RoundingMode.HALF_UP);
            } else {
                median = validScores.get(mid - 1).add(validScores.get(mid))
                        .divide(BigDecimal.valueOf(2), 2, RoundingMode.HALF_UP);
            }
        }

        DashboardAnalyticsResponse.TeacherScoreHistogram histogram = new DashboardAnalyticsResponse.TeacherScoreHistogram(
                subjectId, days, validScores.size(), mean, median, histogramBins
        );

        Map<String, Long> questionCounts = new HashMap<>();
        for (Object[] row : questionRepository.countByTypeAndDifficulty()) {
            questionCounts.put(questionKey(row[0], row[1]), numberAsLong(row[2]));
        }
        List<DashboardAnalyticsResponse.QuestionDistribution> questionDistribution = new ArrayList<>();
        for (QuestionType type : QuestionType.values()) {
            for (Difficulty difficulty : Difficulty.values()) {
                questionDistribution.add(new DashboardAnalyticsResponse.QuestionDistribution(
                        type, difficulty, questionCounts.getOrDefault(questionKey(type, difficulty), 0L)
                ));
            }
        }

        return DashboardAnalyticsResponse.builder()
                .role("TEACHER")
                .scope("Câu hỏi do bạn tạo & lượt làm đề của bạn")
                .period(days != null && days > 0 ? days + " ngày gần nhất" : "Toàn thời gian")
                .generatedAt(now)
                .questionDistribution(questionDistribution)
                .scoreDistribution(legacyScoreBands)
                .scoreSampleCount(validScores.size())
                .scoreSourceCount(filteredAttempts.size())
                .scoreSampleLimit(SCORE_SAMPLE_LIMIT)
                .invalidScoreCount(invalidScoreCount)
                .teacherSubjectQuestionCounts(teacherSubjectPie)
                .selectedSubjectId(effectiveSubjectId)
                .teacherDifficultyBreakdown(difficultyBreakdown)
                .teacherScoreHistogram(histogram)
                .build();
    }

    private DashboardAnalyticsResponse getStudentAnalytics(User student) {
        LocalDateTime now = LocalDateTime.now(UserVisitSessionService.VIETNAM_ZONE);
        Page<StudentExamAttempt> attemptsPage = studentExamAttemptRepository.findByStudent_Id(
                student.getId(),
                PageRequest.of(0, STUDENT_ATTEMPT_SAMPLE_LIMIT, Sort.by(Sort.Direction.DESC, "startedAt"))
        );
        List<StudentExamAttempt> attempts = attemptsPage.getContent();

        List<DashboardAnalyticsResponse.StudentAttemptSummary> attemptSummaries = attempts.stream()
                .map(attempt -> {
                    var matrix = attempt.getExamPaper().getExamMatrix();
                    boolean completed = attempt.getStatus() == AttemptStatus.COMPLETED;
                    BigDecimal onTen = completed
                            ? scoreScaleService.normalizeToTen(attempt.getScore(), attempt.getMaxScore(), attempt.getScoreOnTen())
                            : null;
                    return new DashboardAnalyticsResponse.StudentAttemptSummary(
                            attempt.getId(), attempt.getExamPaper().getId(), matrix.getTitle(), attempt.getExamPaper().getExamCode(),
                            matrix.getSubject().getId(), matrix.getSubject().getName(), attempt.getStatus(),
                            completed ? attempt.getScore() : null,
                            attempt.getMaxScore(),
                            onTen,
                            attempt.getStartedAt(), attempt.getSubmittedAt(), attempt.getGradedAt()
                    );
                })
                .toList();

        Map<Integer, StudentResultAccumulator> resultGroups = new HashMap<>();
        for (StudentExamAttempt attempt : attempts) {
            if (attempt.getStatus() != AttemptStatus.COMPLETED) continue;
            BigDecimal onTen = scoreScaleService.normalizeToTen(attempt.getScore(), attempt.getMaxScore(), attempt.getScoreOnTen());
            if (onTen == null) continue;
            var subject = attempt.getExamPaper().getExamMatrix().getSubject();
            StudentResultAccumulator group = resultGroups.computeIfAbsent(
                    subject.getId(), ignored -> new StudentResultAccumulator(subject.getId(), subject.getName())
            );
            group.add(onTen);
        }
        List<DashboardAnalyticsResponse.StudentSubjectResult> subjectResults = resultGroups.values().stream()
                .sorted(Comparator.comparing(StudentResultAccumulator::name, String.CASE_INSENSITIVE_ORDER))
                .map(StudentResultAccumulator::toResponse)
                .toList();

        List<UUID> completedAttemptIds = attempts.stream()
                .filter(attempt -> attempt.getStatus() == AttemptStatus.COMPLETED)
                .map(StudentExamAttempt::getId)
                .toList();
        Map<ChapterKey, ChapterProgressAccumulator> progressGroups = new HashMap<>();
        if (!completedAttemptIds.isEmpty()) {
            List<StudentAttemptAnswer> answers = studentAttemptAnswerRepository
                    .findByAttempt_IdInAndAttempt_StatusAndIsCorrectIsNotNullAndChoicesIsNotEmpty(
                            completedAttemptIds, AttemptStatus.COMPLETED
                    );
            for (StudentAttemptAnswer answer : answers) {
                var chapter = answer.getQuestion().getChapter();
                var subject = chapter.getSubject();
                ChapterKey key = new ChapterKey(subject.getId(), chapter.getId());
                ChapterProgressAccumulator group = progressGroups.computeIfAbsent(
                        key, ignored -> new ChapterProgressAccumulator(
                                subject.getId(), subject.getName(), chapter.getId(), chapter.getName()
                        )
                );
                group.add(Boolean.TRUE.equals(answer.getIsCorrect()));
            }
        }
        List<DashboardAnalyticsResponse.ChapterAnswerProgress> chapterProgress = progressGroups.values().stream()
                .sorted(Comparator.comparing(ChapterProgressAccumulator::subjectName, String.CASE_INSENSITIVE_ORDER)
                        .thenComparing(ChapterProgressAccumulator::chapterId))
                .map(ChapterProgressAccumulator::toResponse)
                .toList();
        long chapterAnswerCount = chapterProgress.stream().mapToLong(DashboardAnalyticsResponse.ChapterAnswerProgress::answeredCount).sum();

        return DashboardAnalyticsResponse.builder()
                .role("STUDENT")
                .scope("Tài khoản học sinh")
                .period("20 lượt làm gần nhất")
                .generatedAt(now)
                .studentAttempts(attemptSummaries)
                .studentAttemptTotal(attemptsPage.getTotalElements())
                .studentSubjectResults(subjectResults)
                .studentChapterProgress(chapterProgress)
                .studentChapterAnswerCount(chapterAnswerCount)
                .build();
    }

    private static int numberAsInt(Object value) {
        return value instanceof Number number ? number.intValue() : 0;
    }

    private static long numberAsLong(Object value) {
        return value instanceof Number number ? number.longValue() : 0L;
    }

    private static String questionKey(Object type, Object difficulty) {
        return type + ":" + difficulty;
    }

    private static String visibilityKey(Object accessType, Object published) {
        return accessType + ":" + published;
    }

    private record ChapterKey(Integer subjectId, Integer chapterId) {}

    private static final class StudentResultAccumulator {
        private final Integer subjectId;
        private final String name;
        private long attempts;
        private BigDecimal sumOnTen = BigDecimal.ZERO;

        private StudentResultAccumulator(Integer subjectId, String name) {
            this.subjectId = subjectId;
            this.name = name;
        }

        private void add(BigDecimal scoreOnTen) {
            attempts++;
            sumOnTen = sumOnTen.add(scoreOnTen);
        }

        private String name() { return name; }

        private DashboardAnalyticsResponse.StudentSubjectResult toResponse() {
            BigDecimal averageOnTen = sumOnTen.divide(BigDecimal.valueOf(attempts), 2, RoundingMode.HALF_UP);
            return new DashboardAnalyticsResponse.StudentSubjectResult(
                    subjectId, name, attempts, sumOnTen, BigDecimal.valueOf(attempts * 10L), averageOnTen
            );
        }
    }

    private static final class ChapterProgressAccumulator {
        private final Integer subjectId;
        private final String subjectName;
        private final Integer chapterId;
        private final String chapterName;
        private long answered;
        private long correct;

        private ChapterProgressAccumulator(Integer subjectId, String subjectName, Integer chapterId, String chapterName) {
            this.subjectId = subjectId;
            this.subjectName = subjectName;
            this.chapterId = chapterId;
            this.chapterName = chapterName;
        }

        private void add(boolean isCorrect) {
            answered++;
            if (isCorrect) correct++;
        }

        private String subjectName() { return subjectName; }
        private Integer chapterId() { return chapterId; }

        private DashboardAnalyticsResponse.ChapterAnswerProgress toResponse() {
            return new DashboardAnalyticsResponse.ChapterAnswerProgress(
                    subjectId, subjectName, chapterId, chapterName, answered, correct, answered - correct
            );
        }
    }

    private ExamMatrixResponse convertMatrixToResponse(ExamMatrix matrix) {
        List<ExamMatrixConfig> sortedConfigs = new ArrayList<>(matrix.getConfigs());
        sortedConfigs.sort(Comparator.comparing((ExamMatrixConfig config) -> config.getChapter().getOrderIndex())
                .thenComparing(config -> config.getDifficulty().ordinal()));

        List<MatrixConfigResponse> configResponses = new ArrayList<>();
        for (ExamMatrixConfig config : sortedConfigs) {
            configResponses.add(new MatrixConfigResponse(
                    config.getChapter().getId(),
                    config.getDifficulty(),
                    config.getQuantity()
            ));
        }

        return new ExamMatrixResponse(
                matrix.getId(),
                matrix.getTeacher().getId(),
                matrix.getSubject().getId(),
                matrix.getTitle(),
                matrix.getDuration(),
                matrix.getTotalQuestions(),
                matrix.getExamType(),
                configResponses,
                matrix.getCreatedAt(),
                matrix.getUpdatedAt()
        );
    }

    private boolean isAdmin(User user) { return RolePolicy.isContentStaff(user); }
    private boolean isTeacher(User user) { return RolePolicy.isTeacher(user); }
    private boolean isStudent(User user) { return RolePolicy.isStudent(user); }
}
