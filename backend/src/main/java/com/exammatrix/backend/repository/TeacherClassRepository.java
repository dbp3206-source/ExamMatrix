package com.exammatrix.backend.repository;

import com.exammatrix.backend.entity.TeacherClass;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface TeacherClassRepository extends JpaRepository<TeacherClass, UUID> {
    Optional<TeacherClass> findByTeacher_Id(UUID teacherId);

    Optional<TeacherClass> findByClassCode(String classCode);

    boolean existsByClassCode(String classCode);

    boolean existsByTeacher_Id(UUID teacherId);
}
