BEGIN;

-- 1. TeacherClass: separate join_mode from join_password (remove '!' sentinel)
ALTER TABLE teacher_classes
    ADD COLUMN IF NOT EXISTS join_mode VARCHAR(30) NOT NULL DEFAULT 'CLOSED';

ALTER TABLE teacher_classes
    ALTER COLUMN join_password DROP NOT NULL;

UPDATE teacher_classes
SET join_mode = CASE
        WHEN join_password IS NOT NULL AND BTRIM(join_password) <> '' AND join_password <> '!' THEN 'REQUEST_WITH_PASSWORD'
        ELSE 'CLOSED'
    END
WHERE join_mode = 'CLOSED'
  AND join_password IS NOT NULL
  AND BTRIM(join_password) <> ''
  AND join_password <> '!';

UPDATE teacher_classes
SET join_password = NULL
WHERE join_password = '!' OR BTRIM(COALESCE(join_password, '')) = '';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_teacher_classes_join_mode'
    ) THEN
        ALTER TABLE teacher_classes
            ADD CONSTRAINT chk_teacher_classes_join_mode
            CHECK (join_mode IN ('CLOSED', 'REQUEST_OPEN', 'REQUEST_WITH_PASSWORD'));
    END IF;
END $$;

-- 2. StudentTeacherAssignment: allow 1 APPROVED + at most 1 PENDING (class transfer lifecycle)
ALTER TABLE student_teacher_assignments
    DROP CONSTRAINT IF EXISTS chk_student_teacher_assignment_status;

ALTER TABLE student_teacher_assignments
    ADD CONSTRAINT chk_student_teacher_assignment_status
    CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'REVOKED', 'TRANSFERRED'));

DROP INDEX IF EXISTS uq_student_current_teacher;

CREATE UNIQUE INDEX IF NOT EXISTS uq_student_single_approved_class
    ON student_teacher_assignments (student_id)
    WHERE status = 'APPROVED';

CREATE UNIQUE INDEX IF NOT EXISTS uq_student_single_pending_request
    ON student_teacher_assignments (student_id)
    WHERE status = 'PENDING';

-- 3. ExamPaper: published_at for newest-first sorting & published batch analytics
ALTER TABLE exam_papers
    ADD COLUMN IF NOT EXISTS published_at TIMESTAMP NULL;

UPDATE exam_papers
SET published_at = created_at
WHERE is_published = TRUE AND published_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_exam_papers_published_at
    ON exam_papers (published_at DESC);

-- 4. StudentExamAttempt: 10-point score column & actual grader reference
ALTER TABLE student_exam_attempts
    ADD COLUMN IF NOT EXISTS score_on_ten NUMERIC(5, 2) NULL,
    ADD COLUMN IF NOT EXISTS graded_by UUID NULL REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_student_exam_attempts_graded_by
    ON student_exam_attempts (graded_by);

-- Backfill score_on_ten for existing completed attempts safely without re-scaling
UPDATE student_exam_attempts
SET score_on_ten = CASE
        WHEN status = 'COMPLETED' AND score IS NOT NULL AND max_score IS NOT NULL AND max_score > 0
            THEN ROUND(LEAST(10.00, GREATEST(0.00, (score * 10.0) / max_score)), 2)
        ELSE NULL
    END
WHERE score_on_ten IS NULL AND status = 'COMPLETED' AND score IS NOT NULL AND max_score IS NOT NULL AND max_score > 0;

-- 5. QuestionImportRequest: idempotency for import confirm retries (Item 16)
CREATE TABLE IF NOT EXISTS question_import_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    request_id UUID NOT NULL,
    payload_digest VARCHAR(64) NOT NULL,
    created_ids TEXT NOT NULL,
    created_count INTEGER NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_question_import_actor_req UNIQUE (actor_id, request_id)
);

CREATE INDEX IF NOT EXISTS idx_question_import_requests_actor
    ON question_import_requests (actor_id, created_at DESC);

-- 6. UserVisitSession: authenticated visit session tracking for Admin Dashboard (Item 3)
CREATE TABLE IF NOT EXISTS user_visit_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_name VARCHAR(30) NOT NULL,
    visit_date DATE NOT NULL,
    started_at TIMESTAMP NOT NULL,
    last_activity_at TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_visit_sessions_date_role
    ON user_visit_sessions (visit_date, role_name);

CREATE INDEX IF NOT EXISTS idx_user_visit_sessions_user_activity
    ON user_visit_sessions (user_id, last_activity_at DESC);

COMMIT;
