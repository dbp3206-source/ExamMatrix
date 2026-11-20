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
import com.exammatrix.backend.entity.QuestionImportRequest;
import com.exammatrix.backend.entity.User;
import com.exammatrix.backend.entity.enums.Difficulty;
import com.exammatrix.backend.entity.enums.ExamType;
import com.exammatrix.backend.entity.enums.QuestionType;
import com.exammatrix.backend.repository.ChapterRepository;
import com.exammatrix.backend.repository.QuestionImportRequestRepository;
import com.exammatrix.backend.repository.QuestionRepository;
import com.exammatrix.backend.repository.SubjectRepository;
import com.exammatrix.backend.security.CurrentUserService;
import com.exammatrix.backend.service.QuestionImportService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.xwpf.usermodel.IBodyElement;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFTable;
import org.apache.poi.xwpf.usermodel.XWPFTableCell;
import org.apache.poi.xwpf.usermodel.XWPFTableRow;
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
    private static final long MAX_FILE_SIZE = 10 * 1024 * 1024;
    private static final int MAX_QUESTIONS = 500;
    private static final int MAX_PDF_PAGES = 150;
    private static final int MAX_LINES = 12000;
    private static final Pattern QUESTION_HEADER_PATTERN =
            Pattern.compile("^(?:câu\\s+hỏi|câu|question|bài)\\s*(\\d+(?:\\.\\d+)?)[:.]?\\s*(.*)$", Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
    private static final Pattern CHOICE_PATTERN =
            Pattern.compile("^(\\*?|\\[x\\]|\\[v\\])?\\s*([A-Ha-h])([.):])\\s*(.*)$");
    private static final Pattern REF_ANSWER_PATTERN =
            Pattern.compile("^(?:\\[?đáp án tham khảo\\]?|hướng dẫn chấm|reference answer)[:.]?\\s*(.*)$", Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
    private static final Pattern CORRECT_ANSWER_HEADER =
            Pattern.compile("^(?:chọn\\s+đáp\\s+án|đáp\\s+án\\s+đúng|đáp\\s+án|answer)[:.]?\\s*([A-Ha-h](?:\\s*[,;\\s]\\s*[A-Ha-h])*)\\.?\\s*$", Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
    private static final Pattern EXPLANATION_START_PATTERN =
            Pattern.compile("^(?:vì\\s+sao\\s+đúng|giải\\s+thích|lời\\s+giải)\\s*[:.]?\\s*.*$", Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
    private static final Pattern TRAILING_CORRECT_MARKER =
            Pattern.compile("\\s*\\((?:đúng|correct)\\)\\s*$", Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
    private static final Pattern PAGE_MARKER_PATTERN =
            Pattern.compile("^(?:(?:trang|page)\\s+\\d+(?:\\s*/\\s*\\d+|\\s+(?:of|của)\\s+\\d+)?|.*\\((?:trang|page)\\s*\\d+/\\d+\\)|--\\s*\\d+\\s+of\\s+\\d+\\s*--)$",
                    Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);

    private final ChapterRepository chapterRepository;
    private final SubjectRepository subjectRepository;
    private final QuestionRepository questionRepository;
    private final QuestionImportRequestRepository questionImportRequestRepository;
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

        Map<Integer, Chapter> chapterMap = new HashMap<>();
        if (subjectId != null) {
            chapterRepository.findAllBySubjectIdOrderByOrderIndexAsc(subjectId)
                    .forEach(c -> chapterMap.put(c.getId(), c));
        }

        List<ParsedQuestionBlock> blocks = parseBlocksFromLines(rawLines);
        if (blocks.size() > MAX_QUESTIONS) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Mỗi lần chỉ được nhập tối đa 500 câu hỏi");
        }
        if (blocks.isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Không tìm thấy câu hỏi nào đúng định dạng trong tài liệu. Mỗi câu cần bắt đầu bằng 'Câu 1:', 'Bài 1:' hoặc 'Question 1:'."
            );
        }
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
        UUID requestId = request.getRequestId();
        User currentUser = requestId != null
                ? currentUserService.getCurrentUserForUpdate()
                : currentUserService.getCurrentUser();

        if (request.getItems() == null || request.getItems().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Danh sách câu hỏi cần import không được để trống");
        }

        String payloadDigest = requestId != null ? computeImportDigest(request) : null;
        if (requestId != null && questionImportRequestRepository != null) {
            Optional<QuestionImportRequest> existingOpt = questionImportRequestRepository
                    .findByActor_IdAndRequestId(currentUser.getId(), requestId);
            if (existingOpt.isPresent()) {
                QuestionImportRequest existing = existingOpt.get();
                if (!Objects.equals(existing.getPayloadDigest(), payloadDigest)) {
                    throw new ResponseStatusException(
                            HttpStatus.CONFLICT,
                            "Mã xác nhận nhập câu hỏi đã được sử dụng cho bộ dữ liệu khác"
                    );
                }
                List<UUID> createdIds = Arrays.stream(existing.getCreatedIds().split(","))
                        .map(String::trim)
                        .filter(s -> !s.isEmpty())
                        .map(UUID::fromString)
                        .toList();
                Map<UUID, Question> byId = questionRepository.findAllById(createdIds).stream()
                        .collect(Collectors.toMap(Question::getId, q -> q));
                List<QuestionResponse> replayed = new ArrayList<>();
                for (UUID id : createdIds) {
                    Question q = byId.get(id);
                    if (q != null) {
                        replayed.add(convertToQuestionResponse(q));
                    }
                }
                return replayed;
            }
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

            if (request.getSubjectId() != null
                    && (chapter.getSubject() == null || !request.getSubjectId().equals(chapter.getSubject().getId()))) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Chương ID " + itemReq.getChapterId() + " ở câu " + questionNumber + " không thuộc môn học đã chọn"
                );
            }

            Question question = new Question();
            question.setChapter(chapter);
            question.setTeacher(currentUser);
            question.setContent(itemReq.getContent().trim());
            question.setDifficulty(itemReq.getDifficulty());
            question.setType(itemReq.getType());
            question.setExamType(itemReq.getType() == QuestionType.ESSAY ? ExamType.ESSAY : ExamType.OBJECTIVE);

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
        questionRepository.flush();

        if (requestId != null && questionImportRequestRepository != null) {
            String joinedIds = savedQuestions.stream()
                    .map(q -> q.getId().toString())
                    .collect(Collectors.joining(","));
            QuestionImportRequest importRecord = QuestionImportRequest.builder()
                    .actor(currentUser)
                    .requestId(requestId)
                    .payloadDigest(payloadDigest)
                    .createdIds(joinedIds)
                    .createdCount(savedQuestions.size())
                    .build();
            questionImportRequestRepository.save(importRecord);
        }

        return savedQuestions.stream().map(this::convertToQuestionResponse).toList();
    }

    private String computeImportDigest(ImportQuestionsConfirmRequest request) {
        try {
            java.security.MessageDigest md = java.security.MessageDigest.getInstance("SHA-256");
            StringBuilder sb = new StringBuilder();
            sb.append("subject=").append(request.getSubjectId()).append('\n');
            for (ImportQuestionItemRequest item : request.getItems()) {
                sb.append(item.getChapterId()).append('|')
                        .append(item.getType()).append('|')
                        .append(item.getDifficulty()).append('|')
                        .append(item.getContent() != null ? item.getContent().trim() : "").append('|')
                        .append(item.getReferenceAnswer() != null ? item.getReferenceAnswer().trim() : "").append('|');
                if (item.getAnswers() != null) {
                    for (AnswerRequest ar : item.getAnswers()) {
                        sb.append(ar.getContent() != null ? ar.getContent().trim() : "")
                                .append('=')
                                .append(Boolean.TRUE.equals(ar.getIsCorrect()))
                                .append(';');
                    }
                }
                sb.append('\n');
            }
            byte[] hash = md.digest(sb.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder(hash.length * 2);
            for (byte b : hash) {
                hex.append(String.format("%02x", b));
            }
            return hex.toString();
        } catch (Exception e) {
            throw new IllegalStateException("Cannot compute import digest", e);
        }
    }

    private List<String> parseDocxLines(MultipartFile file) {
        try (InputStream is = file.getInputStream(); XWPFDocument document = new XWPFDocument(is)) {
            List<String> lines = new ArrayList<>();
            extractBodyElements(document.getBodyElements(), lines);
            return lines;
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            log.warn("Không thể đọc file DOCX ({})", e.getClass().getSimpleName());
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Không thể đọc nội dung file Word");
        }
    }

    private void extractBodyElements(List<IBodyElement> elements, List<String> lines) {
        if (elements == null) return;
        for (IBodyElement element : elements) {
            if (element instanceof XWPFParagraph paragraph) {
                addSplitLines(paragraph.getText(), lines);
            } else if (element instanceof XWPFTable table) {
                for (XWPFTableRow row : table.getRows()) {
                    for (XWPFTableCell cell : row.getTableCells()) {
                        extractBodyElements(cell.getBodyElements(), lines);
                    }
                }
            }
        }
    }

    private void addSplitLines(String text, List<String> lines) {
        if (!StringUtils.hasText(text)) return;
        for (String part : text.split("\\r?\\n")) {
            if (StringUtils.hasText(part)) {
                if (lines.size() >= MAX_LINES) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Tài liệu có quá nhiều dòng văn bản");
                }
                lines.add(part.trim());
            }
        }
    }

    private List<String> parsePdfLines(MultipartFile file) {
        try {
            byte[] bytes = file.getBytes();
            try (PDDocument document = Loader.loadPDF(bytes)) {
                if (document.getNumberOfPages() > MAX_PDF_PAGES) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Mỗi file PDF chỉ được có tối đa 150 trang");
                }
                PDFTextStripper stripper = new PDFTextStripper();
                stripper.setSortByPosition(true);
                String fullText = stripper.getText(document);
                if (!StringUtils.hasText(fullText)) {
                    throw new ResponseStatusException(
                            HttpStatus.BAD_REQUEST,
                            "File PDF không có lớp văn bản (có thể là PDF scan hoặc ảnh). Hệ thống không hỗ trợ OCR, vui lòng dùng file PDF có văn bản hoặc file Word (.docx)."
                    );
                }
                List<String> lines = new ArrayList<>();
                addSplitLines(fullText, lines);
                lines.removeIf(line -> PAGE_MARKER_PATTERN.matcher(line.trim()).matches());
                return lines;
            }
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            log.warn("Không thể đọc file PDF ({})", e.getClass().getSimpleName());
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Không thể đọc nội dung file PDF");
        }
    }

    private List<ParsedQuestionBlock> parseBlocksFromLines(List<String> lines) {
        List<ParsedQuestionBlock> blocks = new ArrayList<>();
        ParsedQuestionBlock current = null;

        for (String line : lines) {
            if (PAGE_MARKER_PATTERN.matcher(line.trim()).matches()) {
                continue;
            }
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

                    String promptText = stripTags(extra);
                    if (StringUtils.hasText(promptText)) {
                        current.contentLines.add(promptText);
                    }
                }
                continue;
            }

            if (current == null) {

                continue;
            }

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

            if (!current.rawChoices.isEmpty() && EXPLANATION_START_PATTERN.matcher(line).matches()) {
                current.isIgnoringExplanation = true;
                continue;
            }
            if (current.isIgnoringExplanation) {
                continue;
            }

            Matcher choiceMatcher = CHOICE_PATTERN.matcher(line);
            if (choiceMatcher.matches()) {
                String prefixMark = choiceMatcher.group(1);
                String letter = choiceMatcher.group(2).toUpperCase(Locale.ROOT);
                String choiceContent = choiceMatcher.group(4).trim();

                boolean isMarkedCorrect = StringUtils.hasText(prefixMark);
                Matcher trailingMatcher = TRAILING_CORRECT_MARKER.matcher(choiceContent);
                if (trailingMatcher.find()) {
                    isMarkedCorrect = true;
                    choiceContent = trailingMatcher.replaceFirst("").trim();
                }
                current.rawChoices.add(new RawChoice(letter, choiceContent, isMarkedCorrect));
                continue;
            }

            if (current.rawChoices.isEmpty()) {
                current.contentLines.add(line);
            } else if (current.declaredCorrectChoices.isEmpty()) {
                RawChoice lastChoice = current.rawChoices.get(current.rawChoices.size() - 1);
                String nextContent = StringUtils.hasText(lastChoice.content)
                        ? lastChoice.content + "\n" + line
                        : line;
                Matcher trailingMatcher = TRAILING_CORRECT_MARKER.matcher(nextContent);
                if (trailingMatcher.find()) {
                    lastChoice.isCorrect = true;
                    nextContent = trailingMatcher.replaceFirst("").trim();
                }
                lastChoice.content = nextContent;
            }
        }

        if (current != null) {
            blocks.add(current);
        }

        return blocks;
    }

    private void extractTagsFromHeader(ParsedQuestionBlock block, String header) {
        String upper = header.toUpperCase(Locale.ROOT);

        if (upper.contains("DỄ") || upper.contains("EASY")) {
            block.difficulty = Difficulty.EASY;
        } else if (upper.contains("KHÓ") || upper.contains("HARD")) {
            block.difficulty = Difficulty.HARD;
        } else if (upper.contains("TRUNG BÌNH") || upper.contains("MEDIUM")) {
            block.difficulty = Difficulty.MEDIUM;
        }

        if (upper.contains("TỰ LUẬN") || upper.contains("ESSAY")) {
            block.type = QuestionType.ESSAY;
        } else if (upper.contains("ĐÚNG SAI") || upper.contains("ĐÚNG/SAI") || upper.contains("ĐÚNG / SAI") || upper.contains("TRUE_FALSE")) {
            block.type = QuestionType.TRUE_FALSE;
        } else if (upper.contains("NHIỀU ĐÁP ÁN") || upper.contains("MULTIPLE_CHOICE")) {
            block.type = QuestionType.MULTIPLE_CHOICE;
        } else if (upper.contains("SINGLE_CHOICE") || upper.contains("TRẮC NGHIỆM")) {
            block.type = QuestionType.SINGLE_CHOICE;
        }

        Pattern chPattern = Pattern.compile("\\[?(?:chương|chapter)\\s*[:=]?\\s*(\\d+)\\]?", Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
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
        if (chapterId != null && chapterId > 0) {
            Chapter ch = chapterMap.get(chapterId);
            if (ch != null) {
                chapterName = ch.getName();
            } else if (!chapterMap.isEmpty()) {
                errors.add("Chương ID " + chapterId + " không thuộc môn học đã chọn");
            } else {
                Optional<Chapter> foundChapter = chapterRepository.findById(chapterId);
                if (foundChapter.isPresent()) {
                    chapterName = foundChapter.get().getName();
                } else {
                    errors.add("Chương ID " + chapterId + " không tồn tại");
                }
            }
        } else {
            chapterId = null;
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
                if (!StringUtils.hasText(rc.content)) {
                    errors.add("Nội dung phương án " + rc.letter + " không được để trống");
                }
                boolean correct = rc.isCorrect || block.declaredCorrectChoices.contains(rc.letter);
                if (correct) correctCount++;
                answers.add(new AnswerRequest(rc.content, correct));
            }

            if (type == QuestionType.SINGLE_CHOICE && correctCount != 1) {
                errors.add("Câu hỏi một lựa chọn phải có đúng 1 đáp án đúng (hiện có " + correctCount + ")");
            } else if (type == QuestionType.MULTIPLE_CHOICE && correctCount < 1) {
                errors.add("Câu hỏi nhiều lựa chọn phải có ít nhất 1 đáp án đúng");
            } else if (type == QuestionType.TRUE_FALSE) {
                if (answers.size() != 2 || !isTrueFalseChoices(block.rawChoices)) {
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
        if (item.getChapterId() == null || item.getChapterId() <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Câu " + questionNumber + " chưa chọn chương hợp lệ");
        }
        if (!StringUtils.hasText(item.getContent())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Câu " + questionNumber + " thiếu nội dung câu hỏi");
        }
        if (item.getContent().trim().length() > 3000) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Câu " + questionNumber + " vượt quá 3000 ký tự");
        }
        if (item.getDifficulty() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Câu " + questionNumber + " thiếu độ khó");
        }
        if (item.getType() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Câu " + questionNumber + " thiếu loại câu hỏi");
        }
        if (item.getType() == QuestionType.ESSAY) {
            if (item.getAnswers() != null && !item.getAnswers().isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Câu " + questionNumber + " tự luận không được có đáp án lựa chọn");
            }
            if (!StringUtils.hasText(item.getReferenceAnswer())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Câu " + questionNumber + " là tự luận nhưng thiếu đáp án tham khảo");
            }
            if (item.getReferenceAnswer().trim().length() > 10000) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Câu " + questionNumber + " có đáp án tham khảo vượt quá 10000 ký tự");
            }
        } else {
            if (StringUtils.hasText(item.getReferenceAnswer())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Câu " + questionNumber + " trắc nghiệm không được có đáp án tham khảo");
            }
            if (item.getAnswers() == null || item.getAnswers().size() < 2) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Câu " + questionNumber + " trắc nghiệm cần ít nhất 2 đáp án");
            }
            boolean hasBlankAnswer = item.getAnswers().stream().anyMatch(a -> a == null || !StringUtils.hasText(a.getContent()));
            if (hasBlankAnswer) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Câu " + questionNumber + " có phương án đáp án bị trống");
            }
            long correct = item.getAnswers().stream().filter(a -> Boolean.TRUE.equals(a.getIsCorrect())).count();
            if (item.getType() == QuestionType.SINGLE_CHOICE && correct != 1) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Câu " + questionNumber + " một lựa chọn phải có đúng 1 đáp án đúng");
            } else if (item.getType() == QuestionType.MULTIPLE_CHOICE && correct < 1) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Câu " + questionNumber + " nhiều lựa chọn phải có ít nhất 1 đáp án đúng");
            } else if (item.getType() == QuestionType.TRUE_FALSE) {
                if (item.getAnswers().size() != 2) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Câu " + questionNumber + " đúng/sai phải có đúng 2 đáp án");
                }
                Set<String> tfTexts = item.getAnswers().stream()
                        .map(a -> a.getContent().trim().toLowerCase(Locale.ROOT))
                        .collect(Collectors.toSet());
                if (!tfTexts.contains("đúng") || !tfTexts.contains("sai")) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Câu " + questionNumber + " đúng/sai phải có hai đáp án Đúng và Sai");
                }
                if (correct != 1) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Câu " + questionNumber + " đúng/sai phải có đúng 1 đáp án đúng");
                }
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
        boolean isIgnoringExplanation = false;
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
