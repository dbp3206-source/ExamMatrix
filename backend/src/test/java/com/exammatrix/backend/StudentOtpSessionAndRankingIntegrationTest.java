package com.exammatrix.backend;

import com.exammatrix.backend.dto.response.DashboardAnalyticsResponse;
import com.exammatrix.backend.entity.*;
import com.exammatrix.backend.entity.enums.*;
import com.exammatrix.backend.repository.*;
import com.exammatrix.backend.security.JwtService;
import com.exammatrix.backend.service.DashboardService;
import tools.jackson.databind.ObjectMapper;
import jakarta.servlet.Filter;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.mail.MailSendException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@TestPropertySource(properties = {
        "app.otp.resend-cooldown-seconds=0",
        "app.otp.max-attempts=3",
        "app.otp.max-resends=2"
})
class StudentOtpSessionAndRankingIntegrationTest {

    @MockitoBean
    private JavaMailSender mailSender;

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
    @Autowired private StudentFeedbackRecipientRepository feedbackRecipientRepository;
    @Autowired private StudentFeedbackRepository feedbackRepository;
    @Autowired private StudentNameWarningRepository nameWarningRepository;
    @Autowired private StudentRegistrationOtpRepository otpRepository;
    @Autowired private UserVisitSessionRepository visitSessionRepository;
    @Autowired private QuestionImportRequestRepository importRequestRepository;
    @Autowired private DashboardService dashboardService;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private JwtService jwtService;
    @Autowired private JwtEncoder jwtEncoder;
    @Autowired private WebApplicationContext wac;
    @Autowired @Qualifier("springSecurityFilterChain") private Filter springSecurityFilterChain;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private MockMvc mockMvc;

    private User adminUser;
    private User teacherUser;
    private Role studentRole;
    private TeacherClass teacherClass;
    private ExamPaper publicPaper;

    @BeforeEach
    void setUp() {
        reset(mailSender);
        mockMvc = MockMvcBuilders.webAppContextSetup(wac)
                .addFilters(springSecurityFilterChain)
                .build();
        cleanDatabase();

        Role adminRole = roleRepository.save(Role.builder().name("ADMIN").build());
        Role teacherRole = roleRepository.save(Role.builder().name("TEACHER").build());
        studentRole = roleRepository.save(Role.builder().name("STUDENT").build());

        adminUser = userRepository.save(User.builder()
                .username("otp_admin").email("otpadmin@test.com").fullName("OTP Admin")
                .password(passwordEncoder.encode("Pass1234!")).role(adminRole).status(UserStatus.ACTIVE).build());
        teacherUser = userRepository.save(User.builder()
                .username("otp_teacher").email("otpteacher@test.com").fullName("OTP Teacher")
                .password(passwordEncoder.encode("Pass1234!")).role(teacherRole).status(UserStatus.ACTIVE).build());

        Subject subj = subjectRepository.save(Subject.builder().code("OTP01").name("Môn OTP").build());
        Chapter ch = chapterRepository.save(Chapter.builder().subject(subj).name("Chương OTP").orderIndex(1).build());
        ExamMatrix matrix = examMatrixRepository.save(ExamMatrix.builder()
                .teacher(teacherUser).subject(subj).title("Ma trận OTP").duration(30).totalQuestions(1)
                .examType(ExamType.OBJECTIVE).build());
        publicPaper = examPaperRepository.save(ExamPaper.builder()
                .examMatrix(matrix).examCode("RNK-01")
                .accessType(ExamAccessType.PUBLIC).isPublished(true).build());
        teacherClass = teacherClassRepository.save(TeacherClass.builder()
                .teacher(teacherUser).name("Lớp AcceptAll").classCode("ACC01")
                .joinPassword(passwordEncoder.encode("cls123")).joinMode(ClassJoinMode.REQUEST_WITH_PASSWORD).build());
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        cleanDatabase();
    }

    private void cleanDatabase() {
        nameWarningRepository.deleteAll();
        otpRepository.deleteAll();
        feedbackRecipientRepository.deleteAll();
        feedbackRepository.deleteAll();
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
    }

