package com.exammatrix.backend.service.impl;

import com.exammatrix.backend.dto.request.ReviewStudentAssignmentRequest;
import com.exammatrix.backend.dto.request.UpdateTeacherClassRequest;
import com.exammatrix.backend.dto.response.PageResponse;
import com.exammatrix.backend.dto.response.StudentAssignmentResponse;
import com.exammatrix.backend.dto.response.TeacherClassResponse;
import com.exammatrix.backend.entity.StudentTeacherAssignment;
import com.exammatrix.backend.entity.TeacherClass;
import com.exammatrix.backend.entity.User;
import com.exammatrix.backend.entity.enums.StudentAssignmentStatus;
import com.exammatrix.backend.repository.StudentTeacherAssignmentRepository;
import com.exammatrix.backend.repository.TeacherClassRepository;
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
    private final CurrentUserService currentUserService;
    private final PasswordEncoder passwordEncoder;

    @Override
    @Transactional
    public TeacherClassResponse getOrCreateCurrentTeacherClass() {
        User teacher = currentUserService.getCurrentUser();
        TeacherClass teacherClass = teacherClassRepository.findByTeacher_Id(teacher.getId())
                .orElseGet(() -> {
                    String initialCode = "CLASS_" + teacher.getUsername().toUpperCase(Locale.ROOT);
                    if (teacherClassRepository.existsByClassCode(initialCode)) {
                        initialCode = initialCode + "_" + System.currentTimeMillis() % 10000;
                    }
                    TeacherClass newClass = TeacherClass.builder()
                            .teacher(teacher)
                            .name("Lớp của " + teacher.getFullName())
                            .classCode(initialCode)
                            .joinPassword(passwordEncoder.encode("123456"))
                            .build();
                    return teacherClassRepository.save(newClass);
                });

        long count = assignmentRepository.countByTeacherClass_IdAndStatus(
                teacherClass.getId(),
                StudentAssignmentStatus.APPROVED
        );

        return TeacherClassResponse.builder()
                .id(teacherClass.getId())
                .teacherId(teacher.getId())
                .teacherName(teacher.getFullName())
                .name(teacherClass.getName())
                .classCode(teacherClass.getClassCode())
                .studentCount(count)
                .hasPassword(StringUtils.hasText(teacherClass.getJoinPassword()))
                .createdAt(teacherClass.getCreatedAt())
                .build();
    }

    @Override
    @Transactional
    public TeacherClassResponse updateCurrentTeacherClass(UpdateTeacherClassRequest request) {
        User teacher = currentUserService.getCurrentUser();
        TeacherClass teacherClass = teacherClassRepository.findByTeacher_Id(teacher.getId())
                .orElseGet(() -> TeacherClass.builder()
                        .teacher(teacher)
                        .name(request.getName().trim())
                        .classCode(request.getClassCode().trim().toUpperCase(Locale.ROOT))
                        .joinPassword(passwordEncoder.encode("123456"))
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
        if (StringUtils.hasText(request.getPassword())) {
            teacherClass.setJoinPassword(passwordEncoder.encode(request.getPassword().trim()));
        }

        TeacherClass saved = teacherClassRepository.save(teacherClass);
        long count = assignmentRepository.countByTeacherClass_IdAndStatus(
                saved.getId(),
                StudentAssignmentStatus.APPROVED
        );

        return TeacherClassResponse.builder()
                .id(saved.getId())
                .teacherId(teacher.getId())
                .teacherName(teacher.getFullName())
                .name(saved.getName())
                .classCode(saved.getClassCode())
                .studentCount(count)
                .hasPassword(true)
                .createdAt(saved.getCreatedAt())
                .build();
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

        boolean isAdmin = "ADMIN".equalsIgnoreCase(currentUser.getRole().getName());
        if (!isAdmin && !assignment.getTeacher().getId().equals(currentUser.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bạn không có quyền duyệt yêu cầu của giáo viên khác");
        }

        assignment.setStatus(request.getStatus());
        assignment.setReviewedAt(LocalDateTime.now());
        assignment.setReviewedBy(currentUser);
        assignment.setDecisionNote(request.getDecisionNote());

        StudentTeacherAssignment saved = assignmentRepository.save(assignment);
        return toAssignmentResponse(saved);
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
