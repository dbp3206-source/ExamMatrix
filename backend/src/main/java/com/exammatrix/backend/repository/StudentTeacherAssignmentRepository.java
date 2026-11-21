package com.exammatrix.backend.repository;

import com.exammatrix.backend.entity.StudentTeacherAssignment;
import com.exammatrix.backend.entity.enums.StudentAssignmentStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface StudentTeacherAssignmentRepository extends JpaRepository<StudentTeacherAssignment, UUID> {
    @EntityGraph(attributePaths = {"teacher", "teacherClass"})
    Optional<StudentTeacherAssignment> findFirstByStudent_IdOrderByRequestedAtDesc(UUID studentId);

    @EntityGraph(attributePaths = {"teacher", "teacherClass"})
    java.util.List<StudentTeacherAssignment> findByStudent_IdOrderByRequestedAtDesc(UUID studentId);

    @EntityGraph(attributePaths = {"teacher", "teacherClass"})
    Optional<StudentTeacherAssignment> findFirstByStudent_IdAndStatusOrderByRequestedAtDesc(
            UUID studentId,
            StudentAssignmentStatus status
    );

    @EntityGraph(attributePaths = {"teacher", "teacherClass"})
    java.util.List<StudentTeacherAssignment> findByStudent_IdAndStatus(
            UUID studentId,
            StudentAssignmentStatus status
    );

    @EntityGraph(attributePaths = {"teacher", "teacherClass"})
    java.util.List<StudentTeacherAssignment> findByStudent_IdAndStatusOrderByReviewedAtDesc(
            UUID studentId,
            StudentAssignmentStatus status
    );

    @EntityGraph(attributePaths = {"teacher", "teacherClass"})
    Optional<StudentTeacherAssignment> findFirstByStudent_IdAndTeacher_IdAndStatusOrderByRequestedAtDesc(
            UUID studentId,
            UUID teacherId,
            StudentAssignmentStatus status
    );

    long countByTeacher_IdAndStatus(UUID teacherId, StudentAssignmentStatus status);

    Optional<StudentTeacherAssignment> findFirstByStudent_IdAndStatusIn(
            UUID studentId,
            Collection<StudentAssignmentStatus> statuses
    );

    @EntityGraph(attributePaths = {"student", "teacherClass"})
    Page<StudentTeacherAssignment> findByTeacher_Id(UUID teacherId, Pageable pageable);

    @EntityGraph(attributePaths = {"student", "teacherClass"})
    Page<StudentTeacherAssignment> findByTeacher_IdAndStatus(
            UUID teacherId,
            StudentAssignmentStatus status,
            Pageable pageable
    );

    boolean existsByStudent_IdAndTeacher_IdAndStatus(
            UUID studentId,
            UUID teacherId,
            StudentAssignmentStatus status
    );

    @EntityGraph(attributePaths = {"teacherClass"})
    Optional<StudentTeacherAssignment> findFirstByStudent_IdAndTeacher_IdAndStatusOrderByReviewedAtDesc(
            UUID studentId,
            UUID teacherId,
            StudentAssignmentStatus status
    );

    long countByTeacherClass_IdAndStatus(UUID classId, StudentAssignmentStatus status);
}
