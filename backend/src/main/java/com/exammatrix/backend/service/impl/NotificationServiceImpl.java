package com.exammatrix.backend.service.impl;

import com.exammatrix.backend.dto.response.NotificationSummaryResponse;
import com.exammatrix.backend.entity.User;
import com.exammatrix.backend.entity.enums.StudentAssignmentStatus;
import com.exammatrix.backend.repository.StudentFeedbackRecipientRepository;
import com.exammatrix.backend.repository.StudentFeedbackRepository;
import com.exammatrix.backend.repository.StudentNameWarningRepository;
import com.exammatrix.backend.repository.StudentTeacherAssignmentRepository;
import com.exammatrix.backend.security.CurrentUserService;
import com.exammatrix.backend.security.RolePolicy;
import com.exammatrix.backend.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class NotificationServiceImpl implements NotificationService {
    private final StudentTeacherAssignmentRepository assignmentRepository;
    private final StudentFeedbackRepository feedbackRepository;
    private final StudentFeedbackRecipientRepository recipientRepository;
    private final StudentNameWarningRepository nameWarningRepository;
    private final CurrentUserService currentUserService;

    @Override
    public NotificationSummaryResponse getSummary() {
        User user = currentUserService.getCurrentUser();
        String role = user.getRole().getName().toUpperCase(Locale.ROOT);

        if (RolePolicy.TEACHER.equals(role)) {
            long pendingRequests = assignmentRepository.countByTeacher_IdAndStatus(
                    user.getId(), StudentAssignmentStatus.PENDING);
            long unreadFeedbacks = recipientRepository.countByTeacher_IdAndReadFalse(user.getId());
            return new NotificationSummaryResponse(role, pendingRequests, unreadFeedbacks, 0L, List.of());
        }

        if (RolePolicy.STUDENT.equals(role)) {
            List<NotificationSummaryResponse.ApprovedClassNotification> approvedClasses = assignmentRepository
                    .findByStudent_IdAndStatusOrderByReviewedAtDesc(user.getId(), StudentAssignmentStatus.APPROVED)
                    .stream()
                    .map(a -> new NotificationSummaryResponse.ApprovedClassNotification(
                            a.getId(),
                            a.getTeacherClass() != null ? a.getTeacherClass().getName() : "Lớp học",
                            a.getTeacherClass() != null ? a.getTeacherClass().getClassCode() : null,
                            a.getTeacher() != null ? a.getTeacher().getFullName() : "Giáo viên",
                            a.getReviewedAt() != null ? a.getReviewedAt() : a.getRequestedAt()
                    ))
                    .toList();
            long unreadWarnings = nameWarningRepository.countByStudent_IdAndReadFalse(user.getId());
            return new NotificationSummaryResponse(role, 0L, 0L, unreadWarnings, approvedClasses);
        }

        if (RolePolicy.isContentStaff(role)) {
            long unreadFeedbacks = feedbackRepository.countByReadByAdminFalse();
            return new NotificationSummaryResponse(role, 0L, unreadFeedbacks, 0L, List.of());
        }

        return new NotificationSummaryResponse(role, 0L, 0L, 0L, List.of());
    }
}
