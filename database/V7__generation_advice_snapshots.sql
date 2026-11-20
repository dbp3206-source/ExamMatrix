BEGIN;

ALTER TABLE student_exam_attempts
    ADD COLUMN IF NOT EXISTS class_id UUID NULL REFERENCES teacher_classes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_student_exam_attempts_class_id
    ON student_exam_attempts (class_id);

ALTER TABLE exam_generation_requests
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS allocation_snapshot TEXT NULL;

COMMIT;
