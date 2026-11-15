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

    long countByTeacherClass_IdAndStatus(UUID classId, StudentAssignmentStatus status);
}
