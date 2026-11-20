package com.exammatrix.backend;

import com.exammatrix.backend.dto.request.JoinClassRequest;
import com.exammatrix.backend.dto.request.SaveAttemptAnswerRequest;
import com.exammatrix.backend.dto.request.StudentRegisterRequest;
import com.exammatrix.backend.dto.response.*;
import com.exammatrix.backend.entity.*;
import com.exammatrix.backend.entity.enums.AttemptStatus;
import com.exammatrix.backend.entity.enums.Difficulty;
import com.exammatrix.backend.entity.enums.ExamAccessType;
import com.exammatrix.backend.entity.enums.ExamType;
import com.exammatrix.backend.entity.enums.QuestionType;
import com.exammatrix.backend.entity.enums.StudentAssignmentStatus;
import com.exammatrix.backend.entity.enums.UserStatus;
import com.exammatrix.backend.repository.*;
import com.exammatrix.backend.security.JwtService;
import com.exammatrix.backend.service.QuestionImportService;
import com.exammatrix.backend.service.StudentClassService;
import com.exammatrix.backend.service.StudentExamService;
import com.exammatrix.backend.service.TeacherClassService;
import com.exammatrix.backend.service.TeacherGradingService;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.server.ResponseStatusException;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class StudentExamModuleTest {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private SubjectRepository subjectRepository;

    @Autowired
    private ChapterRepository chapterRepository;

    @Autowired
    private QuestionRepository questionRepository;

    @Autowired
    private AnswerRepository answerRepository;

    @Autowired
    private ExamMatrixRepository examMatrixRepository;

    @Autowired
    private ExamPaperRepository examPaperRepository;

    @Autowired
    private PaperQuestionRepository paperQuestionRepository;

    @Autowired
    private TeacherClassRepository teacherClassRepository;

    @Autowired
    private StudentTeacherAssignmentRepository assignmentRepository;

    @Autowired
    private StudentExamAttemptRepository attemptRepository;

    @Autowired
    private StudentAttemptAnswerRepository attemptAnswerRepository;

    @Autowired
    private StudentClassService studentClassService;

    @Autowired
    private TeacherClassService teacherClassService;

    @Autowired
    private StudentExamService studentExamService;

    @Autowired
    private TeacherGradingService teacherGradingService;

    @Autowired
    private QuestionImportService questionImportService;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtService jwtService;

    private User teacherUser;
    private User otherTeacherUser;
    private User studentUser;
    private TeacherClass teacherClass;
    private ExamPaper publicObjectivePaper;
    private ExamPaper privateObjectivePaper;
    private ExamPaper privateEssayPaper;
    private Question singleChoiceQ;
    private Question essayQ;
    private Answer singleChoiceCorrectAns;
    private Answer singleChoiceWrongAns;

    @BeforeEach
    void setUp() {
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

        teacherUser = userRepository.save(User.builder()
                .username("teacher1")
                .email("teacher1@test.com")
                .fullName("Teacher One")
                .password(passwordEncoder.encode("teachpass"))
                .role(teacherRole)
                .status(UserStatus.ACTIVE)
                .build());

        otherTeacherUser = userRepository.save(User.builder()
                .username("teacher2")
                .email("teacher2@test.com")
                .fullName("Teacher Two")
                .password(passwordEncoder.encode("teachpass"))
                .role(teacherRole)
                .status(UserStatus.ACTIVE)
                .build());

        studentUser = userRepository.save(User.builder()
                .username("student1")
                .email("student1@test.com")
                .fullName("Student One")
                .password(passwordEncoder.encode("studpass"))
                .role(studentRole)
                .status(UserStatus.ACTIVE)
                .build());

        teacherClass = teacherClassRepository.save(TeacherClass.builder()
                .teacher(teacherUser)
                .name("Class 12A1")
                .classCode("CLS12A1")
                .joinPassword(passwordEncoder.encode("secret123"))
                .build());

        Subject subject = subjectRepository.save(Subject.builder()
                .code("MTH")
                .name("Mathematics")
                .description("Math subject")
                .build());

        Chapter chapter = chapterRepository.save(Chapter.builder()
                .subject(subject)
                .name("Chapter 1: Algebra")
                .orderIndex(1)
                .build());

        singleChoiceQ = questionRepository.save(Question.builder()
                .chapter(chapter)
                .teacher(teacherUser)
                .content("What is 2 + 2?")
                .difficulty(Difficulty.EASY)
                .type(QuestionType.SINGLE_CHOICE)
                .build());

        singleChoiceCorrectAns = answerRepository.save(Answer.builder()
                .question(singleChoiceQ)
                .content("4")
                .isCorrect(true)
                .build());

        singleChoiceWrongAns = answerRepository.save(Answer.builder()
                .question(singleChoiceQ)
                .content("5")
                .isCorrect(false)
                .build());

        essayQ = questionRepository.save(Question.builder()
                .chapter(chapter)
                .teacher(teacherUser)
                .content("Explain Pythagorean theorem.")
                .difficulty(Difficulty.MEDIUM)
                .type(QuestionType.ESSAY)
                .referenceAnswer("In a right angled triangle, a^2 + b^2 = c^2.")
                .build());

        ExamMatrix objMatrix = examMatrixRepository.save(ExamMatrix.builder()
                .subject(subject)
                .teacher(teacherUser)
                .title("Objective Test Matrix")
                .duration(45)
                .totalQuestions(1)
                .examType(ExamType.OBJECTIVE)
                .build());

        ExamMatrix essayMatrix = examMatrixRepository.save(ExamMatrix.builder()
                .subject(subject)
                .teacher(teacherUser)
                .title("Essay Test Matrix")
                .duration(60)
                .totalQuestions(1)
                .examType(ExamType.ESSAY)
                .build());

        publicObjectivePaper = examPaperRepository.save(ExamPaper.builder()
                .examMatrix(objMatrix)
                .examCode("PUB-01")
                .accessType(ExamAccessType.PUBLIC)
                .isPublished(true)
                .build());

        paperQuestionRepository.save(PaperQuestion.builder()
                .examPaper(publicObjectivePaper)
                .question(singleChoiceQ)
                .questionOrder(1)
                .points(new BigDecimal("10.00"))
                .build());

        privateObjectivePaper = examPaperRepository.save(ExamPaper.builder()
                .examMatrix(objMatrix)
                .examCode("PRV-01")
                .accessType(ExamAccessType.PRIVATE)
                .isPublished(true)
                .build());

        paperQuestionRepository.save(PaperQuestion.builder()
                .examPaper(privateObjectivePaper)
                .question(singleChoiceQ)
                .questionOrder(1)
                .points(new BigDecimal("10.00"))
                .build());

        privateEssayPaper = examPaperRepository.save(ExamPaper.builder()
                .examMatrix(essayMatrix)
                .examCode("PRV-ESSAY")
                .accessType(ExamAccessType.PRIVATE)
                .isPublished(true)
                .build());

        paperQuestionRepository.save(PaperQuestion.builder()
                .examPaper(privateEssayPaper)
                .question(essayQ)
                .questionOrder(1)
                .points(new BigDecimal("10.00"))
                .build());
    }

    private void authenticateUser(User user) {
        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                user.getUsername(),
                null,
                List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().getName()))
        );
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    @Test
    @DisplayName("1. Student token generation and authentication")
    void testStudentAuthentication() {
        String token = jwtService.generateToken(studentUser);
        assertNotNull(token);
        assertFalse(token.isBlank());
    }

    @Test
    @DisplayName("2. Student can access PUBLIC exam paper without joining class")
    void testPublicExamAccessWithoutClass() {
        authenticateUser(studentUser);
        StudentExamDetailResponse detail = studentExamService.getExamDetail(publicObjectivePaper.getId());
        assertNotNull(detail);
        assertEquals("PUB-01", detail.getExamCode());
        assertEquals(1, detail.getQuestions().size());

        StudentQuestionResponse qResp = detail.getQuestions().get(0);
        assertEquals("What is 2 + 2?", qResp.getContent());
        for (StudentAnswerChoiceResponse choice : qResp.getAnswers()) {
            assertNotNull(choice.getContent());
        }
    }

    @Test
    @DisplayName("3. Student blocked (403) from PRIVATE exam before joining class")
    void testPrivateExamBlockedBeforeJoin() {
        authenticateUser(studentUser);
        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                studentExamService.getExamDetail(privateObjectivePaper.getId()));
        assertEquals(403, ex.getStatusCode().value());
    }

    @Test
    @DisplayName("4. Joining class with invalid password fails (400)")
    void testJoinClassInvalidPassword() {
        authenticateUser(studentUser);
        JoinClassRequest req = JoinClassRequest.builder()
                .classCode("CLS12A1")
                .password("wrongpassword")
                .build();
        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                studentClassService.joinClass(req));
        assertEquals(400, ex.getStatusCode().value());
    }

    @Test
    @DisplayName("5. Joining class with valid password creates PENDING request; teacher approval unlocks private exam")
    void testJoinClassSuccess() {
        authenticateUser(studentUser);
        JoinClassRequest req = JoinClassRequest.builder()
                .classCode("CLS12A1")
                .password("secret123")
                .build();
        StudentAssignmentResponse resp = studentClassService.joinClass(req);
        assertNotNull(resp);
        assertEquals(StudentAssignmentStatus.PENDING, resp.getStatus());
        assertEquals("CLS12A1", resp.getClassCode());

        ResponseStatusException forbidden = assertThrows(ResponseStatusException.class, () ->
                studentExamService.getExamDetail(privateObjectivePaper.getId()));
        assertEquals(403, forbidden.getStatusCode().value());

        authenticateUser(teacherUser);
        StudentAssignmentResponse approved = teacherClassService.reviewStudentAssignment(
                resp.getId(),
                com.exammatrix.backend.dto.request.ReviewStudentAssignmentRequest.builder()
                        .status(StudentAssignmentStatus.APPROVED)
                        .build()
        );
        assertEquals(StudentAssignmentStatus.APPROVED, approved.getStatus());

        authenticateUser(studentUser);
        StudentExamDetailResponse detail = studentExamService.getExamDetail(privateObjectivePaper.getId());
        assertNotNull(detail);
        assertEquals("PRV-01", detail.getExamCode());
    }

    @Test
    @DisplayName("6. Student cannot access PRIVATE exam of other teacher")
    void testCannotAccessOtherTeacherPrivateExam() {

        ExamMatrix otherMatrix = examMatrixRepository.save(ExamMatrix.builder()
                .subject(publicObjectivePaper.getExamMatrix().getSubject())
                .teacher(otherTeacherUser)
                .title("Other Teacher Matrix")
                .duration(30)
                .totalQuestions(1)
                .examType(ExamType.OBJECTIVE)
                .build());

        ExamPaper otherPrivatePaper = examPaperRepository.save(ExamPaper.builder()
                .examMatrix(otherMatrix)
                .examCode("OTHER-PRV")
                .accessType(ExamAccessType.PRIVATE)
                .isPublished(true)
                .build());

        authenticateUser(studentUser);
        StudentAssignmentResponse reqResp = studentClassService.joinClass(JoinClassRequest.builder()
                .classCode("CLS12A1")
                .password("secret123")
                .build());
        authenticateUser(teacherUser);
        teacherClassService.reviewStudentAssignment(
                reqResp.getId(),
                com.exammatrix.backend.dto.request.ReviewStudentAssignmentRequest.builder()
                        .status(StudentAssignmentStatus.APPROVED)
                        .build()
        );
        authenticateUser(studentUser);

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                studentExamService.getExamDetail(otherPrivatePaper.getId()));
        assertEquals(403, ex.getStatusCode().value());
    }

    @Test
    @DisplayName("7. Student starts attempt, saves answers, and auto-grades objective exam")
    void testStartAndSubmitObjectiveExam() {
        authenticateUser(studentUser);

        StartAttemptResponse startResp = studentExamService.startAttempt(publicObjectivePaper.getId());
        assertNotNull(startResp);
        assertEquals(AttemptStatus.IN_PROGRESS, startResp.getStatus());
        assertNotNull(startResp.getRemainingSeconds());
        assertTrue(startResp.getRemainingSeconds() > 0);

        UUID attemptId = startResp.getAttemptId();

        StartAttemptResponse resumeResp = studentExamService.startAttempt(publicObjectivePaper.getId());
        assertEquals(attemptId, resumeResp.getAttemptId());

        studentExamService.saveAnswer(attemptId, SaveAttemptAnswerRequest.builder()
                .questionId(singleChoiceQ.getId())
                .selectedAnswerIds(List.of(singleChoiceCorrectAns.getId()))
                .build());

        StudentAttemptResultResponse result = studentExamService.submitAttempt(attemptId);
        assertNotNull(result);
        assertEquals(AttemptStatus.COMPLETED, result.getStatus());
        assertNotNull(result.getScore());
        assertEquals(0, new BigDecimal("10.00").compareTo(result.getScore()));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                studentExamService.saveAnswer(attemptId, SaveAttemptAnswerRequest.builder()
                        .questionId(singleChoiceQ.getId())
                        .selectedAnswerIds(List.of(singleChoiceWrongAns.getId()))
                        .build()));
        assertEquals(400, ex.getStatusCode().value());
    }

    @Test
    @DisplayName("8. Essay exam submission transitions to WAITING_GRADING and teacher grades")
    void testEssayExamWorkflowAndGrading() {
        authenticateUser(studentUser);
        StudentAssignmentResponse reqResp = studentClassService.joinClass(JoinClassRequest.builder()
                .classCode("CLS12A1")
                .password("secret123")
                .build());
        authenticateUser(teacherUser);
        teacherClassService.reviewStudentAssignment(
                reqResp.getId(),
                com.exammatrix.backend.dto.request.ReviewStudentAssignmentRequest.builder()
                        .status(StudentAssignmentStatus.APPROVED)
                        .build()
        );
        authenticateUser(studentUser);

        StartAttemptResponse startResp = studentExamService.startAttempt(privateEssayPaper.getId());
        UUID attemptId = startResp.getAttemptId();

        studentExamService.saveAnswer(attemptId, SaveAttemptAnswerRequest.builder()
                .questionId(essayQ.getId())
                .essayAnswer("The theorem states that a^2 + b^2 = c^2 in right triangles.")
                .build());

        StudentAttemptResultResponse submitResult = studentExamService.submitAttempt(attemptId);
        assertEquals(AttemptStatus.WAITING_GRADING, submitResult.getStatus());
        assertNull(submitResult.getScore());

        authenticateUser(teacherUser);
        GradingAttemptDetailResponse gradingView = teacherGradingService.getGradingAttempt(attemptId);
        assertNotNull(gradingView);
        assertEquals("Teacher One", teacherUser.getFullName());
        assertEquals(1, gradingView.getAnswers().size());
        assertEquals("In a right angled triangle, a^2 + b^2 = c^2.", gradingView.getAnswers().get(0).getReferenceAnswer());

        UUID attemptAnswerId = gradingView.getAnswers().get(0).getAttemptAnswerId();

        authenticateUser(otherTeacherUser);
        assertThrows(ResponseStatusException.class, () ->
                teacherGradingService.gradeAnswer(attemptId, attemptAnswerId,
                        com.exammatrix.backend.dto.request.GradeAnswerRequest.builder()
                                .awardedScore(new BigDecimal("9.50"))
                                .feedback("Very clear")
                                .build()));

        authenticateUser(teacherUser);
        teacherGradingService.gradeAnswer(attemptId, attemptAnswerId,
                com.exammatrix.backend.dto.request.GradeAnswerRequest.builder()
                        .awardedScore(new BigDecimal("9.50"))
                        .feedback("Very clear and concise.")
                        .build());

        StudentAttemptResultResponse completedResult = teacherGradingService.completeGrading(attemptId,
                com.exammatrix.backend.dto.request.CompleteGradingRequest.builder()
                        .status("COMPLETED")
                        .build());

        assertEquals(AttemptStatus.COMPLETED, completedResult.getStatus());
        assertEquals(0, new BigDecimal("9.50").compareTo(completedResult.getScore()));
    }

    @Test
    @DisplayName("9. Question import rejects image files with clear non-AI message")
    void testQuestionImportRejectsImage() {
        authenticateUser(teacherUser);
        MockMultipartFile imageFile = new MockMultipartFile(
                "file",
                "sample.png",
                "image/png",
                new byte[]{1, 2, 3}
        );

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                questionImportService.previewImport(imageFile, null, null));
        assertTrue(ex.getReason().contains("AI") || ex.getReason().contains("ảnh"));
    }

    @Test
    @DisplayName("10. Question import parses docx document")
    void testQuestionImportDocx() throws IOException {
        authenticateUser(teacherUser);

        byte[] docxBytes;
        try (XWPFDocument doc = new XWPFDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            XWPFParagraph p1 = doc.createParagraph();
            p1.createRun().setText("Câu 1: Số nguyên tố chẵn duy nhất là gì?");

            XWPFParagraph p2 = doc.createParagraph();
            p2.createRun().setText("A. 2 (Đúng)");

            XWPFParagraph p3 = doc.createParagraph();
            p3.createRun().setText("B. 4");

            doc.write(out);
            docxBytes = out.toByteArray();
        }

        MockMultipartFile docxFile = new MockMultipartFile(
                "file",
                "math_quiz.docx",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                docxBytes
        );

        ImportQuestionsPreviewResponse preview = questionImportService.previewImport(
                docxFile,
                publicObjectivePaper.getExamMatrix().getSubject().getId(),
                singleChoiceQ.getChapter().getId()
        );

        assertNotNull(preview);
        assertTrue(preview.getTotalParsed() >= 1);
    }
}
