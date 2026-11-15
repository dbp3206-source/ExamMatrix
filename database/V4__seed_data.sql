-- V4: Seed demo data for Exam Matrix
-- Includes roles, demo admin, teacher, student, default class, subjects and chapters

BEGIN;

-- 1. Ensure Roles
INSERT INTO roles (name)
VALUES ('ADMIN'), ('TEACHER'), ('STUDENT')
ON CONFLICT (name) DO NOTHING;

-- 2. Insert Default Users (passwords are BCrypt hashed)
-- admin: admin / admin123
INSERT INTO users (id, username, email, full_name, password, role_id, status)
SELECT 'a0000000-0000-0000-0000-000000000001'::uuid, 'admin', 'admin@exammatrix.vn', 'Quản trị hệ thống',
       '$2a$10$8BGm8uwctlvZ5WpHGVQKUufuzn54WKgPoM0TNkcDA/1j7K867.nc2', r.id, 'ACTIVE'
FROM roles r WHERE r.name = 'ADMIN'
ON CONFLICT (username) DO NOTHING;

-- teacher: teacher / teacher123
INSERT INTO users (id, username, email, full_name, password, role_id, status)
SELECT 'b0000000-0000-0000-0000-000000000002'::uuid, 'teacher', 'teacher@exammatrix.vn', 'Nguyễn Minh Anh',
       '$2a$10$0SfXSXjCpJiaHQXWE8YOouRM68mNEYskxN05XycBtia4XeGxxJtHi', r.id, 'ACTIVE'
FROM roles r WHERE r.name = 'TEACHER'
ON CONFLICT (username) DO NOTHING;

-- student: student / student123
INSERT INTO users (id, username, email, full_name, password, role_id, status)
SELECT 'c0000000-0000-0000-0000-000000000003'::uuid, 'student', 'student@exammatrix.vn', 'Trần Văn Nam',
       '$2a$10$nMqkykL5kyFZVPEp/QVmA..e255bFCRvcd2puyhpDF3gWn4.qJl8W', r.id, 'ACTIVE'
FROM roles r WHERE r.name = 'STUDENT'
ON CONFLICT (username) DO NOTHING;

-- 3. Teacher Classroom for demo teacher
-- password is '123'
INSERT INTO teacher_classes (id, teacher_id, name, class_code, join_password)
VALUES (
    'd0000000-0000-0000-0000-000000000004'::uuid,
    'b0000000-0000-0000-0000-000000000002'::uuid,
    'Lớp Toán Thầy Minh Anh',
    'TOAN12A',
    '$2a$10$i3Atit1/OhlQul5eBiW8POIciKArra9Y9UlP/4SnkEoTDkRBSAV.2'
)
ON CONFLICT (class_code) DO NOTHING;

-- 4. Initial Subjects
INSERT INTO subjects (id, code, name, description)
VALUES 
    (1, 'MATH', 'Toán học', 'Chương trình Toán trung học phổ thông'),
    (2, 'PHYS', 'Vật lý', 'Chương trình Vật lý trung học phổ thông'),
    (3, 'CHEM', 'Hóa học', 'Chương trình Hóa học trung học phổ thông')
ON CONFLICT (code) DO NOTHING;

-- Reset sequence for subjects if needed
SELECT setval('subjects_id_seq', (SELECT COALESCE(MAX(id), 1) FROM subjects));

-- 5. Initial Chapters
INSERT INTO chapters (id, subject_id, name, order_index)
VALUES
    (1, 1, 'Hàm số và đồ thị', 1),
    (2, 1, 'Mũ và lôgarit', 2),
    (3, 1, 'Nguyên hàm và tích phân', 3),
    (4, 2, 'Dao động cơ', 1),
    (5, 2, 'Dòng điện xoay chiều', 2),
    (6, 3, 'Cấu tạo nguyên tử', 1)
ON CONFLICT DO NOTHING;

SELECT setval('chapters_id_seq', (SELECT COALESCE(MAX(id), 1) FROM chapters));

COMMIT;
