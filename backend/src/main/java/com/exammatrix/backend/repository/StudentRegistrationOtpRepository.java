package com.exammatrix.backend.repository;

import com.exammatrix.backend.entity.StudentRegistrationOtp;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface StudentRegistrationOtpRepository extends JpaRepository<StudentRegistrationOtp, UUID> {
    Optional<StudentRegistrationOtp> findByEmailIgnoreCase(String email);

    void deleteByEmailIgnoreCase(String email);
}
