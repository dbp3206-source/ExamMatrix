package com.exammatrix.backend.service.impl;

import com.exammatrix.backend.dto.request.CreateStudentFeedbackRequest;
import com.exammatrix.backend.dto.response.FeedbackInboxResponse;
import com.exammatrix.backend.dto.response.StudentFeedbackResponse;
import com.exammatrix.backend.entity.StudentFeedback;
import com.exammatrix.backend.entity.StudentFeedbackRecipient;
import com.exammatrix.backend.entity.StudentTeacherAssignment;
import com.exammatrix.backend.entity.TeacherClass;
import com.exammatrix.backend.entity.User;
import com.exammatrix.backend.entity.enums.StudentAssignmentStatus;
import com.exammatrix.backend.repository.StudentFeedbackRecipientRepository;
import com.exammatrix.backend.repository.StudentFeedbackRepository;
import com.exammatrix.backend.repository.StudentTeacherAssignmentRepository;
import com.exammatrix.backend.security.CurrentUserService;
import com.exammatrix.backend.service.FeedbackService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class FeedbackServiceImpl implements FeedbackService {
    private final StudentFeedbackRepository feedbackRepository;
    private final StudentFeedbackRecipientRepository recipientRepository;
    private final StudentTeacherAssignmentRepository assignmentRepository;
    private final CurrentUserService currentUserService;

    @Override
    @Transactional
    public StudentFeedbackResponse submitFeedback(CreateStudentFeedbackRequest request) {
        User student = currentUserService.getCurrentUser();
        String trimmedTitle = request.getTitle().trim();
        String trimmedContent = request.getContent().trim();
        if (trimmedTitle.length() < 3) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Tiêu đề phải có ít nhất 3 ký tự");
        }
        if (trimmedContent.length() < 5) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nội dung phải có ít nhất 5 ký tự");
        }

        StudentFeedback feedback = StudentFeedback.builder()
                .student(student)
                .category(request.getCategory())
                .title(trimmedTitle)
                .content(trimmedContent)
                .readByAdmin(false)
                .build();

        List<StudentTeacherAssignment> approvedAssignments = assignmentRepository
                .findByStudent_IdAndStatusOrderByReviewedAtDesc(student.getId(), StudentAssignmentStatus.APPROVED);

        Map<UUID, StudentTeacherAssignment> distinctByTeacher = new LinkedHashMap<>();
        for (StudentTeacherAssignment assignment : approvedAssignments) {
            if (assignment.getTeacher() != null) {
                distinctByTeacher.putIfAbsent(assignment.getTeacher().getId(), assignment);
            }
        }

        List<StudentFeedbackRecipient> recipients = new ArrayList<>();
        for (StudentTeacherAssignment assignment : distinctByTeacher.values()) {
            TeacherClass teacherClass = assignment.getTeacherClass();
            String className = teacherClass != null ? teacherClass.getName() : null;
            recipients.add(StudentFeedbackRecipient.builder()
                    .feedback(feedback)
                    .teacher(assignment.getTeacher())
                    .teacherClass(teacherClass)
                    .className(className)
                    .read(false)
                    .build());
        }
        feedback.getRecipients().addAll(recipients);

        StudentFeedback saved = feedbackRepository.save(feedback);
        return toStudentViewResponse(saved);
    }

    @Override
    public List<StudentFeedbackResponse> getMyFeedbacks() {
        User student = currentUserService.getCurrentUser();
        return feedbackRepository.findByStudent_IdOrderByCreatedAtDesc(student.getId())
                .stream()
                .map(this::toStudentViewResponse)
                .toList();
    }

    @Override
    public FeedbackInboxResponse getInbox() {
        User currentUser = currentUserService.getCurrentUser();
        String role = currentUser.getRole().getName();
        if (com.exammatrix.backend.security.RolePolicy.isContentStaff(role)) {
            List<StudentFeedback> all = feedbackRepository.findAllByOrderByCreatedAtDesc();
            long unread = all.stream().filter(f -> !f.isReadByAdmin()).count();
            List<StudentFeedbackResponse> items = all.stream()
                    .map(this::toAdminViewResponse)
                    .toList();
            return new FeedbackInboxResponse(unread, items);
        }
        if ("TEACHER".equalsIgnoreCase(role)) {
            List<StudentFeedbackRecipient> recipients = recipientRepository
                    .findByTeacher_IdOrderByFeedback_CreatedAtDesc(currentUser.getId());
            long unread = recipients.stream().filter(r -> !r.isRead()).count();
            List<StudentFeedbackResponse> items = recipients.stream()
                    .map(this::toTeacherViewResponse)
                    .toList();
            return new FeedbackInboxResponse(unread, items);
        }
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bạn không có quyền xem hòm thư góp ý");
    }

    @Override
    @Transactional
    public StudentFeedbackResponse markAsRead(UUID feedbackId) {
        User currentUser = currentUserService.getCurrentUser();
        String role = currentUser.getRole().getName();
        if (com.exammatrix.backend.security.RolePolicy.isContentStaff(role)) {
            StudentFeedback feedback = feedbackRepository.findById(feedbackId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy góp ý"));
            if (!feedback.isReadByAdmin()) {
                feedback.setReadByAdmin(true);
                feedbackRepository.save(feedback);
            }
            return toAdminViewResponse(feedback);
        }
        if ("TEACHER".equalsIgnoreCase(role)) {
            StudentFeedbackRecipient recipient = recipientRepository
                    .findByFeedback_IdAndTeacher_Id(feedbackId, currentUser.getId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy góp ý trong hòm thư của bạn"));
            if (!recipient.isRead()) {
                recipient.setRead(true);
                recipientRepository.save(recipient);
            }
            return toTeacherViewResponse(recipient);
        }
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bạn không có quyền cập nhật trạng thái góp ý");
    }

    private StudentFeedbackResponse toStudentViewResponse(StudentFeedback feedback) {
        List<String> labels = feedback.getRecipients().isEmpty()
                ? List.of("Quản trị viên hệ thống")
                : feedback.getRecipients().stream()
                .map(r -> {
                    String teacherName = r.getTeacher() != null ? r.getTeacher().getFullName() : "Giáo viên";
                    return r.getClassName() != null && !r.getClassName().isBlank()
                            ? r.getClassName() + " (GV: " + teacherName + ")"
                            : "GV: " + teacherName;
                })
                .toList();
        boolean readByAnyone = feedback.isReadByAdmin()
                || feedback.getRecipients().stream().anyMatch(StudentFeedbackRecipient::isRead);
        return new StudentFeedbackResponse(
                feedback.getId(),
                feedback.getStudent().getId(),
                feedback.getStudent().getFullName(),
                feedback.getStudent().getEmail(),
                feedback.getCategory(),
                feedback.getTitle(),
                feedback.getContent(),
                readByAnyone,
                labels,
                feedback.getCreatedAt()
        );
    }

    private StudentFeedbackResponse toAdminViewResponse(StudentFeedback feedback) {
        List<String> labels = feedback.getRecipients().isEmpty()
                ? List.of("Chưa tham gia lớp")
                : feedback.getRecipients().stream()
                .map(r -> {
                    String teacherName = r.getTeacher() != null ? r.getTeacher().getFullName() : "Giáo viên";
                    return r.getClassName() != null && !r.getClassName().isBlank()
                            ? r.getClassName() + " (" + teacherName + ")"
                            : teacherName;
                })
                .toList();
        return new StudentFeedbackResponse(
                feedback.getId(),
                feedback.getStudent().getId(),
                feedback.getStudent().getFullName(),
                feedback.getStudent().getEmail(),
                feedback.getCategory(),
                feedback.getTitle(),
                feedback.getContent(),
                feedback.isReadByAdmin(),
                labels,
                feedback.getCreatedAt()
        );
    }

    private StudentFeedbackResponse toTeacherViewResponse(StudentFeedbackRecipient recipient) {
        StudentFeedback feedback = recipient.getFeedback();
        String label = recipient.getClassName() != null && !recipient.getClassName().isBlank()
                ? recipient.getClassName()
                : "Lớp của bạn";
        return new StudentFeedbackResponse(
                feedback.getId(),
                feedback.getStudent().getId(),
                feedback.getStudent().getFullName(),
                feedback.getStudent().getEmail(),
                feedback.getCategory(),
                feedback.getTitle(),
                feedback.getContent(),
                recipient.isRead(),
                List.of(label),
                feedback.getCreatedAt()
        );
    }
}
