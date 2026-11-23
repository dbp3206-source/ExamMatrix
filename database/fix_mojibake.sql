BEGIN;

-- 1. Users
UPDATE users SET full_name = U&'Qu\1ea3n tr\1ecb h\1ec7 th\1ed1ng' WHERE username = 'admin';
UPDATE users SET full_name = U&'Nguy\1ec5n Minh Anh' WHERE username = 'teacher';
UPDATE users SET full_name = U&'Tr\1ea7n V\0103n Nam' WHERE username = 'student';

-- 2. Teacher Class
UPDATE teacher_classes SET name = U&'L\1edbp To\00e1n Th\1ea7y Minh Anh' WHERE class_code = 'TOAN12A';

-- 3. Subjects
UPDATE subjects SET name = U&'To\00e1n h\1ecdc', description = U&'Ch\01b0\01a1ng tr\00ecnh To\00e1n trung h\1ecdc ph\1ed5 th\00f4ng' WHERE id = 1;
UPDATE subjects SET name = U&'V\1eadt l\00fd', description = U&'Ch\01b0\01a1ng tr\00ecnh V\1eadt l\00fd trung h\1ecdc ph\1ed5 th\00f4ng' WHERE id = 2;
UPDATE subjects SET name = U&'H\00f3a h\1ecdc', description = U&'Ch\01b0\01a1ng tr\00ecnh H\00f3a h\1ecdc trung h\1ecdc ph\1ed5 th\00f4ng' WHERE id = 3;

-- 4. Chapters
UPDATE chapters SET name = U&'H\00e0m s\1ed1 v\00e0 \0111\1ed3 th\1ecb' WHERE id = 1;
UPDATE chapters SET name = U&'M\0169 v\00e0 l\00f4garit' WHERE id = 2;
UPDATE chapters SET name = U&'Nguy\00ean h\00e0m v\00e0 t\00edch ph\00e2n' WHERE id = 3;
UPDATE chapters SET name = U&'Dao \0111\1ed9ng c\01a1' WHERE id = 4;
UPDATE chapters SET name = U&'D\00f2ng \0111i\1ec7n xoay chi\1ec1u' WHERE id = 5;
UPDATE chapters SET name = U&'C\1ea5u t\1ea1o nguy\00ean t\1eed' WHERE id = 6;

COMMIT;
