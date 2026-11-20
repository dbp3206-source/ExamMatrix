package com.exammatrix.backend.repository;

import com.exammatrix.backend.entity.ExamGenerationRequest;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ExamGenerationRequestRepository extends JpaRepository<ExamGenerationRequest, UUID> {
    Optional<ExamGenerationRequest> findByExamMatrix_IdAndRequestId(UUID matrixId, UUID requestId);

    List<ExamGenerationRequest> findByRequestIdIn(Collection<UUID> requestIds);
}
