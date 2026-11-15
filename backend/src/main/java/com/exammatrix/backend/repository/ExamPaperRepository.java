package com.exammatrix.backend.repository;

import com.exammatrix.backend.entity.ExamPaper;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface ExamPaperRepository extends JpaRepository<ExamPaper, UUID> {
    @Query("""
        SELECT p
        FROM ExamPaper p
        JOIN p.examMatrix m
        JOIN m.teacher t
        WHERE (
            :matrixId IS NULL
            OR m.id = :matrixId
        )
        AND (
            :teacherId IS NULL
            OR t.id = :teacherId
        )
        """)
    Page<ExamPaper> searchExamPapers(
            @Param("matrixId") UUID matrixId,
            @Param("teacherId") UUID teacherId,
            Pageable pageable
    );

    boolean existsByExamMatrix_IdAndExamCode(
            UUID matrixId,
            String examCode
    );

    @Query(
        value = """
            SELECT p
            FROM ExamPaper p
            JOIN p.examMatrix m
            JOIN m.subject s
            JOIN m.teacher t
            WHERE p.isPublished = true
            AND (
                p.accessType = com.exammatrix.backend.entity.enums.ExamAccessType.PUBLIC
                OR (
                    p.accessType = com.exammatrix.backend.entity.enums.ExamAccessType.PRIVATE
                    AND t.id IN (
                        SELECT a.teacher.id
                        FROM StudentTeacherAssignment a
                        WHERE a.student.id = :studentId
                        AND a.status = com.exammatrix.backend.entity.enums.StudentAssignmentStatus.APPROVED
                    )
                )
            )
            """,
        countQuery = """
            SELECT count(p)
            FROM ExamPaper p
            JOIN p.examMatrix m
            JOIN m.teacher t
            WHERE p.isPublished = true
            AND (
                p.accessType = com.exammatrix.backend.entity.enums.ExamAccessType.PUBLIC
                OR (
                    p.accessType = com.exammatrix.backend.entity.enums.ExamAccessType.PRIVATE
                    AND t.id IN (
                        SELECT a.teacher.id
                        FROM StudentTeacherAssignment a
                        WHERE a.student.id = :studentId
                        AND a.status = com.exammatrix.backend.entity.enums.StudentAssignmentStatus.APPROVED
                    )
                )
            )
            """
    )
    Page<ExamPaper> findAccessiblePapersForStudent(
            @Param("studentId") UUID studentId,
            Pageable pageable
    );

    @Override
    @EntityGraph(attributePaths = {
            "examMatrix",
            "examMatrix.teacher",
            "paperQuestions",
            "paperQuestions.question"
    })
    Optional<ExamPaper> findById(UUID id);

    long countByExamMatrix_Teacher_Id(UUID teacherId);
}