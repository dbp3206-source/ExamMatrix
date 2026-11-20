# Exam Matrix - Hệ thống Quản lý Ngân hàng Câu hỏi & Tổ chức Thi

Dự án ứng dụng hỗ trợ giáo viên xây dựng ma trận đề thi, sinh đề trắc nghiệm / tự luận và cho phép sinh viên tham gia làm bài thi trực tuyến.

---

## 1. Cấu trúc và Kiến trúc Dự án

- **Backend**: Java 21, Spring Boot 4.1.1, Spring Data JPA, Spring Security (JWT), PostgreSQL (chế độ `ddl-auto: validate`), Apache POI, Apache PDFBox, Lombok.
- **Frontend**: React (JSX), Vite, React Router, TanStack React Query, React Hook Form, Mock API & Real API song song.
- **Database**: PostgreSQL (quản lý schema qua các script DDL thủ công tại thư mục `database/`).

---

## 2. Hướng dẫn Chạy Database Migration

Schema thực tế được ghi trong `database/`. Trước khi đưa bản mới lên PostgreSQL đang có dữ liệu, cập nhật schema theo phiên bản và chạy với `DB_DDL_AUTO=validate` sau khi xác nhận cài đặt. Chế độ phát triển mặc định là `update`.

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

## 3. Triển khai với Docker & Docker Compose (Khuyến nghị)

Docker Compose khởi tạo PostgreSQL bằng `V1`, `V2`, `V3`, `V5`, `V6` trên volume mới. Dùng [hướng dẫn bật Google và nâng cấp backend](docs/backend-google-sign-in.md) cho volume đã có dữ liệu.

### 3.1. Khởi chạy toàn bộ hệ thống

Chỉ cần một lệnh duy nhất tại thư mục gốc của dự án:

```bash
docker compose up -d --build
```

Lệnh này sẽ tự động:
1. Khởi tạo container PostgreSQL 16 Alpine, tạo cơ sở dữ liệu `exam_matrix` và nạp schema cùng các vai trò.
2. Build backend đa tầng (multi-stage build) trên nền Java 21 Temurin Alpine, chạy ứng dụng dưới quyền non-root user `appuser` tại cổng 8080.
3. Build frontend với Vite & pnpm, đóng gói vào Nginx Alpine phục vụ tĩnh kèm cấu hình reverse proxy chuyển tiếp các API `/auth/`, `/student/`, `/teacher/`, `/dashboard/`, `/questions/`, `/matrices/`, `/exam-papers/` về backend tại cổng 3000.

### 3.2. Truy cập ứng dụng & Tài khoản mẫu

