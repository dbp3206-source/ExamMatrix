DROP INDEX IF EXISTS uq_student_single_approved_class;
DROP INDEX IF EXISTS uq_student_single_pending_request;
DROP INDEX IF EXISTS uq_student_current_teacher;

CREATE UNIQUE INDEX IF NOT EXISTS uq_student_teacher_active_assignment
    ON student_teacher_assignments (student_id, teacher_id)
    WHERE status IN ('APPROVED', 'PENDING');

CREATE TABLE IF NOT EXISTS student_feedbacks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category VARCHAR(40) NOT NULL,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    is_read_by_admin BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_student_feedbacks_category'
    ) THEN
        ALTER TABLE student_feedbacks
            ADD CONSTRAINT chk_student_feedbacks_category
            CHECK (category IN ('SYSTEM_FEEDBACK', 'SUBJECT_REQUEST', 'EXAM_REQUEST', 'OTHER'));
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS student_feedback_recipients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    feedback_id UUID NOT NULL REFERENCES student_feedbacks(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    class_id UUID NULL REFERENCES teacher_classes(id) ON DELETE SET NULL,
    class_name VARCHAR(120) NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT uq_student_feedback_recipient UNIQUE (feedback_id, teacher_id)
);

CREATE INDEX IF NOT EXISTS idx_student_feedbacks_student_created
    ON student_feedbacks (student_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_student_feedbacks_created
    ON student_feedbacks (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_student_feedback_recipients_teacher_read
    ON student_feedback_recipients (teacher_id, is_read, feedback_id);
