package com.exammatrix.backend.service;

import com.exammatrix.backend.dto.response.PageResponse;
import com.exammatrix.backend.dto.response.TeacherResultRowResponse;
import com.exammatrix.backend.entity.StudentExamAttempt;
import com.exammatrix.backend.entity.StudentTeacherAssignment;
import com.exammatrix.backend.entity.User;
import com.exammatrix.backend.entity.enums.AttemptStatus;
import com.exammatrix.backend.entity.enums.ExamType;
import com.exammatrix.backend.entity.enums.StudentAssignmentStatus;
import com.exammatrix.backend.repository.StudentExamAttemptRepository;
import com.exammatrix.backend.repository.StudentTeacherAssignmentRepository;
import com.exammatrix.backend.security.CurrentUserService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class TeacherResultsService {
    private static final UUID DUMMY_EMPTY_UUID = UUID.fromString("00000000-0000-0000-0000-000000000000");

    private final CurrentUserService currentUserService;
    private final StudentTeacherAssignmentRepository assignmentRepository;
    private final StudentExamAttemptRepository attemptRepository;
    private final ScoreScaleService scoreScaleService;

    public PageResponse<TeacherResultRowResponse> getTeacherResults(
            ExamType examType,
            AttemptStatus status,
            String search,
            String sortBy,
            String sortDir,
            int page,
            int size
    ) {
        User currentUser = currentUserService.getCurrentUser();
        UUID teacherId = currentUser.getId();

        Set<UUID> approvedStudentIds = new HashSet<>();
        Page<StudentTeacherAssignment> approvedPage = assignmentRepository.findByTeacher_IdAndStatus(
                teacherId, StudentAssignmentStatus.APPROVED, PageRequest.of(0, 2000));
        for (StudentTeacherAssignment sta : approvedPage.getContent()) {
            if (sta.getStudent() != null) {
                approvedStudentIds.add(sta.getStudent().getId());
            }
        }

        Collection<UUID> queryStudentIds = approvedStudentIds.isEmpty()
                ? List.of(DUMMY_EMPTY_UUID)
                : approvedStudentIds;

        List<StudentExamAttempt> attempts = attemptRepository.findTeacherVisibleAttempts(teacherId, queryStudentIds);
        String q = search == null ? "" : search.trim().toLowerCase(Locale.ROOT);

        List<TeacherResultRowResponse> rows = attempts.stream()
                .filter(a -> examType == null || a.getExamPaper().getExamMatrix().getExamType() == examType)
                .filter(a -> status == null || a.getStatus() == status)
                .filter(a -> matchesSearch(a, q))
                .map(a -> toRow(a, teacherId, approvedStudentIds))
                .sorted(buildComparator(sortBy, sortDir))
                .toList();

        return paginate(rows, page, size);
    }

    private boolean matchesSearch(StudentExamAttempt a, String q) {
        if (q.isEmpty()) return true;
        String studentName = a.getStudent() != null && a.getStudent().getFullName() != null
                ? a.getStudent().getFullName().toLowerCase(Locale.ROOT) : "";
        String studentEmail = a.getStudent() != null && a.getStudent().getEmail() != null
                ? a.getStudent().getEmail().toLowerCase(Locale.ROOT) : "";
        String paperTitle = a.getExamPaper().getExamMatrix().getTitle() != null
                ? a.getExamPaper().getExamMatrix().getTitle().toLowerCase(Locale.ROOT) : "";
        String subjectName = a.getExamPaper().getExamMatrix().getSubject().getName() != null
                ? a.getExamPaper().getExamMatrix().getSubject().getName().toLowerCase(Locale.ROOT) : "";
        String examCode = a.getExamPaper().getExamCode() != null
                ? a.getExamPaper().getExamCode().toLowerCase(Locale.ROOT) : "";
        return studentName.contains(q) || studentEmail.contains(q)
                || paperTitle.contains(q) || subjectName.contains(q) || examCode.contains(q);
    }

    private TeacherResultRowResponse toRow(
            StudentExamAttempt a,
            UUID teacherId,
            Set<UUID> approvedStudentIds
    ) {
        var paper = a.getExamPaper();
        var matrix = paper.getExamMatrix();
        var subject = matrix.getSubject();

        boolean isAssignedPaper = a.getTeacher() != null && a.getTeacher().getId().equals(teacherId);
        boolean inTeacherClass = (a.getTeacherClass() != null
                && a.getTeacherClass().getTeacher() != null
                && a.getTeacherClass().getTeacher().getId().equals(teacherId))
                || (a.getStudent() != null && approvedStudentIds.contains(a.getStudent().getId()));

        String relationLabel;
        if (inTeacherClass && isAssignedPaper) {
            relationLabel = "Học sinh lớp & Đề của bạn";
        } else if (inTeacherClass) {
            relationLabel = "Học sinh thuộc lớp";
        } else {
            relationLabel = "Đề của bạn";
        }

        BigDecimal scoreOnTen = a.getStatus() == AttemptStatus.COMPLETED
                ? scoreScaleService.normalizeToTen(a.getScore(), a.getMaxScore(), a.getScoreOnTen())
                : null;

        return new TeacherResultRowResponse(
                a.getId(),
                a.getStudent().getId(),
                a.getStudent().getFullName(),
                a.getStudent().getEmail(),
                a.getTeacherClass() != null ? a.getTeacherClass().getName() : null,
                a.getTeacherClass() != null ? a.getTeacherClass().getClassCode() : null,
                subject.getId(),
                subject.getName(),
                paper.getId(),
                matrix.getTitle(),
                paper.getExamCode(),
                matrix.getExamType(),
                a.getStatus(),
                scoreOnTen,
                a.getScore(),
                a.getMaxScore(),
                a.getStartedAt(),
                a.getSubmittedAt(),
                a.getGradedAt(),
                a.getGradedBy() != null ? a.getGradedBy().getFullName() : null,
                relationLabel,
                a.effectiveAttemptNumber()
        );
    }

    private Comparator<TeacherResultRowResponse> buildComparator(String sortBy, String sortDir) {
        boolean asc = "asc".equalsIgnoreCase(sortDir);
        Comparator<TeacherResultRowResponse> primary;
        if ("score".equalsIgnoreCase(sortBy)) {
            primary = Comparator.comparing(
                    TeacherResultRowResponse::scoreOnTen,
                    Comparator.nullsLast(Comparator.naturalOrder())
            );
        } else {
            primary = Comparator.comparing(r -> {
                LocalDateTime t = r.gradedAt() != null ? r.gradedAt()
                        : (r.submittedAt() != null ? r.submittedAt() : r.startedAt());
                return t != null ? t : LocalDateTime.MIN;
            });
        }
        if (!asc) {
            primary = primary.reversed();
        }
        return primary.thenComparing(TeacherResultRowResponse::attemptId);
    }

    private PageResponse<TeacherResultRowResponse> paginate(List<TeacherResultRowResponse> rows, int page, int size) {
        int safePage = Math.max(0, page);
        int safeSize = Math.max(1, Math.min(size, 100));
        int total = rows.size();
        int totalPages = total == 0 ? 0 : (int) Math.ceil((double) total / safeSize);
        int from = Math.min(safePage * safeSize, total);
        int to = Math.min(from + safeSize, total);
        return new PageResponse<>(rows.subList(from, to), safePage, safeSize, (long) total, totalPages);
    }
}
