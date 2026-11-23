package com.exammatrix.backend.repository;

import com.exammatrix.backend.entity.StudentExamAttempt;
import com.exammatrix.backend.entity.enums.AttemptStatus;
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

import java.math.BigDecimal;
import java.util.Collection;
import java.util.Optional;
import java.util.List;
import java.util.UUID;

@Repository
public interface StudentExamAttemptRepository extends JpaRepository<StudentExamAttempt, UUID> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from StudentExamAttempt a where a.id = :id")
    Optional<StudentExamAttempt> findByIdForUpdate(@Param("id") UUID id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from StudentExamAttempt a where a.student.id = :studentId and a.examPaper.id = :paperId order by a.attemptNumber desc, a.startedAt desc")
    List<StudentExamAttempt> findForStartList(@Param("studentId") UUID studentId, @Param("paperId") UUID paperId);

    @EntityGraph(attributePaths = {"examPaper", "examPaper.examMatrix", "examPaper.examMatrix.subject"})
    List<StudentExamAttempt> findByStudent_IdAndExamPaper_IdOrderByAttemptNumberDescStartedAtDesc(UUID studentId, UUID examPaperId);

    @Query("""
        select a.id from StudentExamAttempt a
        where a.status = :status
          and timestampadd(minute, a.examPaper.examMatrix.duration, a.startedAt) <= :now
        order by a.startedAt, a.id
        """)
    List<UUID> findExpiredIds(@Param("status") AttemptStatus status,
                             @Param("now") java.time.LocalDateTime now, Pageable pageable);

    @EntityGraph(attributePaths = {"examPaper", "examPaper.examMatrix", "examPaper.examMatrix.subject"})
    Optional<StudentExamAttempt> findByStudent_IdAndExamPaper_Id(UUID studentId, UUID examPaperId);

    boolean existsByStudent_IdAndExamPaper_Id(UUID studentId, UUID examPaperId);

    boolean existsByExamPaper_Id(UUID examPaperId);

    @EntityGraph(attributePaths = {"examPaper", "examPaper.examMatrix", "student"})
    Page<StudentExamAttempt> findByTeacher_IdAndStatus(UUID teacherId, AttemptStatus status, Pageable pageable);

    @EntityGraph(attributePaths = {"examPaper", "examPaper.examMatrix", "student"})
    Page<StudentExamAttempt> findByStatus(AttemptStatus status, Pageable pageable);

    @EntityGraph(attributePaths = {"examPaper", "examPaper.examMatrix", "student"})
    Page<StudentExamAttempt> findByTeacher_IdAndStatusAndExamPaper_ExamMatrix_ExamType(
            UUID teacherId,
            AttemptStatus status,
            ExamType examType,
            Pageable pageable
    );

    @EntityGraph(attributePaths = {"examPaper", "examPaper.examMatrix", "student"})
    Page<StudentExamAttempt> findByStatusAndExamPaper_ExamMatrix_ExamType(
            AttemptStatus status,
            ExamType examType,
            Pageable pageable
    );

    @EntityGraph(attributePaths = {"examPaper", "examPaper.examMatrix", "examPaper.examMatrix.subject"})
    Page<StudentExamAttempt> findByTeacher_IdAndStatusAndScoreIsNotNullAndMaxScoreGreaterThanOrderByGradedAtDesc(
            UUID teacherId,
            AttemptStatus status,
            BigDecimal minimumMaxScore,
            Pageable pageable
    );

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

    @EntityGraph(attributePaths = {
        "examPaper",
        "examPaper.examMatrix",
        "examPaper.examMatrix.subject",
        "student"
    })
    @Query("""
        select a from StudentExamAttempt a
        where a.teacher.id = :teacherId
          and a.teacherClass.id = :classId
          and a.examPaper.examMatrix.subject.id = :subjectId
          and a.examPaper.examMatrix.examType = :examType
          and a.examPaper.generationRequestId is not null
          and a.status in :statuses
        """)
    List<StudentExamAttempt> findComparableAttemptsForAdvice(
            @Param("teacherId") UUID teacherId,
            @Param("classId") UUID classId,
            @Param("subjectId") Integer subjectId,
            @Param("examType") ExamType examType,
            @Param("statuses") Collection<AttemptStatus> statuses
    );

    @EntityGraph(attributePaths = {
        "examPaper",
        "examPaper.examMatrix",
        "examPaper.examMatrix.subject"
    })
    @Query("""
        SELECT a FROM StudentExamAttempt a
        WHERE a.teacher.id = :teacherId
          AND a.status = com.exammatrix.backend.entity.enums.AttemptStatus.COMPLETED
          AND a.score IS NOT NULL
          AND a.maxScore IS NOT NULL
          AND a.maxScore > 0
          AND COALESCE(a.gradedAt, a.submittedAt, a.startedAt) >= :since
        ORDER BY COALESCE(a.gradedAt, a.submittedAt, a.startedAt) DESC
        """)
    List<StudentExamAttempt> findCompletedForTeacherHistogramAllSubjects(
            @Param("teacherId") UUID teacherId,
            @Param("since") java.time.LocalDateTime since
    );

    @EntityGraph(attributePaths = {
        "examPaper",
        "examPaper.examMatrix",
        "examPaper.examMatrix.subject"
    })
    @Query("""
        SELECT a FROM StudentExamAttempt a
        WHERE a.teacher.id = :teacherId
          AND a.status = com.exammatrix.backend.entity.enums.AttemptStatus.COMPLETED
          AND a.score IS NOT NULL
          AND a.maxScore IS NOT NULL
          AND a.maxScore > 0
          AND a.examPaper.examMatrix.subject.id = :subjectId
          AND COALESCE(a.gradedAt, a.submittedAt, a.startedAt) >= :since
        ORDER BY COALESCE(a.gradedAt, a.submittedAt, a.startedAt) DESC
        """)
    List<StudentExamAttempt> findCompletedForTeacherHistogramBySubject(
            @Param("teacherId") UUID teacherId,
            @Param("subjectId") Integer subjectId,
            @Param("since") java.time.LocalDateTime since
    );

    @EntityGraph(attributePaths = {
        "examPaper",
        "examPaper.examMatrix",
        "examPaper.examMatrix.subject",
        "student",
        "teacher",
        "gradedBy",
        "teacherClass"
    })
    @Query("""
        SELECT a FROM StudentExamAttempt a
        WHERE a.status = com.exammatrix.backend.entity.enums.AttemptStatus.COMPLETED
        """)
    List<StudentExamAttempt> findAllCompletedWithDetails();

    @EntityGraph(attributePaths = {
        "examPaper",
        "examPaper.examMatrix",
        "examPaper.examMatrix.subject",
        "student",
        "teacher",
        "gradedBy",
        "teacherClass"
    })
    @Query("""
        SELECT DISTINCT a FROM StudentExamAttempt a
        LEFT JOIN a.answers ans
        WHERE a.status = com.exammatrix.backend.entity.enums.AttemptStatus.COMPLETED
          AND a.examPaper.examMatrix.examType = com.exammatrix.backend.entity.enums.ExamType.ESSAY
          AND (
              a.gradedBy.id = :graderId
              OR ans.gradedBy.id = :graderId
          )
        """)
    List<StudentExamAttempt> findEssayAttemptsGradedBy(@Param("graderId") UUID graderId);

    @EntityGraph(attributePaths = {
        "examPaper",
        "examPaper.examMatrix",
        "examPaper.examMatrix.subject",
        "student",
        "teacher",
        "teacherClass"
    })
    @Query("""
        SELECT a FROM StudentExamAttempt a
        WHERE a.status = com.exammatrix.backend.entity.enums.AttemptStatus.COMPLETED
          AND a.examPaper.examMatrix.examType = com.exammatrix.backend.entity.enums.ExamType.OBJECTIVE
        """)
    List<StudentExamAttempt> findAllCompletedObjectiveAttempts();

    @EntityGraph(attributePaths = {
        "examPaper",
        "examPaper.examMatrix",
        "examPaper.examMatrix.subject",
        "student",
        "teacher",
        "gradedBy",
        "teacherClass"
    })
    @Query("""
        SELECT DISTINCT a FROM StudentExamAttempt a
        WHERE a.teacher.id = :teacherId
           OR a.teacherClass.teacher.id = :teacherId
           OR a.student.id IN :studentIds
        """)
    List<StudentExamAttempt> findTeacherVisibleAttempts(
            @Param("teacherId") UUID teacherId,
            @Param("studentIds") Collection<UUID> studentIds
    );
}
