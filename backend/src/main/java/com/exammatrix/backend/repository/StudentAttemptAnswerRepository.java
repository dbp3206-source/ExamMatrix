package com.exammatrix.backend.repository;

import com.exammatrix.backend.entity.StudentAttemptAnswer;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface StudentAttemptAnswerRepository extends JpaRepository<StudentAttemptAnswer, UUID> {
    @EntityGraph(attributePaths = {"question", "choices"})
    List<StudentAttemptAnswer> findByAttempt_Id(UUID attemptId);

    @EntityGraph(attributePaths = {"question", "choices"})
    Optional<StudentAttemptAnswer> findByAttempt_IdAndQuestion_Id(UUID attemptId, UUID questionId);
}
