package com.exammatrix.backend.service;

import com.exammatrix.backend.dto.request.CreateStudentFeedbackRequest;
import com.exammatrix.backend.dto.response.FeedbackInboxResponse;
import com.exammatrix.backend.dto.response.StudentFeedbackResponse;

import java.util.List;
import java.util.UUID;

public interface FeedbackService {
    StudentFeedbackResponse submitFeedback(CreateStudentFeedbackRequest request);

    List<StudentFeedbackResponse> getMyFeedbacks();

    FeedbackInboxResponse getInbox();

    StudentFeedbackResponse markAsRead(UUID feedbackId);
}
