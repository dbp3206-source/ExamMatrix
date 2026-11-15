# Exam Matrix - Hệ thống Quản lý Ngân hàng Câu hỏi & Tổ chức Thi

Dự án ứng dụng hỗ trợ giáo viên xây dựng ma trận đề thi, sinh đề trắc nghiệm / tự luận và cho phép sinh viên tham gia làm bài thi trực tuyến.

---

## 1. Cấu trúc và Kiến trúc Dự án

- **Backend**: Java 21, Spring Boot 4.1.1, Spring Data JPA, Spring Security (JWT), PostgreSQL (chế độ `ddl-auto: validate`), Apache POI, Apache PDFBox, Lombok.
- **Frontend**: React (JSX), Vite, React Router, TanStack React Query, React Hook Form, Mock API & Real API song song.
- **Database**: PostgreSQL (quản lý schema qua các script DDL thủ công tại thư mục `database/`).

---

## 2. Hướng dẫn Chạy Database Migration

Hệ thống sử dụng `spring.jpa.hibernate.ddl-auto=validate`, vì vậy trước khi khởi động backend lần đầu hoặc khi cập nhật module sinh viên, cần thực thi các script SQL sau vào database PostgreSQL theo thứ tự:

1. `database/V2__student_exam_flow.sql`:
   - Bổ sung vai trò `STUDENT`.
   - Bổ sung trường `reference_answer` cho bảng `questions` (phục vụ câu hỏi tự luận `ESSAY`).
   - Bổ sung trường `exam_type` (`OBJECTIVE` / `ESSAY`) cho `exam_matrices`.
   - Tạo bảng `student_teacher_assignments`, `student_exam_attempts`, `student_attempt_answers`, `student_attempt_answer_choices`.

2. `database/V3__student_exam_access_and_import.sql`:
   - Bổ sung `access_type` (`PUBLIC` / `PRIVATE`) và `is_published` cho bảng `exam_papers`.
   - Tạo bảng `teacher_classes` (quản lý lớp học giáo viên, mã lớp và mật khẩu tham gia băm qua `PasswordEncoder`).
   - Bổ sung liên kết `class_id` trong `student_teacher_assignments`.

```bash
# Ví dụ thực thi qua psql:
psql -U <db_user> -d <db_name> -f database/V2__student_exam_flow.sql
psql -U <db_user> -d <db_name> -f database/V3__student_exam_access_and_import.sql
```

---

## 3. Cài đặt và Khởi chạy

### 3.1. Backend

Yêu cầu: JDK 21.

```bash
cd backend

# Chạy toàn bộ test suite (dùng H2 in-memory mode PostgreSQL)
./mvnw test

# Khởi chạy backend server
./mvnw spring-boot:run
```

Backend chạy mặc định tại cổng `http://localhost:8080`.

### 3.2. Frontend

Yêu cầu: Node.js 18+ và `pnpm`.

```bash
cd frontend

# Cài đặt dependencies
pnpm install

# Kiểm tra lint
pnpm lint

# Build production bundle
pnpm build

# Khởi chạy dev server
pnpm dev
```

Frontend chạy mặc định tại `http://localhost:5173`. Có thể chuyển đổi giữa Mock API và Real API qua biến môi trường `VITE_USE_MOCK_API=false` trong `frontend/.env`.

---

## 4. Module Sinh viên Làm bài thi & Phân quyền

### 4.1. Đăng ký & Đăng nhập Sinh viên
- Sinh viên đăng ký tài khoản qua endpoint `POST /auth/register/student` hoặc trên giao diện đăng ký sinh viên (`/dang-ky-sinh-vien`).
- Đăng nhập qua JWT token chuẩn.
- Phân quyền nghiêm ngặt:
  - Sinh viên chỉ được vào các route `/hoc-sinh/*` (đề thi, phòng thi, kết quả, lớp giáo viên).
  - Sinh viên bị chặn (403 Forbidden) khi cố truy cập ngân hàng câu hỏi, ma trận đề, sinh đề thi hoặc quản trị.
  - Giáo viên và Admin bị chặn khi vào màn hình làm bài của sinh viên.

### 4.2. Lớp Giáo viên & Đề PUBLIC / PRIVATE
- Mỗi giáo viên sở hữu lớp/phòng thi riêng với mã lớp và mật khẩu lớp học (mật khẩu được băm an toàn bằng BCrypt/PasswordEncoder).
- **Đề PUBLIC (Công khai)**: Bất kỳ sinh viên nào đã đăng nhập đều có thể xem và bắt đầu làm bài trực tiếp mà không cần tham gia lớp.
- **Đề PRIVATE (Lớp học)**: Yêu cầu sinh viên phải nhập đúng mật khẩu tham gia lớp của giáo viên sở hữu đề trước khi được xem hoặc làm bài. Backend kiểm tra quyền ở mọi endpoint; không dựa vào frontend.
- Giáo viên có thể duyệt, từ chối hoặc thu hồi quyền (`REVOKED`) của sinh viên trong lớp.

### 4.3. Lượt làm bài thi & Chấm điểm
- Mỗi sinh viên chỉ có tối đa 1 lượt làm trên mỗi đề thi.
- Bộ đếm thời gian tính chính xác dựa vào thời điểm `startedAt` do server ghi nhận (không phụ thuộc timer frontend).
- Hỗ trợ đầy đủ: một đáp án (`SINGLE_CHOICE`), nhiều đáp án (`MULTIPLE_CHOICE`), đúng/sai (`TRUE_FALSE`), tự luận (`ESSAY`).
- Tự động lưu đáp án trong quá trình làm; tự động nộp bài khi hết giờ.
- Sau khi nộp, câu trả lời bị khóa hoàn toàn.
- Đề trắc nghiệm được hệ thống tự động chấm điểm ngay khi nộp.
- Đề chứa câu hỏi tự luận chuyển sang trạng thái `WAITING_GRADING`. Chỉ giáo viên sở hữu đề mới có quyền chấm điểm, cho nhận xét từng câu và chuyển trạng thái sang `COMPLETED`.
- Toàn bộ đáp án đúng (`isCorrect`) và hướng dẫn chấm (`referenceAnswer`) được bảo mật tuyệt đối, không gửi về phía sinh viên trước khi hoàn thành bài thi.

---

## 5. Nhập câu hỏi từ tài liệu & Giới hạn công nghệ

- **Hỗ trợ Word (`.docx`) và PDF (`.pdf`)**: Phân tích cú pháp nội bộ bằng Apache POI và Apache PDFBox độc lập, chạy offline, bảo đảm an toàn dữ liệu học liệu.
- **Giới hạn về nhận diện từ hình ảnh (Image OCR)**:
  - Theo nguyên tắc bắt buộc không sử dụng AI, LLM, OpenAI API hoặc Cloud OCR bên ngoài, hệ thống **không triển khai OCR giả lập** cho ảnh.
  - Khi người dùng tải lên tệp hình ảnh (`.png`, `.jpg`, `.jpeg`), hệ thống sẽ từ chối một cách tường minh kèm thông báo giải thích rõ giới hạn công nghệ.
