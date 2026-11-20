package com.exammatrix.backend.entity;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

import java.time.LocalDateTime;
import java.util.UUID;

@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "exam_generation_requests", uniqueConstraints =
        @UniqueConstraint(name = "uq_exam_generation_request", columnNames = {"matrix_id", "request_id"}))
public class ExamGenerationRequest {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "matrix_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private ExamMatrix examMatrix;

    @Column(name = "request_id", nullable = false)
    private UUID requestId;

    @Column(name = "number_of_papers", nullable = false)
    private int numberOfPapers;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "allocation_snapshot", columnDefinition = "TEXT")
    private String allocationSnapshot;

    public ExamGenerationRequest(ExamMatrix examMatrix, UUID requestId, int numberOfPapers) {
        this(examMatrix, requestId, numberOfPapers, null);
    }

    public ExamGenerationRequest(ExamMatrix examMatrix, UUID requestId, int numberOfPapers, String allocationSnapshot) {
        this.examMatrix = examMatrix;
        this.requestId = requestId;
        this.numberOfPapers = numberOfPapers;
        this.allocationSnapshot = allocationSnapshot;
        this.createdAt = LocalDateTime.now();
    }
}
