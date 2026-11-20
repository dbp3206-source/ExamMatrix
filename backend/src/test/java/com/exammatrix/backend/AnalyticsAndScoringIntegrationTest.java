package com.exammatrix.backend;

import com.exammatrix.backend.dto.request.*;
import com.exammatrix.backend.dto.response.*;
import com.exammatrix.backend.entity.*;
import com.exammatrix.backend.entity.enums.*;
import com.exammatrix.backend.repository.*;
import com.exammatrix.backend.service.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class AnalyticsAndScoringIntegrationTest {

    @Autowired private ScoreScaleService scoreScaleService;
    @Autowired private StudentClassService studentClassService;
    @Autowired private TeacherClassService teacherClassService;
    @Autowired private QuestionImportService questionImportService;
    @Autowired private StudentExamService studentExamService;
    @Autowired private TeacherGradingService teacherGradingService;
    @Autowired private DashboardService dashboardService;
    @Autowired private AdminResultsService adminResultsService;
    @Autowired private UserVisitSessionService visitSessionService;

    @Autowired private UserRepository userRepository;
    @Autowired private RoleRepository roleRepository;
    @Autowired private SubjectRepository subjectRepository;
    @Autowired private ChapterRepository chapterRepository;
    @Autowired private QuestionRepository questionRepository;
    @Autowired private AnswerRepository answerRepository;
    @Autowired private ExamMatrixRepository examMatrixRepository;
    @Autowired private ExamPaperRepository examPaperRepository;
    @Autowired private PaperQuestionRepository paperQuestionRepository;
    @Autowired private TeacherClassRepository teacherClassRepository;
    @Autowired private StudentTeacherAssignmentRepository assignmentRepository;
    @Autowired private StudentExamAttemptRepository attemptRepository;
    @Autowired private StudentAttemptAnswerRepository attemptAnswerRepository;
    @Autowired private QuestionImportRequestRepository importRequestRepository;
    @Autowired private UserVisitSessionRepository visitSessionRepository;
    @Autowired private PasswordEncoder passwordEncoder;

    private User adminUser;
    private User teacher1;
    private User teacher2;
    private User student1;
    private Subject mathSubject;
    private Chapter mathCh1;
    private TeacherClass class1;
    private TeacherClass class2;

    @BeforeEach
    void setUp() {
        visitSessionRepository.deleteAll();
        importRequestRepository.deleteAll();
        attemptAnswerRepository.deleteAll();
        attemptRepository.deleteAll();
        assignmentRepository.deleteAll();
        paperQuestionRepository.deleteAll();
        examPaperRepository.deleteAll();
        examMatrixRepository.deleteAll();
        answerRepository.deleteAll();
        questionRepository.deleteAll();
        teacherClassRepository.deleteAll();
        userRepository.deleteAll();
        roleRepository.deleteAll();
        chapterRepository.deleteAll();
        subjectRepository.deleteAll();

        Role adminRole = roleRepository.save(Role.builder().name("ADMIN").build());
        Role teacherRole = roleRepository.save(Role.builder().name("TEACHER").build());
        Role studentRole = roleRepository.save(Role.builder().name("STUDENT").build());

        adminUser = userRepository.save(User.builder()
                .username("admin_16").email("admin16@test.com").fullName("Admin 16")
                .password(passwordEncoder.encode("pass1234")).role(adminRole).status(UserStatus.ACTIVE).build());
        teacher1 = userRepository.save(User.builder()
                .username("teacher_16a").email("t16a@test.com").fullName("Teacher Alpha")
                .password(passwordEncoder.encode("pass1234")).role(teacherRole).status(UserStatus.ACTIVE).build());
        teacher2 = userRepository.save(User.builder()
                .username("teacher_16b").email("t16b@test.com").fullName("Teacher Beta")
                .password(passwordEncoder.encode("pass1234")).role(teacherRole).status(UserStatus.ACTIVE).build());
        student1 = userRepository.save(User.builder()
                .username("student_16").email("s16@test.com").fullName("Student Gamma")
                .password(passwordEncoder.encode("pass1234")).role(studentRole).status(UserStatus.ACTIVE).build());

        mathSubject = subjectRepository.save(Subject.builder().code("MATH16").name("Toán 16").description("Toán").build());
        mathCh1 = chapterRepository.save(Chapter.builder().subject(mathSubject).name("Chương 1").orderIndex(1).build());

        class1 = teacherClassRepository.save(TeacherClass.builder()
                .teacher(teacher1).name("Lớp Alpha").classCode("ALPHA01")
                .joinMode(ClassJoinMode.REQUEST_WITH_PASSWORD)
                .joinPassword(passwordEncoder.encode("alphaPass99"))
                .build());
        class2 = teacherClassRepository.save(TeacherClass.builder()
                .teacher(teacher2).name("Lớp Beta Mở").classCode("BETA02")
                .joinMode(ClassJoinMode.REQUEST_OPEN)
                .joinPassword(null)
                .build());
    }

    private void auth(User u) {
        var auth = new UsernamePasswordAuthenticationToken(
                u.getUsername(), null, List.of(new SimpleGrantedAuthority("ROLE_" + u.getRole().getName())));
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    @Test
    @DisplayName("Item 6: Unified 10-point ScoreScaleService (objective, weighted essay, legacy normalization)")
    void testScoreScaleService() {
        assertEquals(new BigDecimal("5.00"), scoreScaleService.calculateObjectiveScoreOnTen(2, 4));
        assertEquals(new BigDecimal("10.00"), scoreScaleService.calculateObjectiveScoreOnTen(4, 4));
        assertEquals(new BigDecimal("0.00"), scoreScaleService.calculateObjectiveScoreOnTen(0, 4));
        assertEquals(new BigDecimal("3.33"), scoreScaleService.calculateObjectiveScoreOnTen(1, 3));

        List<BigDecimal> threeEqual = scoreScaleService.distributeEqualTenPoints(3);
        assertEquals(3, threeEqual.size());
        BigDecimal sum = threeEqual.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        assertEquals(new BigDecimal("10.00"), sum);

        List<BigDecimal> weighted = scoreScaleService.distributeWeightedTenPoints(
                List.of(new BigDecimal("1"), new BigDecimal("2"), new BigDecimal("3")));
        BigDecimal weightedSum = weighted.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        assertEquals(new BigDecimal("10.00"), weightedSum);

        assertEquals(new BigDecimal("5.00"), scoreScaleService.normalizeToTen(new BigDecimal("2"), new BigDecimal("4"), null));
        assertEquals(new BigDecimal("8.50"), scoreScaleService.normalizeToTen(new BigDecimal("8.50"), new BigDecimal("10.00"), null));
        assertNull(scoreScaleService.normalizeToTen(null, new BigDecimal("10.00"), null));
        assertNull(scoreScaleService.normalizeToTen(new BigDecimal("5"), BigDecimal.ZERO, null));
    }

    @Test
    @DisplayName("Item 15: Class discovery, REQUEST_OPEN & REQUEST_WITH_PASSWORD -> PENDING, atomic class transfer")
    void testClassDiscoveryAndTransferLifecycle() {
        auth(student1);
        StudentClassDiscoveryResponse discovery = studentClassService.getClassDiscovery();
        assertEquals(2, discovery.availableClasses().size());

        StudentAssignmentResponse join1 = studentClassService.joinClass(JoinClassRequest.builder()
                .classCode("ALPHA01").password("alphaPass99").build());
        assertEquals(StudentAssignmentStatus.PENDING, join1.getStatus());

        auth(teacher1);
        StudentAssignmentResponse approved1 = teacherClassService.reviewStudentAssignment(
                join1.getId(), ReviewStudentAssignmentRequest.builder().status(StudentAssignmentStatus.APPROVED).build());
        assertEquals(StudentAssignmentStatus.APPROVED, approved1.getStatus());

        auth(student1);
        StudentAssignmentResponse transferReq = studentClassService.joinClass(JoinClassRequest.builder()
                .classCode("BETA02").build());
        assertEquals(StudentAssignmentStatus.PENDING, transferReq.getStatus());

        StudentClassDiscoveryResponse duringTransfer = studentClassService.getClassDiscovery();
        assertEquals("ALPHA01", duringTransfer.activeAssignment().getClassCode());
        assertEquals("BETA02", duringTransfer.pendingAssignment().getClassCode());

        auth(teacher2);
        StudentAssignmentResponse approved2 = teacherClassService.reviewStudentAssignment(
                transferReq.getId(), ReviewStudentAssignmentRequest.builder().status(StudentAssignmentStatus.APPROVED).build());
        assertEquals(StudentAssignmentStatus.APPROVED, approved2.getStatus());

        auth(student1);
        StudentClassDiscoveryResponse afterTransfer = studentClassService.getClassDiscovery();
        assertEquals("BETA02", afterTransfer.activeAssignment().getClassCode());
        assertNull(afterTransfer.pendingAssignment());
        assertTrue(afterTransfer.history().stream().anyMatch(h -> h.getStatus() == StudentAssignmentStatus.TRANSFERRED));
    }

    @Test
    @DisplayName("Item 16 Reg 2: Import confirm UUID idempotency replays created IDs & rejects digest mismatch with 409")
    void testImportConfirmIdempotency() {
        auth(teacher1);
        UUID reqId = UUID.randomUUID();
        ImportQuestionItemRequest item = ImportQuestionItemRequest.builder()
                .chapterId(mathCh1.getId())
                .content("2 + 2 = ?")
                .difficulty(Difficulty.EASY)
                .type(QuestionType.SINGLE_CHOICE)
                .answers(List.of(
                        AnswerRequest.builder().content("4").isCorrect(true).build(),
                        AnswerRequest.builder().content("5").isCorrect(false).build()
                ))
                .build();
        ImportQuestionsConfirmRequest req = ImportQuestionsConfirmRequest.builder()
                .requestId(reqId)
                .subjectId(mathSubject.getId())
                .items(List.of(item))
                .build();

        List<QuestionResponse> first = questionImportService.confirmImport(req);
        assertEquals(1, first.size());
        long countAfterFirst = questionRepository.count();

        List<QuestionResponse> replay = questionImportService.confirmImport(req);
        assertEquals(1, replay.size());
        assertEquals(first.get(0).getId(), replay.get(0).getId());
        assertEquals(countAfterFirst, questionRepository.count());

        ImportQuestionItemRequest altered = ImportQuestionItemRequest.builder()
                .chapterId(mathCh1.getId())
                .content("3 + 3 = ?")
                .difficulty(Difficulty.EASY)
                .type(QuestionType.SINGLE_CHOICE)
                .answers(List.of(
                        AnswerRequest.builder().content("6").isCorrect(true).build(),
                        AnswerRequest.builder().content("7").isCorrect(false).build()
                ))
                .build();
        ImportQuestionsConfirmRequest conflictReq = ImportQuestionsConfirmRequest.builder()
                .requestId(reqId)
                .subjectId(mathSubject.getId())
                .items(List.of(altered))
                .build();
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> questionImportService.confirmImport(conflictReq));
        assertEquals(HttpStatus.CONFLICT, ex.getStatusCode());
    }

    @Test
    @DisplayName("Items 3, 7, 8, 14: Visit session dedupe, Admin analytics & results, Teacher pies, Student exam subjects")
    void testAnalyticsAdminResultsAndStudentExams() {

        visitSessionService.recordActivity(teacher1);
        visitSessionService.recordActivity(teacher1);
        visitSessionService.recordActivity(student1);
        assertEquals(2, visitSessionRepository.count());

        auth(adminUser);
        DashboardAnalyticsResponse adminAnalytics = dashboardService.getAnalytics(LocalDate.now(), null, null);
        assertNotNull(adminAnalytics.getAdminWeeklyVisits());
        assertEquals(7, adminAnalytics.getAdminWeeklyVisits().days().size());

        Question q = questionRepository.save(Question.builder()
                .chapter(mathCh1).teacher(teacher1).content("Câu hỏi toán")
                .difficulty(Difficulty.MEDIUM).type(QuestionType.SINGLE_CHOICE).examType(ExamType.OBJECTIVE)
                .build());
        auth(teacher1);
        DashboardAnalyticsResponse teacherAnalytics = dashboardService.getAnalytics(null, mathSubject.getId(), 30);
        assertEquals(1, teacherAnalytics.getTeacherSubjectQuestionCounts().size());
        assertEquals(1L, teacherAnalytics.getTeacherSubjectQuestionCounts().get(0).count());
        assertNotNull(teacherAnalytics.getTeacherScoreHistogram());
        assertEquals(10, teacherAnalytics.getTeacherScoreHistogram().bins().size());

        auth(adminUser);
        assertFalse(adminResultsService.listUsersByRole("TEACHER", "Alpha").isEmpty());
        assertEquals(0, adminResultsService.getTeacherGradedEssays(teacher1.getId(), "gradedAt", "desc", 0, 10).getTotalElements());
        assertEquals(0, adminResultsService.getTeacherObjectiveResults(teacher1.getId(), "BOTH", "gradedAt", "desc", 0, 10).getTotalElements());

        auth(student1);
        assertNotNull(studentExamService.getAccessibleExamSubjectCounts());
        assertNotNull(studentExamService.getAccessibleExams(null, "", "publishedAt", "desc", PageRequest.of(0, 10)));
    }
}
