package com.exammatrix.backend;

import com.exammatrix.backend.dto.request.*;
import com.exammatrix.backend.dto.response.*;
import com.exammatrix.backend.entity.*;
import com.exammatrix.backend.entity.enums.*;
import com.exammatrix.backend.repository.*;
import com.exammatrix.backend.security.JwtService;
import com.exammatrix.backend.security.GoogleStudentTokenVerifier;
import com.exammatrix.backend.service.*;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.poi.xwpf.usermodel.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.web.server.ResponseStatusException;

import jakarta.servlet.Filter;
import jakarta.servlet.http.Cookie;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.hamcrest.Matchers.nullValue;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
class AssessmentIntegrityIntegrationTest {

    @Autowired private WebApplicationContext wac;
    @Autowired private Filter springSecurityFilterChain;
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
    @Autowired private StudentRegistrationOtpRepository otpRepository;

    @Autowired private StudentExamService studentExamService;
    @Autowired private TeacherGradingService teacherGradingService;
    @Autowired private SubjectService subjectService;
    @Autowired private ChapterService chapterService;
    @Autowired private ExamPaperService examPaperService;
    @Autowired private ExamGenerationService examGenerationService;
    @Autowired private QuestionImportService questionImportService;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private JwtService jwtService;
    @Autowired private JdbcTemplate jdbcTemplate;
    @MockitoBean private GoogleStudentTokenVerifier googleVerifier;

    private User adminUser;
    private User teacherUser;
    private User studentUser;
    private Subject subject;
    private Chapter chapter;
    private Question q1;
    private Question qOther;
    private Question essayQ;
    private Answer q1AnsA;
    private Answer q1AnsB;
    private Answer q1AnsC;
    private Answer qOtherAns;
    private ExamMatrix matrix;
    private ExamPaper paper;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(wac)
                .addFilters(springSecurityFilterChain)
                .build();

