package com.exammatrix.backend.repository;

import com.exammatrix.backend.entity.StudentFeedbackRecipient;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface StudentFeedbackRecipientRepository extends JpaRepository<StudentFeedbackRecipient, UUID> {
    @EntityGraph(attributePaths = {"feedback", "feedback.student", "teacher", "teacherClass"})
    List<StudentFeedbackRecipient> findByTeacher_IdOrderByFeedback_CreatedAtDesc(UUID teacherId);

    @EntityGraph(attributePaths = {"feedback", "feedback.student", "teacher", "teacherClass"})
    Optional<StudentFeedbackRecipient> findByFeedback_IdAndTeacher_Id(UUID feedbackId, UUID teacherId);

    long countByTeacher_IdAndReadFalse(UUID teacherId);
}
