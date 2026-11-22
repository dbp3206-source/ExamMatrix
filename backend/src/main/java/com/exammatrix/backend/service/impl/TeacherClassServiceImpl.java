package com.exammatrix.backend.service.impl;

import com.exammatrix.backend.dto.request.ReviewStudentAssignmentRequest;
import com.exammatrix.backend.dto.request.UpdateTeacherClassRequest;
import com.exammatrix.backend.dto.response.BatchApproveStudentsResponse;
import com.exammatrix.backend.dto.response.PageResponse;
import com.exammatrix.backend.dto.response.StudentAssignmentResponse;
import com.exammatrix.backend.dto.response.TeacherClassResponse;
import com.exammatrix.backend.entity.StudentTeacherAssignment;
import com.exammatrix.backend.entity.TeacherClass;
import com.exammatrix.backend.entity.User;
import com.exammatrix.backend.entity.enums.ClassJoinMode;
import com.exammatrix.backend.entity.enums.StudentAssignmentStatus;
import com.exammatrix.backend.repository.StudentTeacherAssignmentRepository;
import com.exammatrix.backend.repository.TeacherClassRepository;
import com.exammatrix.backend.repository.UserRepository;
import com.exammatrix.backend.security.CurrentUserService;
import com.exammatrix.backend.service.TeacherClassService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class TeacherClassServiceImpl implements TeacherClassService {
    private final TeacherClassRepository teacherClassRepository;
    private final StudentTeacherAssignmentRepository assignmentRepository;
    private final UserRepository userRepository;
    private final CurrentUserService currentUserService;
    private final PasswordEncoder passwordEncoder;

    @Override
    @Transactional
    public TeacherClassResponse getOrCreateCurrentTeacherClass() {
        User teacher = currentUserService.getCurrentUserForUpdate();
        TeacherClass teacherClass = teacherClassRepository.findByTeacher_Id(teacher.getId())
                .orElseGet(() -> {
                    TeacherClass newClass = TeacherClass.builder()
                            .teacher(teacher)
                            .name("Lớp mới")
                            .classCode("CLASS_" + UUID.randomUUID().toString().replace("-", "").toUpperCase(Locale.ROOT))
                            .joinMode(ClassJoinMode.CLOSED)
                            .joinPassword(null)
                            .build();
                    return teacherClassRepository.save(newClass);
                });

        return toTeacherClassResponse(teacherClass, teacher);
    }

    @Override
    @Transactional
    public TeacherClassResponse updateCurrentTeacherClass(UpdateTeacherClassRequest request) {
        User teacher = currentUserService.getCurrentUserForUpdate();
        TeacherClass teacherClass = teacherClassRepository.findByTeacher_Id(teacher.getId())
                .orElseGet(() -> TeacherClass.builder()
                        .teacher(teacher)
                        .name(request.getName().trim())
                        .classCode(request.getClassCode().trim().toUpperCase(Locale.ROOT))
                        .joinMode(ClassJoinMode.CLOSED)
                        .joinPassword(null)
                        .build()
                );

        String normalizedCode = request.getClassCode().trim().toUpperCase(Locale.ROOT);
        teacherClassRepository.findByClassCode(normalizedCode).ifPresent(existing -> {
            if (!existing.getId().equals(teacherClass.getId())) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Mã lớp đã được sử dụng");
            }
        });

        teacherClass.setName(request.getName().trim());
        teacherClass.setClassCode(normalizedCode);

        ClassJoinMode requestedMode = request.getJoinMode();
        if (requestedMode == null) {
            if (StringUtils.hasText(request.getPassword())) {
                requestedMode = ClassJoinMode.REQUEST_WITH_PASSWORD;
            } else {
                requestedMode = teacherClass.effectiveJoinMode();
            }
        }

        if (requestedMode == ClassJoinMode.CLOSED) {
            teacherClass.setJoinMode(ClassJoinMode.CLOSED);
            teacherClass.setJoinPassword(null);
        } else if (requestedMode == ClassJoinMode.REQUEST_OPEN) {
            teacherClass.setJoinMode(ClassJoinMode.REQUEST_OPEN);
            teacherClass.setJoinPassword(null);
        } else {

            if (StringUtils.hasText(request.getPassword())) {
                if ("123456".equals(request.getPassword().trim())) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Hãy đặt mật khẩu lớp khác mật khẩu mặc định cũ");
                }
                teacherClass.setJoinPassword(passwordEncoder.encode(request.getPassword().trim()));
            } else if (!StringUtils.hasText(teacherClass.getJoinPassword())
                    || TeacherClass.JOIN_DISABLED.equals(teacherClass.getJoinPassword())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Vui lòng nhập mật khẩu lớp khi bật chế độ yêu cầu mật khẩu");
            }
            teacherClass.setJoinMode(ClassJoinMode.REQUEST_WITH_PASSWORD);
        }

        TeacherClass saved = teacherClassRepository.save(teacherClass);
        return toTeacherClassResponse(saved, teacher);
    }

    @Override
    public PageResponse<StudentAssignmentResponse> getTeacherStudents(
            StudentAssignmentStatus status,
            Pageable pageable
    ) {
        User teacher = currentUserService.getCurrentUser();
        Page<StudentTeacherAssignment> page = status == null
                ? assignmentRepository.findByTeacher_Id(teacher.getId(), pageable)
                : assignmentRepository.findByTeacher_IdAndStatus(teacher.getId(), status, pageable);

        List<StudentAssignmentResponse> responses = page.getContent().stream()
                .map(this::toAssignmentResponse)
                .toList();

        return new PageResponse<>(
                responses,
                page.getNumber(),
                page.getSize(),
                page.getTotalElements(),
                page.getTotalPages()
        );
    }

    @Override
    @Transactional
    public StudentAssignmentResponse reviewStudentAssignment(
            UUID assignmentId,
            ReviewStudentAssignmentRequest request
    ) {
        User currentUser = currentUserService.getCurrentUser();
        StudentTeacherAssignment assignment = assignmentRepository.findById(assignmentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy yêu cầu"));

        boolean isAdmin = com.exammatrix.backend.security.RolePolicy.isContentStaff(currentUser);
        if (!isAdmin && !assignment.getTeacher().getId().equals(currentUser.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bạn không có quyền duyệt yêu cầu của giáo viên khác");
        }

        userRepository.findByIdForUpdate(assignment.getStudent().getId());

        LocalDateTime now = LocalDateTime.now();

        assignment.setStatus(request.getStatus());
        assignment.setReviewedAt(now);
        assignment.setReviewedBy(currentUser);
        if (StringUtils.hasText(request.getDecisionNote())) {
            assignment.setDecisionNote(request.getDecisionNote().trim());
        }

        StudentTeacherAssignment saved = assignmentRepository.save(assignment);
        return toAssignmentResponse(saved);
    }

    @Override
    @Transactional
    public BatchApproveStudentsResponse approveAllPendingRequests() {
        User currentUser = currentUserService.getCurrentUser();
        List<StudentTeacherAssignment> pending = assignmentRepository.findByTeacher_IdAndStatus(
                currentUser.getId(),
                StudentAssignmentStatus.PENDING
        );
        if (pending.isEmpty()) {
            return new BatchApproveStudentsResponse(0);
        }
        LocalDateTime now = LocalDateTime.now();
        for (StudentTeacherAssignment assignment : pending) {
            userRepository.findByIdForUpdate(assignment.getStudent().getId());
            assignment.setStatus(StudentAssignmentStatus.APPROVED);
            assignment.setReviewedAt(now);
            assignment.setReviewedBy(currentUser);
        }
        assignmentRepository.saveAll(pending);
        return new BatchApproveStudentsResponse(pending.size());
    }

    private TeacherClassResponse toTeacherClassResponse(TeacherClass teacherClass, User teacher) {
        long count = assignmentRepository.countByTeacherClass_IdAndStatus(
                teacherClass.getId(),
                StudentAssignmentStatus.APPROVED
        );
        ClassJoinMode mode = teacherClass.effectiveJoinMode();
        boolean hasPassword = mode == ClassJoinMode.REQUEST_WITH_PASSWORD
                && StringUtils.hasText(teacherClass.getJoinPassword())
                && !TeacherClass.JOIN_DISABLED.equals(teacherClass.getJoinPassword())
                && !passwordEncoder.matches("123456", teacherClass.getJoinPassword());

        return TeacherClassResponse.builder()
                .id(teacherClass.getId())
                .teacherId(teacher.getId())
                .teacherName(teacher.getFullName())
                .name(teacherClass.getName())
                .classCode(teacherClass.getClassCode())
                .joinMode(mode)
                .studentCount(count)
                .hasPassword(hasPassword)
                .createdAt(teacherClass.getCreatedAt())
                .build();
    }

    private StudentAssignmentResponse toAssignmentResponse(StudentTeacherAssignment assignment) {
        return StudentAssignmentResponse.builder()
                .id(assignment.getId())
                .studentId(assignment.getStudent().getId())
                .studentName(assignment.getStudent().getFullName())
                .studentEmail(assignment.getStudent().getEmail())
                .teacherId(assignment.getTeacher().getId())
                .teacherName(assignment.getTeacher().getFullName())
                .teacherEmail(assignment.getTeacher().getEmail())
                .classCode(assignment.getTeacherClass() != null ? assignment.getTeacherClass().getClassCode() : null)
                .className(assignment.getTeacherClass() != null ? assignment.getTeacherClass().getName() : null)
                .status(assignment.getStatus())
                .requestedAt(assignment.getRequestedAt())
                .reviewedAt(assignment.getReviewedAt())
                .decisionNote(assignment.getDecisionNote())
                .build();
    }
}