        otpRepository.deleteAll();
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
                .username("admin_test")
                .email("admin_test@test.com")
                .fullName("Admin Test")
                .password(passwordEncoder.encode("admin123"))
                .role(adminRole)
                .status(UserStatus.ACTIVE)
                .build());

        teacherUser = userRepository.save(User.builder()
                .username("teacher_test")
                .email("teacher_test@test.com")
                .fullName("Teacher Test")
                .password(passwordEncoder.encode("teach123"))
                .role(teacherRole)
                .status(UserStatus.ACTIVE)
                .build());

        studentUser = userRepository.save(User.builder()
                .username("student_test")
                .email("student_test@test.com")
                .fullName("Student Test")
                .password(passwordEncoder.encode("stud123"))
                .role(studentRole)
                .status(UserStatus.ACTIVE)
                .build());

        subject = subjectRepository.save(Subject.builder()
                .code("MATH")
                .name("Toán học")
                .description("Toán")
                .build());

        chapter = chapterRepository.save(Chapter.builder()
                .subject(subject)
                .name("Chương 1")
                .orderIndex(1)
                .build());

        q1 = questionRepository.save(Question.builder()
                .chapter(chapter)
                .teacher(teacherUser)
                .content("1 + 1 = ?")
                .difficulty(Difficulty.EASY)
                .type(QuestionType.SINGLE_CHOICE)
                .examType(ExamType.OBJECTIVE)
                .build());

        q1AnsA = answerRepository.save(Answer.builder().question(q1).content("2").isCorrect(true).build());
        q1AnsB = answerRepository.save(Answer.builder().question(q1).content("3").isCorrect(false).build());
        q1AnsC = answerRepository.save(Answer.builder().question(q1).content("4").isCorrect(false).build());

        qOther = questionRepository.save(Question.builder()
                .chapter(chapter)
                .teacher(teacherUser)
                .content("Outside paper question?")
                .difficulty(Difficulty.EASY)
                .type(QuestionType.SINGLE_CHOICE)
                .examType(ExamType.OBJECTIVE)
                .build());
        qOtherAns = answerRepository.save(Answer.builder().question(qOther).content("Yes").isCorrect(true).build());

        essayQ = questionRepository.save(Question.builder()
                .chapter(chapter)
                .teacher(teacherUser)
                .content("Chứng minh định lý?")
                .difficulty(Difficulty.MEDIUM)
                .type(QuestionType.ESSAY)
                .examType(ExamType.ESSAY)
                .referenceAnswer("Barem chấm chuẩn")
                .build());

        matrix = new ExamMatrix();
        matrix.setSubject(subject);
        matrix.setTeacher(teacherUser);
        matrix.setTitle("Ma trận kiểm thử");
        matrix.setDuration(1);
        matrix.setTotalQuestions(1);
        matrix.setExamType(ExamType.OBJECTIVE);
        ExamMatrixConfig cfg = new ExamMatrixConfig();
        cfg.setChapter(chapter);
        cfg.setDifficulty(Difficulty.EASY);
        cfg.setQuantity(1);
        matrix.addConfig(cfg);
        matrix = examMatrixRepository.save(matrix);

        paper = examPaperRepository.save(ExamPaper.builder()
                .examMatrix(matrix)
                .examCode("100001")
                .accessType(ExamAccessType.PUBLIC)
                .isPublished(true)
                .build());

        paperQuestionRepository.save(PaperQuestion.builder()
                .examPaper(paper)
                .question(q1)
                .questionOrder(1)
                .points(BigDecimal.ONE)
                .build());
    }

    private void authenticate(User user) {
        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                user.getUsername(),
                null,
                List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().getName()))
        );
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    @Test
    @DisplayName("BE01: saveAnswer rejects foreign question, foreign answer, and multi-select on SINGLE_CHOICE")
    void be01_saveAnswerValidatesMembershipAndCardinality() {
        authenticate(studentUser);
        UUID attemptId = studentExamService.startAttempt(paper.getId()).getAttemptId();
        studentExamService.saveAnswer(attemptId, SaveAttemptAnswerRequest.builder()
                .questionId(q1.getId()).selectedAnswerIds(List.of(q1AnsA.getId())).build());

        ResponseStatusException ex1 = assertThrows(ResponseStatusException.class, () ->
                studentExamService.saveAnswer(attemptId, SaveAttemptAnswerRequest.builder()
                        .questionId(qOther.getId())
                        .selectedAnswerIds(List.of(qOtherAns.getId()))
                        .build()));
        assertEquals(HttpStatus.BAD_REQUEST, ex1.getStatusCode());

        ResponseStatusException ex2 = assertThrows(ResponseStatusException.class, () ->
                studentExamService.saveAnswer(attemptId, SaveAttemptAnswerRequest.builder()
                        .questionId(q1.getId())
                        .selectedAnswerIds(List.of(qOtherAns.getId()))
                        .build()));
        assertEquals(HttpStatus.BAD_REQUEST, ex2.getStatusCode());

        ResponseStatusException ex3 = assertThrows(ResponseStatusException.class, () ->
                studentExamService.saveAnswer(attemptId, SaveAttemptAnswerRequest.builder()
                        .questionId(q1.getId())
                        .selectedAnswerIds(List.of(q1AnsA.getId(), q1AnsB.getId()))
                        .build()));
        assertEquals(HttpStatus.BAD_REQUEST, ex3.getStatusCode());
        assertEquals(HttpStatus.BAD_REQUEST, assertThrows(ResponseStatusException.class, () ->
                studentExamService.saveAnswer(attemptId, SaveAttemptAnswerRequest.builder()
                        .questionId(q1.getId()).selectedAnswerIds(java.util.Collections.singletonList(null)).build()))
                .getStatusCode());
        assertEquals(HttpStatus.BAD_REQUEST, assertThrows(ResponseStatusException.class, () ->
                studentExamService.saveAnswer(attemptId, SaveAttemptAnswerRequest.builder()
                        .questionId(q1.getId()).essayAnswer("Nội dung tự luận gửi nhầm").build())).getStatusCode());
        var persisted = attemptAnswerRepository.findByAttempt_IdAndQuestion_Id(attemptId, q1.getId()).orElseThrow();
        assertEquals(List.of(q1AnsA.getId()), persisted.getChoices().stream().map(Answer::getId).toList());
    }

    @Test
    void essayAnswersAndScoresArePreservedWhenClientsSendTheWrongAction() {
        var essayMatrix = examMatrixRepository.save(ExamMatrix.builder()
                .teacher(teacherUser).subject(subject).title("Bài tự luận QA").duration(10)
                .totalQuestions(1).examType(ExamType.ESSAY).build());
        var essayPaper = examPaperRepository.save(ExamPaper.builder()
                .examMatrix(essayMatrix).examCode("QAESSAY").accessType(ExamAccessType.PUBLIC)
                .isPublished(true).build());
        paperQuestionRepository.save(PaperQuestion.builder().examPaper(essayPaper).question(essayQ)
                .questionOrder(1).points(BigDecimal.ONE).build());
        authenticate(studentUser);
        UUID attemptId = studentExamService.startAttempt(essayPaper.getId()).getAttemptId();
        studentExamService.saveAnswer(attemptId, SaveAttemptAnswerRequest.builder()
                .questionId(essayQ.getId()).essayAnswer("Câu trả lời cần giữ lại").build());
        assertEquals(HttpStatus.BAD_REQUEST, assertThrows(ResponseStatusException.class, () ->
                studentExamService.saveAnswer(attemptId, SaveAttemptAnswerRequest.builder()
                        .questionId(essayQ.getId()).selectedAnswerIds(List.of(q1AnsA.getId())).build()))
                .getStatusCode());
        assertEquals(AttemptStatus.WAITING_GRADING, studentExamService.submitAttempt(attemptId).getStatus());

        authenticate(teacherUser);
        var answer = teacherGradingService.getGradingAttempt(attemptId).getAnswers().getFirst();
        assertEquals("Câu trả lời cần giữ lại", answer.getEssayAnswer());
        teacherGradingService.gradeAnswer(attemptId, answer.getAttemptAnswerId(),
                new GradeAnswerRequest(new BigDecimal("0.75"), "Kiểm thử"));
        assertEquals(HttpStatus.BAD_REQUEST, assertThrows(ResponseStatusException.class, () ->
                teacherGradingService.completeGrading(attemptId, new CompleteGradingRequest("CANCELLED"))).getStatusCode());
        assertEquals(AttemptStatus.WAITING_GRADING, attemptRepository.findById(attemptId).orElseThrow().getStatus());
        assertEquals(new BigDecimal("0.75"), teacherGradingService.completeGrading(attemptId, null).getScore());
    }

    @Test
    void cancelledAttemptCannotBeSubmitted() {
        authenticate(studentUser);
        UUID attemptId = studentExamService.startAttempt(paper.getId()).getAttemptId();
        jdbcTemplate.update("UPDATE student_exam_attempts SET status = ? WHERE id = ?", "CANCELLED", attemptId);

        assertEquals(HttpStatus.CONFLICT, assertThrows(ResponseStatusException.class, () ->
                studentExamService.submitAttempt(attemptId)).getStatusCode());
        assertEquals(AttemptStatus.CANCELLED, studentExamService.getAttemptResult(attemptId).getStatus());
        assertNull(studentExamService.getAttemptResult(attemptId).getSubmittedAt());
    }

    @Test
    void googleSignInCreatesStudentsAndReusesTheSubjectWithoutLinkingExistingEmail() throws Exception {
        String subject = "test-google-subject";
        when(googleVerifier.getClientId()).thenReturn("test-client");
        Jwt newStudent = Jwt.withTokenValue("verified-google-id")
                .header("alg", "RS256").subject(subject)
                .claim("email", "new-google-user@example.com").claim("name", "Học sinh Google").build();
        Jwt existingEmail = Jwt.withTokenValue("other-id")
                .header("alg", "RS256").subject("other-subject")
                .claim("email", teacherUser.getEmail()).build();
        when(googleVerifier.verify("verified-google-id", "test-nonce")).thenReturn(newStudent);
        when(googleVerifier.verify("other-id", "test-nonce")).thenReturn(existingEmail);

        mockMvc.perform(post("/auth/google/student/challenge"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.clientId").value("test-client"))
                .andExpect(jsonPath("$.nonce").isNotEmpty())
                .andExpect(header().exists("Set-Cookie"));
        var nonce = new Cookie("exam_google_nonce", "test-nonce");
        for (int login = 0; login < 2; login++) {
            mockMvc.perform(post("/auth/google/student").cookie(nonce)
                            .contentType("application/json").content("{\"credential\":\"verified-google-id\"}"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.user.role").value("STUDENT"))
                    .andExpect(jsonPath("$.accessToken").isNotEmpty());
        }
        assertEquals(4, userRepository.count());
        assertTrue(userRepository.findByGoogleSubject(subject).isPresent());
        mockMvc.perform(post("/auth/google/student").cookie(nonce)
                        .contentType("application/json").content("{\"credential\":\"other-id\"}"))
                .andExpect(status().isConflict());
    }

    @Test
    void bcryptPasswordChangesValidateTheUtf8ByteLength() throws Exception {
        otpRepository.save(StudentRegistrationOtp.builder()
                .email("qa_utf8@example.com")
                .otpHash(passwordEncoder.encode("123456"))
                .expiresAt(java.time.LocalDateTime.now().plusMinutes(5))
                .attempts(0)
                .resendCount(0)
                .lastSentAt(java.time.LocalDateTime.now())
                .build());
        String tooLong = "ấ".repeat(25);
        String registration = """
                {"username":"qa_utf8","email":"qa_utf8@example.com","fullName":"QA UTF8","password":"%s","otp":"123456"}
                """;
        mockMvc.perform(post("/auth/register/student").contentType("application/json")
                        .content(registration.formatted(tooLong)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.password").isString());
        mockMvc.perform(post("/auth/register/student").contentType("application/json")
                        .content(registration.formatted("ấ".repeat(24))))
                .andExpect(status().isCreated());

        String teacher = "Bearer " + jwtService.generateToken(teacherUser);
        mockMvc.perform(patch("/auth/password").header("Authorization", teacher)
                        .contentType("application/json")
                        .content("""
                                {"currentPassword":"teacher123","newPassword":"%s"}
                                """.formatted(tooLong)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.newPassword").isString());
        mockMvc.perform(patch("/teacher/classes").header("Authorization", teacher)
                        .contentType("application/json")
                        .content("""
                                {"name":"Lớp kiểm thử", "classCode":"QA_UTF8", "password":"%s"}
                                """.formatted(tooLong)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.password").isString());

        String admin = "Bearer " + jwtService.generateToken(adminUser);
        mockMvc.perform(post("/users").header("Authorization", admin).contentType("application/json")
                        .content(registration.formatted(tooLong)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.password").isString());
    }

    @Test
    void invalidHttpRequestsKeepTheirClientErrorStatuses() throws Exception {
        String token = jwtService.generateToken(teacherUser);
        mockMvc.perform(get("/teacher/qa-missing-route").header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
        mockMvc.perform(post("/dashboard/summary").header("Authorization", "Bearer " + token))
                .andExpect(status().isMethodNotAllowed())
                .andExpect(header().exists("Allow"));
        mockMvc.perform(post("/auth/google/student").contentType("text/plain").content("invalid media type"))
                .andExpect(status().isUnsupportedMediaType());
    }

    @Test
    void jwtStopsWorkingAfterAccountLockOrLogout() throws Exception {
        String token = jwtService.generateToken(adminUser);
        mockMvc.perform(get("/roles").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
        adminUser.setStatus(UserStatus.LOCKED);
        userRepository.saveAndFlush(adminUser);
        mockMvc.perform(get("/roles").header("Authorization", "Bearer " + token))
                .andExpect(status().isUnauthorized());

        String studentToken = jwtService.generateToken(studentUser);
        mockMvc.perform(post("/auth/logout").header("Authorization", "Bearer " + studentToken))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/auth/me").header("Authorization", "Bearer " + studentToken))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void generationWithSameRequestReturnsUnpublishedPapersWithoutDuplicates() {
        authenticate(teacherUser);
        var request = new GenerateExamPapersRequest(BigDecimal.ONE, UUID.randomUUID());
        var first = examGenerationService.generateExamPapers(matrix.getId(), request).getFirst();
        var retry = examGenerationService.generateExamPapers(matrix.getId(), request).getFirst();
        assertEquals(first.getId(), retry.getId());
        assertFalse(first.getIsPublished());
        assertEquals(ExamAccessType.PRIVATE, first.getAccessType());
    }

    @Test
    void paperSummariesFilterAndPaginateWithinTheCurrentRole() throws Exception {
        ExamMatrix otherMatrix = examMatrixRepository.save(ExamMatrix.builder()
                .teacher(adminUser).subject(subject).title("Ma trận riêng").duration(15)
                .totalQuestions(1).examType(ExamType.ESSAY).build());
        ExamPaper otherPaper = examPaperRepository.save(ExamPaper.builder()
                .examMatrix(otherMatrix).examCode("100002").accessType(ExamAccessType.PRIVATE)
                .isPublished(false).build());
        String teacher = "Bearer " + jwtService.generateToken(teacherUser);
        String admin = "Bearer " + jwtService.generateToken(adminUser);

        mockMvc.perform(get("/exam-papers/summary").header("Authorization", teacher)
                        .queryParam("matrixId", matrix.getId().toString())
                        .queryParam("subjectId", subject.getId().toString())
                        .queryParam("examType", "OBJECTIVE").queryParam("accessType", "PUBLIC")
                        .queryParam("isPublished", "true").queryParam("search", "math"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].id").value(paper.getId().toString()))
                .andExpect(jsonPath("$.content[0].matrixTitle").value(matrix.getTitle()))
                .andExpect(jsonPath("$.content[0].subjectName").value("Toán học"))
                .andExpect(jsonPath("$.content[0].questionCount").value(1))
                .andExpect(jsonPath("$.content[0].questions").doesNotHaveJsonPath());

        mockMvc.perform(get("/exam-papers/summary").header("Authorization", teacher)
                        .queryParam("matrixId", otherMatrix.getId().toString()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));

        mockMvc.perform(get("/exam-papers/summary").header("Authorization", admin)
                        .queryParam("examType", "ESSAY").queryParam("isPublished", "false")
                        .queryParam("accessType", "PRIVATE"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].id").value(otherPaper.getId().toString()));

        mockMvc.perform(get("/exam-papers/summary").header("Authorization", admin)
                        .queryParam("page", "1").queryParam("size", "1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.totalPages").value(2)).andExpect(jsonPath("$.content.length()").value(1));
        mockMvc.perform(get("/exam-papers/summary").header("Authorization", admin)
                        .queryParam("search", "%"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));
        mockMvc.perform(get("/exam-papers").header("Authorization", teacher)
                        .queryParam("matrixId", matrix.getId().toString()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.content[0].questions.length()").value(1));
    }

    @Test
    void generationRetryDoesNotRecreateDeletedPapers() {
        authenticate(teacherUser);
        var request = new GenerateExamPapersRequest(BigDecimal.valueOf(2), UUID.randomUUID());
        var papers = examGenerationService.generateExamPapers(matrix.getId(), request);
        examPaperService.deleteExamPaper(papers.getFirst().getId());

        var changedCount = new GenerateExamPapersRequest(BigDecimal.ONE, request.getRequestId());
        assertEquals(HttpStatus.CONFLICT, assertThrows(ResponseStatusException.class, () ->
                examGenerationService.generateExamPapers(matrix.getId(), changedCount)).getStatusCode());

        examPaperService.deleteExamPaper(papers.getLast().getId());
        long remaining = examPaperRepository.count();
        assertEquals(HttpStatus.CONFLICT, assertThrows(ResponseStatusException.class, () ->
                examGenerationService.generateExamPapers(matrix.getId(), request)).getStatusCode());
        assertEquals(remaining, examPaperRepository.count());

        var newRequest = new GenerateExamPapersRequest(BigDecimal.ONE, UUID.randomUUID());
        assertEquals(1, examGenerationService.generateExamPapers(matrix.getId(), newRequest).size());
    }

    @Test
    @DisplayName("BE02+BE03: Expired saveAnswer and startAttempt commit auto-submit instead of rolling back")
    void be02_be03_expiredAttemptCommitsAutoSubmit() {
        authenticate(studentUser);
        UUID attemptId = studentExamService.startAttempt(paper.getId()).getAttemptId();
        studentExamService.saveAnswer(attemptId, SaveAttemptAnswerRequest.builder()
                .questionId(q1.getId())
                .selectedAnswerIds(List.of(q1AnsA.getId()))
                .build());

        jdbcTemplate.update(
                "UPDATE student_exam_attempts SET started_at = ? WHERE id = ?",
                java.sql.Timestamp.valueOf(LocalDateTime.now().minusSeconds(65)),
                attemptId
        );

        ResponseStatusException saveEx = assertThrows(ResponseStatusException.class, () ->
                studentExamService.saveAnswer(attemptId, SaveAttemptAnswerRequest.builder()
                        .questionId(q1.getId())
                        .selectedAnswerIds(List.of(q1AnsB.getId()))
                        .build()));
        assertEquals(HttpStatus.BAD_REQUEST, saveEx.getStatusCode());

        StudentExamAttempt persisted = attemptRepository.findById(attemptId).orElseThrow();
        assertEquals(AttemptStatus.COMPLETED, persisted.getStatus());
        assertEquals(0, BigDecimal.ONE.compareTo(persisted.getScore()));
    }

    @Test
    @DisplayName("BE04: completeGrading rejects non-WAITING_GRADING attempts with 409")
    void be04_completeGradingRequiresWaitingStatus() {
        authenticate(studentUser);
        UUID attemptId = studentExamService.startAttempt(paper.getId()).getAttemptId();

        authenticate(teacherUser);
        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                teacherGradingService.completeGrading(attemptId, new CompleteGradingRequest("COMPLETED")));
        assertEquals(HttpStatus.CONFLICT, ex.getStatusCode());
    }

    @Test
    @DisplayName("FK delete returns 409 Conflict for non-admin Subject, Chapter, and ExamPaper; Admin can cascade-delete Subject")
    void fkDeletesReturnConflict409() {
        authenticate(teacherUser);

        ResponseStatusException subEx = assertThrows(ResponseStatusException.class, () ->
                subjectService.deleteSubjectById(subject.getId()));
        assertEquals(HttpStatus.CONFLICT, subEx.getStatusCode());

        authenticate(adminUser);

        ResponseStatusException chapEx = assertThrows(ResponseStatusException.class, () ->
                chapterService.deleteChapterById(chapter.getId()));
        assertEquals(HttpStatus.CONFLICT, chapEx.getStatusCode());

        authenticate(studentUser);
        studentExamService.startAttempt(paper.getId());

        authenticate(teacherUser);
        ResponseStatusException paperEx = assertThrows(ResponseStatusException.class, () ->
                examPaperService.deleteExamPaper(paper.getId()));
        assertEquals(HttpStatus.CONFLICT, paperEx.getStatusCode());

        authenticate(adminUser);
        subjectService.deleteSubjectById(subject.getId());
        assertFalse(subjectRepository.existsById(subject.getId()));
    }

    @Test
    @DisplayName("ExamGenerationServiceImpl distributes 10-point total and deterministic answer order across endpoints")
    void examGenerationPointsAndDeterministicOrder() {
        authenticate(teacherUser);
        List<ExamPaperDetailResponse> generated = examGenerationService.generateExamPapers(
                matrix.getId(),
                new GenerateExamPapersRequest(BigDecimal.ONE)
        );
        assertEquals(1, generated.size());
        ExamPaperDetailResponse genPaper = generated.get(0);
        PaperQuestionResponse genQ = genPaper.getQuestions().get(0);
        assertEquals(0, BigDecimal.TEN.compareTo(genQ.getPoints()));

        ExamPaperDetailResponse fetchedPaper = examPaperService.getExamPaperById(genPaper.getId());
        List<UUID> genAnswerIds = genQ.getAnswers().stream().map(AnswerResponse::getId).toList();
        List<UUID> fetchedAnswerIds = fetchedPaper.getQuestions().get(0).getAnswers().stream()
                .map(AnswerResponse::getId).toList();
        assertEquals(genAnswerIds, fetchedAnswerIds);

        authenticate(studentUser);
        ResponseStatusException draft = assertThrows(ResponseStatusException.class, () ->
                studentExamService.getExamDetail(genPaper.getId()));
        assertEquals(HttpStatus.FORBIDDEN, draft.getStatusCode());
        authenticate(teacherUser);
        examPaperService.updateExamPaperAccess(genPaper.getId(),
                new UpdateExamPaperAccessRequest(ExamAccessType.PUBLIC, true));
        authenticate(studentUser);
        StudentExamDetailResponse studentDetail = studentExamService.getExamDetail(genPaper.getId());
        List<UUID> studentAnswerIds = studentDetail.getQuestions().get(0).getAnswers().stream()
                .map(StudentAnswerChoiceResponse::getId).toList();
        assertEquals(genAnswerIds, studentAnswerIds);
    }

    @Test
    @DisplayName("QuestionImportServiceImpl parses XWPFTable, multiline options, and rejects scanned PDF")
    void importServiceHandlesTablesMultilineAndScannedPdf() throws Exception {
        authenticate(teacherUser);

        byte[] docxBytes;
        try (XWPFDocument doc = new XWPFDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            XWPFTable table = doc.createTable(2, 1);
            table.getRow(0).getCell(0).setText(
                    "Câu 1: [Trắc nghiệm] [Dễ] Giá trị của 2^3 là?\n" +
                    "A. 6\n" +
                    "B. 8 (Đúng)\n" +
                    "dòng bổ sung cho đáp án B\n" +
                    "C. 9"
            );
            table.getRow(1).getCell(0).setText(
                    "Câu 2: [Tự luận] [Khó] Trình bày khái niệm ma trận.\n" +
                    "Đáp án tham khảo: Ma trận là bảng số gồm m hàng và n cột."
            );
            XWPFParagraph p3 = doc.createParagraph();
            p3.createRun().setText(
                    "Câu 3: [Đúng / Sai] [Dễ] Số 2 là số nguyên tố chẵn duy nhất.\n" +
                    "*A. Đúng\n" +
                    "B. Sai"
            );
            doc.write(out);
            docxBytes = out.toByteArray();
        }

        MockMultipartFile docxFile = new MockMultipartFile(
                "file", "table_import.docx",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                docxBytes
        );
        ImportQuestionsPreviewResponse preview = questionImportService.previewImport(docxFile, subject.getId(), chapter.getId());
        assertEquals(3, preview.getTotalParsed(), () -> "Items: " + preview.getItems());
        assertEquals(3, preview.getValidCount(), () -> "Items: " + preview.getItems());
        assertTrue(preview.getItems().get(0).getAnswers().get(1).getIsCorrect());
        assertTrue(preview.getItems().get(0).getAnswers().get(1).getContent().contains("dòng bổ sung"));
        assertEquals(QuestionType.TRUE_FALSE, preview.getItems().get(2).getType());

        Subject otherSubject = subjectRepository.save(Subject.builder()
                .code("PHYS").name("Vật lý").description("Lý").build());
        ImportQuestionsConfirmRequest mismatchReq = ImportQuestionsConfirmRequest.builder()
                .subjectId(otherSubject.getId())
                .items(List.of(ImportQuestionItemRequest.builder()
                        .chapterId(chapter.getId())
                        .content("Câu hỏi sai môn")
                        .difficulty(Difficulty.EASY)
                        .type(QuestionType.ESSAY)
                        .referenceAnswer("Barem")
                        .build()))
                .build();
        ResponseStatusException confirmEx = assertThrows(ResponseStatusException.class, () ->
                questionImportService.confirmImport(mismatchReq));
        assertEquals(HttpStatus.BAD_REQUEST, confirmEx.getStatusCode());

        byte[] multiPagePdfBytes;
        try (PDDocument pdf = new PDDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            var font = new org.apache.pdfbox.pdmodel.font.PDType1Font(
                    org.apache.pdfbox.pdmodel.font.Standard14Fonts.FontName.HELVETICA);
            PDPage p1 = new PDPage();
            pdf.addPage(p1);
            try (var cs = new org.apache.pdfbox.pdmodel.PDPageContentStream(pdf, p1)) {
                cs.beginText();
                cs.setFont(font, 11);
                cs.setLeading(15f);
                cs.newLineAtOffset(50, 750);
                for (String line : List.of(
                        "Question 1: [SINGLE_CHOICE] [EASY] 2 + 2 = ?",
                        "A. 3",
                        "*B. 4",
                        "C. 5",
                        "D. 6"
                )) {
                    cs.showText(line);
                    cs.newLine();
                }
                cs.endText();
            }
            PDPage p2 = new PDPage();
            pdf.addPage(p2);
            try (var cs = new org.apache.pdfbox.pdmodel.PDPageContentStream(pdf, p2)) {
                cs.beginText();
                cs.setFont(font, 11);
                cs.setLeading(15f);
                cs.newLineAtOffset(50, 750);
                for (String line : List.of(
                        "SAMPLE BANK HEADER (TRANG 2/2)",
                        "Question 2: [TRUE_FALSE] [MEDIUM] 1 + 1 = 2.",
                        "*A. Dung",
                        "B. Sai"
                )) {
                    cs.showText(line);
                    cs.newLine();
                }
                cs.endText();
            }
            pdf.save(out);
            multiPagePdfBytes = out.toByteArray();
        }
        MockMultipartFile multiPdfFile = new MockMultipartFile("file", "multi.pdf", "application/pdf", multiPagePdfBytes);
        ImportQuestionsPreviewResponse multiPreview = questionImportService.previewImport(multiPdfFile, subject.getId(), chapter.getId());
        assertEquals(2, multiPreview.getTotalParsed());
        assertEquals("6", multiPreview.getItems().get(0).getAnswers().get(3).getContent());

        byte[] blankPdfBytes;
        try (PDDocument pdf = new PDDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            pdf.addPage(new PDPage());
            pdf.save(out);
            blankPdfBytes = out.toByteArray();
        }
        MockMultipartFile pdfFile = new MockMultipartFile("file", "scan.pdf", "application/pdf", blankPdfBytes);
        ResponseStatusException pdfEx = assertThrows(ResponseStatusException.class, () ->
                questionImportService.previewImport(pdfFile, subject.getId(), chapter.getId()));
        assertEquals(HttpStatus.BAD_REQUEST, pdfEx.getStatusCode());
    }

    @Test
    @DisplayName("SecurityConfig blocks ADMIN from CLASS_ADMIN endpoints while allowing TEACHER")
    void securityBlocksAdminFromClassAdmin() throws Exception {
        String adminToken = jwtService.generateToken(adminUser);
        String teacherToken = jwtService.generateToken(teacherUser);

        mockMvc.perform(get("/teacher/classes")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/teacher/student-requests")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/teacher/classes")
                        .header("Authorization", "Bearer " + teacherToken))
                .andExpect(status().isOk());

        mockMvc.perform(get("/teacher/grading/pending")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("Role dashboards aggregate one real exam attempt without crossing account scope")
    void analyticsDashboardUsesRealScopedDataAcrossRoles() throws Exception {
        authenticate(studentUser);
        UUID attemptId = studentExamService.startAttempt(paper.getId()).getAttemptId();
        studentExamService.saveAnswer(attemptId, SaveAttemptAnswerRequest.builder()
                .questionId(q1.getId())
                .selectedAnswerIds(List.of(q1AnsA.getId()))
                .build());
        studentExamService.submitAttempt(attemptId);

        String adminToken = jwtService.generateToken(adminUser);
        String teacherToken = jwtService.generateToken(teacherUser);
        String studentToken = jwtService.generateToken(studentUser);

        mockMvc.perform(get("/dashboard/analytics")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("ADMIN"))
                .andExpect(jsonPath("$.subjectCoverage[0].chapterCount").value(1))
                .andExpect(jsonPath("$.subjectCoverage[0].questionCount").value(3))
                .andExpect(jsonPath("$.subjectCoverage[0].chaptersWithoutQuestions").value(0))
                .andExpect(jsonPath("$.paperVisibility.length()").value(4))
                .andExpect(jsonPath("$.studentAttempts").value(nullValue()));

        mockMvc.perform(get("/dashboard/analytics")
                        .header("Authorization", "Bearer " + teacherToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("TEACHER"))
                .andExpect(jsonPath("$.questionDistribution.length()").value(12))
                .andExpect(jsonPath("$.scoreSampleCount").value(1))
                .andExpect(jsonPath("$.scoreDistribution[5].count").value(1))
                .andExpect(jsonPath("$.gradingQueue").doesNotExist())
                .andExpect(jsonPath("$.teacherScoreHistogram.sampleSize").value(1))
                .andExpect(jsonPath("$.subjectCoverage").value(nullValue()));

        mockMvc.perform(get("/dashboard/analytics")
                        .header("Authorization", "Bearer " + studentToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("STUDENT"))
                .andExpect(jsonPath("$.studentAttemptTotal").value(1))
                .andExpect(jsonPath("$.studentSubjectResults[0].averageOnTen").value(10.0))
                .andExpect(jsonPath("$.studentChapterProgress[0].correctCount").value(1))
                .andExpect(jsonPath("$.questionDistribution").value(nullValue()));
    }

    @Test
    @DisplayName("Question list and detail map answers with open-in-view disabled")
    void questionReadsLoadAnswersInsideServiceTransaction() throws Exception {
        String token = "Bearer " + jwtService.generateToken(teacherUser);
        mockMvc.perform(get("/questions").header("Authorization", token))
                .andExpect(status().isOk());
        mockMvc.perform(get("/questions/{id}", q1.getId()).header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.answers.length()").value(3));
    }

    @Test
    @DisplayName("Readiness is public while CORS permits only configured local origins")
    void readinessAndCorsPolicyAreExplicit() throws Exception {
        mockMvc.perform(get("/actuator/health/readiness"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));

        mockMvc.perform(options("/auth/login")
                        .header("Origin", "http://localhost:3000")
                        .header("Access-Control-Request-Method", "POST")
                        .header("Access-Control-Request-Headers", "content-type"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:3000"))
                .andExpect(header().string("Access-Control-Allow-Credentials", "true"));

        mockMvc.perform(options("/auth/login")
                        .header("Origin", "https://untrusted.example")
                        .header("Access-Control-Request-Method", "POST"))
                .andExpect(status().isForbidden())
                .andExpect(header().doesNotExist("Access-Control-Allow-Origin"));
    }
}
