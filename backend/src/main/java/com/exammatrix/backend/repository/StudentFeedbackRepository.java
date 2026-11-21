package com.exammatrix.backend.repository;

import com.exammatrix.backend.entity.StudentFeedback;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface StudentFeedbackRepository extends JpaRepository<StudentFeedback, UUID> {
    @EntityGraph(attributePaths = {"student", "recipients", "recipients.teacher"})
    List<StudentFeedback> findByStudent_IdOrderByCreatedAtDesc(UUID studentId);

    @EntityGraph(attributePaths = {"student", "recipients", "recipients.teacher"})
    List<StudentFeedback> findAllByOrderByCreatedAtDesc();

    long countByReadByAdminFalse();
}
