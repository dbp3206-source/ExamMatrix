package com.exammatrix.backend.entity;

import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

@Entity
@Table(
        name = "student_feedback_recipients",
        uniqueConstraints = @UniqueConstraint(
                name = "uq_student_feedback_recipient",
                columnNames = {"feedback_id", "teacher_id"}
        )
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StudentFeedbackRecipient {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "feedback_id", nullable = false)
    private StudentFeedback feedback;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "teacher_id", nullable = false)
    private User teacher;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "class_id")
    private TeacherClass teacherClass;

    @Column(name = "class_name", length = 120)
    private String className;

    @Column(name = "is_read", nullable = false)
    @Builder.Default
    private boolean read = false;
}
