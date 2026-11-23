import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Ban, CheckCircle2, Clock, RefreshCw, RotateCcw, XCircle } from 'lucide-react'
import { api } from '@/api/service'
import { attemptStatusMeta, examTypeLabel, scoreCardTone, typeLabel } from '@/constants'
import { classifyAttemptStatus } from '@/utils/examAttemptStatus'
import { formatDate } from '@/utils'
import type { AttemptAnswerRecord, AttemptResultResponse, ExamPaperSummary } from '@/types/domain'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorState, LoadingState, PageHeader } from '@/components/common/StateFeedback'
import { MathRenderer } from '@/components/common/MathRenderer'

export default function StudentResultPage() {
  const { attemptId } = useParams<{ attemptId: string }>()
  const navigate = useNavigate()

  useEffect(() => {
    document.title = 'Kết quả bài thi | Exam Matrix'
  }, [])

  const {
    data: result,
    isLoading,
    error,
    refetch,
  } = useQuery<AttemptResultResponse>({
    queryKey: ['student', 'attempt', attemptId],
    queryFn: () => api.getAttemptResult(attemptId),
    enabled: Boolean(attemptId),
  })

  const paperQuery = useQuery<ExamPaperSummary>({
    queryKey: ['student', 'result-paper', result?.paperId],
    queryFn: () => api.getStudentExam(result!.paperId),
    enabled: Boolean(result?.paperId && result.status === 'COMPLETED'),
    retry: false,
  })

  if (isLoading) return <LoadingState label="Đang tải kết quả bài thi..." />
  if (error) return <ErrorState error={error} onRetry={refetch} />

  if (!result) {
    return (
      <Card className="mx-auto max-w-md text-center">
        <CardContent className="space-y-4 p-6">
          <h2 className="text-lg font-bold text-slate-900">Không tìm thấy bài thi</h2>
          <p className="text-sm text-slate-600">Không có thông tin lượt thi với mã này.</p>
          <Button onClick={() => navigate('/hoc-sinh/de-thi')}>Về danh sách đề thi</Button>
        </CardContent>
      </Card>
    )
  }

  const statusClass = classifyAttemptStatus(result.status)
  const isCompleted = result.status === 'COMPLETED'
  const isWaitingGrading = result.status === 'WAITING_GRADING' || result.status === 'SUBMITTED'
  const isCancelled = statusClass === 'CANCELLED'
  const isUnknownStatus = statusClass === 'UNKNOWN'
  const meta = attemptStatusMeta(result.status)
  const paperQuestions = paperQuery.data?.questions || []

  const displayScoreOnTen =
    isCompleted && result.scoreOnTen != null
      ? Number(result.scoreOnTen)
      : isCompleted && result.score != null && result.maxScore != null && Number(result.maxScore) > 0
        ? (Number(result.score) / Number(result.maxScore)) * 10
        : null
  const formattedScoreOnTen =
    displayScoreOnTen != null
      ? (Number.isInteger(displayScoreOnTen) ? String(displayScoreOnTen) : displayScoreOnTen.toFixed(2).replace(/\.?0+$/, ''))
      : '—'
  const scoreTone = scoreCardTone(displayScoreOnTen ?? result.score, displayScoreOnTen != null ? 10 : result.maxScore)

  const selectedChoiceText = (answer: AttemptAnswerRecord): string => {
    const selectedIds = answer.selectedAnswerIds || []
    const question = paperQuestions.find((item) => item.id === answer.questionId)
    if (!selectedIds.length) return ''
    if (!question?.answers?.length) return `${selectedIds.length} phương án đã chọn`
    return selectedIds
      .map((id) => {
        const idx = question.answers!.findIndex((item) => item.id === id)
        if (idx < 0) return null
        return `${String.fromCharCode(65 + idx)}. ${question.answers![idx].content}`
      })
      .filter(Boolean)
      .join('; ')
  }

  return (
    <div className="space-y-6" data-role="student">
      <PageHeader
        accent="teal"
        eyebrow="Kết quả bài thi"
        title="Bảng điểm & Chi tiết bài làm"
        description={`Chi tiết lượt thi: ${result.paperTitle || 'Bài kiểm tra'} (Lần ${result.attemptNumber || 1})`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {result.paperId && (
              <Button variant="teal" onClick={() => navigate(`/hoc-sinh/lam-bai/${result.paperId}?forceNew=1`)}>
                <RotateCcw className="h-4 w-4" />
                Làm lại bài thi
              </Button>
            )}
            <Button variant="outline" onClick={() => navigate('/hoc-sinh/de-thi')}>
              <ArrowLeft className="h-4 w-4" />
              Danh sách đề thi
            </Button>
          </div>
        }
      />

      <Card>
        <CardContent className="space-y-5 p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-slate-900">
                {result.paperTitle} (Lần {result.attemptNumber || 1})
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="indigo">{examTypeLabel(result.examType)}</Badge>
                <Badge variant={meta.tone}>{meta.label}</Badge>
                <Badge variant="neutral">Lần {result.attemptNumber || 1}</Badge>
                {result.examCode && <Badge variant="neutral">Mã đề #{result.examCode}</Badge>}
              </div>
            </div>

            {isCompleted ? (
              <div className={`rounded-xl border px-5 py-3 text-right ${scoreTone.box}`}>
                <div className={`text-xs font-semibold ${scoreTone.label}`}>Điểm thang 10</div>
                <div className={`text-3xl font-bold tabular-nums ${scoreTone.value}`}>
                  {formattedScoreOnTen}{' '}
                  <span className={`text-base font-semibold ${scoreTone.denom}`}>/ 10</span>
                </div>
                {result.correctCount != null && result.totalQuestions != null && result.examType !== 'ESSAY' && (
                  <div className={`text-xs font-medium tabular-nums ${scoreTone.scale}`}>
                    Đúng {result.correctCount} / {result.totalQuestions} câu
                  </div>
                )}
              </div>
            ) : isWaitingGrading ? (
              <div className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
                <Clock className="h-4 w-4" />
                Đang chờ giáo viên chấm bài
              </div>
            ) : isCancelled ? (
              <div className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
                <Ban className="h-4 w-4" />
                Lượt làm đã bị hủy
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="text-xs font-medium text-slate-500">Bắt đầu</div>
              <div className="mt-1 text-sm font-semibold text-slate-900 tabular-nums">{formatDate(result.startedAt)}</div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="text-xs font-medium text-slate-500">Nộp bài</div>
              <div className="mt-1 text-sm font-semibold text-slate-900 tabular-nums">{formatDate(result.submittedAt)}</div>
            </div>
            {result.gradedAt && (
              <div className="rounded-lg bg-slate-50 p-3">
                <div className="text-xs font-medium text-slate-500">Hoàn tất chấm</div>
                <div className="mt-1 text-sm font-semibold text-slate-900 tabular-nums">{formatDate(result.gradedAt)}</div>
              </div>
            )}
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="text-xs font-medium text-slate-500">Trạng thái</div>
              <div className="mt-1 text-sm font-bold text-slate-900">{meta.label}</div>
            </div>
          </div>

          {isCancelled && (
            <Alert variant="destructive">
              <AlertDescription>
                <strong>Lượt làm đã bị hủy.</strong> Bài làm này không được tính là đã nộp và không có điểm công bố.
              </AlertDescription>
            </Alert>
          )}

          {isUnknownStatus && (
            <Alert variant="warning">
              <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                <span>
                  Trạng thái lượt thi hiện chưa xác định ({result.status || 'trống'}). Hệ thống không tự xác nhận kết quả nộp bài.
                </span>
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  <RefreshCw className="h-3.5 w-3.5" />
                  Kiểm tra lại trạng thái
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {isWaitingGrading && (
            <Alert variant="warning">
              <AlertDescription>
                Bài thi tự luận của bạn đã được nộp thành công. Điểm chính thức và nhận xét của giáo viên sẽ hiển thị tại đây sau khi hoàn tất chấm.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {result.answers && result.answers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Chi tiết bài làm {isCompleted && result.examType === 'ESSAY' && 'và nhận xét giáo viên'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {result.answers.map((ans, idx) => {
              const qOrder = ans.questionOrder || idx + 1
              return (
                <div key={ans.questionId || idx} className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className="text-sm font-bold text-slate-900">
                      Câu {qOrder}: <span className="font-semibold"><MathRenderer content={ans.content || 'Nội dung câu hỏi không khả dụng'} /></span>
                    </h3>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="neutral">{typeLabel(ans.type)}</Badge>
                      {ans.awardedScore != null && (
                        <Badge variant="indigo" className="tabular-nums">
                          {ans.awardedScore} / {ans.maxScore ?? '—'} điểm
                        </Badge>
                      )}
                    </div>
                  </div>

                  {ans.type !== 'ESSAY' ? (
                    <div className="space-y-2 rounded-lg bg-slate-50 p-3 text-sm">
                      {selectedChoiceText(ans) ? (
                        <div>
                          <strong>Câu trả lời của bạn:</strong> {selectedChoiceText(ans)}
                        </div>
                      ) : ans.selectedAnswerIds?.length ? (
                        <div>
                          <strong>Câu trả lời của bạn:</strong> {ans.selectedAnswerIds.length} phương án đã chọn
                        </div>
                      ) : (
                        <div className="text-slate-500">(Không chọn phương án nào)</div>
                      )}
                      {isCompleted && ans.isCorrect != null && (
                        <div>
                          <Badge variant={ans.isCorrect ? 'success' : 'danger'}>
                            {ans.isCorrect ? (
                              <><CheckCircle2 className="h-3 w-3" /> Trả lời đúng</>
                            ) : (
                              <><XCircle className="h-3 w-3" /> Trả lời sai</>
                            )}
                          </Badge>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="rounded-lg border border-slate-200 bg-[#F8F7F4] p-3 text-sm">
                        <div className="text-xs font-semibold text-slate-500 mb-1">
                          Bài làm của bạn
                        </div>
                        <p className="whitespace-pre-line text-slate-900">{ans.essayAnswer || '— (Trống)'}</p>
                      </div>

                      {isCompleted && ans.feedback && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-950">
                          <div className="text-xs font-semibold text-amber-800 mb-1">
                            Nhận xét của giáo viên
                          </div>
                          <p className="whitespace-pre-line">{ans.feedback}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
