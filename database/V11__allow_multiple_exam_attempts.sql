ALTER TABLE student_exam_attempts DROP CONSTRAINT IF EXISTS uq_student_exam_paper_attempt;

ALTER TABLE student_exam_attempts ADD COLUMN IF NOT EXISTS attempt_number INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_student_exam_attempts_student_paper_started
    ON student_exam_attempts (student_id, exam_paper_id, started_at DESC);
