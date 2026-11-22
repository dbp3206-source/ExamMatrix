package com.exammatrix.backend.service.impl;

import com.exammatrix.backend.dto.request.CreateStudentNameWarningRequest;
import com.exammatrix.backend.dto.response.StudentNameWarningResponse;
import com.exammatrix.backend.entity.StudentNameWarning;
import com.exammatrix.backend.entity.User;
import com.exammatrix.backend.repository.StudentNameWarningRepository;
import com.exammatrix.backend.repository.UserRepository;
import com.exammatrix.backend.security.CurrentUserService;
import com.exammatrix.backend.security.RolePolicy;
import com.exammatrix.backend.service.EmailService;
import com.exammatrix.backend.service.StudentNameWarningService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class StudentNameWarningServiceImpl implements StudentNameWarningService {
    private final StudentNameWarningRepository warningRepository;
    private final UserRepository userRepository;
    private final CurrentUserService currentUserService;
    private final EmailService emailService;

    @Override
    @Transactional
    public StudentNameWarningResponse sendWarning(UUID studentId, CreateStudentNameWarningRequest request) {
        User sender = currentUserService.getCurrentUser();
        if (!RolePolicy.isUserManager(sender)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bạn không có quyền gửi cảnh báo đổi tên");
        }

        User student = userRepository.findById(studentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy tài khoản học sinh"));

        if (!RolePolicy.isStudent(student)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Chỉ có thể gửi cảnh báo đổi tên cho tài khoản học sinh");
        }

        String trimmedReason = request.getReason().trim();
        StudentNameWarning warning = StudentNameWarning.builder()
                .student(student)
                .sender(sender)
                .senderName(sender.getFullName())
                .reason(trimmedReason)
                .read(false)
                .build();

        StudentNameWarning saved = warningRepository.save(warning);
        boolean emailDelivered = emailService.sendNameWarningEmail(
                student.getEmail(),
                student.getFullName(),
                trimmedReason,
                sender.getFullName()
        );
        return toResponse(saved, emailDelivered);
    }

    @Override
    public List<StudentNameWarningResponse> getWarningsForStudent(UUID studentId) {
        User caller = currentUserService.getCurrentUser();
        if (!RolePolicy.isUserManager(caller)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bạn không có quyền xem lịch sử cảnh báo");
        }

        User student = userRepository.findById(studentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy tài khoản học sinh"));

        if (!RolePolicy.isStudent(student)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Tài khoản này không phải học sinh");
        }

        return warningRepository.findByStudent_IdOrderByCreatedAtDesc(studentId).stream()
                .map(w -> toResponse(w, false))
                .toList();
    }

    @Override
    public List<StudentNameWarningResponse> getMyWarnings() {
        User student = currentUserService.getCurrentUser();
        if (!RolePolicy.isStudent(student)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Chỉ học sinh mới có danh sách cảnh báo đổi tên");
        }

        return warningRepository.findByStudent_IdOrderByCreatedAtDesc(student.getId()).stream()
                .map(w -> toResponse(w, false))
                .toList();
    }

    @Override
    @Transactional
    public StudentNameWarningResponse markMyWarningAsRead(UUID warningId) {
        User student = currentUserService.getCurrentUser();
        if (!RolePolicy.isStudent(student)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Chỉ học sinh mới có thể đánh dấu đã đọc cảnh báo");
        }

        StudentNameWarning warning = warningRepository.findByIdAndStudent_Id(warningId, student.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy cảnh báo đổi tên"));

        if (!warning.isRead()) {
            warning.setRead(true);
            warning = warningRepository.save(warning);
        }
        return toResponse(warning, false);
    }

    private StudentNameWarningResponse toResponse(StudentNameWarning w, boolean emailDelivered) {
        return new StudentNameWarningResponse(
                w.getId(),
                w.getStudent().getId(),
                w.getStudent().getUsername(),
                w.getStudent().getFullName(),
                w.getSender().getId(),
                w.getSenderName(),
                w.getReason(),
                w.isRead(),
                w.getCreatedAt(),
                emailDelivered
        );
    }
}
