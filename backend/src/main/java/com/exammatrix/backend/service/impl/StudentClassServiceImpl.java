package com.exammatrix.backend.service.impl;

import com.exammatrix.backend.dto.request.JoinClassRequest;
import com.exammatrix.backend.dto.response.StudentAssignmentResponse;
import com.exammatrix.backend.dto.response.StudentClassDiscoveryResponse;
import com.exammatrix.backend.dto.response.UserResponse;
import com.exammatrix.backend.entity.StudentTeacherAssignment;
import com.exammatrix.backend.entity.TeacherClass;
import com.exammatrix.backend.entity.User;
import com.exammatrix.backend.entity.enums.ClassJoinMode;
import com.exammatrix.backend.entity.enums.StudentAssignmentStatus;
import com.exammatrix.backend.entity.enums.UserStatus;
import com.exammatrix.backend.repository.StudentTeacherAssignmentRepository;
import com.exammatrix.backend.repository.TeacherClassRepository;
import com.exammatrix.backend.repository.UserRepository;
import com.exammatrix.backend.security.CurrentUserService;
import com.exammatrix.backend.service.StudentClassService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class StudentClassServiceImpl implements StudentClassService {
    private final UserRepository userRepository;
    private final TeacherClassRepository teacherClassRepository;
    private final StudentTeacherAssignmentRepository assignmentRepository;
    private final CurrentUserService currentUserService;
    private final PasswordEncoder passwordEncoder;

    @Override
    public List<UserResponse> getAvailableTeachers() {
        currentUserService.getCurrentUser();
        return userRepository.findByRole_NameIgnoreCaseAndStatusOrderByFullNameAsc("TEACHER", UserStatus.ACTIVE).stream()
                .map(u -> new UserResponse(
                        u.getId(),
                        u.getUsername(),
                        u.getEmail(),
                        u.getFullName(),
                        u.getRole().getName(),
                        u.getStatus(),
                        u.getCreatedAt(),
                        u.getUpdatedAt()
                ))
                .toList();
    }

    @Override
    public StudentAssignmentResponse getCurrentAssignment() {
        User student = currentUserService.getCurrentUser();

        return assignmentRepository.findFirstByStudent_IdAndStatusOrderByRequestedAtDesc(
                        student.getId(), StudentAssignmentStatus.APPROVED)
                .or(() -> assignmentRepository.findFirstByStudent_IdAndStatusOrderByRequestedAtDesc(
                        student.getId(), StudentAssignmentStatus.PENDING))
                .or(() -> assignmentRepository.findFirstByStudent_IdOrderByRequestedAtDesc(student.getId()))
                .map(this::toAssignmentResponse)
                .orElse(null);
    }

    @Override
    public StudentClassDiscoveryResponse getClassDiscovery() {
        User student = currentUserService.getCurrentUser();
        List<StudentTeacherAssignment> allHistory = assignmentRepository
                .findByStudent_IdOrderByRequestedAtDesc(student.getId());

        List<StudentAssignmentResponse> approvedClasses = allHistory.stream()
                .filter(a -> a.getStatus() == StudentAssignmentStatus.APPROVED)
                .map(this::toAssignmentResponse)
                .toList();

        List<StudentAssignmentResponse> pendingRequests = allHistory.stream()
                .filter(a -> a.getStatus() == StudentAssignmentStatus.PENDING)
                .map(this::toAssignmentResponse)
                .toList();

        StudentAssignmentResponse activeAssignment = approvedClasses.isEmpty() ? null : approvedClasses.get(0);
        StudentAssignmentResponse pendingAssignment = pendingRequests.isEmpty() ? null : pendingRequests.get(0);

        StudentAssignmentResponse latestAssignment = allHistory.stream()
                .findFirst()
                .map(this::toAssignmentResponse)
                .orElse(null);

        List<StudentAssignmentResponse> history = allHistory.stream()
                .limit(20)
                .map(this::toAssignmentResponse)
                .toList();

        Set<UUID> approvedTeacherIds = approvedClasses.stream()
                .map(StudentAssignmentResponse::getTeacherId)
                .collect(Collectors.toSet());

        Set<UUID> pendingTeacherIds = pendingRequests.stream()
                .map(StudentAssignmentResponse::getTeacherId)
                .collect(Collectors.toSet());

        List<StudentClassDiscoveryResponse.DiscoverableClassItem> availableClasses = teacherClassRepository
                .findAllByOrderByNameAsc()
                .stream()
                .filter(tc -> tc.getTeacher() != null
                        && "TEACHER".equalsIgnoreCase(tc.getTeacher().getRole().getName())
                        && tc.getTeacher().getStatus() == UserStatus.ACTIVE
                        && tc.isJoinEnabled())
                .map(tc -> new StudentClassDiscoveryResponse.DiscoverableClassItem(
                        tc.getId(),
                        tc.getName(),
                        tc.getClassCode(),
                        tc.getTeacher().getId(),
                        tc.getTeacher().getFullName(),
                        tc.effectiveJoinMode(),
                        tc.requiresPassword(),
                        assignmentRepository.countByTeacherClass_IdAndStatus(tc.getId(), StudentAssignmentStatus.APPROVED),
                        approvedTeacherIds.contains(tc.getTeacher().getId()),
                        pendingTeacherIds.contains(tc.getTeacher().getId())
                ))
                .toList();

        return new StudentClassDiscoveryResponse(
                activeAssignment,
                pendingAssignment,
                latestAssignment,
                approvedClasses,
                pendingRequests,
                history,
                availableClasses
        );
    }

    @Override
    @Transactional
    public StudentAssignmentResponse joinClass(JoinClassRequest request) {
        User student = currentUserService.getCurrentUserForUpdate();

        Optional<TeacherClass> selectedClass = Optional.empty();
        if (StringUtils.hasText(request.getClassCode())) {
            selectedClass = teacherClassRepository.findByClassCode(request.getClassCode().trim().toUpperCase(Locale.ROOT));
        } else if (request.getTeacherId() != null) {
            selectedClass = teacherClassRepository.findByTeacher_Id(request.getTeacherId());
        }
        TeacherClass teacherClass = selectedClass.orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy lớp học hoặc giáo viên tương ứng"));
        User teacher = teacherClass.getTeacher();
        if ((request.getTeacherId() != null && !request.getTeacherId().equals(teacher.getId()))
                || !"TEACHER".equalsIgnoreCase(teacher.getRole().getName()) || teacher.getStatus() != UserStatus.ACTIVE) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy lớp học phù hợp");
        }
        if (teacher.getId().equals(student.getId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Giáo viên không thể tham gia lớp của chính mình");
        }

        ClassJoinMode mode = teacherClass.effectiveJoinMode();
        if (mode == ClassJoinMode.CLOSED || !teacherClass.isJoinEnabled()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Lớp học hiện đang đóng nhận yêu cầu tham gia");
        }

        if (mode == ClassJoinMode.REQUEST_WITH_PASSWORD) {
            String rawPassword = request.getPassword();
            if (!StringUtils.hasText(rawPassword)
                    || "123456".equals(rawPassword.trim())
                    || teacherClass.getJoinPassword() == null
                    || !passwordEncoder.matches(rawPassword, teacherClass.getJoinPassword())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Mật khẩu lớp học không chính xác");
            }
        }

        Optional<StudentTeacherAssignment> existingApprovedOpt = assignmentRepository
                .findFirstByStudent_IdAndTeacher_IdAndStatusOrderByRequestedAtDesc(
                        student.getId(), teacher.getId(), StudentAssignmentStatus.APPROVED);
        if (existingApprovedOpt.isPresent()) {
            return toAssignmentResponse(existingApprovedOpt.get());
        }

        Optional<StudentTeacherAssignment> existingPendingOpt = assignmentRepository
                .findFirstByStudent_IdAndTeacher_IdAndStatusOrderByRequestedAtDesc(
                        student.getId(), teacher.getId(), StudentAssignmentStatus.PENDING);
        if (existingPendingOpt.isPresent()) {
            return toAssignmentResponse(existingPendingOpt.get());
        }

        String note = mode == ClassJoinMode.REQUEST_WITH_PASSWORD
                ? "Gửi yêu cầu tham gia lớp bằng mật khẩu"
                : "Gửi yêu cầu tham gia lớp mở";

        StudentTeacherAssignment newAssignment = StudentTeacherAssignment.builder()
                .student(student)
                .teacher(teacher)
                .teacherClass(teacherClass)
                .status(StudentAssignmentStatus.PENDING)
                .decisionNote(note)
                .build();

        return toAssignmentResponse(assignmentRepository.save(newAssignment));
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