    private String extractOtpFromSentEmail() {
        ArgumentCaptor<SimpleMailMessage> captor = ArgumentCaptor.forClass(SimpleMailMessage.class);
        verify(mailSender, atLeastOnce()).send(captor.capture());
        List<SimpleMailMessage> all = captor.getAllValues();
        String body = all.get(all.size() - 1).getText();
        Matcher matcher = Pattern.compile("\\b(\\d{6})\\b").matcher(body);
        assertTrue(matcher.find());
        return matcher.group(1);
    }

    @Test
    @DisplayName("Section 7.5, 7.6, 7.7: Student OTP registration, wrong/expired/mail failure, and plain password login without OTP")
    void testStudentOtpRegistrationAndPlainLogin() throws Exception {
        Map<String, String> otpReq = Map.of(
                "username", "hs_otp_user",
                "email", "hs.otp@example.com",
                "password", "Secret123!",
                "fullName", "Học Sinh OTP"
        );

        mockMvc.perform(post("/auth/register/student/request-otp")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(otpReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.expirationMinutes").value(5));

        String firstOtp = extractOtpFromSentEmail();
        StudentRegistrationOtp stored = otpRepository.findByEmailIgnoreCase("hs.otp@example.com").orElseThrow();
        assertNotEquals(firstOtp, stored.getOtpHash());

        String wrongOtp = firstOtp.equals("000000") ? "999999" : "000000";
        mockMvc.perform(post("/auth/register/student")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of(
                        "username", "hs_otp_user",
                        "email", "hs.otp@example.com",
                        "password", "Secret123!",
                        "fullName", "Học Sinh OTP",
                        "otp", wrongOtp))))
                .andExpect(status().isBadRequest());

        mockMvc.perform(post("/auth/register/student")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of(
                        "username", "hs_otp_user",
                        "email", "hs.otp@example.com",
                        "password", "Secret123!",
                        "fullName", "Học Sinh OTP",
                        "otp", wrongOtp))))
                .andExpect(status().isBadRequest());

        mockMvc.perform(post("/auth/register/student")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of(
                        "username", "hs_otp_user",
                        "email", "hs.otp@example.com",
                        "password", "Secret123!",
                        "fullName", "Học Sinh OTP",
                        "otp", wrongOtp))))
                .andExpect(status().isTooManyRequests());

        mockMvc.perform(post("/auth/register/student/resend-otp")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"hs.otp@example.com\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.remainingResends").value(1));

        String resentOtp = extractOtpFromSentEmail();
        StudentRegistrationOtp expiredRecord = otpRepository.findByEmailIgnoreCase("hs.otp@example.com").orElseThrow();
        expiredRecord.setExpiresAt(LocalDateTime.now().minusMinutes(1));
        otpRepository.save(expiredRecord);

        mockMvc.perform(post("/auth/register/student")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of(
                        "username", "hs_otp_user",
                        "email", "hs.otp@example.com",
                        "password", "Secret123!",
                        "fullName", "Học Sinh OTP",
                        "otp", resentOtp))))
                .andExpect(status().isBadRequest());

        mockMvc.perform(post("/auth/register/student/request-otp")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(otpReq)))
                .andExpect(status().isOk());

        String finalOtp = extractOtpFromSentEmail();
        mockMvc.perform(post("/auth/register/student")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of(
                        "username", "hs_otp_user",
                        "email", "hs.otp@example.com",
                        "password", "Secret123!",
                        "fullName", "Học Sinh OTP",
                        "otp", finalOtp))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.user.role").value("STUDENT"));

        assertTrue(otpRepository.findByEmailIgnoreCase("hs.otp@example.com").isEmpty());

        mockMvc.perform(post("/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of(
                        "username", "hs_otp_user",
                        "password", "Secret123!"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.expiresInSeconds").value(7200));

        doThrow(new MailSendException("SMTP unavailable")).when(mailSender).send(any(SimpleMailMessage.class));
        mockMvc.perform(post("/auth/register/student/request-otp")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of(
                        "username", "hs_mail_fail",
                        "email", "fail@example.com",
                        "password", "Secret123!",
                        "fullName", "Mail Fail"))))
                .andExpect(status().isBadGateway());
    }

    @Test
    @DisplayName("Section 7.9: Session duration is 2 hours, active session can refresh, and expired token is rejected with 401")
    void testSessionExpirationAndRefresh() throws Exception {
        MvcResult loginResult = mockMvc.perform(post("/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of(
                        "username", "otp_admin",
                        "password", "Pass1234!"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.expiresInSeconds").value(7200))
                .andReturn();

        String initialToken = objectMapper.readTree(loginResult.getResponse().getContentAsString())
                .get("accessToken").asText();

        mockMvc.perform(post("/auth/refresh")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + initialToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.expiresInSeconds").value(7200));

        Instant past = Instant.now().minus(3, ChronoUnit.HOURS);
        JwtClaimsSet expiredClaims = JwtClaimsSet.builder()
                .issuer("exam-matrix")
                .issuedAt(past.minus(2, ChronoUnit.HOURS))
                .expiresAt(past)
                .subject(adminUser.getUsername())
                .claim("userId", adminUser.getId().toString())
                .claim("sessionVersion", adminUser.sessionVersionClaim())
                .claim("authorities", List.of("ROLE_ADMIN"))
                .build();
        String expiredToken = jwtEncoder.encode(
                JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).type("JWT").build(), expiredClaims)
        ).getTokenValue();

        mockMvc.perform(get("/auth/me")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + expiredToken))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(post("/auth/logout")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + initialToken))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/auth/me")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + initialToken))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Teacher approve-all accepts all pending requests and student ranking sorts by highest attempt score")
    void testTeacherApproveAllAndHighestScoreStudentRanking() throws Exception {
        User s1 = userRepository.save(User.builder()
                .username("rank_s1").email("rs1@test.com").fullName("Học Sinh Điểm 9.5")
                .password(passwordEncoder.encode("Pass1234!")).role(studentRole).status(UserStatus.ACTIVE).build());
        User s2 = userRepository.save(User.builder()
                .username("rank_s2").email("rs2@test.com").fullName("Học Sinh Điểm 8.5")
                .password(passwordEncoder.encode("Pass1234!")).role(studentRole).status(UserStatus.ACTIVE).build());

        assignmentRepository.save(StudentTeacherAssignment.builder()
                .student(s1).teacher(teacherUser).teacherClass(teacherClass)
                .status(StudentAssignmentStatus.PENDING).requestedAt(LocalDateTime.now()).build());
        assignmentRepository.save(StudentTeacherAssignment.builder()
                .student(s2).teacher(teacherUser).teacherClass(teacherClass)
                .status(StudentAssignmentStatus.PENDING).requestedAt(LocalDateTime.now()).build());

        String teacherBearer = "Bearer " + jwtService.generateToken(teacherUser);
        mockMvc.perform(patch("/teacher/student-requests/approve-all")
                .header(HttpHeaders.AUTHORIZATION, teacherBearer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.approvedCount").value(2));

        assertEquals(2, assignmentRepository.countByTeacherClass_IdAndStatus(
                teacherClass.getId(), StudentAssignmentStatus.APPROVED));

        LocalDateTime yesterday = LocalDate.now().atStartOfDay().minusHours(2);
        LocalDateTime today = LocalDateTime.now();

        attemptRepository.save(StudentExamAttempt.builder()
                .student(s2).examPaper(publicPaper).teacher(teacherUser)
                .status(AttemptStatus.COMPLETED).score(BigDecimal.valueOf(8.5)).maxScore(BigDecimal.TEN)
                .scoreOnTen(BigDecimal.valueOf(8.5)).submittedAt(yesterday).gradedAt(yesterday).build());
        attemptRepository.save(StudentExamAttempt.builder()
                .student(s1).examPaper(publicPaper).teacher(teacherUser)
                .status(AttemptStatus.COMPLETED).score(BigDecimal.valueOf(6.0)).maxScore(BigDecimal.TEN)
                .scoreOnTen(BigDecimal.valueOf(6.0)).submittedAt(yesterday).gradedAt(yesterday).build());
        attemptRepository.save(StudentExamAttempt.builder()
                .student(s1).examPaper(publicPaper).teacher(teacherUser)
                .status(AttemptStatus.COMPLETED).score(BigDecimal.valueOf(9.5)).maxScore(BigDecimal.TEN)
                .scoreOnTen(BigDecimal.valueOf(9.5)).submittedAt(today).gradedAt(today).build());

        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(
                        adminUser.getUsername(),
                        "N/A",
                        List.of(new SimpleGrantedAuthority("ROLE_ADMIN"))
                )
        );
        DashboardAnalyticsResponse analytics = dashboardService.getAnalytics(LocalDate.now(), null, null);
        List<DashboardAnalyticsResponse.AdminStudentRankItem> board = analytics.getAdminStudentLeaderboard();

        assertEquals(2, board.size());
        assertEquals(s1.getId(), board.get(0).userId());
        assertEquals(0, board.get(0).highestScore().compareTo(new BigDecimal("9.50")));
        assertEquals(1, board.get(0).rankDelta());
        assertEquals(s2.getId(), board.get(1).userId());
        assertEquals(0, board.get(1).highestScore().compareTo(new BigDecimal("8.50")));
        assertEquals(-1, board.get(1).rankDelta());
    }

    @Test
    @DisplayName("Student can retake completed or in-progress exams with incremented attemptNumber")
    void testRetakeCompletedAndInProgressExams() throws Exception {
        User retakeStudent = userRepository.save(User.builder()
                .username("retake_student").email("retake@test.com").fullName("Học Sinh Làm Lại")
                .password(passwordEncoder.encode("Pass1234!")).role(studentRole).status(UserStatus.ACTIVE).build());
        String studentBearer = "Bearer " + jwtService.generateToken(retakeStudent);

        MvcResult firstRes = mockMvc.perform(post("/student/exams/" + publicPaper.getId() + "/attempts")
                .header(HttpHeaders.AUTHORIZATION, studentBearer))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.attemptNumber").value(1))
                .andExpect(jsonPath("$.status").value("IN_PROGRESS"))
                .andReturn();
        String attempt1Id = objectMapper.readTree(firstRes.getResponse().getContentAsString())
                .get("attemptId").asText();

        MvcResult retakeInProgressRes = mockMvc.perform(post("/student/exams/" + publicPaper.getId() + "/attempts?forceNew=true")
                .header(HttpHeaders.AUTHORIZATION, studentBearer))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.attemptNumber").value(2))
                .andExpect(jsonPath("$.status").value("IN_PROGRESS"))
                .andReturn();
        String attempt2Id = objectMapper.readTree(retakeInProgressRes.getResponse().getContentAsString())
                .get("attemptId").asText();
        assertNotEquals(attempt1Id, attempt2Id);
        assertEquals(AttemptStatus.CANCELLED, attemptRepository.findById(java.util.UUID.fromString(attempt1Id)).orElseThrow().getStatus());

        mockMvc.perform(post("/student/attempts/" + attempt2Id + "/submit")
                .header(HttpHeaders.AUTHORIZATION, studentBearer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.attemptNumber").value(2))
                .andExpect(jsonPath("$.status").value("COMPLETED"));

        MvcResult retakeCompletedRes = mockMvc.perform(post("/student/exams/" + publicPaper.getId() + "/attempts?forceNew=true")
                .header(HttpHeaders.AUTHORIZATION, studentBearer))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.attemptNumber").value(3))
                .andExpect(jsonPath("$.status").value("IN_PROGRESS"))
                .andReturn();
        String attempt3Id = objectMapper.readTree(retakeCompletedRes.getResponse().getContentAsString())
                .get("attemptId").asText();
        assertNotEquals(attempt2Id, attempt3Id);
        assertEquals(AttemptStatus.COMPLETED, attemptRepository.findById(java.util.UUID.fromString(attempt2Id)).orElseThrow().getStatus());

        mockMvc.perform(get("/student/exams")
                .header(HttpHeaders.AUTHORIZATION, studentBearer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].attemptNumber").value(3))
                .andExpect(jsonPath("$.content[0].attemptCount").value(3));

        mockMvc.perform(get("/dashboard/analytics")
                .header(HttpHeaders.AUTHORIZATION, studentBearer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.studentAttempts", hasSize(3)));
    }
}
