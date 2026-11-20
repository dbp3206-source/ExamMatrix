BEGIN;

ALTER TABLE questions ADD COLUMN IF NOT EXISTS exam_type VARCHAR(20);
UPDATE questions
SET exam_type = CASE WHEN type = 'ESSAY' THEN 'ESSAY' ELSE 'OBJECTIVE' END
WHERE exam_type IS DISTINCT FROM CASE WHEN type = 'ESSAY' THEN 'ESSAY' ELSE 'OBJECTIVE' END;
ALTER TABLE questions ALTER COLUMN exam_type SET DEFAULT 'OBJECTIVE';
ALTER TABLE questions ALTER COLUMN exam_type SET NOT NULL;

ALTER TABLE users ADD COLUMN IF NOT EXISTS google_subject VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS session_version UUID;
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_google_subject ON users(google_subject);
ALTER TABLE exam_papers ADD COLUMN IF NOT EXISTS generation_request_id UUID;
CREATE INDEX IF NOT EXISTS ix_exam_papers_generation_request
    ON exam_papers(matrix_id, generation_request_id) WHERE generation_request_id IS NOT NULL;

INSERT INTO roles (name) VALUES ('ADMIN'), ('TEACHER'), ('STUDENT')
ON CONFLICT (name) DO NOTHING;

COMMIT;
