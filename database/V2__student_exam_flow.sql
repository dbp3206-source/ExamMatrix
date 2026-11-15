-- Migration for the student exam flow.
-- Run this script once against the existing PostgreSQL database.
-- The backend currently uses spring.jpa.hibernate.ddl-auto=validate,
-- therefore Hibernate will not create these columns/tables for you.

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Keep enum-like values consistent with Java @Enumerated(EnumType.STRING).
UPDATE roles
SET name = UPPER(TRIM(name))
WHERE name IS NOT NULL;

UPDATE users
SET status = UPPER(TRIM(status))
WHERE status IS NOT NULL;

UPDATE questions
SET type = UPPER(TRIM(type)),
    difficulty = UPPER(TRIM(difficulty));

UPDATE matrix_configs
SET difficulty = UPPER(TRIM(difficulty));

-- The student feature needs a STUDENT role. Do not duplicate roles that already exist.
INSERT INTO roles(name)
SELECT required_role.role_name
FROM (VALUES ('ADMIN'), ('TEACHER'), ('STUDENT')) AS required_role(role_name)
WHERE NOT EXISTS (
    SELECT 1
    FROM roles r
    WHERE UPPER(TRIM(r.name)) = required_role.role_name
);

-- Essay questions keep the teacher's reference/rubric text here.
ALTER TABLE questions
    ADD COLUMN IF NOT EXISTS reference_answer TEXT;

-- Ensure answers table has audit timestamps
ALTER TABLE answers
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- A matrix is either objective or essay; it must not mix both kinds.
ALTER TABLE exam_matrices
    ADD COLUMN IF NOT EXISTS exam_type VARCHAR(20);

UPDATE exam_matrices
SET exam_type = 'OBJECTIVE'
WHERE exam_type IS NULL;

ALTER TABLE exam_matrices
    ALTER COLUMN exam_type SET DEFAULT 'OBJECTIVE';

ALTER TABLE exam_matrices
    ALTER COLUMN exam_type SET NOT NULL;

ALTER TABLE roles
    ALTER COLUMN name SET DEFAULT 'TEACHER';

ALTER TABLE users
    ALTER COLUMN status SET DEFAULT 'ACTIVE';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_exam_matrices_exam_type'
    ) THEN
        ALTER TABLE exam_matrices
            ADD CONSTRAINT chk_exam_matrices_exam_type
            CHECK (exam_type IN ('OBJECTIVE', 'ESSAY'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_questions_type'
    ) THEN
        ALTER TABLE questions
            ADD CONSTRAINT chk_questions_type
            CHECK (type IN ('SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE', 'ESSAY'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_questions_reference_answer'
    ) THEN
        ALTER TABLE questions
            ADD CONSTRAINT chk_questions_reference_answer
            CHECK (
                (
                    type = 'ESSAY'
                    AND reference_answer IS NOT NULL
                    AND BTRIM(reference_answer) <> ''
                )
                OR
                (
                    type <> 'ESSAY'
                    AND reference_answer IS NULL
                )
            );
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_questions_type_chapter_difficulty
    ON questions(type, chapter_id, difficulty);

CREATE INDEX IF NOT EXISTS idx_exam_matrices_exam_type
    ON exam_matrices(exam_type);

-- One student can have one current relationship at a time.
CREATE TABLE IF NOT EXISTS student_teacher_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES users(id),
    teacher_id UUID NOT NULL REFERENCES users(id),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    requested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP,
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    decision_note VARCHAR(500),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_student_teacher_assignment_status
        CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'REVOKED')),
    CONSTRAINT chk_student_teacher_not_same_user
        CHECK (student_id <> teacher_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_student_current_teacher
    ON student_teacher_assignments(student_id)
    WHERE status IN ('PENDING', 'APPROVED');

CREATE INDEX IF NOT EXISTS idx_student_teacher_teacher_status
    ON student_teacher_assignments(teacher_id, status);

CREATE INDEX IF NOT EXISTS idx_student_teacher_student_status
    ON student_teacher_assignments(student_id, status);

-- Keep the points of a generated paper question so essay answers can be graded.
ALTER TABLE paper_questions
    ADD COLUMN IF NOT EXISTS points NUMERIC(8, 2) NOT NULL DEFAULT 1;

-- A generated paper code is unique inside its matrix.
CREATE UNIQUE INDEX IF NOT EXISTS uq_exam_papers_matrix_exam_code
    ON exam_papers(matrix_id, exam_code);

-- One row represents one student's attempt at one generated paper.
CREATE TABLE IF NOT EXISTS student_exam_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    exam_paper_id UUID NOT NULL REFERENCES exam_papers(id),
    student_id UUID NOT NULL REFERENCES users(id),
    teacher_id UUID NOT NULL REFERENCES users(id),
    status VARCHAR(30) NOT NULL DEFAULT 'IN_PROGRESS',
    score NUMERIC(8, 2),
    max_score NUMERIC(8, 2),
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    submitted_at TIMESTAMP,
    graded_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_student_exam_attempt_status
        CHECK (status IN ('IN_PROGRESS', 'SUBMITTED', 'WAITING_GRADING', 'COMPLETED', 'CANCELLED')),
    CONSTRAINT chk_student_exam_attempt_score
        CHECK (score IS NULL OR score >= 0),
    CONSTRAINT chk_student_exam_attempt_max_score
        CHECK (max_score IS NULL OR max_score > 0),
    CONSTRAINT uq_student_exam_paper_attempt UNIQUE (student_id, exam_paper_id)
);

CREATE INDEX IF NOT EXISTS idx_student_exam_attempts_student_status
    ON student_exam_attempts(student_id, status);

CREATE INDEX IF NOT EXISTS idx_student_exam_attempts_teacher_status
    ON student_exam_attempts(teacher_id, status);

-- One submitted answer per question in an attempt.
CREATE TABLE IF NOT EXISTS student_attempt_answers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    attempt_id UUID NOT NULL REFERENCES student_exam_attempts(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES questions(id),
    essay_answer TEXT,
    is_correct BOOLEAN,
    awarded_score NUMERIC(8, 2),
    feedback TEXT,
    graded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    graded_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_student_attempt_question UNIQUE (attempt_id, question_id),
    CONSTRAINT chk_student_attempt_awarded_score
        CHECK (awarded_score IS NULL OR awarded_score >= 0)
);

CREATE INDEX IF NOT EXISTS idx_student_attempt_answers_attempt
    ON student_attempt_answers(attempt_id);

-- Supports single-choice and multiple-choice submissions without storing arrays in a column.
CREATE TABLE IF NOT EXISTS student_attempt_answer_choices (
    attempt_answer_id UUID NOT NULL REFERENCES student_attempt_answers(id) ON DELETE CASCADE,
    answer_id UUID NOT NULL REFERENCES answers(id),
    PRIMARY KEY (attempt_answer_id, answer_id)
);

CREATE INDEX IF NOT EXISTS idx_student_attempt_answer_choices_answer
    ON student_attempt_answer_choices(answer_id);

COMMIT;
