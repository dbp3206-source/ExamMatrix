package com.exammatrix.backend.repository;

import com.exammatrix.backend.entity.StudentNameWarning;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface StudentNameWarningRepository extends JpaRepository<StudentNameWarning, UUID> {
    List<StudentNameWarning> findByStudent_IdOrderByCreatedAtDesc(UUID studentId);

    Optional<StudentNameWarning> findByIdAndStudent_Id(UUID id, UUID studentId);

    long countByStudent_IdAndReadFalse(UUID studentId);
}
