package com.exammatrix.backend.repository;

import com.exammatrix.backend.entity.StudentExamAttempt;
import com.exammatrix.backend.entity.enums.AttemptStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface StudentExamAttemptRepository extends JpaRepository<StudentExamAttempt, UUID> {
    @EntityGraph(attributePaths = {"examPaper", "examPaper.examMatrix", "examPaper.examMatrix.subject"})
    Optional<StudentExamAttempt> findByStudent_IdAndExamPaper_Id(UUID studentId, UUID examPaperId);

    boolean existsByStudent_IdAndExamPaper_Id(UUID studentId, UUID examPaperId);

    @EntityGraph(attributePaths = {"examPaper", "examPaper.examMatrix", "student"})
    Page<StudentExamAttempt> findByTeacher_IdAndStatus(UUID teacherId, AttemptStatus status, Pageable pageable);

    @EntityGraph(attributePaths = {"examPaper", "examPaper.examMatrix", "student"})
    Page<StudentExamAttempt> findByStatus(AttemptStatus status, Pageable pageable);

    @EntityGraph(attributePaths = {"examPaper", "examPaper.examMatrix", "examPaper.examMatrix.subject"})
    Page<StudentExamAttempt> findByStudent_Id(UUID studentId, Pageable pageable);

    @Override
    @EntityGraph(attributePaths = {
        "examPaper",
        "examPaper.examMatrix",
        "examPaper.examMatrix.subject",
        "student",
        "teacher",
        "answers",
        "answers.question",
        "answers.choices"
    })
    Optional<StudentExamAttempt> findById(UUID id);
}
