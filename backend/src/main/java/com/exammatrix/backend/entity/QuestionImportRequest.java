package com.exammatrix.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

import java.time.LocalDateTime;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
@Table(
        name = "question_import_requests",
        uniqueConstraints = @UniqueConstraint(name = "uq_question_import_actor_req", columnNames = {"actor_id", "request_id"})
)
public class QuestionImportRequest {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "actor_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private User actor;

    @Column(name = "request_id", nullable = false)
    private UUID requestId;

    @Column(name = "payload_digest", length = 64, nullable = false)
    private String payloadDigest;

    @Column(name = "created_ids", columnDefinition = "TEXT", nullable = false)
    private String createdIds;

    @Column(name = "created_count", nullable = false)
    private Integer createdCount;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
