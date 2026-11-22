package com.exammatrix.backend;

import com.exammatrix.backend.entity.*;
import com.exammatrix.backend.entity.enums.*;
import com.exammatrix.backend.repository.*;
import com.exammatrix.backend.security.JwtService;
import tools.jackson.databind.ObjectMapper;
import jakarta.servlet.Filter;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Map;

import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
class RbacAndNameWarningIntegrationTest {

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
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private JwtService jwtService;
    @Autowired private WebApplicationContext wac;
    @Autowired @Qualifier("springSecurityFilterChain") private Filter springSecurityFilterChain;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private MockMvc mockMvc;

    private User superAdmin;
    private User contentAdmin;
    private User userAdmin;
    private User teacher;
    private User student;
    private ExamPaper privatePaper;
    private TeacherClass teacherClass;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(wac)
                .addFilters(springSecurityFilterChain)
                .build();
        cleanDatabase();

        Role adminRole = roleRepository.save(Role.builder().name("ADMIN").build());
        Role contentAdminRole = roleRepository.save(Role.builder().name("CONTENT_ADMIN").build());
        Role userAdminRole = roleRepository.save(Role.builder().name("USER_ADMIN").build());
        Role teacherRole = roleRepository.save(Role.builder().name("TEACHER").build());
        Role studentRole = roleRepository.save(Role.builder().name("STUDENT").build());

        superAdmin = userRepository.save(User.builder()
                .username("rbac_super_admin").email("super@test.com").fullName("Admin Tổng")
                .password(passwordEncoder.encode("Pass1234!")).role(adminRole).status(UserStatus.ACTIVE).build());
        contentAdmin = userRepository.save(User.builder()
                .username("rbac_content_admin").email("content@test.com").fullName("Admin Nội Dung")
                .password(passwordEncoder.encode("Pass1234!")).role(contentAdminRole).status(UserStatus.ACTIVE).build());
        userAdmin = userRepository.save(User.builder()
                .username("rbac_user_admin").email("uadmin@test.com").fullName("Admin Người Dùng")
                .password(passwordEncoder.encode("Pass1234!")).role(userAdminRole).status(UserStatus.ACTIVE).build());
        teacher = userRepository.save(User.builder()
                .username("rbac_teacher").email("teacher@test.com").fullName("Giáo Viên")
                .password(passwordEncoder.encode("Pass1234!")).role(teacherRole).status(UserStatus.ACTIVE).build());
        student = userRepository.save(User.builder()
                .username("rbac_student").email("student@test.com").fullName("Ten Vi Pham")
                .password(passwordEncoder.encode("Pass1234!")).role(studentRole).status(UserStatus.ACTIVE).build());

