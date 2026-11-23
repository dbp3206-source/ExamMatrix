package com.exammatrix.backend.service;

import com.exammatrix.backend.dto.response.AdminResultRowResponse;
import com.exammatrix.backend.dto.response.PageResponse;
import com.exammatrix.backend.dto.response.UserResponse;
import com.exammatrix.backend.entity.StudentExamAttempt;
import com.exammatrix.backend.entity.StudentTeacherAssignment;
import com.exammatrix.backend.entity.TeacherClass;
import com.exammatrix.backend.entity.User;
import com.exammatrix.backend.entity.enums.StudentAssignmentStatus;
import com.exammatrix.backend.entity.enums.UserStatus;
import com.exammatrix.backend.repository.StudentExamAttemptRepository;
import com.exammatrix.backend.repository.StudentTeacherAssignmentRepository;
import com.exammatrix.backend.repository.TeacherClassRepository;
import com.exammatrix.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AdminResultsService {
    private final UserRepository userRepository;
    private final TeacherClassRepository teacherClassRepository;
    private final StudentTeacherAssignmentRepository assignmentRepository;
    private final StudentExamAttemptRepository attemptRepository;
    private final ScoreScaleService scoreScaleService;

    public List<UserResponse> listUsersByRole(String role, String search) {
        String normalizedRole = (role == null || role.isBlank()) ? "TEACHER" : role.trim().toUpperCase(Locale.ROOT);
        if (!"TEACHER".equals(normalizedRole)
                && !"STUDENT".equals(normalizedRole)
                && !"ADMIN".equals(normalizedRole)
                && !"CONTENT_ADMIN".equals(normalizedRole)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Vai trò không hợp lệ");
        }
        String q = search == null ? "" : search.trim().toLowerCase(Locale.ROOT);
        return userRepository.findByRole_NameIgnoreCaseAndStatusOrderByFullNameAsc(normalizedRole, UserStatus.ACTIVE)
                .stream()
                .filter(u -> q.isEmpty()
                        || (u.getFullName() != null && u.getFullName().toLowerCase(Locale.ROOT).contains(q))
                        || (u.getEmail() != null && u.getEmail().toLowerCase(Locale.ROOT).contains(q))
                        || (u.getUsername() != null && u.getUsername().toLowerCase(Locale.ROOT).contains(q)))
                .map(u -> new UserResponse(
                        u.getId(), u.getUsername(), u.getEmail(), u.getFullName(),
                        u.getRole().getName(), u.getStatus(), u.getCreatedAt(), u.getUpdatedAt()
                ))
                .toList();
    }

    public PageResponse<AdminResultRowResponse> getTeacherGradedEssays(
            UUID graderId,
            String sortBy,
            String sortDir,
            int page,
            int size
    ) {
        User grader = userRepository.findById(graderId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy người dùng"));

        List<StudentExamAttempt> attempts = attemptRepository.findEssayAttemptsGradedBy(grader.getId());
        Map<UUID, StudentExamAttempt> deduped = new LinkedHashMap<>();
        for (StudentExamAttempt a : attempts) {
            deduped.putIfAbsent(a.getId(), a);
        }

        List<AdminResultRowResponse> rows = deduped.values().stream()
                .map(a -> toRow(a, false, true, "Tự luận đã chấm"))
                .sorted(buildComparator(sortBy, sortDir))
                .toList();

        return paginate(rows, page, size);
    }

    public PageResponse<AdminResultRowResponse> getTeacherObjectiveResults(
            UUID teacherId,
            String scope,
            String sortBy,
            String sortDir,
            int page,
            int size
    ) {
        User teacher = userRepository.findById(teacherId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy giáo viên"));

        String normalizedScope = (scope == null || scope.isBlank()) ? "BOTH" : scope.trim().toUpperCase(Locale.ROOT);
        UUID teacherClassId = teacherClassRepository.findByTeacher_Id(teacher.getId())
                .map(TeacherClass::getId)
                .orElse(null);

        Set<UUID> approvedStudentIds = new HashSet<>();
        Page<StudentTeacherAssignment> approvedPage = assignmentRepository.findByTeacher_IdAndStatus(
                teacher.getId(), StudentAssignmentStatus.APPROVED, PageRequest.of(0, 2000));
        for (StudentTeacherAssignment sta : approvedPage.getContent()) {
            approvedStudentIds.add(sta.getStudent().getId());
        }

        List<StudentExamAttempt> allObjective = attemptRepository.findAllCompletedObjectiveAttempts();
        Map<UUID, AdminResultRowResponse> deduped = new LinkedHashMap<>();

        for (StudentExamAttempt a : allObjective) {
            boolean isAssignedPaper = a.getTeacher() != null && a.getTeacher().getId().equals(teacher.getId());
            boolean inTeacherClass;
            if (a.getTeacherClass() != null) {
                inTeacherClass = teacherClassId != null && teacherClassId.equals(a.getTeacherClass().getId());
            } else {
                inTeacherClass = a.getStudent() != null && approvedStudentIds.contains(a.getStudent().getId());
            }

            boolean include = switch (normalizedScope) {
                case "CLASS_STUDENTS" -> inTeacherClass;
                case "ASSIGNED_PAPERS" -> isAssignedPaper;
                default -> inTeacherClass || isAssignedPaper;
            };
            if (!include) continue;

            String relationLabel;
            if (inTeacherClass && isAssignedPaper) {
                relationLabel = "Học sinh thuộc lớp & Đề đã giao";
            } else if (inTeacherClass) {
                relationLabel = "Học sinh thuộc lớp";
            } else {
                relationLabel = "Đề đã giao";
            }

            deduped.putIfAbsent(a.getId(), toRow(a, inTeacherClass, isAssignedPaper, relationLabel));
        }

        List<AdminResultRowResponse> rows = deduped.values().stream()
                .sorted(buildComparator(sortBy, sortDir))
                .toList();

        return paginate(rows, page, size);
    }

    public PageResponse<AdminResultRowResponse> getStudentResults(
            UUID studentId,
            String sortBy,
            String sortDir,
            int page,
            int size
    ) {
        User student = userRepository.findById(studentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy học sinh"));

        Page<StudentExamAttempt> attemptPage = attemptRepository.findByStudent_Id(
                student.getId(),
                PageRequest.of(0, 1000, Sort.by(Sort.Direction.DESC, "startedAt"))
        );

        List<AdminResultRowResponse> rows = attemptPage.getContent().stream()
                .map(a -> toRow(a, a.getTeacherClass() != null, true,
                        a.getStatus() != null ? a.getStatus().name() : ""))
                .sorted(buildComparator(sortBy, sortDir))
                .toList();

        return paginate(rows, page, size);
    }

    private AdminResultRowResponse toRow(
            StudentExamAttempt a,
            boolean inTeacherClass,
            boolean isAssignedPaper,
            String relationLabel
    ) {
        var paper = a.getExamPaper();
        var matrix = paper.getExamMatrix();
        var subject = matrix.getSubject();
        BigDecimal scoreOnTen = scoreScaleService.normalizeToTen(a.getScore(), a.getMaxScore(), a.getScoreOnTen());

        String className = a.getTeacherClass() != null ? a.getTeacherClass().getName() : null;
        String classCode = a.getTeacherClass() != null ? a.getTeacherClass().getClassCode() : null;
        String gradedByName = a.getGradedBy() != null ? a.getGradedBy().getFullName() : null;

        return new AdminResultRowResponse(
                a.getId(),
                a.getStudent().getId(),
                a.getStudent().getFullName(),
                a.getStudent().getEmail(),
                className,
                classCode,
                subject.getId(),
                subject.getName(),
                paper.getId(),
                matrix.getTitle(),
                paper.getExamCode(),
                matrix.getExamType(),
                scoreOnTen,
                a.getScore(),
                a.getMaxScore(),
                a.getGradedAt(),
                a.getSubmittedAt(),
                gradedByName,
                inTeacherClass,
                isAssignedPaper,
                relationLabel,
                a.effectiveAttemptNumber()
        );
    }

    private Comparator<AdminResultRowResponse> buildComparator(String sortBy, String sortDir) {
        boolean asc = "asc".equalsIgnoreCase(sortDir);
        Comparator<AdminResultRowResponse> primary;
        if ("score".equalsIgnoreCase(sortBy)) {
            primary = Comparator.comparing(
                    AdminResultRowResponse::scoreOnTen,
                    Comparator.nullsLast(Comparator.naturalOrder())
            );
        } else {
            primary = Comparator.comparing(
                    r -> {
                        LocalDateTime t = r.gradedAt() != null ? r.gradedAt() : r.submittedAt();
                        return t != null ? t : LocalDateTime.MIN;
                    }
            );
        }
        if (!asc) {
            primary = primary.reversed();
        }

        return primary.thenComparing(AdminResultRowResponse::attemptId);
    }

    private PageResponse<AdminResultRowResponse> paginate(List<AdminResultRowResponse> rows, int page, int size) {
        int safePage = Math.max(0, page);
        int safeSize = Math.max(1, Math.min(size, 100));
        int total = rows.size();
        int totalPages = total == 0 ? 0 : (int) Math.ceil((double) total / safeSize);
        int from = Math.min(safePage * safeSize, total);
        int to = Math.min(from + safeSize, total);
        return new PageResponse<>(rows.subList(from, to), safePage, safeSize, (long) total, totalPages);
    }
}
