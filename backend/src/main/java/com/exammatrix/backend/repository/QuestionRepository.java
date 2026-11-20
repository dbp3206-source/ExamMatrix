package com.exammatrix.backend.repository;

import com.exammatrix.backend.entity.Question;
import com.exammatrix.backend.entity.enums.Difficulty;
import com.exammatrix.backend.entity.enums.ExamType;
import com.exammatrix.backend.entity.enums.QuestionType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface QuestionRepository extends JpaRepository<Question, UUID> {
    @Query("""
        SELECT q
        FROM Question q
        JOIN q.chapter c
        JOIN c.subject s
        WHERE (
            :search IS NULL
            OR LOWER(q.content) LIKE LOWER(
                CONCAT('%', CAST(:search AS string), '%')
            )
        )
        AND (
            :subjectId IS NULL
            OR s.id = :subjectId
        )
        AND (
            :chapterId IS NULL
            OR c.id = :chapterId
        )
        AND (
            :difficulty IS NULL
            OR q.difficulty = :difficulty
        )
        AND (
            :type IS NULL
            OR q.type = :type
        )
    """)
    Page<Question> searchQuestions(
        @Param("search") String search,
        @Param("subjectId") Integer subjectId,
        @Param("chapterId") Integer chapterId,
        @Param("difficulty") Difficulty difficulty,
        @Param("type") QuestionType type,
        Pageable pageable
    );

    long countByChapter_IdAndExamTypeAndDifficulty(
            Integer chapterId,
            ExamType examType,
            Difficulty difficulty
    );

    long countByChapter_IdAndDifficultyAndTypeIn(
            Integer chapterId,
            Difficulty difficulty,
            Collection<QuestionType> types
    );

    @EntityGraph(attributePaths = "answers")
    List<Question> findByChapter_IdAndDifficultyAndTypeIn(
            Integer chapterId,
            Difficulty difficulty,
            Collection<QuestionType> types
    );

    @Query("""
        SELECT count(q)
        FROM Question q
        WHERE q.chapter.id = :chapterId
        AND q.difficulty = :difficulty
        AND (
            (:isEssay = true AND q.type = com.exammatrix.backend.entity.enums.QuestionType.ESSAY)
            OR
            (:isEssay = false AND q.type <> com.exammatrix.backend.entity.enums.QuestionType.ESSAY)
        )
    """)
    long countByChapterAndDifficultyAndIsEssay(
            @Param("chapterId") Integer chapterId,
            @Param("difficulty") Difficulty difficulty,
            @Param("isEssay") boolean isEssay
    );

    @Override
    @EntityGraph(attributePaths = {
        "chapter",
        "teacher",
        "answers"
    })
    Optional<Question> findById(UUID id);

    @EntityGraph(attributePaths = "answers")
    List<Question> findAllByChapter_IdAndDifficulty(
            Integer chapterId,
            Difficulty difficulty
    );

    @EntityGraph(attributePaths = "answers")
    @Query("""
        SELECT q
        FROM Question q
        WHERE q.chapter.id = :chapterId
        AND q.difficulty = :difficulty
        AND (
            (:isEssay = true AND q.type = com.exammatrix.backend.entity.enums.QuestionType.ESSAY)
            OR
            (:isEssay = false AND q.type <> com.exammatrix.backend.entity.enums.QuestionType.ESSAY)
        )
    """)
    List<Question> findAllByChapterAndDifficultyAndIsEssay(
            @Param("chapterId") Integer chapterId,
            @Param("difficulty") Difficulty difficulty,
            @Param("isEssay") boolean isEssay
    );

    @EntityGraph(attributePaths = "answers")
    List<Question> findAllByChapter_IdAndDifficultyAndTypeIn(
            Integer chapterId,
            Difficulty difficulty,
            Collection<QuestionType> types
    );

    long countByDifficulty(Difficulty difficulty);

    @Query("""
        SELECT q.type, q.difficulty, COUNT(q)
        FROM Question q
        GROUP BY q.type, q.difficulty
        ORDER BY q.type, q.difficulty
        """)
    List<Object[]> countByTypeAndDifficulty();

    @Query("""
        SELECT s.id, s.name, COUNT(DISTINCT c.id), COUNT(q.id),
               COUNT(DISTINCT CASE WHEN q.id IS NULL THEN c.id ELSE NULL END)
        FROM Subject s
        LEFT JOIN Chapter c ON c.subject = s
        LEFT JOIN Question q ON q.chapter = c
        GROUP BY s.id, s.name
        ORDER BY s.name
        """)
    List<Object[]> summarizeCoverageBySubject();

    boolean existsByChapter_Id(Integer chapterId);

    @Query("""
        SELECT s.id, s.name, COUNT(q.id)
        FROM Question q
        JOIN q.chapter c
        JOIN c.subject s
        WHERE q.teacher.id = :teacherId
        GROUP BY s.id, s.name
        ORDER BY COUNT(q.id) DESC, lower(s.name) ASC
        """)
    List<Object[]> countBySubjectForTeacher(@Param("teacherId") UUID teacherId);

    @Query("""
        SELECT q.difficulty, COUNT(q.id)
        FROM Question q
        JOIN q.chapter c
        WHERE q.teacher.id = :teacherId
          AND c.subject.id = :subjectId
        GROUP BY q.difficulty
        """)
    List<Object[]> countByDifficultyForTeacherAndSubject(
            @Param("teacherId") UUID teacherId,
            @Param("subjectId") Integer subjectId
    );
}
