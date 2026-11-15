package com.exammatrix.backend.service.impl;

import com.exammatrix.backend.dto.request.JoinClassRequest;
import com.exammatrix.backend.dto.response.StudentAssignmentResponse;
import com.exammatrix.backend.dto.response.UserResponse;
import com.exammatrix.backend.entity.StudentTeacherAssignment;
import com.exammatrix.backend.entity.TeacherClass;
import com.exammatrix.backend.entity.User;
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

import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;

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
        return userRepository.findAll().stream()
                .filter(u -> "TEACHER".equalsIgnoreCase(u.getRole().getName()) && u.getStatus() == UserStatus.ACTIVE)
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
        return assignmentRepository.findFirstByStudent_IdOrderByRequestedAtDesc(student.getId())
                .map(this::toAssignmentResponse)
                .orElse(null);
    }

    @Override
    @Transactional
    public StudentAssignmentResponse joinClass(JoinClassRequest request) {
        User student = currentUserService.getCurrentUser();

        TeacherClass teacherClass = null;
        if (StringUtils.hasText(request.getClassCode())) {
            teacherClass = teacherClassRepository.findByClassCode(request.getClassCode().trim().toUpperCase(Locale.ROOT))
                    .orElse(null);
        }

        if (teacherClass == null && request.getTeacherId() != null) {
            teacherClass = teacherClassRepository.findByTeacher_Id(request.getTeacherId())
                    .orElseGet(() -> {
                        User teacher = userRepository.findById(request.getTeacherId())
                                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy giáo viên"));
                        TeacherClass newClass = TeacherClass.builder()
                                .teacher(teacher)
                                .name("Lớp của " + teacher.getFullName())
                                .classCode("CLASS_" + teacher.getUsername().toUpperCase(Locale.ROOT))
                                .joinPassword(passwordEncoder.encode("123456"))
                                .build();
                        return teacherClassRepository.save(newClass);
                    });
        }

        if (teacherClass == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy lớp học hoặc giáo viên tương ứng");
        }

        if (!passwordEncoder.matches(request.getPassword(), teacherClass.getJoinPassword())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Mật khẩu lớp học không chính xác");
        }

        User teacher = teacherClass.getTeacher();
        if (teacher.getId().equals(student.getId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Giáo viên không thể tham gia lớp của chính mình");
        }

        // Check if student has active assignment with another teacher
        List<StudentAssignmentStatus> activeStatuses = List.of(StudentAssignmentStatus.APPROVED, StudentAssignmentStatus.PENDING);
        StudentTeacherAssignment existingActive = assignmentRepository
                .findFirstByStudent_IdAndStatusIn(student.getId(), activeStatuses)
                .orElse(null);

        if (existingActive != null) {
            if (existingActive.getTeacher().getId().equals(teacher.getId())) {
                if (existingActive.getStatus() == StudentAssignmentStatus.APPROVED) {
                    return toAssignmentResponse(existingActive);
                }
                existingActive.setStatus(StudentAssignmentStatus.APPROVED);
                existingActive.setTeacherClass(teacherClass);
                existingActive.setReviewedAt(LocalDateTime.now());
                existingActive.setDecisionNote("Tham gia bằng mật khẩu lớp học");
                return toAssignmentResponse(assignmentRepository.save(existingActive));
            } else {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Bạn hiện đã tham gia lớp của giáo viên " + existingActive.getTeacher().getFullName()
                );
            }
        }

        // Check for any previous revoked/rejected record to avoid duplicate insert violating constraints
        StudentTeacherAssignment previousAssignment = assignmentRepository
                .findFirstByStudent_IdOrderByRequestedAtDesc(student.getId())
                .filter(a -> a.getTeacher().getId().equals(teacher.getId()))
                .orElse(null);

        if (previousAssignment != null) {
            previousAssignment.setStatus(StudentAssignmentStatus.APPROVED);
            previousAssignment.setTeacherClass(teacherClass);
            previousAssignment.setRequestedAt(LocalDateTime.now());
            previousAssignment.setReviewedAt(LocalDateTime.now());
            previousAssignment.setDecisionNote("Tham gia bằng mật khẩu lớp học");
            return toAssignmentResponse(assignmentRepository.save(previousAssignment));
        }

        StudentTeacherAssignment newAssignment = StudentTeacherAssignment.builder()
                .student(student)
                .teacher(teacher)
                .teacherClass(teacherClass)
                .status(StudentAssignmentStatus.APPROVED)
                .decisionNote("Tham gia bằng mật khẩu lớp học")
                .reviewedAt(LocalDateTime.now())
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
