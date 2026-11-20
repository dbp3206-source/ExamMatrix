package com.exammatrix.backend;

import com.exammatrix.backend.dto.request.AdviceAdjustmentRequest;
import com.exammatrix.backend.dto.request.GenerateExamPapersRequest;
import com.exammatrix.backend.dto.request.GenerationAdviceRequest;
import com.exammatrix.backend.dto.response.ExamPaperDetailResponse;
import com.exammatrix.backend.dto.response.GenerationAdviceResponse;
import com.exammatrix.backend.entity.*;
import com.exammatrix.backend.entity.enums.*;
import com.exammatrix.backend.repository.*;
import com.exammatrix.backend.security.GoogleStudentTokenVerifier;
import com.exammatrix.backend.service.ExamGenerationService;
import com.exammatrix.backend.service.GenerationAdviceService;
import com.exammatrix.backend.service.StudentExamService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class GenerationAdviceIntegrationTest {

    @Autowired private RoleRepository roleRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private SubjectRepository subjectRepository;
    @Autowired private ChapterRepository chapterRepository;
    @Autowired private QuestionRepository questionRepository;
    @Autowired private ExamMatrixRepository examMatrixRepository;
    @Autowired private ExamPaperRepository examPaperRepository;
    @Autowired private ExamGenerationRequestRepository generationRequestRepository;
    @Autowired private TeacherClassRepository teacherClassRepository;
    @Autowired private StudentTeacherAssignmentRepository assignmentRepository;
    @Autowired private StudentExamAttemptRepository attemptRepository;
    @Autowired private StudentAttemptAnswerRepository attemptAnswerRepository;

    @Autowired private GenerationAdviceService generationAdviceService;
    @Autowired private ExamGenerationService examGenerationService;
    @Autowired private StudentExamService studentExamService;
    @Autowired private PasswordEncoder passwordEncoder;
    @MockitoBean private GoogleStudentTokenVerifier googleVerifier;

    private Role teacherRole;
    private Role studentRole;
    private User teacher1;
    private User teacher2;
    private TeacherClass class1;
    private TeacherClass class2;
    private Subject subject1;
    private Subject subject2;
    private Chapter chWeak;
    private Chapter chDonor;
    private Chapter chOtherSubject;
    private List<Question> weakQuestions;
    private List<Question> donorQuestions;
    private List<Question> otherSubjectQuestions;
    private ExamMatrix matrix;
    private List<User> students;

    @BeforeEach
    void setUp() {
        attemptAnswerRepository.deleteAll();
        attemptRepository.deleteAll();
        examPaperRepository.deleteAll();
        generationRequestRepository.deleteAll();
        examMatrixRepository.deleteAll();
        questionRepository.deleteAll();
        chapterRepository.deleteAll();
        subjectRepository.deleteAll();
        assignmentRepository.deleteAll();
        teacherClassRepository.deleteAll();
        userRepository.deleteAll();
        roleRepository.deleteAll();

        teacherRole = roleRepository.save(Role.builder().name("TEACHER").build());
        studentRole = roleRepository.save(Role.builder().name("STUDENT").build());

        teacher1 = createUser("teacher_adv_1", teacherRole);
        teacher2 = createUser("teacher_adv_2", teacherRole);

        class1 = teacherClassRepository.save(TeacherClass.builder()
                .teacher(teacher1)
                .name("Lớp 12A1")
                .classCode("ADV12A1")
                .joinPassword(passwordEncoder.encode("secret123"))
                .build());

        class2 = teacherClassRepository.save(TeacherClass.builder()
                .teacher(teacher2)
                .name("Lớp 12A2")
                .classCode("ADV12A2")
                .joinPassword(passwordEncoder.encode("secret456"))
                .build());

        subject1 = subjectRepository.save(Subject.builder().code("XSTK").name("Xác suất thống kê").build());
        subject2 = subjectRepository.save(Subject.builder().code("GT1").name("Giải tích 1").build());

        chWeak = chapterRepository.save(Chapter.builder().subject(subject1).name("Xác suất").orderIndex(1).build());
        chDonor = chapterRepository.save(Chapter.builder().subject(subject1).name("Thống kê mô tả").orderIndex(2).build());
        chOtherSubject = chapterRepository.save(Chapter.builder().subject(subject2).name("Giới hạn").orderIndex(1).build());

        weakQuestions = new ArrayList<>();
        for (int i = 1; i <= 4; i++) {
            weakQuestions.add(createMcq(chWeak, Difficulty.MEDIUM, "Câu XS " + i));
        }

        donorQuestions = new ArrayList<>();
        for (int i = 1; i <= 4; i++) {
            donorQuestions.add(createMcq(chDonor, Difficulty.MEDIUM, "Câu TK " + i));
        }

        otherSubjectQuestions = new ArrayList<>();
        for (int i = 1; i <= 3; i++) {
            otherSubjectQuestions.add(createMcq(chOtherSubject, Difficulty.MEDIUM, "Câu GT " + i));
        }

        matrix = createMatrix(teacher1, subject1, "Ma trận XSTK", 2, 2);

        students = new ArrayList<>();
        for (int i = 1; i <= 7; i++) {
            User st = createUser("st_adv_" + i, studentRole);
            students.add(st);
            assignmentRepository.save(StudentTeacherAssignment.builder()
                    .student(st)
                    .teacher(teacher1)
                    .teacherClass(class1)
                    .status(StudentAssignmentStatus.APPROVED)
                    .reviewedAt(LocalDateTime.now().minusDays(10))
                    .build());
        }
    }

    @Test
    @DisplayName("Biên 4 vs 5 học sinh đủ mẫu và 2 vs 3 em gặp khó (50% vs 49%)")
    void boundaryStudentCountsAndRates() {
        ExamPaper batch1Paper = createBatchPaper(matrix, UUID.randomUUID(), List.of(weakQuestions.get(0), weakQuestions.get(1), donorQuestions.get(0), donorQuestions.get(1)), LocalDateTime.now().minusDays(2));

        recordAttempt(batch1Paper, teacher1, class1, students.get(0), LocalDateTime.now().minusDays(1), Map.of(weakQuestions.get(0), false, weakQuestions.get(1), false));
        recordAttempt(batch1Paper, teacher1, class1, students.get(1), LocalDateTime.now().minusDays(1), Map.of(weakQuestions.get(0), false, weakQuestions.get(1), false));
        recordAttempt(batch1Paper, teacher1, class1, students.get(2), LocalDateTime.now().minusDays(1), Map.of(weakQuestions.get(0), false, weakQuestions.get(1), false));
        recordAttempt(batch1Paper, teacher1, class1, students.get(3), LocalDateTime.now().minusDays(1), Map.of(weakQuestions.get(0), true, weakQuestions.get(1), true));

        authenticate(teacher1);
        GenerationAdviceResponse fourStudents = generationAdviceService.getGenerationAdvice(matrix.getId(), new GenerationAdviceRequest(BigDecimal.valueOf(2)));
        assertFalse(fourStudents.recommended(), "4 eligible students must NOT trigger advice");
        assertEquals("NO_WEAK_CELL", fourStudents.reasonCode());

        recordAttempt(batch1Paper, teacher1, class1, students.get(4), LocalDateTime.now().minusDays(1), Map.of(weakQuestions.get(0), true, weakQuestions.get(1), true));
        GenerationAdviceResponse fiveStudents = generationAdviceService.getGenerationAdvice(matrix.getId(), new GenerationAdviceRequest(BigDecimal.valueOf(2)));
        assertTrue(fiveStudents.recommended(), "5 eligible students with 3 struggling (60%) MUST trigger advice");
        assertEquals(chWeak.getId(), fiveStudents.increaseCell().chapterId());
        assertEquals(2, fiveStudents.increaseCell().currentCount());
        assertEquals(3, fiveStudents.increaseCell().proposedCount());
        assertEquals(chDonor.getId(), fiveStudents.decreaseCell().chapterId());
        assertEquals(2, fiveStudents.decreaseCell().currentCount());
        assertEquals(1, fiveStudents.decreaseCell().proposedCount());
        assertEquals(5, fiveStudents.increaseCell().eligibleStudents());
        assertEquals(3, fiveStudents.increaseCell().strugglingStudents());

        recordAttempt(batch1Paper, teacher1, class1, students.get(5), LocalDateTime.now().minusDays(1), Map.of(weakQuestions.get(0), true, weakQuestions.get(1), true));
        GenerationAdviceResponse fiftyPercent = generationAdviceService.getGenerationAdvice(matrix.getId(), new GenerationAdviceRequest(BigDecimal.valueOf(2)));
        assertTrue(fiftyPercent.recommended(), "3/6 = 50% MUST still trigger advice");
        assertEquals(50.0, fiftyPercent.increaseCell().strugglingRatePercent());

        recordAttempt(batch1Paper, teacher1, class1, students.get(6), LocalDateTime.now().minusDays(1), Map.of(weakQuestions.get(0), true, weakQuestions.get(1), true));
        GenerationAdviceResponse belowFifty = generationAdviceService.getGenerationAdvice(matrix.getId(), new GenerationAdviceRequest(BigDecimal.valueOf(2)));
        assertFalse(belowFifty.recommended(), "3/7 < 50% must NOT trigger advice");
    }

    @Test
    @DisplayName("Lỗi dồn vào 1 câu duy nhất hoặc bỏ trống không bị quy kết sai cả chương")
    void singleQuestionConcentrationAndBlanksDoNotTrigger() {
        ExamPaper batchPaper = createBatchPaper(matrix, UUID.randomUUID(), List.of(weakQuestions.get(0), weakQuestions.get(1), donorQuestions.get(0), donorQuestions.get(1)), LocalDateTime.now().minusDays(2));

        for (int i = 0; i < 5; i++) {
            recordAttempt(batchPaper, teacher1, class1, students.get(i), LocalDateTime.now().minusDays(1),
                    Map.of(weakQuestions.get(0), false, weakQuestions.get(1), true));
        }

        recordBlankAttempt(batchPaper, teacher1, class1, students.get(5), LocalDateTime.now().minusDays(1), List.of(weakQuestions.get(0), weakQuestions.get(1)));

        authenticate(teacher1);
        GenerationAdviceResponse resp = generationAdviceService.getGenerationAdvice(matrix.getId(), new GenerationAdviceRequest(BigDecimal.ONE));
        assertFalse(resp.recommended(), "Single-question concentration must NOT trigger advice");
        GenerationAdviceResponse.CellEvidenceItem weakEv = resp.cellEvidences().stream()
                .filter(e -> e.chapterId().equals(chWeak.getId())).findFirst().orElseThrow();
        assertEquals(5, weakEv.eligibleStudents());
        assertEquals(0, weakEv.strugglingStudents());
        assertEquals(2, weakEv.blankCount());
    }

    @Test
    @DisplayName("Trùng câu gốc giữa các mã đề & thi lại lấy kết quả mới nhất theo (học sinh, câu gốc)")
    void deduplicatesOriginalQuestionAndUsesLatestRetakeResult() {
        UUID batch1 = UUID.randomUUID();
        UUID batch2 = UUID.randomUUID();
        ExamPaper p1 = createBatchPaper(matrix, batch1, List.of(weakQuestions.get(0), weakQuestions.get(1)), LocalDateTime.now().minusDays(4));
        ExamPaper p2 = createBatchPaper(matrix, batch2, List.of(weakQuestions.get(0), weakQuestions.get(1)), LocalDateTime.now().minusDays(1));

        for (int i = 0; i < 5; i++) {
            recordAttempt(p1, teacher1, class1, students.get(i), LocalDateTime.now().minusDays(3),
                    Map.of(weakQuestions.get(0), false, weakQuestions.get(1), false));
        }

        for (int i = 0; i < 3; i++) {
            recordAttempt(p2, teacher1, class1, students.get(i), LocalDateTime.now().minusHours(6),
                    Map.of(weakQuestions.get(0), true, weakQuestions.get(1), true));
        }

        authenticate(teacher1);
        GenerationAdviceResponse resp = generationAdviceService.getGenerationAdvice(matrix.getId(), new GenerationAdviceRequest(BigDecimal.ONE));
        assertFalse(resp.recommended(), "Latest retake results must supersede older wrong results");
        GenerationAdviceResponse.CellEvidenceItem weakEv = resp.cellEvidences().stream()
                .filter(e -> e.chapterId().equals(chWeak.getId())).findFirst().orElseThrow();
        assertEquals(5, weakEv.eligibleStudents());
        assertEquals(2, weakEv.strugglingStudents());
    }

    @Test
    @DisplayName("Cô lập lớp khác, môn khác và lịch sử cũ không có class_id")
    void isolatesOtherClassOtherSubjectAndNullClassHistory() {
        ExamPaper batch1 = createBatchPaper(matrix, UUID.randomUUID(), List.of(weakQuestions.get(0), weakQuestions.get(1)), LocalDateTime.now().minusDays(2));

        for (int i = 0; i < 3; i++) {
            recordAttempt(batch1, teacher1, null, students.get(i), LocalDateTime.now().minusDays(1),
                    Map.of(weakQuestions.get(0), false, weakQuestions.get(1), false));
        }
        for (int i = 3; i < 5; i++) {
            recordAttempt(batch1, teacher1, class2, students.get(i), LocalDateTime.now().minusDays(1),
                    Map.of(weakQuestions.get(0), false, weakQuestions.get(1), false));
        }

        authenticate(teacher1);
        GenerationAdviceResponse resp = generationAdviceService.getGenerationAdvice(matrix.getId(), new GenerationAdviceRequest(BigDecimal.ONE));
        assertFalse(resp.recommended());
        assertEquals("INSUFFICIENT_DATA", resp.reasonCode());
    }

    @Test
    @DisplayName("Mức sàn ô giảm (>= 2) và thiếu ngân hàng ở ô tăng được chặn đúng")
    void donorFloorAndBankShortageRespected() {

        ExamMatrix floorMatrix = createMatrix(teacher1, subject1, "Ma trận sàn 1", 2, 1);
        ExamPaper batch1 = createBatchPaper(floorMatrix, UUID.randomUUID(), List.of(weakQuestions.get(0), weakQuestions.get(1)), LocalDateTime.now().minusDays(2));
        for (int i = 0; i < 5; i++) {
            recordAttempt(batch1, teacher1, class1, students.get(i), LocalDateTime.now().minusDays(1),
                    Map.of(weakQuestions.get(0), false, weakQuestions.get(1), false));
        }

        authenticate(teacher1);
        GenerationAdviceResponse floorResp = generationAdviceService.getGenerationAdvice(floorMatrix.getId(), new GenerationAdviceRequest(BigDecimal.ONE));
        assertFalse(floorResp.recommended());
        assertEquals("NO_DONOR_CELL", floorResp.reasonCode());

        ExamMatrix shortageMatrix = createMatrix(teacher1, subject1, "Ma trận hết ngân hàng", 4, 2);
        GenerationAdviceResponse bankResp = generationAdviceService.getGenerationAdvice(shortageMatrix.getId(), new GenerationAdviceRequest(BigDecimal.ONE));
        assertFalse(bankResp.recommended());
        assertEquals("INSUFFICIENT_BANK", bankResp.reasonCode());
    }

    @Test
    @DisplayName("Áp dụng gợi ý sinh đúng phân bổ mới, không sửa ma trận gốc, chống stale 409 và idempotent retry")
    void applyAdviceAtomicallyPreservesMatrixRejectsStaleAndSupportsRetry() {
        ExamPaper batch1 = createBatchPaper(matrix, UUID.randomUUID(), List.of(weakQuestions.get(0), weakQuestions.get(1), donorQuestions.get(0), donorQuestions.get(1)), LocalDateTime.now().minusDays(2));
        for (int i = 0; i < 5; i++) {
            recordAttempt(batch1, teacher1, class1, students.get(i), LocalDateTime.now().minusDays(1),
                    Map.of(weakQuestions.get(0), false, weakQuestions.get(1), false));
        }

        authenticate(teacher1);
        GenerationAdviceResponse advice = generationAdviceService.getGenerationAdvice(matrix.getId(), new GenerationAdviceRequest(BigDecimal.valueOf(2)));
        assertTrue(advice.recommended());

        GenerateExamPapersRequest staleReq = GenerateExamPapersRequest.builder()
                .numberOfPapers(BigDecimal.valueOf(2))
                .requestId(UUID.randomUUID())
                .snapshotVersion("stale-version-hash")
                .adviceAdjustment(AdviceAdjustmentRequest.builder()
                        .increaseChapterId(advice.increaseCell().chapterId())
                        .decreaseChapterId(advice.decreaseCell().chapterId())
                        .difficulty(advice.increaseCell().difficulty())
                        .build())
                .build();
        ResponseStatusException staleEx = assertThrows(ResponseStatusException.class,
                () -> examGenerationService.generateExamPapers(matrix.getId(), staleReq));
        assertEquals(HttpStatus.CONFLICT, staleEx.getStatusCode());

        UUID genReqId = UUID.randomUUID();
        GenerateExamPapersRequest validReq = GenerateExamPapersRequest.builder()
                .numberOfPapers(BigDecimal.valueOf(2))
                .requestId(genReqId)
                .snapshotVersion(advice.snapshotVersion())
                .adviceAdjustment(AdviceAdjustmentRequest.builder()
                        .increaseChapterId(advice.increaseCell().chapterId())
                        .decreaseChapterId(advice.decreaseCell().chapterId())
                        .difficulty(advice.increaseCell().difficulty())
                        .build())
                .build();

        List<ExamPaperDetailResponse> generated = examGenerationService.generateExamPapers(matrix.getId(), validReq);
        assertEquals(2, generated.size());
        for (ExamPaperDetailResponse paperResp : generated) {
            assertEquals(4, paperResp.getQuestions().size());
            long weakCount = paperResp.getQuestions().stream()
                    .filter(q -> weakQuestions.stream().anyMatch(wq -> wq.getId().equals(q.getId()))).count();
            long donorCount = paperResp.getQuestions().stream()
                    .filter(q -> donorQuestions.stream().anyMatch(dq -> dq.getId().equals(q.getId()))).count();
            assertEquals(3, weakCount, "Increase chapter must have 3 questions");
            assertEquals(1, donorCount, "Decrease chapter must have 1 question");
        }

        ExamMatrix reloaded = examMatrixRepository.findById(matrix.getId()).orElseThrow();
        for (ExamMatrixConfig cfg : reloaded.getConfigs()) {
            assertEquals(2, cfg.getQuantity(), "Original matrix config must remain untouched");
        }

        ExamGenerationRequest savedReq = generationRequestRepository
                .findByExamMatrix_IdAndRequestId(matrix.getId(), genReqId).orElseThrow();
        assertNotNull(savedReq.getAllocationSnapshot());
        assertTrue(savedReq.getAllocationSnapshot().contains("\"count\":3"));
        assertTrue(savedReq.getAllocationSnapshot().contains("\"count\":1"));

        List<ExamPaperDetailResponse> retried = examGenerationService.generateExamPapers(matrix.getId(), validReq);
        assertEquals(generated.stream().map(ExamPaperDetailResponse::getId).toList(),
                retried.stream().map(ExamPaperDetailResponse::getId).toList());
    }

    @Test
    @DisplayName("Phân quyền: giáo viên khác hoặc học sinh bị từ chối 403; startAttempt snapshot class_id cho đề PRIVATE")
    void authzAndClassIdSnapshotOnPrivateAttemptStart() {

        authenticate(teacher2);
        ResponseStatusException forbiddenTeacher = assertThrows(ResponseStatusException.class,
                () -> generationAdviceService.getGenerationAdvice(matrix.getId(), new GenerationAdviceRequest(BigDecimal.ONE)));
        assertEquals(HttpStatus.FORBIDDEN, forbiddenTeacher.getStatusCode());

        authenticate(students.get(0));
        ResponseStatusException forbiddenStudent = assertThrows(ResponseStatusException.class,
                () -> generationAdviceService.getGenerationAdvice(matrix.getId(), new GenerationAdviceRequest(BigDecimal.ONE)));
        assertEquals(HttpStatus.FORBIDDEN, forbiddenStudent.getStatusCode());

        ExamPaper privatePaper = createBatchPaper(matrix, UUID.randomUUID(), List.of(weakQuestions.get(0)), LocalDateTime.now());
        privatePaper.setAccessType(ExamAccessType.PRIVATE);
        privatePaper.setIsPublished(true);
        examPaperRepository.save(privatePaper);

        authenticate(students.get(0));
        var started = studentExamService.startAttempt(privatePaper.getId());
        StudentExamAttempt savedAttempt = attemptRepository.findById(started.getAttemptId()).orElseThrow();
        assertNotNull(savedAttempt.getTeacherClass(), "PRIVATE attempt must snapshot class_id");
        assertEquals(class1.getId(), savedAttempt.getTeacherClass().getId());

        savedAttempt.setStatus(AttemptStatus.CANCELLED);
        attemptRepository.save(savedAttempt);

        ResponseStatusException startCancelled = assertThrows(ResponseStatusException.class,
                () -> studentExamService.startAttempt(privatePaper.getId()));
        assertEquals(HttpStatus.CONFLICT, startCancelled.getStatusCode());
        assertTrue(startCancelled.getReason() != null && startCancelled.getReason().toLowerCase().contains("hủy"),
                "startAttempt on CANCELLED must indicate cancellation, not completion");

        com.exammatrix.backend.dto.request.SaveAttemptAnswerRequest saveReq = new com.exammatrix.backend.dto.request.SaveAttemptAnswerRequest();
        saveReq.setQuestionId(weakQuestions.get(0).getId());
        saveReq.setSelectedAnswerIds(List.of(weakQuestions.get(0).getAnswers().get(0).getId()));
        ResponseStatusException saveCancelled = assertThrows(ResponseStatusException.class,
                () -> studentExamService.saveAnswer(savedAttempt.getId(), saveReq));
        assertEquals(HttpStatus.CONFLICT, saveCancelled.getStatusCode());
        assertTrue(saveCancelled.getReason() != null && saveCancelled.getReason().toLowerCase().contains("hủy"),
                "saveAnswer on CANCELLED must return 409 with cancellation reason");

        ResponseStatusException submitCancelled = assertThrows(ResponseStatusException.class,
                () -> studentExamService.submitAttempt(savedAttempt.getId()));
        assertEquals(HttpStatus.CONFLICT, submitCancelled.getStatusCode());
        assertTrue(submitCancelled.getReason() != null && submitCancelled.getReason().toLowerCase().contains("hủy"));
    }

    private User createUser(String username, Role role) {
        return userRepository.save(User.builder()
                .username(username)
                .email(username + "@example.com")
                .fullName("User " + username)
                .password(passwordEncoder.encode("Password123!"))
                .role(role)
                .status(UserStatus.ACTIVE)
                .build());
    }

    private Question createMcq(Chapter ch, Difficulty diff, String content) {
        Question q = Question.builder()
                .chapter(ch)
                .teacher(teacher1)
                .difficulty(diff)
                .type(QuestionType.SINGLE_CHOICE)
                .examType(ExamType.OBJECTIVE)
                .content(content)
                .build();
        q.addAnswer(Answer.builder().content("Đáp án A").isCorrect(true).build());
        q.addAnswer(Answer.builder().content("Đáp án B").isCorrect(false).build());
        return questionRepository.save(q);
    }

    private ExamMatrix createMatrix(User owner, Subject subj, String title, int weakQty, int donorQty) {
        ExamMatrix m = new ExamMatrix();
        m.setTeacher(owner);
        m.setSubject(subj);
        m.setTitle(title);
        m.setDuration(45);
        m.setTotalQuestions(weakQty + donorQty);
        m.setExamType(ExamType.OBJECTIVE);

        ExamMatrixConfig c1 = new ExamMatrixConfig();
        c1.setChapter(chWeak);
        c1.setDifficulty(Difficulty.MEDIUM);
        c1.setQuantity(weakQty);
        m.addConfig(c1);

        ExamMatrixConfig c2 = new ExamMatrixConfig();
        c2.setChapter(chDonor);
        c2.setDifficulty(Difficulty.MEDIUM);
        c2.setQuantity(donorQty);
        m.addConfig(c2);

        return examMatrixRepository.save(m);
    }

    private ExamPaper createBatchPaper(ExamMatrix m, UUID batchId, List<Question> questions, LocalDateTime createdAt) {
        ExamPaper paper = new ExamPaper();
        paper.setExamMatrix(m);
        paper.setGenerationRequestId(batchId);
        paper.setExamCode(String.format("%06d", Math.abs(UUID.randomUUID().hashCode()) % 1_000_000));
        paper.setAccessType(ExamAccessType.PRIVATE);
        paper.setIsPublished(true);
        for (int i = 0; i < questions.size(); i++) {
            PaperQuestion pq = new PaperQuestion();
            pq.setQuestion(questions.get(i));
            pq.setQuestionOrder(i + 1);
            pq.setPoints(BigDecimal.ONE);
            paper.addPaperQuestion(pq);
        }
        ExamPaper saved = examPaperRepository.save(paper);
        generationRequestRepository.save(new ExamGenerationRequest(m, batchId, 1));
        return saved;
    }

    private void recordAttempt(
            ExamPaper paper,
            User teacher,
            TeacherClass teacherClass,
            User student,
            LocalDateTime gradedAt,
            Map<Question, Boolean> questionResults
    ) {
        StudentExamAttempt attempt = StudentExamAttempt.builder()
                .examPaper(paper)
                .student(student)
                .teacher(teacher)
                .teacherClass(teacherClass)
                .status(AttemptStatus.COMPLETED)
                .startedAt(gradedAt.minusMinutes(15))
                .submittedAt(gradedAt)
                .gradedAt(gradedAt)
                .score(BigDecimal.ZERO)
                .maxScore(BigDecimal.valueOf(questionResults.size()))
                .build();

        for (Map.Entry<Question, Boolean> entry : questionResults.entrySet()) {
            Question q = entry.getKey();
            boolean correct = entry.getValue();
            Answer chosen = q.getAnswers().stream()
                    .filter(a -> Boolean.valueOf(correct).equals(a.getIsCorrect()))
                    .findFirst()
                    .orElse(q.getAnswers().get(0));

            StudentAttemptAnswer ans = StudentAttemptAnswer.builder()
                    .question(q)
                    .isCorrect(correct)
                    .awardedScore(correct ? BigDecimal.ONE : BigDecimal.ZERO)
                    .build();
            ans.getChoices().add(chosen);
            attempt.addAnswer(ans);
        }

        attemptRepository.save(attempt);
    }

    private void recordBlankAttempt(
            ExamPaper paper,
            User teacher,
            TeacherClass teacherClass,
            User student,
            LocalDateTime gradedAt,
            List<Question> blankQuestions
    ) {
        StudentExamAttempt attempt = StudentExamAttempt.builder()
                .examPaper(paper)
                .student(student)
                .teacher(teacher)
                .teacherClass(teacherClass)
                .status(AttemptStatus.COMPLETED)
                .startedAt(gradedAt.minusMinutes(15))
                .submittedAt(gradedAt)
                .gradedAt(gradedAt)
                .score(BigDecimal.ZERO)
                .maxScore(BigDecimal.valueOf(blankQuestions.size()))
                .build();

        for (Question q : blankQuestions) {
            StudentAttemptAnswer ans = StudentAttemptAnswer.builder()
                    .question(q)
                    .isCorrect(false)
                    .awardedScore(BigDecimal.ZERO)
                    .build();
            attempt.addAnswer(ans);
        }

        attemptRepository.save(attempt);
    }

    private void authenticate(User user) {
        var auth = new UsernamePasswordAuthenticationToken(
                user.getUsername(),
                null,
                List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().getName()))
        );
        SecurityContextHolder.getContext().setAuthentication(auth);
    }
}
