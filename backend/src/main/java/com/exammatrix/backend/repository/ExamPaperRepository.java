package com.exammatrix.backend.repository;

import com.exammatrix.backend.dto.response.ExamPaperSummaryResponse;
import com.exammatrix.backend.entity.ExamPaper;
import com.exammatrix.backend.entity.enums.ExamAccessType;
import com.exammatrix.backend.entity.enums.ExamType;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.Optional;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface ExamPaperRepository extends JpaRepository<ExamPaper, UUID> {
    @Query("""
        SELECT new com.exammatrix.backend.dto.response.ExamPaperSummaryResponse(
            p.id, m.id, m.title, s.id, s.code, s.name, m.examType,
            p.examCode, p.accessType, p.isPublished, p.createdAt, size(p.paperQuestions)
        )
        FROM ExamPaper p
        JOIN p.examMatrix m
        JOIN m.subject s
        WHERE (:teacherId IS NULL OR m.teacher.id = :teacherId)
          AND (:matrixId IS NULL OR m.id = :matrixId)
          AND (:subjectId IS NULL OR s.id = :subjectId)
          AND (:examType IS NULL OR m.examType = :examType)
          AND (:accessType IS NULL OR p.accessType = :accessType)
          AND (:isPublished IS NULL OR p.isPublished = :isPublished)
          AND (:search = '' OR locate(lower(:search),
                lower(concat(p.examCode, ' ', m.title, ' ', s.name, ' ', s.code))) > 0)
        """)
    Page<ExamPaperSummaryResponse> searchExamPaperSummaries(
            @Param("teacherId") UUID teacherId,
            @Param("matrixId") UUID matrixId,
            @Param("subjectId") Integer subjectId,
            @Param("examType") ExamType examType,
            @Param("accessType") ExamAccessType accessType,
            @Param("isPublished") Boolean isPublished,
            @Param("search") String search,
            Pageable pageable);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from ExamPaper p where p.id = :id")
    Optional<ExamPaper> findByIdForUpdate(@Param("id") UUID id);

    @Lock(LockModeType.PESSIMISTIC_READ)
    @Query("select p from ExamPaper p where p.id = :id")
    Optional<ExamPaper> findByIdForAttemptStart(@Param("id") UUID id);

    @Lock(LockModeType.PESSIMISTIC_READ)
    List<ExamPaper> findByExamMatrix_IdAndGenerationRequestIdOrderByCreatedAtAscIdAsc(
            UUID matrixId, UUID generationRequestId);

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

    boolean existsByExamMatrix_Id(UUID matrixId);

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

    @Query(
        value = """
            SELECT p
            FROM ExamPaper p
            JOIN p.examMatrix m
            JOIN m.subject s
            JOIN m.teacher t
            WHERE p.isPublished = true
            AND (:subjectId IS NULL OR s.id = :subjectId)
            AND (:search = '' OR locate(lower(:search), lower(concat(p.examCode, ' ', m.title, ' ', s.name))) > 0)
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
            ORDER BY
                CASE WHEN :sortKey = 'publishedAt_desc' THEN COALESCE(p.publishedAt, p.createdAt) END DESC,
                CASE WHEN :sortKey = 'publishedAt_asc' THEN COALESCE(p.publishedAt, p.createdAt) END ASC,
                CASE WHEN :sortKey = 'title_asc' THEN lower(m.title) END ASC,
                CASE WHEN :sortKey = 'title_desc' THEN lower(m.title) END DESC,
                CASE WHEN :sortKey = 'examCode_asc' THEN lower(p.examCode) END ASC,
                CASE WHEN :sortKey = 'examCode_desc' THEN lower(p.examCode) END DESC,
                CASE WHEN :sortKey = 'duration_asc' THEN m.duration END ASC,
                CASE WHEN :sortKey = 'duration_desc' THEN m.duration END DESC,
                COALESCE(p.publishedAt, p.createdAt) DESC,
                p.id DESC
            """,
        countQuery = """
            SELECT count(p)
            FROM ExamPaper p
            JOIN p.examMatrix m
            JOIN m.subject s
            JOIN m.teacher t
            WHERE p.isPublished = true
            AND (:subjectId IS NULL OR s.id = :subjectId)
            AND (:search = '' OR locate(lower(:search), lower(concat(p.examCode, ' ', m.title, ' ', s.name))) > 0)
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
    Page<ExamPaper> searchAccessiblePapersForStudent(
            @Param("studentId") UUID studentId,
            @Param("subjectId") Integer subjectId,
            @Param("search") String search,
            @Param("sortKey") String sortKey,
            Pageable pageable
    );

    @Query("""
        SELECT s.id, s.code, s.name, COUNT(p)
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
        GROUP BY s.id, s.code, s.name
        ORDER BY lower(s.name) ASC
        """)
    List<Object[]> countAccessiblePapersBySubjectForStudent(@Param("studentId") UUID studentId);

    @Override
    @EntityGraph(attributePaths = {
            "examMatrix",
            "examMatrix.teacher",
            "paperQuestions",
            "paperQuestions.question"
    })
    Optional<ExamPaper> findById(UUID id);

    long countByExamMatrix_Teacher_Id(UUID teacherId);

    @Query("""
        SELECT p.accessType, p.isPublished, COUNT(p)
        FROM ExamPaper p
        GROUP BY p.accessType, p.isPublished
        ORDER BY p.accessType, p.isPublished
        """)
    List<Object[]> countByVisibilityState();

    @Query(value = """
        SELECT EXTRACT(YEAR FROM created_at), EXTRACT(MONTH FROM created_at), COUNT(*)
        FROM exam_papers
        WHERE created_at >= :from
        GROUP BY EXTRACT(YEAR FROM created_at), EXTRACT(MONTH FROM created_at)
        ORDER BY EXTRACT(YEAR FROM created_at), EXTRACT(MONTH FROM created_at)
        """, nativeQuery = true)
    List<Object[]> countCreatedByMonthSince(@Param("from") LocalDateTime from);

    @EntityGraph(attributePaths = {
            "examMatrix",
            "paperQuestions",
            "paperQuestions.question",
            "paperQuestions.question.chapter"
    })
    List<ExamPaper> findByGenerationRequestIdIn(Collection<UUID> generationRequestIds);

    @Query("""
        SELECT p.examMatrix.teacher.id, p.generationRequestId, p.id, COALESCE(p.publishedAt, p.createdAt)
        FROM ExamPaper p
        WHERE p.isPublished = true
        """)
    List<Object[]> findPublishedPapersForBatchCounting();
}