- **Giao diện người dùng (Frontend Web)**: [http://localhost:3000](http://localhost:3000)
- **Backend API trực tiếp**: [http://localhost:8080](http://localhost:8080)

**Tài khoản mẫu cho môi trường demo.** Chỉ dùng `docker compose -f docker-compose.yml -f docker-compose.demo.yml up -d --build` với một DB mới dành riêng cho demo. Bản chạy thông thường cần cấu hình quản trị viên ban đầu theo hướng dẫn ở trên.
- **Quản trị viên (Admin)**: `admin` / `admin123`
- **Giáo viên (Teacher)**: `teacher` / `teacher123` (Đã có sẵn lớp học mẫu mã `TOAN12A` - mật khẩu lớp: `123`)
- **Sinh viên (Student)**: `student` / `student123`

### 3.3. Quản lý container

```bash
# Xem trạng thái các container
docker compose ps

# Xem log thời gian thực
docker compose logs -f

# Dừng toàn bộ hệ thống
docker compose down

# Dừng và xóa toàn bộ dữ liệu volume nếu muốn khởi tạo lại từ đầu
docker compose down -v
```

---

## 4. Cài đặt và Khởi chạy thủ công (Manual Setup)

### 4.1. Backend

Yêu cầu: JDK 21.

```bash
cd backend

# Chạy toàn bộ test suite (dùng H2 in-memory mode PostgreSQL)
./mvnw test

# Khởi chạy backend server
./mvnw spring-boot:run
```

Backend chạy mặc định tại cổng `http://localhost:8080`.

### 4.2. Frontend

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

## 5. Module Sinh viên Làm bài thi & Phân quyền

### 5.1. Đăng ký & Đăng nhập Sinh viên
- Sinh viên đăng ký tài khoản qua endpoint `POST /auth/register/student` hoặc trên giao diện đăng ký sinh viên (`/dang-ky-sinh-vien`).
- Đăng nhập qua JWT token chuẩn.
- Phân quyền nghiêm ngặt:
  - Sinh viên chỉ được vào các route `/hoc-sinh/*` (đề thi, phòng thi, kết quả, lớp giáo viên).
  - Sinh viên bị chặn (403 Forbidden) khi cố truy cập ngân hàng câu hỏi, ma trận đề, sinh đề thi hoặc quản trị.
  - Giáo viên và Admin bị chặn khi vào màn hình làm bài của sinh viên.

### 5.2. Lớp Giáo viên & Đề PUBLIC / PRIVATE
- Mỗi giáo viên sở hữu lớp/phòng thi riêng với mã lớp và mật khẩu lớp học (mật khẩu được băm an toàn bằng BCrypt/PasswordEncoder).
- **Đề PUBLIC (Công khai)**: Bất kỳ sinh viên nào đã đăng nhập đều có thể xem và bắt đầu làm bài trực tiếp mà không cần tham gia lớp.
- **Đề PRIVATE (Lớp học)**: Yêu cầu sinh viên phải nhập đúng mật khẩu tham gia lớp của giáo viên sở hữu đề trước khi được xem hoặc làm bài. Backend kiểm tra quyền ở mọi endpoint; không dựa vào frontend.
- Giáo viên có thể duyệt, từ chối hoặc thu hồi quyền (`REVOKED`) của sinh viên trong lớp.

### 5.3. Lượt làm bài thi & Chấm điểm
- Mỗi sinh viên chỉ có tối đa 1 lượt làm trên mỗi đề thi.
- Bộ đếm thời gian tính chính xác dựa vào thời điểm `startedAt` do server ghi nhận (không phụ thuộc timer frontend).
- Hỗ trợ đầy đủ: một đáp án (`SINGLE_CHOICE`), nhiều đáp án (`MULTIPLE_CHOICE`), đúng/sai (`TRUE_FALSE`), tự luận (`ESSAY`).
- Tự động lưu đáp án trong quá trình làm; tự động nộp bài khi hết giờ.
- Sau khi nộp, câu trả lời bị khóa hoàn toàn.
- Đề trắc nghiệm được hệ thống tự động chấm điểm ngay khi nộp.
- Đề chứa câu hỏi tự luận chuyển sang trạng thái `WAITING_GRADING`. Chỉ giáo viên sở hữu đề mới có quyền chấm điểm, cho nhận xét từng câu và chuyển trạng thái sang `COMPLETED`.
- Toàn bộ đáp án đúng (`isCorrect`) và hướng dẫn chấm (`referenceAnswer`) được bảo mật tuyệt đối, không gửi về phía sinh viên trước khi hoàn thành bài thi.

---

## 6. Nhập câu hỏi từ tài liệu & Giới hạn công nghệ

- **Hỗ trợ Word (`.docx`) và PDF (`.pdf`)**: Phân tích cú pháp nội bộ bằng Apache POI và Apache PDFBox độc lập, chạy offline, bảo đảm an toàn dữ liệu học liệu.
- **Giới hạn về nhận diện từ hình ảnh (Image OCR)**:
  - Theo nguyên tắc bắt buộc không sử dụng AI, LLM, OpenAI API hoặc Cloud OCR bên ngoài, hệ thống **không triển khai OCR giả lập** cho ảnh.
  - Khi người dùng tải lên tệp hình ảnh (`.png`, `.jpg`, `.jpeg`), hệ thống sẽ từ chối một cách tường minh kèm thông báo giải thích rõ giới hạn công nghệ.
