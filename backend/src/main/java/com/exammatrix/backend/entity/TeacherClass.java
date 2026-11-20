package com.exammatrix.backend.entity;

import com.exammatrix.backend.entity.enums.ClassJoinMode;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
@Table(name = "teacher_classes")
public class TeacherClass {
    public static final String JOIN_DISABLED = "!";

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "teacher_id", nullable = false, unique = true)
    private User teacher;

    @Column(name = "name", length = 100, nullable = false)
    private String name;

    @Column(name = "class_code", length = 50, nullable = false, unique = true)
    private String classCode;

    @Enumerated(EnumType.STRING)
    @Column(name = "join_mode", length = 30, nullable = false)
    @Builder.Default
    private ClassJoinMode joinMode = ClassJoinMode.CLOSED;

    @Column(name = "join_password", length = 255)
    private String joinPassword;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public ClassJoinMode effectiveJoinMode() {
        if (joinMode != null && joinMode != ClassJoinMode.CLOSED) {
            return joinMode;
        }

        if (joinMode == ClassJoinMode.CLOSED
                && joinPassword != null
                && !joinPassword.isBlank()
                && !JOIN_DISABLED.equals(joinPassword)
                && joinPassword.startsWith("$2")) {
            return ClassJoinMode.REQUEST_WITH_PASSWORD;
        }
        return joinMode != null ? joinMode : ClassJoinMode.CLOSED;
    }

    public boolean isJoinEnabled() {
        ClassJoinMode mode = effectiveJoinMode();
        if (mode == ClassJoinMode.REQUEST_OPEN) {
            return true;
        }
        if (mode == ClassJoinMode.REQUEST_WITH_PASSWORD) {
            return joinPassword != null && !joinPassword.isBlank() && !JOIN_DISABLED.equals(joinPassword);
        }
        return false;
    }

    public boolean requiresPassword() {
        return effectiveJoinMode() == ClassJoinMode.REQUEST_WITH_PASSWORD;
    }
}
