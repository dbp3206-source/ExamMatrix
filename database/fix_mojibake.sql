-- Review returned rows in an isolated copy. Only exact known encoding variants qualify.
BEGIN;

-- 1. Users
UPDATE users SET full_name = U&'Qu\1ea3n tr\1ecb h\1ec7 th\1ed1ng' WHERE username = 'admin'
  AND full_name IN (U&'Qu\00e1\00ba\00a3n tr\00e1\00bb\008b h\00e1\00bb\0087 th\00e1\00bb\0091ng', U&'Qu\00e1\00ba\00a3n tr\00e1\00bb\2039 h\00e1\00bb\2021 th\00e1\00bb\2018ng')
RETURNING username, full_name;
UPDATE users SET full_name = U&'Nguy\1ec5n Minh Anh' WHERE username = 'teacher'
  AND full_name IN (U&'Nguy\00e1\00bb\0085n Minh Anh', U&'Nguy\00e1\00bb\2026n Minh Anh')
RETURNING username, full_name;
UPDATE users SET full_name = U&'Tr\1ea7n V\0103n Nam' WHERE username = 'student'
  AND full_name IN (U&'Tr\00e1\00ba\00a7n V\00c4\0083n Nam', U&'Tr\00e1\00ba\00a7n V\00c4\0192n Nam')
RETURNING username, full_name;

-- 2. Teacher Class
UPDATE teacher_classes SET name = U&'L\1edbp To\00e1n Th\1ea7y Minh Anh' WHERE class_code = 'TOAN12A'
  AND name IN (U&'L\00e1\00bb\009bp To\00c3\00a1n Th\00e1\00ba\00a7y Minh Anh', U&'L\00e1\00bb\203ap To\00c3\00a1n Th\00e1\00ba\00a7y Minh Anh')
RETURNING class_code, name;

-- 3. Subjects
UPDATE subjects SET name = U&'To\00e1n h\1ecdc', description = U&'Ch\01b0\01a1ng tr\00ecnh To\00e1n trung h\1ecdc ph\1ed5 th\00f4ng' WHERE id = 1
  AND name IN (U&'To\00c3\00a1n h\00e1\00bb\008dc')
  AND description IN (U&'Ch\00c6\00b0\00c6\00a1ng tr\00c3\00acnh To\00c3\00a1n trung h\00e1\00bb\008dc ph\00e1\00bb\0095 th\00c3\00b4ng', U&'Ch\00c6\00b0\00c6\00a1ng tr\00c3\00acnh To\00c3\00a1n trung h\00e1\00bb\008dc ph\00e1\00bb\2022 th\00c3\00b4ng')
RETURNING id, name;
UPDATE subjects SET name = U&'V\1eadt l\00fd', description = U&'Ch\01b0\01a1ng tr\00ecnh V\1eadt l\00fd trung h\1ecdc ph\1ed5 th\00f4ng' WHERE id = 2
  AND name IN (U&'V\00e1\00ba\00adt l\00c3\00bd')
  AND description IN (U&'Ch\00c6\00b0\00c6\00a1ng tr\00c3\00acnh V\00e1\00ba\00adt l\00c3\00bd trung h\00e1\00bb\008dc ph\00e1\00bb\0095 th\00c3\00b4ng', U&'Ch\00c6\00b0\00c6\00a1ng tr\00c3\00acnh V\00e1\00ba\00adt l\00c3\00bd trung h\00e1\00bb\008dc ph\00e1\00bb\2022 th\00c3\00b4ng')
RETURNING id, name;
UPDATE subjects SET name = U&'H\00f3a h\1ecdc', description = U&'Ch\01b0\01a1ng tr\00ecnh H\00f3a h\1ecdc trung h\1ecdc ph\1ed5 th\00f4ng' WHERE id = 3
  AND name IN (U&'H\00c3\00b3a h\00e1\00bb\008dc')
  AND description IN (U&'Ch\00c6\00b0\00c6\00a1ng tr\00c3\00acnh H\00c3\00b3a h\00e1\00bb\008dc trung h\00e1\00bb\008dc ph\00e1\00bb\0095 th\00c3\00b4ng', U&'Ch\00c6\00b0\00c6\00a1ng tr\00c3\00acnh H\00c3\00b3a h\00e1\00bb\008dc trung h\00e1\00bb\008dc ph\00e1\00bb\2022 th\00c3\00b4ng')
RETURNING id, name;

-- 4. Chapters
UPDATE chapters SET name = U&'H\00e0m s\1ed1 v\00e0 \0111\1ed3 th\1ecb' WHERE id = 1
  AND name IN (U&'H\00c3\00a0m s\00e1\00bb\0091 v\00c3\00a0 \00c4\0091\00e1\00bb\0093 th\00e1\00bb\008b', U&'H\00c3\00a0m s\00e1\00bb\2018 v\00c3\00a0 \00c4\2018\00e1\00bb\201c th\00e1\00bb\2039')
RETURNING id, name;
UPDATE chapters SET name = U&'M\0169 v\00e0 l\00f4garit' WHERE id = 2
  AND name IN (U&'M\00c5\00a9 v\00c3\00a0 l\00c3\00b4garit')
RETURNING id, name;
UPDATE chapters SET name = U&'Nguy\00ean h\00e0m v\00e0 t\00edch ph\00e2n' WHERE id = 3
  AND name IN (U&'Nguy\00c3\00aan h\00c3\00a0m v\00c3\00a0 t\00c3\00adch ph\00c3\00a2n')
RETURNING id, name;
UPDATE chapters SET name = U&'Dao \0111\1ed9ng c\01a1' WHERE id = 4
  AND name IN (U&'Dao \00c4\0091\00e1\00bb\0099ng c\00c6\00a1', U&'Dao \00c4\2018\00e1\00bb\2122ng c\00c6\00a1')
RETURNING id, name;
UPDATE chapters SET name = U&'D\00f2ng \0111i\1ec7n xoay chi\1ec1u' WHERE id = 5
  AND name IN (U&'D\00c3\00b2ng \00c4\0091i\00e1\00bb\0087n xoay chi\00e1\00bb\0081u', U&'D\00c3\00b2ng \00c4\2018i\00e1\00bb\2021n xoay chi\00e1\00bb\0081u')
RETURNING id, name;
UPDATE chapters SET name = U&'C\1ea5u t\1ea1o nguy\00ean t\1eed' WHERE id = 6
  AND name IN (U&'C\00e1\00ba\00a5u t\00e1\00ba\00a1o nguy\00c3\00aan t\00e1\00bb\00ad')
RETURNING id, name;

-- Change to COMMIT only after checking the preview.
ROLLBACK;
