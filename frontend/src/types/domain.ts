import { z } from 'zod'

export type UserRole = 'ADMIN' | 'TEACHER' | 'STUDENT'
export type ExamType = 'OBJECTIVE' | 'ESSAY'
export type AccessType = 'PUBLIC' | 'PRIVATE'
export type DifficultyLevel = 'EASY' | 'MEDIUM' | 'HARD'
export type QuestionType = 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'ESSAY'
export type AttemptStatus = 'IN_PROGRESS' | 'SUBMITTED' | 'WAITING_GRADING' | 'COMPLETED' | 'CANCELLED'
export type ClassroomRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'REVOKED'

export interface PaginatedResponse<T> {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

export interface ApiErrorShape {
  message?: string
  status?: number
  fieldErrors?: Record<string, string>
  response?: {
    status?: number
    data?: {
      message?: string
      fieldErrors?: Record<string, string>
    }
  }
}

export interface SubjectItem {
  id: number
  code: string
  name: string
  description?: string
}

export interface MatrixSummary {
  id: string
  title: string
  subjectId?: number
  subjectName?: string
  examType?: ExamType
  duration?: number
  durationMinutes?: number
  totalQuestions?: number
}

export interface PaperAnswerOption {
  id: string
  content: string
  isCorrect?: boolean
}

export interface PaperQuestionItem {
  id: string
  questionOrder?: number
  content: string
  type: QuestionType
  difficulty?: DifficultyLevel
  points?: number
  referenceAnswer?: string | null
  answers?: PaperAnswerOption[]
}

export interface StudentExamDetail {
  id: string
  title: string
  examCode?: string
  examType?: ExamType
  duration?: number
  questions?: PaperQuestionItem[]
}

export interface StartExamAttemptResponse {
  attemptId: string
  attemptNumber?: number
  paperId?: string
  status?: AttemptStatus | string
  remainingSeconds?: number | null
}

export interface ExamPaperDetail extends ExamPaperSummary {
  questions: PaperQuestionItem[]
}

export interface PaperSummaryQueryParams {
  page: number
  size: number
  matrixId?: string
  subjectId?: number
  examType?: ExamType | string
  accessType?: AccessType | string
  isPublished?: boolean
  search?: string
}

export interface ExamPaperSummary {
  id: string
  examCode: string
  matrixId?: string
  matrixTitle?: string
  subjectId?: number
  subjectCode?: string
  subjectName?: string
  examType?: ExamType
  durationMinutes?: number
  questionCount?: number
  questions?: PaperQuestionItem[]
  accessType?: AccessType
  isPublished?: boolean
  createdAt?: string
  teacherName?: string
}

export interface AttemptAnswerRecord {
  questionId: string
  questionOrder?: number
  content?: string
  type?: QuestionType
  selectedAnswerIds?: string[]
  essayAnswer?: string | null
  isCorrect?: boolean | null
  awardedScore?: number | null
  maxScore?: number | null
  feedback?: string | null
}

export interface AttemptResultResponse {
  attemptId: string
  attemptNumber?: number
  paperId: string
  paperTitle?: string
  examCode?: string
  examType?: ExamType
  status: AttemptStatus | string
  startedAt?: string
  submittedAt?: string | null
  gradedAt?: string | null
  durationMinutes?: number
  score?: number | null
  maxScore?: number | null
  scoreOnTen?: number | null
  correctCount?: number | null
  totalQuestions?: number | null
  answers?: AttemptAnswerRecord[]
}

export interface TeacherProfileItem {
  id: string
  fullName: string
  email: string
}

export interface TeacherRequestRecord {
  id: string
  teacherId?: string
  teacherName?: string
  className?: string
  classCode?: string
  status: ClassroomRequestStatus | string
  requestedAt?: string
  decisionNote?: string | null
}

export interface AdviceCellAdjustment {
  chapterId: number
  chapterName: string
  difficulty: DifficultyLevel
  currentCount: number
  proposedCount: number
  reason: string
}

export interface AdviceAllocationCell {
  chapterId: number
  chapterName: string
  difficulty: DifficultyLevel
  count: number
  percent: number
}

export interface AdviceBatchHistoryItem {
  requestId: string
  label: string
  matrixTitle: string
  totalQuestions: number
  paperCount: number
  source: 'ALLOCATION_SNAPSHOT' | 'RECONSTRUCTED_FROM_PAPERS' | string
  allocations: AdviceAllocationCell[]
}

export interface AdviceBatchBreakdown {
  requestId: string
  label: string
  studentCount: number
  distinctQuestionCount: number
  wrongCount: number
  blankCount: number
}

export interface AdviceQuestionEvidence {
  questionId: string
  questionSnippet?: string
  batchLabels?: string[]
  observedStudents: number
  correctCount: number
  wrongCount: number
  blankCount: number
}

export interface AdviceCellEvidence {
  chapterId: number
  chapterName: string
  difficulty: DifficultyLevel
  isTargetIncrease?: boolean
  isTargetDecrease?: boolean
  eligibleStudents: number
  strugglingStudents: number
  strugglingRatePercent: number
  observedStudents: number
  classStudentCount: number
  coveragePercent: number
  correctCount: number
  wrongCount: number
  blankCount: number
  partialCount: number
  waitingGradingCount: number
  batchBreakdowns?: AdviceBatchBreakdown[]
  questions?: AdviceQuestionEvidence[]
}

export interface GenerationAdviceResponse {
  triggered: boolean
  snapshotVersion?: string
  actionTitle?: string
  className?: string
  classStudentCount?: number
  examType?: ExamType
  totalQuestions: number
  totalPoints: number
  requestedNumberOfPapers: number
  increaseCell?: AdviceCellAdjustment
  decreaseCell?: AdviceCellAdjustment
  currentAllocation?: AdviceAllocationCell[]
  proposedAllocation?: AdviceAllocationCell[]
  batchHistory?: AdviceBatchHistoryItem[]
  cellEvidences?: AdviceCellEvidence[]
}

export const joinClassSchema = z
  .object({
    classCode: z.string().trim().max(32, 'Mã lớp tối đa 32 ký tự'),
    teacherId: z.string().trim(),
    password: z.string().trim().min(1, 'Vui lòng nhập mật khẩu tham gia lớp học.'),
  })
  .refine((data) => Boolean(data.classCode || data.teacherId), {
    message: 'Vui lòng nhập mã lớp hoặc chọn giáo viên hướng dẫn.',
    path: ['classCode'],
  })

export type JoinClassFormValues = z.infer<typeof joinClassSchema>
