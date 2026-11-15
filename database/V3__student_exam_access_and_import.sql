-- Migration V3: Student exam access, teacher classes, and question import flow
-- Run this script against the PostgreSQL database after V2__student_exam_flow.sql.
-- The backend uses spring.jpa.hibernate.ddl-auto=validate, so these DDL changes are required.

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Support PUBLIC / PRIVATE access and published state on exam papers
ALTER TABLE exam_papers
    ADD COLUMN IF NOT EXISTS access_type VARCHAR(20) NOT NULL DEFAULT 'PUBLIC';

ALTER TABLE exam_papers
    ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT TRUE;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_exam_papers_access_type'
    ) THEN
        ALTER TABLE exam_papers
            ADD CONSTRAINT chk_exam_papers_access_type
            CHECK (access_type IN ('PUBLIC', 'PRIVATE'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_exam_papers_access_published
    ON exam_papers(access_type, is_published);

-- 2. Teacher classrooms / exam rooms with join code and hashed password
CREATE TABLE IF NOT EXISTS teacher_classes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    class_code VARCHAR(50) NOT NULL UNIQUE,
    join_password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_teacher_classes_code
    ON teacher_classes(class_code);

CREATE INDEX IF NOT EXISTS idx_teacher_classes_teacher
    ON teacher_classes(teacher_id);

-- 3. Link student assignments to teacher classes
ALTER TABLE student_teacher_assignments
    ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES teacher_classes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_student_teacher_class
    ON student_teacher_assignments(class_id);

COMMIT;
