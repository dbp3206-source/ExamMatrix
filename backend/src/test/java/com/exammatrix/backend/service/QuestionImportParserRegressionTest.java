package com.exammatrix.backend.service;

import com.exammatrix.backend.dto.response.ImportQuestionItemResponse;
import com.exammatrix.backend.dto.response.ImportQuestionsPreviewResponse;
import com.exammatrix.backend.entity.Chapter;
import com.exammatrix.backend.entity.Subject;
import com.exammatrix.backend.entity.enums.QuestionType;
import com.exammatrix.backend.repository.ChapterRepository;
import com.exammatrix.backend.repository.QuestionRepository;
import com.exammatrix.backend.repository.SubjectRepository;
import com.exammatrix.backend.security.CurrentUserService;
import com.exammatrix.backend.service.impl.QuestionImportServiceImpl;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import java.io.ByteArrayOutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import org.junit.jupiter.api.Assumptions;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class QuestionImportParserRegressionTest {

    @Mock private ChapterRepository chapterRepository;
    @Mock private SubjectRepository subjectRepository;
    @Mock private QuestionRepository questionRepository;
    @Mock private CurrentUserService currentUserService;

    @InjectMocks
    private QuestionImportServiceImpl importService;

    private Chapter chapter1;

    @BeforeEach
    void setUp() {
        Subject subject = Subject.builder().id(1).code("MMT").name("Mạng máy tính").build();
        chapter1 = Chapter.builder().id(10).subject(subject).name("Chương 1").orderIndex(1).build();
        when(chapterRepository.findAllBySubjectIdOrderByOrderIndexAsc(1)).thenReturn(List.of(chapter1));
    }

    @Test
    @DisplayName("Nhận đầu câu Câu hỏi 1.1:, khóa Chọn đáp án B, lọc Vì sao đúng: và Trang N")
    void parsesNewDeterministicPatternsWithoutPollutingChoices() throws Exception {
        byte[] docx = createDocx(List.of(
                "Trang 1",
                "Câu hỏi 1.1: Tầng nào trong mô hình OSI chịu trách nhiệm định tuyến?",
                "A. Tầng Vật lý",
                "B. Tầng Mạng",
                "C. Tầng Phiên",
                "D. Tầng Ứng dụng",
                "Trang 2",
                "Chọn đáp án B",
                "Vì sao đúng: Tầng Mạng (Layer 3) sử dụng địa chỉ IP để định tuyến gói tin.",
                "Dòng giải thích tiếp theo cũng phải được lọc bỏ hoàn toàn.",
                "Câu hỏi 2: Các giao thức nào thuộc tầng Giao vận?",
                "A. TCP",
                "B. UDP",
                "C. HTTP",
                "D. ARP",
                "Chọn đáp án A, B",
                "Vì sao đúng: TCP và UDP hoạt động ở tầng Giao vận (Layer 4).",
                "Câu 3. [Tự luận] Trình bày bắt tay 3 bước của TCP.",
                "Đáp án tham khảo: SYN -> SYN-ACK -> ACK."
        ));

        MockMultipartFile file = new MockMultipartFile(
                "file",
                "sample-deterministic.docx",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                docx
        );

        ImportQuestionsPreviewResponse preview = importService.previewImport(file, 1, 10);
        assertEquals(3, preview.getTotalParsed());
        assertEquals(3, preview.getValidCount());
        assertEquals(0, preview.getErrorCount());

        ImportQuestionItemResponse q1 = preview.getItems().get(0);
        assertTrue(q1.isValid());
        assertEquals(QuestionType.SINGLE_CHOICE, q1.getType());
        assertEquals(4, q1.getAnswers().size());
        assertFalse(q1.getAnswers().get(3).getContent().contains("Trang 2"), "Page marker must be stripped");
        assertFalse(q1.getAnswers().get(3).getContent().contains("Vì sao đúng"), "Explanation must not stick to last choice");
        assertTrue(Boolean.TRUE.equals(q1.getAnswers().get(1).getIsCorrect()), "Choice B must be marked correct");

        ImportQuestionItemResponse q2 = preview.getItems().get(1);
        assertTrue(q2.isValid());
        assertEquals(QuestionType.MULTIPLE_CHOICE, q2.getType());
        assertTrue(Boolean.TRUE.equals(q2.getAnswers().get(0).getIsCorrect()));
        assertTrue(Boolean.TRUE.equals(q2.getAnswers().get(1).getIsCorrect()));
        assertFalse(Boolean.TRUE.equals(q2.getAnswers().get(2).getIsCorrect()));
        assertFalse(q2.getAnswers().get(3).getContent().contains("Vì sao đúng"));

        ImportQuestionItemResponse q3 = preview.getItems().get(2);
        assertTrue(q3.isValid());
        assertEquals(QuestionType.ESSAY, q3.getType());
        assertEquals("SYN -> SYN-ACK -> ACK.", q3.getReferenceAnswer());
    }

    @Test
    @DisplayName("3 file chuẩn hóa cục bộ (MMT-chuan.docx, TRR2-chuan.docx, GiaiTich1-102-chuan.pdf) vượt qua previewImport với 0 lỗi")
    void normalizedRealExamFilesParseCleanlyWithZeroErrors() throws Exception {
        Path qaDir = Path.of("..", "design-work", "qa", "real-exams");
        Path mmt = qaDir.resolve("MMT-chuan.docx");
        Path trr2 = qaDir.resolve("TRR2-chuan.docx");
        Path gt1 = qaDir.resolve("GiaiTich1-102-chuan.pdf");
        Assumptions.assumeTrue(Files.exists(mmt) && Files.exists(trr2) && Files.exists(gt1),
                "Local QA normalized exam files not present");

        ImportQuestionsPreviewResponse mmtPreview = importService.previewImport(
                new MockMultipartFile("file", "MMT-chuan.docx",
                        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                        Files.readAllBytes(mmt)),
                1, 10);
        assertEquals(304, mmtPreview.getTotalParsed());
        assertEquals(304, mmtPreview.getValidCount());
        assertEquals(0, mmtPreview.getErrorCount());

        ImportQuestionsPreviewResponse trr2Preview = importService.previewImport(
                new MockMultipartFile("file", "TRR2-chuan.docx",
                        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                        Files.readAllBytes(trr2)),
                1, 10);
        assertEquals(172, trr2Preview.getTotalParsed());
        assertEquals(172, trr2Preview.getValidCount());
        assertEquals(0, trr2Preview.getErrorCount());

        ImportQuestionsPreviewResponse gt1Preview = importService.previewImport(
                new MockMultipartFile("file", "GiaiTich1-102-chuan.pdf",
                        "application/pdf",
                        Files.readAllBytes(gt1)),
                1, 10);
        assertEquals(14, gt1Preview.getTotalParsed());
        assertEquals(14, gt1Preview.getValidCount());
        assertEquals(0, gt1Preview.getErrorCount());
    }

    private byte[] createDocx(List<String> lines) throws Exception {
        try (XWPFDocument doc = new XWPFDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            for (String line : lines) {
                XWPFParagraph p = doc.createParagraph();
                p.createRun().setText(line);
            }
            doc.write(out);
            return out.toByteArray();
        }
    }
}
