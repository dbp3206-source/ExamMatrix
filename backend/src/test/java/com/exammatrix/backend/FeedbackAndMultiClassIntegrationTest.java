package com.exammatrix.backend;

import com.exammatrix.backend.dto.request.CreateStudentFeedbackRequest;
import com.exammatrix.backend.dto.request.JoinClassRequest;
import com.exammatrix.backend.dto.request.ReviewStudentAssignmentRequest;
import com.exammatrix.backend.dto.response.*;
import com.exammatrix.backend.entity.*;
import com.exammatrix.backend.entity.enums.*;
import com.exammatrix.backend.repository.*;
import com.exammatrix.backend.service.*;
import org.junit.jupiter.api.AfterEach;
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
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class FeedbackAndMultiClassIntegrationTest {

    @Autowired private StudentClassService studentClassService;
    @Autowired private TeacherClassService teacherClassService;
    @Autowired private StudentExamService studentExamService;
    @Autowired private FeedbackService feedbackService;
    @Autowired private NotificationService notificationService;

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
    @Autowired private UserVisitSessionRepository visitSessionRepository;
    @Autowired private QuestionImportRequestRepository importRequestRepository;
    @Autowired private PasswordEncoder passwordEncoder;

    private User adminUser;
    private User teacher1;
    private User teacher2;
    private User student1;
    private User student2;
    private Subject subject;
    private Chapter chapter;
    private TeacherClass class1;
    private TeacherClass class2;

    @BeforeEach
    void setUp() {
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

        Role adminRole = roleRepository.save(Role.builder().name("ADMIN").build());
        Role teacherRole = roleRepository.save(Role.builder().name("TEACHER").build());
        Role studentRole = roleRepository.save(Role.builder().name("STUDENT").build());

        adminUser = userRepository.save(User.builder()
                .username("admin_fb").email("admin_fb@test.com").fullName("Quản trị viên")
                .password(passwordEncoder.encode("pass1234")).role(adminRole).status(UserStatus.ACTIVE).build());
        teacher1 = userRepository.save(User.builder()
                .username("teacher_fb1").email("t_fb1@test.com").fullName("Cô Lan")
                .password(passwordEncoder.encode("pass1234")).role(teacherRole).status(UserStatus.ACTIVE).build());
        teacher2 = userRepository.save(User.builder()
                .username("teacher_fb2").email("t_fb2@test.com").fullName("Thầy Minh")
                .password(passwordEncoder.encode("pass1234")).role(teacherRole).status(UserStatus.ACTIVE).build());
        student1 = userRepository.save(User.builder()
                .username("student_fb1").email("s_fb1@test.com").fullName("Học sinh An")
                .password(passwordEncoder.encode("pass1234")).role(studentRole).status(UserStatus.ACTIVE).build());
        student2 = userRepository.save(User.builder()
                .username("student_fb2").email("s_fb2@test.com").fullName("Học sinh Bình")
                .password(passwordEncoder.encode("pass1234")).role(studentRole).status(UserStatus.ACTIVE).build());

        subject = subjectRepository.save(Subject.builder().code("FB_MATH").name("Toán học").description("Toán").build());
        chapter = chapterRepository.save(Chapter.builder().subject(subject).name("Chương 1").orderIndex(1).build());

        class1 = teacherClassRepository.save(TeacherClass.builder()
                .teacher(teacher1).name("Lớp 12A1").classCode("FB12A1")
                .joinMode(ClassJoinMode.REQUEST_OPEN).build());
        class2 = teacherClassRepository.save(TeacherClass.builder()
                .teacher(teacher2).name("Lớp 12B2").classCode("FB12B2")
                .joinMode(ClassJoinMode.REQUEST_WITH_PASSWORD)
                .joinPassword(passwordEncoder.encode("secret99")).build());
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        feedbackRecipientRepository.deleteAll();
        feedbackRepository.deleteAll();
    }

    private void auth(User u) {
        var auth = new UsernamePasswordAuthenticationToken(
                u.getUsername(), null, List.of(new SimpleGrantedAuthority("ROLE_" + u.getRole().getName())));
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    private ExamPaper createPublishedPrivatePaper(User owner, String code) {
        Question q = questionRepository.save(Question.builder()
                .chapter(chapter).teacher(owner).content("Câu hỏi của " + owner.getFullName())
                .difficulty(Difficulty.EASY).type(QuestionType.SINGLE_CHOICE).examType(ExamType.OBJECTIVE).build());
        answerRepository.save(Answer.builder().question(q).content("Đáp án đúng").isCorrect(true).build());
        answerRepository.save(Answer.builder().question(q).content("Đáp án sai").isCorrect(false).build());

        ExamMatrix matrix = examMatrixRepository.save(ExamMatrix.builder()
                .teacher(owner).subject(subject).title("Đề riêng " + code)
                .duration(30).totalQuestions(1).examType(ExamType.OBJECTIVE).build());

        ExamPaper paper = examPaperRepository.save(ExamPaper.builder()
                .examMatrix(matrix).examCode(code).accessType(ExamAccessType.PRIVATE)
                .isPublished(true).publishedAt(LocalDateTime.now()).build());

        paperQuestionRepository.save(PaperQuestion.builder()
                .examPaper(paper).question(q).questionOrder(1).points(BigDecimal.TEN).build());

        return paper;
    }

    @Test
    @DisplayName("Multi-class student enrollment grants concurrent access to PRIVATE exams from all approved classes")
    void testMultiClassEnrollmentAndPrivateExamAccess() {
        ExamPaper paper1 = createPublishedPrivatePaper(teacher1, "P_LAN_01");
        ExamPaper paper2 = createPublishedPrivatePaper(teacher2, "P_MINH_02");

        auth(student1);
        StudentAssignmentResponse req1 = studentClassService.joinClass(JoinClassRequest.builder().classCode("FB12A1").build());
        StudentAssignmentResponse req2 = studentClassService.joinClass(JoinClassRequest.builder().classCode("FB12B2").password("secret99").build());
        assertEquals(StudentAssignmentStatus.PENDING, req1.getStatus());
        assertEquals(StudentAssignmentStatus.PENDING, req2.getStatus());

        StudentAssignmentResponse duplicateReq1 = studentClassService.joinClass(JoinClassRequest.builder().classCode("FB12A1").build());
        assertEquals(req1.getId(), duplicateReq1.getId());

        auth(teacher1);
        assertEquals(1L, notificationService.getSummary().pendingClassRequestCount());
        teacherClassService.reviewStudentAssignment(req1.getId(),
                ReviewStudentAssignmentRequest.builder().status(StudentAssignmentStatus.APPROVED).build());
        assertEquals(0L, notificationService.getSummary().pendingClassRequestCount());

        auth(teacher2);
        assertEquals(1L, notificationService.getSummary().pendingClassRequestCount());
        teacherClassService.reviewStudentAssignment(req2.getId(),
                ReviewStudentAssignmentRequest.builder().status(StudentAssignmentStatus.APPROVED).build());

        auth(student1);
        NotificationSummaryResponse studentNotif = notificationService.getSummary();
        assertEquals(2, studentNotif.approvedClasses().size());

        PageResponse<StudentExamSummaryResponse> exams = studentExamService.getAccessibleExams(PageRequest.of(0, 10));
        assertEquals(2L, exams.getTotalElements());

        StartAttemptResponse attempt1 = studentExamService.startAttempt(paper1.getId());
        StartAttemptResponse attempt2 = studentExamService.startAttempt(paper2.getId());

        StudentExamAttempt saved1 = attemptRepository.findById(attempt1.getAttemptId()).orElseThrow();
        StudentExamAttempt saved2 = attemptRepository.findById(attempt2.getAttemptId()).orElseThrow();
        assertEquals(class1.getId(), saved1.getTeacherClass().getId());
        assertEquals(class2.getId(), saved2.getTeacherClass().getId());
    }

    @Test
    @DisplayName("Feedback routes to Admin only when student has no approved class, and to Admin + all approved teachers when enrolled")
    void testFeedbackRoutingAndReadState() {
        auth(student2);
        StudentFeedbackResponse unenrolledFb = feedbackService.submitFeedback(CreateStudentFeedbackRequest.builder()
                .category(FeedbackCategory.SUBJECT_REQUEST)
                .title("Đề xuất thêm môn Vật lý")
                .content("Mong hệ thống bổ sung thêm môn Vật lý lớp 12.")
                .build());
        assertEquals(List.of("Quản trị viên hệ thống"), unenrolledFb.recipientLabels());
        assertFalse(unenrolledFb.isRead());

        auth(teacher1);
        assertEquals(0, feedbackService.getInbox().items().size());
        assertEquals(0L, notificationService.getSummary().unreadFeedbackCount());

        auth(adminUser);
        FeedbackInboxResponse adminInbox1 = feedbackService.getInbox();
        assertEquals(1L, adminInbox1.unreadCount());
        assertEquals(1, adminInbox1.items().size());
        assertEquals(List.of("Chưa tham gia lớp"), adminInbox1.items().get(0).recipientLabels());
        assertEquals(1L, notificationService.getSummary().unreadFeedbackCount());

        auth(student1);
        StudentAssignmentResponse r1 = studentClassService.joinClass(JoinClassRequest.builder().classCode("FB12A1").build());
        StudentAssignmentResponse r2 = studentClassService.joinClass(JoinClassRequest.builder().classCode("FB12B2").password("secret99").build());
        auth(teacher1);
        teacherClassService.reviewStudentAssignment(r1.getId(),
                ReviewStudentAssignmentRequest.builder().status(StudentAssignmentStatus.APPROVED).build());
        auth(teacher2);
        teacherClassService.reviewStudentAssignment(r2.getId(),
                ReviewStudentAssignmentRequest.builder().status(StudentAssignmentStatus.APPROVED).build());

        auth(student1);
        StudentFeedbackResponse enrolledFb = feedbackService.submitFeedback(CreateStudentFeedbackRequest.builder()
                .category(FeedbackCategory.EXAM_REQUEST)
                .title("Xin thêm đề ôn tập giữa kỳ")
                .content("Em muốn có thêm đề luyện tập trắc nghiệm chương 1.")
                .build());
        assertEquals(2, enrolledFb.recipientLabels().size());
        assertEquals(1, feedbackService.getMyFeedbacks().size());

        auth(teacher1);
        FeedbackInboxResponse t1Inbox = feedbackService.getInbox();
        assertEquals(1L, t1Inbox.unreadCount());
        assertEquals(1, t1Inbox.items().size());
        assertEquals("Xin thêm đề ôn tập giữa kỳ", t1Inbox.items().get(0).title());
        assertEquals(1L, notificationService.getSummary().unreadFeedbackCount());

        feedbackService.markAsRead(enrolledFb.id());
        assertEquals(0L, feedbackService.getInbox().unreadCount());
        assertEquals(0L, notificationService.getSummary().unreadFeedbackCount());

        auth(teacher2);
        assertEquals(1L, feedbackService.getInbox().unreadCount());

        auth(adminUser);
        assertEquals(2L, feedbackService.getInbox().unreadCount());
        feedbackService.markAsRead(unenrolledFb.id());
        assertEquals(1L, feedbackService.getInbox().unreadCount());

        auth(student1);
        ResponseStatusException shortTitleEx = assertThrows(ResponseStatusException.class, () ->
                feedbackService.submitFeedback(CreateStudentFeedbackRequest.builder()
                        .category(FeedbackCategory.SYSTEM_FEEDBACK)
                        .title("  ab  ")
                        .content("Nội dung hợp lệ dài hơn 5 ký tự")
                        .build()));
        assertEquals(HttpStatus.BAD_REQUEST, shortTitleEx.getStatusCode());
    }
}