        Subject subj = subjectRepository.save(Subject.builder().code("RBAC1").name("Môn RBAC").build());
        Chapter ch = chapterRepository.save(Chapter.builder().subject(subj).name("Chương 1").orderIndex(1).build());
        ExamMatrix matrix = examMatrixRepository.save(ExamMatrix.builder()
                .teacher(teacher).subject(subj).title("Ma trận RBAC").duration(30).totalQuestions(1)
                .examType(ExamType.OBJECTIVE).build());
        privatePaper = examPaperRepository.save(ExamPaper.builder()
                .examMatrix(matrix).examCode("RBAC-01")
                .accessType(ExamAccessType.PUBLIC).isPublished(true).build());
        teacherClass = teacherClassRepository.save(TeacherClass.builder()
                .teacher(teacher).name("Lớp RBAC").classCode("RBACCLS")
                .joinPassword(passwordEncoder.encode("cls123")).joinMode(ClassJoinMode.REQUEST_WITH_PASSWORD).build());
    }

    @AfterEach
    void tearDown() {
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

    private String bearer(User user) {
        return "Bearer " + jwtService.generateToken(user);
    }

    @Test
    @DisplayName("Section 7.1: ADMIN (Admin tổng) accesses all sections including User Management")
    void testSuperAdminAccessesAllEndpoints() throws Exception {
        String auth = bearer(superAdmin);

        mockMvc.perform(get("/dashboard/summary").header(HttpHeaders.AUTHORIZATION, auth)).andExpect(status().isOk());
        mockMvc.perform(get("/dashboard/analytics").header(HttpHeaders.AUTHORIZATION, auth)).andExpect(status().isOk());
        mockMvc.perform(get("/subjects").header(HttpHeaders.AUTHORIZATION, auth)).andExpect(status().isOk());
        mockMvc.perform(get("/chapters").header(HttpHeaders.AUTHORIZATION, auth)).andExpect(status().isOk());
        mockMvc.perform(get("/questions").header(HttpHeaders.AUTHORIZATION, auth)).andExpect(status().isOk());
        mockMvc.perform(get("/exam-matrices").header(HttpHeaders.AUTHORIZATION, auth)).andExpect(status().isOk());
        mockMvc.perform(get("/exam-papers").header(HttpHeaders.AUTHORIZATION, auth)).andExpect(status().isOk());
        mockMvc.perform(get("/teacher/grading/pending").header(HttpHeaders.AUTHORIZATION, auth)).andExpect(status().isOk());
        mockMvc.perform(get("/admin/results/users").header(HttpHeaders.AUTHORIZATION, auth)).andExpect(status().isOk());
        mockMvc.perform(get("/feedbacks/inbox").header(HttpHeaders.AUTHORIZATION, auth)).andExpect(status().isOk());
        mockMvc.perform(get("/users").header(HttpHeaders.AUTHORIZATION, auth)).andExpect(status().isOk());
        mockMvc.perform(get("/roles").header(HttpHeaders.AUTHORIZATION, auth)).andExpect(status().isOk());
    }

    @Test
    @DisplayName("Section 7.2 & 7.4: CONTENT_ADMIN accesses content/exam/results and is denied (403) on User Management")
    void testContentAdminRbacBoundaries() throws Exception {
        String auth = bearer(contentAdmin);

        mockMvc.perform(get("/dashboard/summary").header(HttpHeaders.AUTHORIZATION, auth)).andExpect(status().isOk());
        mockMvc.perform(get("/dashboard/analytics").header(HttpHeaders.AUTHORIZATION, auth)).andExpect(status().isOk());
        mockMvc.perform(get("/subjects").header(HttpHeaders.AUTHORIZATION, auth)).andExpect(status().isOk());
        mockMvc.perform(get("/chapters").header(HttpHeaders.AUTHORIZATION, auth)).andExpect(status().isOk());
        mockMvc.perform(get("/questions").header(HttpHeaders.AUTHORIZATION, auth)).andExpect(status().isOk());
        mockMvc.perform(get("/exam-matrices").header(HttpHeaders.AUTHORIZATION, auth)).andExpect(status().isOk());
        mockMvc.perform(get("/exam-papers").header(HttpHeaders.AUTHORIZATION, auth)).andExpect(status().isOk());
        mockMvc.perform(get("/teacher/grading/pending").header(HttpHeaders.AUTHORIZATION, auth)).andExpect(status().isOk());
        mockMvc.perform(get("/admin/results/users").header(HttpHeaders.AUTHORIZATION, auth)).andExpect(status().isOk());
        mockMvc.perform(get("/feedbacks/inbox").header(HttpHeaders.AUTHORIZATION, auth)).andExpect(status().isOk());

        mockMvc.perform(post("/subjects")
                .header(HttpHeaders.AUTHORIZATION, auth)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("code", "CADM", "name", "Content Subject"))))
                .andExpect(status().isCreated());

        mockMvc.perform(get("/users").header(HttpHeaders.AUTHORIZATION, auth)).andExpect(status().isForbidden());
        mockMvc.perform(get("/roles").header(HttpHeaders.AUTHORIZATION, auth)).andExpect(status().isForbidden());
        mockMvc.perform(post("/users")
                .header(HttpHeaders.AUTHORIZATION, auth)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of(
                        "username", "blocked_u",
                        "fullName", "Blocked",
                        "email", "blocked@test.com",
                        "password", "Password123!"))))
                .andExpect(status().isForbidden());
        mockMvc.perform(patch("/users/" + student.getId() + "/status")
                .header(HttpHeaders.AUTHORIZATION, auth)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"LOCKED\"}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/users/" + student.getId() + "/name-warnings")
                .header(HttpHeaders.AUTHORIZATION, auth)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"reason\":\"Invalid\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Section 7.3 & 7.4: USER_ADMIN accesses ONLY User Management and is denied (403) everywhere else")
    void testUserAdminRbacBoundaries() throws Exception {
        String auth = bearer(userAdmin);

        mockMvc.perform(get("/users").header(HttpHeaders.AUTHORIZATION, auth)).andExpect(status().isOk());
        mockMvc.perform(get("/roles").header(HttpHeaders.AUTHORIZATION, auth)).andExpect(status().isOk());
        mockMvc.perform(get("/auth/me").header(HttpHeaders.AUTHORIZATION, auth)).andExpect(status().isOk());

        mockMvc.perform(post("/users")
                .header(HttpHeaders.AUTHORIZATION, auth)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of(
                        "username", "new_teacher_by_ua",
                        "fullName", "Teacher By UserAdmin",
                        "email", "newt@test.com",
                        "password", "Password123!",
                        "role", "TEACHER"))))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/users")
                .header(HttpHeaders.AUTHORIZATION, auth)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of(
                        "username", "escalate_admin",
                        "fullName", "Escalated Admin",
                        "email", "esc@test.com",
                        "password", "Password123!",
                        "role", "ADMIN"))))
                .andExpect(status().isForbidden());

        mockMvc.perform(patch("/users/" + superAdmin.getId() + "/status")
                .header(HttpHeaders.AUTHORIZATION, auth)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"LOCKED\"}"))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/dashboard/summary").header(HttpHeaders.AUTHORIZATION, auth)).andExpect(status().isForbidden());
        mockMvc.perform(get("/dashboard/analytics").header(HttpHeaders.AUTHORIZATION, auth)).andExpect(status().isForbidden());
        mockMvc.perform(get("/subjects").header(HttpHeaders.AUTHORIZATION, auth)).andExpect(status().isForbidden());
        mockMvc.perform(get("/chapters").header(HttpHeaders.AUTHORIZATION, auth)).andExpect(status().isForbidden());
        mockMvc.perform(get("/questions").header(HttpHeaders.AUTHORIZATION, auth)).andExpect(status().isForbidden());
        mockMvc.perform(get("/exam-matrices").header(HttpHeaders.AUTHORIZATION, auth)).andExpect(status().isForbidden());
        mockMvc.perform(get("/exam-papers").header(HttpHeaders.AUTHORIZATION, auth)).andExpect(status().isForbidden());
        mockMvc.perform(get("/teacher/grading/pending").header(HttpHeaders.AUTHORIZATION, auth)).andExpect(status().isForbidden());
        mockMvc.perform(get("/admin/results/users").header(HttpHeaders.AUTHORIZATION, auth)).andExpect(status().isForbidden());
        mockMvc.perform(get("/feedbacks/inbox").header(HttpHeaders.AUTHORIZATION, auth)).andExpect(status().isForbidden());
        mockMvc.perform(get("/notifications/summary").header(HttpHeaders.AUTHORIZATION, auth)).andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Section 7.8: Name warnings logged with sender/history, readable by student, renaming keeps exam/class links")
    void testStudentNameWarningAndRenamePreservesData() throws Exception {
        assignmentRepository.save(StudentTeacherAssignment.builder()
                .student(student).teacher(teacher).teacherClass(teacherClass)
                .status(StudentAssignmentStatus.APPROVED).reviewedAt(LocalDateTime.now()).reviewedBy(teacher).build());
        StudentExamAttempt attempt = attemptRepository.save(StudentExamAttempt.builder()
                .student(student).examPaper(privatePaper).teacher(teacher)
                .status(AttemptStatus.COMPLETED).score(BigDecimal.valueOf(9)).maxScore(BigDecimal.TEN)
                .scoreOnTen(BigDecimal.valueOf(9.0)).submittedAt(LocalDateTime.now()).gradedAt(LocalDateTime.now()).build());

        mockMvc.perform(post("/users/" + student.getId() + "/name-warnings")
                .header(HttpHeaders.AUTHORIZATION, bearer(userAdmin))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of(
                        "reason", "Vui lòng đổi tên thật theo quy định lớp học"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.studentId").value(student.getId().toString()))
                .andExpect(jsonPath("$.senderId").value(userAdmin.getId().toString()))
                .andExpect(jsonPath("$.senderName").value("Admin Người Dùng"))
                .andExpect(jsonPath("$.read").value(false));

        mockMvc.perform(post("/users/" + teacher.getId() + "/name-warnings")
                .header(HttpHeaders.AUTHORIZATION, bearer(superAdmin))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"reason\":\"Not a student\"}"))
                .andExpect(status().isBadRequest());

        mockMvc.perform(post("/users/" + student.getId() + "/name-warnings")
                .header(HttpHeaders.AUTHORIZATION, bearer(teacher))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"reason\":\"Forbidden caller\"}"))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/users/" + student.getId() + "/name-warnings")
                .header(HttpHeaders.AUTHORIZATION, bearer(superAdmin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].reason").value("Vui lòng đổi tên thật theo quy định lớp học"));

        mockMvc.perform(get("/notifications/summary")
                .header(HttpHeaders.AUTHORIZATION, bearer(student)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.unreadNameWarningCount").value(1));

        String warningId = nameWarningRepository.findByStudent_IdOrderByCreatedAtDesc(student.getId()).get(0).getId().toString();

        mockMvc.perform(get("/student/name-warnings")
                .header(HttpHeaders.AUTHORIZATION, bearer(student)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)));

        mockMvc.perform(patch("/student/name-warnings/" + warningId + "/read")
                .header(HttpHeaders.AUTHORIZATION, bearer(student)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.read").value(true));

        mockMvc.perform(patch("/auth/profile")
                .header(HttpHeaders.AUTHORIZATION, bearer(student))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of(
                        "fullName", "Nguyễn Minh Hoàng",
                        "email", student.getEmail()))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.fullName").value("Nguyễn Minh Hoàng"));

        StudentExamAttempt reloadedAttempt = attemptRepository.findById(attempt.getId()).orElseThrow();
        assertEquals(student.getId(), reloadedAttempt.getStudent().getId());
        assertEquals("Nguyễn Minh Hoàng", reloadedAttempt.getStudent().getFullName());
        assertEquals(1, assignmentRepository.findByStudent_IdAndStatus(student.getId(), StudentAssignmentStatus.APPROVED).size());
    }
}
