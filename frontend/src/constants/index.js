export const DIFFICULTIES = [
  { value: 'EASY', label: 'Dễ' },
  { value: 'MEDIUM', label: 'Trung bình' },
  { value: 'HARD', label: 'Khó' },
]

export const QUESTION_TYPES = [
  { value: 'SINGLE_CHOICE', label: 'Một đáp án' },
  { value: 'MULTIPLE_CHOICE', label: 'Nhiều đáp án' },
  { value: 'TRUE_FALSE', label: 'Đúng / Sai' },
  { value: 'ESSAY', label: 'Tự luận' },
]

export const EXAM_TYPES = [
  { value: 'OBJECTIVE', label: 'Trắc nghiệm' },
  { value: 'ESSAY', label: 'Tự luận' },
]

export const difficultyLabel = (value) => DIFFICULTIES.find((item) => item.value === value)?.label || value
export const typeLabel = (value) => QUESTION_TYPES.find((item) => item.value === value)?.label || value
export const examTypeLabel = (value) => EXAM_TYPES.find((item) => item.value === (value || 'OBJECTIVE'))?.label || value
export const roleLabel = (value) => {
  if (value === 'ADMIN') return 'Quản trị viên'
  if (value === 'STUDENT') return 'Học sinh'
  return 'Giáo viên'
}

export const REQUEST_STATUSES = [
  { value: 'PENDING', label: 'Chờ duyệt', tone: 'warning' },
  { value: 'APPROVED', label: 'Đã duyệt', tone: 'success' },
  { value: 'REJECTED', label: 'Đã từ chối', tone: 'danger' },
  { value: 'REVOKED', label: 'Đã thu hồi', tone: 'neutral' },
]
export const requestStatusMeta = (val) => REQUEST_STATUSES.find((s) => s.value === val) || { label: val || '—', tone: 'neutral' }

export const ATTEMPT_STATUSES = [
  { value: 'AVAILABLE', label: 'Chưa làm', tone: 'neutral' },
  { value: 'IN_PROGRESS', label: 'Đang làm', tone: 'warning' },
  { value: 'SUBMITTED', label: 'Đã nộp', tone: 'warning' },
  { value: 'WAITING_GRADING', label: 'Chờ chấm', tone: 'warning' },
  { value: 'COMPLETED', label: 'Hoàn thành', tone: 'success' },
  { value: 'CANCELLED', label: 'Đã hủy', tone: 'danger' },
]
export const attemptStatusMeta = (val) => ATTEMPT_STATUSES.find((s) => s.value === val) || { label: val || '—', tone: 'neutral' }
