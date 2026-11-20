package com.exammatrix.backend.repository;

import com.exammatrix.backend.entity.StudentAttemptAnswer;
import com.exammatrix.backend.entity.enums.AttemptStatus;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Collection;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface StudentAttemptAnswerRepository extends JpaRepository<StudentAttemptAnswer, UUID> {
    @EntityGraph(attributePaths = {"question", "choices"})
    List<StudentAttemptAnswer> findByAttempt_Id(UUID attemptId);

    @EntityGraph(attributePaths = {"question", "choices"})
    Optional<StudentAttemptAnswer> findByAttempt_IdAndQuestion_Id(UUID attemptId, UUID questionId);

    @EntityGraph(attributePaths = {"attempt", "question", "question.chapter", "question.chapter.subject"})
    List<StudentAttemptAnswer> findByAttempt_IdInAndAttempt_StatusAndIsCorrectIsNotNullAndChoicesIsNotEmpty(
            Collection<UUID> attemptIds,
            AttemptStatus status
    );

    @EntityGraph(attributePaths = {"attempt", "attempt.student", "attempt.examPaper", "question", "question.chapter", "choices"})
    List<StudentAttemptAnswer> findByAttempt_IdIn(Collection<UUID> attemptIds);
}
