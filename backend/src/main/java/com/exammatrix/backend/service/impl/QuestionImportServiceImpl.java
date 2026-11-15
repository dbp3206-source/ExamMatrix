package com.exammatrix.backend.service.impl;

import com.exammatrix.backend.dto.request.AnswerRequest;
import com.exammatrix.backend.dto.request.ImportQuestionItemRequest;
import com.exammatrix.backend.dto.request.ImportQuestionsConfirmRequest;
import com.exammatrix.backend.dto.response.AnswerResponse;
import com.exammatrix.backend.dto.response.ImportQuestionItemResponse;
import com.exammatrix.backend.dto.response.ImportQuestionsPreviewResponse;
import com.exammatrix.backend.dto.response.QuestionResponse;
import com.exammatrix.backend.entity.Answer;
import com.exammatrix.backend.entity.Chapter;
import com.exammatrix.backend.entity.Question;
import com.exammatrix.backend.entity.User;
import com.exammatrix.backend.entity.enums.Difficulty;
import com.exammatrix.backend.entity.enums.QuestionType;
import com.exammatrix.backend.repository.ChapterRepository;
import com.exammatrix.backend.repository.QuestionRepository;
import com.exammatrix.backend.repository.SubjectRepository;
import com.exammatrix.backend.security.CurrentUserService;
import com.exammatrix.backend.service.QuestionImportService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.InputStream;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class QuestionImportServiceImpl implements QuestionImportService {
    private static final long MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    private static final Pattern QUESTION_HEADER_PATTERN =
            Pattern.compile("^(?:câu|question|bài)\\s*(\\d+)[:.]?\\s*(.*)$", Pattern.CASE_INSENSITIVE);
    private static final Pattern CHOICE_PATTERN =
            Pattern.compile("^(\\*?|\\[x\\]|\\[v\\])?\\s*([A-Ha-h])([.):])\\s*(.*)$");
    private static final Pattern REF_ANSWER_PATTERN =
            Pattern.compile("^(?:\\[?đáp án tham khảo\\]?|hướng dẫn chấm|reference answer)[:.]?\\s*(.*)$", Pattern.CASE_INSENSITIVE);
    private static final Pattern CORRECT_ANSWER_HEADER =
            Pattern.compile("^(?:đáp án đúng|đáp án|answer)[:.]?\\s*([A-Ha-h,\\s]+)$", Pattern.CASE_INSENSITIVE);

    private final ChapterRepository chapterRepository;
    private final SubjectRepository subjectRepository;
    private final QuestionRepository questionRepository;
    private final CurrentUserService currentUserService;

    @Override
    public ImportQuestionsPreviewResponse previewImport(
            MultipartFile file,
            Integer subjectId,
            Integer chapterId
    ) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "File import không được để trống");
        }

        if (file.getSize() > MAX_FILE_SIZE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Kích thước file vượt quá giới hạn tối đa 10MB");
        }

        String filename = file.getOriginalFilename() != null ? file.getOriginalFilename().trim() : "";
        String lowerName = filename.toLowerCase(Locale.ROOT);
        String contentType = file.getContentType() != null ? file.getContentType().toLowerCase(Locale.ROOT) : "";

        // Check if user uploaded an image
        if (lowerName.endsWith(".png") || lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")
                || contentType.startsWith("image/")) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Tính năng nhận diện từ ảnh hiện chưa được hỗ trợ do yêu cầu nghiêm ngặt không sử dụng dịch vụ AI / Cloud OCR bên ngoài. Vui lòng sử dụng file Word (.docx) hoặc PDF (.pdf)."
            );
        }

        List<String> rawLines;
        if (lowerName.endsWith(".docx")) {
            rawLines = parseDocxLines(file);
        } else if (lowerName.endsWith(".pdf")) {
            rawLines = parsePdfLines(file);
        } else {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Định dạng file không hợp lệ. Hệ thống chỉ hỗ trợ Word (.docx) và PDF (.pdf)."
            );
        }

        // Fetch subject chapters for validation
        Map<Integer, Chapter> chapterMap = new HashMap<>();
        if (subjectId != null) {
            chapterRepository.findAllBySubjectIdOrderByOrderIndexAsc(subjectId)
                    .forEach(c -> chapterMap.put(c.getId(), c));
        }

        List<ParsedQuestionBlock> blocks = parseBlocksFromLines(rawLines);
        List<ImportQuestionItemResponse> items = new ArrayList<>();

        int index = 1;
        for (ParsedQuestionBlock block : blocks) {
            ImportQuestionItemResponse item = buildQuestionItemResponse(
                    index++,
                    block,
                    chapterId,
                    chapterMap
            );
            items.add(item);
        }

        int validCount = (int) items.stream().filter(ImportQuestionItemResponse::isValid).count();
        int errorCount = items.size() - validCount;

        return ImportQuestionsPreviewResponse.builder()
                .fileName(filename)
                .totalParsed(items.size())
                .validCount(validCount)
                .errorCount(errorCount)
                .items(items)
                .build();
    }

    @Override
    @Transactional
    public List<QuestionResponse> confirmImport(ImportQuestionsConfirmRequest request) {
        User currentUser = currentUserService.getCurrentUser();

        if (request.getItems() == null || request.getItems().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Danh sách câu hỏi cần import không được để trống");
        }

        List<Question> questionsToSave = new ArrayList<>();

        for (int i = 0; i < request.getItems().size(); i++) {
            int questionNumber = i + 1;
            ImportQuestionItemRequest itemReq = request.getItems().get(i);
            validateImportItem(itemReq, questionNumber);

            Chapter chapter = chapterRepository.findById(itemReq.getChapterId())
                    .orElseThrow(() -> new ResponseStatusException(
                            HttpStatus.BAD_REQUEST,
                            "Chương với ID " + itemReq.getChapterId() + " ở câu " + questionNumber + " không tồn tại"
                    ));

            Question question = new Question();
            question.setChapter(chapter);
            question.setTeacher(currentUser);
            question.setContent(itemReq.getContent().trim());
            question.setDifficulty(itemReq.getDifficulty());
            question.setType(itemReq.getType());

            if (itemReq.getType() == QuestionType.ESSAY) {
                question.setReferenceAnswer(itemReq.getReferenceAnswer() != null ? itemReq.getReferenceAnswer().trim() : null);
            } else {
                question.setReferenceAnswer(null);
                if (itemReq.getAnswers() != null) {
                    for (AnswerRequest ar : itemReq.getAnswers()) {
                        Answer a = new Answer();
                        a.setContent(ar.getContent().trim());
                        a.setIsCorrect(Boolean.TRUE.equals(ar.getIsCorrect()));
                        question.addAnswer(a);
                    }
                }
            }

            questionsToSave.add(question);
        }

        List<Question> savedQuestions = questionRepository.saveAll(questionsToSave);
        return savedQuestions.stream().map(this::convertToQuestionResponse).toList();
    }

    private List<String> parseDocxLines(MultipartFile file) {
        try (InputStream is = file.getInputStream(); XWPFDocument document = new XWPFDocument(is)) {
            List<String> lines = new ArrayList<>();
            for (XWPFParagraph paragraph : document.getParagraphs()) {
                String text = paragraph.getText();
                if (StringUtils.hasText(text)) {
                    lines.add(text.trim());
                }
            }
            return lines;
        } catch (Exception e) {
            log.error("Lỗi đọc file Word .docx: {}", e.getMessage(), e);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Không thể đọc nội dung file Word: " + e.getMessage());
        }
    }

    private List<String> parsePdfLines(MultipartFile file) {
        try {
            byte[] bytes = file.getBytes();
            try (PDDocument document = Loader.loadPDF(bytes)) {
                PDFTextStripper stripper = new PDFTextStripper();
                stripper.setSortByPosition(true);
                String fullText = stripper.getText(document);
                String[] split = fullText.split("\\r?\\n");
                List<String> lines = new ArrayList<>();
                for (String s : split) {
                    if (StringUtils.hasText(s)) {
                        lines.add(s.trim());
                    }
                }
                return lines;
            }
        } catch (Exception e) {
            log.error("Lỗi đọc file PDF: {}", e.getMessage(), e);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Không thể đọc nội dung file PDF: " + e.getMessage());
        }
    }

    private List<ParsedQuestionBlock> parseBlocksFromLines(List<String> lines) {
        List<ParsedQuestionBlock> blocks = new ArrayList<>();
        ParsedQuestionBlock current = null;

        for (String line : lines) {
            Matcher qMatcher = QUESTION_HEADER_PATTERN.matcher(line);
            if (qMatcher.matches()) {
                if (current != null) {
                    blocks.add(current);
                }
                current = new ParsedQuestionBlock();
                current.headerText = line;
                String extra = qMatcher.group(2).trim();
                extractTagsFromHeader(current, extra);
                if (StringUtils.hasText(extra)) {
                    // Remove tags from prompt
                    String promptText = stripTags(extra);
                    if (StringUtils.hasText(promptText)) {
                        current.contentLines.add(promptText);
                    }
                }
                continue;
            }

            if (current == null) {
                // Ignore lines before first question
                continue;
            }

            // Check if line is reference answer start
            Matcher refMatcher = REF_ANSWER_PATTERN.matcher(line);
            if (refMatcher.matches()) {
                current.isReadingReferenceAnswer = true;
                current.type = QuestionType.ESSAY;
                String contentAfter = refMatcher.group(1).trim();
                if (StringUtils.hasText(contentAfter)) {
                    current.referenceAnswerLines.add(contentAfter);
                }
                continue;
            }

            if (current.isReadingReferenceAnswer) {
                current.referenceAnswerLines.add(line);
                continue;
            }

            // Check if line is correct answer declaration like "Đáp án: A"
            Matcher correctHeaderMatcher = CORRECT_ANSWER_HEADER.matcher(line);
            if (correctHeaderMatcher.matches()) {
                String answersStr = correctHeaderMatcher.group(1).toUpperCase(Locale.ROOT);
                for (char c : answersStr.toCharArray()) {
                    if (c >= 'A' && c <= 'H') {
                        current.declaredCorrectChoices.add(String.valueOf(c));
                    }
                }
                continue;
            }

            // Check if line is choice
            Matcher choiceMatcher = CHOICE_PATTERN.matcher(line);
            if (choiceMatcher.matches()) {
                String prefixMark = choiceMatcher.group(1);
                String letter = choiceMatcher.group(2).toUpperCase(Locale.ROOT);
                String choiceContent = choiceMatcher.group(4).trim();

                boolean isMarkedCorrect = StringUtils.hasText(prefixMark);
                current.rawChoices.add(new RawChoice(letter, choiceContent, isMarkedCorrect));
                continue;
            }

            // Otherwise, line is part of question content
            if (current.rawChoices.isEmpty()) {
                current.contentLines.add(line);
            }
        }

        if (current != null) {
            blocks.add(current);
        }

        return blocks;
    }

    private void extractTagsFromHeader(ParsedQuestionBlock block, String header) {
        String upper = header.toUpperCase(Locale.ROOT);

        // Detect difficulty
        if (upper.contains("DỄ") || upper.contains("EASY")) {
            block.difficulty = Difficulty.EASY;
        } else if (upper.contains("KHÓ") || upper.contains("HARD")) {
            block.difficulty = Difficulty.HARD;
        } else if (upper.contains("TRUNG BÌNH") || upper.contains("MEDIUM")) {
            block.difficulty = Difficulty.MEDIUM;
        }

        // Detect type
        if (upper.contains("TỰ LUẬN") || upper.contains("ESSAY")) {
            block.type = QuestionType.ESSAY;
        } else if (upper.contains("ĐÚNG SAI") || upper.contains("TRUE_FALSE")) {
            block.type = QuestionType.TRUE_FALSE;
        } else if (upper.contains("NHIỀU ĐÁP ÁN") || upper.contains("MULTIPLE_CHOICE")) {
            block.type = QuestionType.MULTIPLE_CHOICE;
        } else if (upper.contains("SINGLE_CHOICE") || upper.contains("TRẮC NGHIỆM")) {
            block.type = QuestionType.SINGLE_CHOICE;
        }

        // Detect chapter id e.g. [Chương: 1]
        Pattern chPattern = Pattern.compile("\\[?(?:chương|chapter)\\s*[:=]?\\s*(\\d+)\\]?", Pattern.CASE_INSENSITIVE);
        Matcher chMatcher = chPattern.matcher(header);
        if (chMatcher.find()) {
            try {
                block.taggedChapterId = Integer.parseInt(chMatcher.group(1));
            } catch (NumberFormatException ignored) {}
        }
    }

    private String stripTags(String text) {
        return text.replaceAll("\\[[^\\]]+\\]", "").trim();
    }

    private ImportQuestionItemResponse buildQuestionItemResponse(
            int index,
            ParsedQuestionBlock block,
            Integer defaultChapterId,
            Map<Integer, Chapter> chapterMap
    ) {
        List<String> errors = new ArrayList<>();

        Integer chapterId = block.taggedChapterId != null ? block.taggedChapterId : defaultChapterId;
        String chapterName = null;
        if (chapterId != null) {
            Chapter ch = chapterMap.get(chapterId);
            if (ch != null) {
                chapterName = ch.getName();
            } else if (!chapterMap.isEmpty()) {
                errors.add("Chương ID " + chapterId + " không thuộc môn học đã chọn");
            }
        } else {
            errors.add("Chưa chọn chương cho câu hỏi");
        }

        String content = String.join("\n", block.contentLines).trim();
        if (!StringUtils.hasText(content)) {
            errors.add("Nội dung câu hỏi không được để trống");
        } else if (content.length() > 3000) {
            errors.add("Nội dung câu hỏi vượt quá 3000 ký tự");
        }

        Difficulty difficulty = block.difficulty != null ? block.difficulty : Difficulty.MEDIUM;

        QuestionType type = block.type;
        String referenceAnswer = String.join("\n", block.referenceAnswerLines).trim();

        if (type == null) {
            if (StringUtils.hasText(referenceAnswer)) {
                type = QuestionType.ESSAY;
            } else if (block.rawChoices.size() == 2 && isTrueFalseChoices(block.rawChoices)) {
                type = QuestionType.TRUE_FALSE;
            } else {
                long correctCount = block.rawChoices.stream()
                        .filter(c -> c.isCorrect || block.declaredCorrectChoices.contains(c.letter))
                        .count();
                type = correctCount > 1 ? QuestionType.MULTIPLE_CHOICE : QuestionType.SINGLE_CHOICE;
            }
        }

        List<AnswerRequest> answers = new ArrayList<>();
        if (type == QuestionType.ESSAY) {
            if (!StringUtils.hasText(referenceAnswer)) {
                errors.add("Câu hỏi tự luận bắt buộc phải có đáp án tham khảo");
            } else if (referenceAnswer.length() > 10000) {
                errors.add("Đáp án tham khảo không được vượt quá 10000 ký tự");
            }
        } else {
            referenceAnswer = null;
            if (block.rawChoices.size() < 2) {
                errors.add("Câu hỏi trắc nghiệm phải có ít nhất 2 phương án đáp án");
            }

            int correctCount = 0;
            for (RawChoice rc : block.rawChoices) {
                boolean correct = rc.isCorrect || block.declaredCorrectChoices.contains(rc.letter);
                if (correct) correctCount++;
                answers.add(new AnswerRequest(rc.content, correct));
            }

            if (type == QuestionType.SINGLE_CHOICE && correctCount != 1) {
                errors.add("Câu hỏi một lựa chọn phải có đúng 1 đáp án đúng (hiện có " + correctCount + ")");
            } else if (type == QuestionType.MULTIPLE_CHOICE && correctCount < 1) {
                errors.add("Câu hỏi nhiều lựa chọn phải có ít nhất 1 đáp án đúng");
            } else if (type == QuestionType.TRUE_FALSE) {
                if (answers.size() != 2) {
                    errors.add("Câu hỏi đúng/sai phải có đúng 2 đáp án (Đúng và Sai)");
                } else if (correctCount != 1) {
                    errors.add("Câu hỏi đúng/sai phải có đúng 1 đáp án đúng");
                }
            }
        }

        return ImportQuestionItemResponse.builder()
                .itemIndex(index)
                .chapterId(chapterId)
                .chapterName(chapterName)
                .content(content)
                .difficulty(difficulty)
                .type(type)
                .referenceAnswer(referenceAnswer)
                .answers(answers)
                .valid(errors.isEmpty())
                .errors(errors)
                .build();
    }

    private boolean isTrueFalseChoices(List<RawChoice> choices) {
        if (choices.size() != 2) return false;
        Set<String> texts = choices.stream()
                .map(c -> c.content.trim().toLowerCase(Locale.ROOT))
                .collect(Collectors.toSet());
        return texts.contains("đúng") && texts.contains("sai");
    }

    private void validateImportItem(ImportQuestionItemRequest item, int questionNumber) {
        if (item.getChapterId() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Câu " + questionNumber + " chưa chọn chương");
        }
        if (!StringUtils.hasText(item.getContent())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Câu " + questionNumber + " thiếu nội dung câu hỏi");
        }
        if (item.getType() == QuestionType.ESSAY) {
            if (!StringUtils.hasText(item.getReferenceAnswer())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Câu " + questionNumber + " là tự luận nhưng thiếu đáp án tham khảo");
            }
        } else {
            if (item.getAnswers() == null || item.getAnswers().size() < 2) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Câu " + questionNumber + " trắc nghiệm cần ít nhất 2 đáp án");
            }
            long correct = item.getAnswers().stream().filter(a -> Boolean.TRUE.equals(a.getIsCorrect())).count();
            if (item.getType() == QuestionType.SINGLE_CHOICE && correct != 1) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Câu " + questionNumber + " một lựa chọn phải có đúng 1 đáp án đúng");
            }
        }
    }

    private QuestionResponse convertToQuestionResponse(Question q) {
        List<AnswerResponse> answerResponses = q.getAnswers().stream()
                .map(a -> new AnswerResponse(a.getId(), a.getContent(), a.getIsCorrect()))
                .toList();

        return QuestionResponse.builder()
                .id(q.getId())
                .chapterId(q.getChapter().getId())
                .content(q.getContent())
                .teacherId(q.getTeacher().getId())
                .difficulty(q.getDifficulty())
                .type(q.getType())
                .referenceAnswer(q.getReferenceAnswer())
                .answers(answerResponses)
                .createdAt(q.getCreatedAt())
                .build();
    }

    private static class ParsedQuestionBlock {
        String headerText;
        Difficulty difficulty;
        QuestionType type;
        Integer taggedChapterId;
        List<String> contentLines = new ArrayList<>();
        List<RawChoice> rawChoices = new ArrayList<>();
        List<String> referenceAnswerLines = new ArrayList<>();
        Set<String> declaredCorrectChoices = new HashSet<>();
        boolean isReadingReferenceAnswer = false;
    }

    private static class RawChoice {
        String letter;
        String content;
        boolean isCorrect;

        RawChoice(String letter, String content, boolean isCorrect) {
            this.letter = letter;
            this.content = content;
            this.isCorrect = isCorrect;
        }
    }
}
