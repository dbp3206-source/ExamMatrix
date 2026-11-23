import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckCircle2,
  ClipboardList,
  Clock,
  Eye,
  FileBarChart2,
  Search,
  XCircle,
} from 'lucide-react'
import { api } from '@/api/service'
import { attemptStatusMeta, examTypeLabel, scoreCardTone, typeLabel } from '@/constants'
import { formatDateTime } from '@/utils'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { EmptyState, ErrorState, LoadingState, PageHeader } from '@/components/common/StateFeedback'

interface TeacherResultRow {
  attemptId: string
  studentId: string
  studentName: string
  studentEmail: string
  className: string | null
  classCode: string | null
  subjectId: number
  subjectName: string
  paperId: string
  paperTitle: string
  examCode: string
  examType: 'OBJECTIVE' | 'ESSAY'
  attemptNumber?: number
  status: 'IN_PROGRESS' | 'WAITING_GRADING' | 'COMPLETED' | 'CANCELLED' | string
  scoreOnTen: number | null
  rawScore: number | null
  maxScore: number | null
  startedAt: string | null
  submittedAt: string | null
  gradedAt: string | null
  gradedByName: string | null
  relationLabel: string
}

interface PageResult<T> {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

interface GradingOptionItem {
  id: string
  content: string
  isCorrect: boolean
}

interface GradingAnswerItem {
  attemptAnswerId: string | null
  questionId: string
  questionOrder: number
  content: string
  type: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'ESSAY' | string
  points: number
  essayAnswer: string | null
  referenceAnswer: string | null
  selectedAnswerIds: string[]
  options?: GradingOptionItem[]
  awardedScore: number | null
  feedback: string | null
  isCorrect: boolean | null
}

interface GradingAttemptDetail {
  attemptId: string
  paperId: string
  paperTitle: string
  attemptNumber?: number
  studentId: string
  studentName: string
  studentEmail: string
  submittedAt: string | null
  status: string
  examType: 'OBJECTIVE' | 'ESSAY'
  score: number | null
  maxScore: number | null
  scoreOnTen: number | null
  answers: GradingAnswerItem[]
}

function fmtNum(val: number | null | undefined) {
  if (val == null || Number.isNaN(Number(val))) return '—'
  const n = Number(val)
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, '')
}

function fmtTen(val: number | null | undefined) {
  const s = fmtNum(val)
  return s === '—' ? '—' : `${s}/10`
}

export default function TeacherResultsPage() {
  const [search, setSearch] = useState('')
  const [examType, setExamType] = useState<'ALL' | 'OBJECTIVE' | 'ESSAY'>('ALL')
  const [status, setStatus] = useState<'ALL' | 'COMPLETED' | 'WAITING_GRADING' | 'IN_PROGRESS' | 'CANCELLED'>('ALL')
  const [sortBy, setSortBy] = useState<'time' | 'score'>('time')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(0)
  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(null)

  useEffect(() => {
    document.title = 'Theo dõi Kết quả | Exam Matrix'
  }, [])

  const listQuery = useQuery<PageResult<TeacherResultRow>>({
    queryKey: ['teacher-results', examType, status, search, sortBy, sortDir, page],
    queryFn: () =>
      api.getTeacherResults({
        examType: examType === 'ALL' ? undefined : examType,
        status: status === 'ALL' ? undefined : status,
        search: search.trim() || undefined,
        sortBy,
        sortDir,
        page,
        size: 12,
      }),
  })

  const detailQuery = useQuery<GradingAttemptDetail>({
    queryKey: ['teacher-attempt-detail', selectedAttemptId],
    queryFn: () => api.getGradingAttempt(selectedAttemptId!),
    enabled: Boolean(selectedAttemptId),
  })

  const toggleSort = (col: 'time' | 'score') => {
    if (sortBy === col) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortBy(col)
      setSortDir('desc')
    }
    setPage(0)
  }

  const rows = listQuery.data?.content || []
  const totalElements = listQuery.data?.totalElements || 0
  const totalPages = listQuery.data?.totalPages || 0

  return (
    <div className="space-y-6 pb-16">
      <PageHeader
        title="Theo dõi Kết quả"
        description="Xem điểm số, trạng thái làm bài của học sinh và kiểm tra chi tiết từng câu đúng/sai trong bài làm."
        action={
          <Button size="sm" variant="outline" asChild>
            <Link to="/giao-vien/cham-thi">
              <ClipboardList className="h-3.5 w-3.5" />
              Chấm tự luận
            </Link>
          </Button>
        }
      />

      <Card className="border-slate-200 shadow-xs">
        <CardHeader className="border-b border-slate-100 pb-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
              <FileBarChart2 className="h-4 w-4 text-indigo-600" />
              Danh sách bài làm của học sinh
              <Badge variant="neutral" className="tabular-nums">
                {totalElements} lượt thi
              </Badge>
            </CardTitle>

            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(0)
                }}
                placeholder="Tìm học sinh, đề thi, môn, mã đề..."
                className="h-9 pl-9 text-sm"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs font-semibold text-slate-500">Loại đề:</span>
            {(
              [
                ['ALL', 'Tất cả'],
                ['OBJECTIVE', 'Trắc nghiệm'],
                ['ESSAY', 'Tự luận'],
              ] as const
            ).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => {
                  setExamType(val)
                  setPage(0)
                }}
                className={cn(
                  'rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer',
                  examType === val
                    ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                )}
              >
                {label}
              </button>
            ))}

            <span className="ml-2 text-xs font-semibold text-slate-500">Trạng thái:</span>
            {(
              [
                ['ALL', 'Tất cả'],
                ['COMPLETED', 'Đã hoàn thành'],
                ['WAITING_GRADING', 'Chờ chấm'],
                ['IN_PROGRESS', 'Đang làm'],
                ['CANCELLED', 'Đã hủy'],
              ] as const
            ).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => {
                  setStatus(val)
                  setPage(0)
                }}
                className={cn(
                  'rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer',
                  status === val
                    ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {listQuery.isPending ? (
            <div className="p-6">
              <LoadingState label="Đang tải danh sách kết quả..." />
            </div>
          ) : listQuery.isError ? (
            <div className="p-6">
              <ErrorState error={listQuery.error} onRetry={listQuery.refetch} />
            </div>
          ) : rows.length === 0 ? (
            <div className="p-6">
              <EmptyState
                title="Chưa có lượt làm bài phù hợp"
                description="Khi học sinh làm đề của bạn hoặc học sinh trong lớp bạn làm bài, kết quả sẽ hiển thị tại đây."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Học sinh</th>
                    <th className="px-4 py-3">Bài kiểm tra & Môn</th>
                    <th className="px-4 py-3">Loại bài</th>
                    <th className="px-4 py-3">Trạng thái</th>
                    <th className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => toggleSort('score')}
                        className="inline-flex items-center gap-1 hover:text-slate-900 cursor-pointer"
                      >
                        Điểm (Thang 10)
                        {sortBy === 'score' ? (
                          sortDir === 'desc' ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUp className="h-3.5 w-3.5" />
                        ) : (
                          <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />
                        )}
                      </button>
                    </th>
                    <th className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => toggleSort('time')}
                        className="inline-flex items-center gap-1 hover:text-slate-900 cursor-pointer"
                      >
                        Thời gian
                        {sortBy === 'time' ? (
                          sortDir === 'desc' ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUp className="h-3.5 w-3.5" />
                        ) : (
                          <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />
                        )}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-right">Chi tiết</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row) => {
                    const stMeta = attemptStatusMeta(row.status)
                    const timeVal = row.gradedAt || row.submittedAt || row.startedAt
                    return (
                      <tr
                        key={row.attemptId}
                        onClick={() => setSelectedAttemptId(row.attemptId)}
                        className="hover:bg-indigo-50/40 transition-colors cursor-pointer"
                      >
                        <td className="px-4 py-3 align-top">
                          <div className="font-semibold text-slate-900">{row.studentName}</div>
                          <div className="text-xs text-slate-500">{row.studentEmail}</div>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {row.className && (
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
                                Lớp {row.className}
                              </span>
                            )}
                            <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[11px] font-medium text-indigo-700">
                              {row.relationLabel}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <div className="font-semibold text-slate-900">{row.paperTitle} (Lần {row.attemptNumber || 1})</div>
                          <div className="mt-0.5 text-xs text-slate-500">
                            {row.subjectName} · Mã đề <span className="font-mono font-semibold text-slate-700">{row.examCode}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <Badge variant={row.examType === 'ESSAY' ? 'warning' : 'indigo'}>
                            {examTypeLabel(row.examType)}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <Badge variant={stMeta.tone}>{stMeta.label}</Badge>
                        </td>
                        <td className="px-4 py-3 align-top tabular-nums">
                          {row.status === 'COMPLETED' ? (
                            <div>
                              <span className="text-sm font-bold text-slate-900">{fmtTen(row.scoreOnTen)}</span>
                              {row.rawScore != null && row.maxScore != null && (
                                <div className="text-xs text-slate-500">
                                  ({fmtNum(row.rawScore)}/{fmtNum(row.maxScore)}đ)
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">Chưa có điểm</span>
                          )}
                        </td>
                        <td className="px-4 py-3 align-top text-xs text-slate-600 tabular-nums">
                          {timeVal ? formatDateTime(timeVal) : '—'}
                        </td>
                        <td className="px-4 py-3 align-top text-right">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedAttemptId(row.attemptId)
                            }}
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Xem bài làm
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-600">
              <span className="tabular-nums">
                Trang {page + 1} / {totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  Trước
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={page + 1 >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Sau
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(selectedAttemptId)} onOpenChange={(open) => !open && setSelectedAttemptId(null)}>
        <DialogContent className="max-w-4xl max-h-[88vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2">
              <FileBarChart2 className="h-5 w-5 text-indigo-600" />
              Chi tiết bài làm của học sinh
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-1 space-y-4">
            {detailQuery.isPending ? (
              <LoadingState label="Đang tải chi tiết bài làm..." />
            ) : detailQuery.isError ? (
              <ErrorState error={detailQuery.error} onRetry={detailQuery.refetch} />
            ) : detailQuery.data ? (
              <>
                {(() => {
                  const d = detailQuery.data
                  const st = attemptStatusMeta(d.status)
                  const tone = scoreCardTone(d.scoreOnTen ?? d.score, d.scoreOnTen != null ? 10 : d.maxScore)
                  return (
                    <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 sm:grid-cols-4">
                      <div className="sm:col-span-2 space-y-1">
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Học sinh</div>
                        <div className="text-sm font-bold text-slate-900">{d.studentName}</div>
                        <div className="text-xs text-slate-500">{d.studentEmail}</div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Bài kiểm tra</div>
                        <div className="text-sm font-semibold text-slate-900">{d.paperTitle} (Lần {d.attemptNumber || 1})</div>
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          <Badge variant={d.examType === 'ESSAY' ? 'warning' : 'indigo'}>{examTypeLabel(d.examType)}</Badge>
                          <Badge variant={st.tone}>{st.label}</Badge>
                        </div>
                      </div>
                      <div className={cn('rounded-lg border p-3 text-center', tone.box)}>
                        <div className={cn('text-[11px] font-semibold uppercase tracking-wide', tone.label)}>Điểm thang 10</div>
                        <div className={cn('mt-0.5 text-xl font-extrabold tabular-nums', tone.value)}>
                          {d.status === 'COMPLETED' ? fmtTen(d.scoreOnTen) : '—'}
                        </div>
                        {d.status === 'COMPLETED' && d.score != null && d.maxScore != null && (
                          <div className={cn('text-[11px] tabular-nums', tone.denom)}>
                            ({fmtNum(d.score)}/{fmtNum(d.maxScore)}đ)
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })()}

                {detailQuery.data.status === 'WAITING_GRADING' && (
                  <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
                    <span className="flex items-center gap-2 font-medium">
                      <Clock className="h-4 w-4" />
                      Bài tự luận này đang chờ chấm điểm.
                    </span>
                    <Button size="sm" variant="outline" asChild>
                      <Link to="/giao-vien/cham-thi">Đi tới trang Chấm tự luận</Link>
                    </Button>
                  </div>
                )}

                <div className="space-y-3">
                  {detailQuery.data.answers.map((ans) => {
                    const selectedSet = new Set(ans.selectedAnswerIds || [])
                    const isObj = ans.type !== 'ESSAY'
                    const isUnanswered = isObj ? selectedSet.size === 0 : !ans.essayAnswer?.trim()
                    return (
                      <div key={ans.questionId} className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-800">
                              Câu {ans.questionOrder}
                            </span>
                            <Badge variant="neutral">{typeLabel(ans.type)}</Badge>
                            {ans.isCorrect === true && (
                              <Badge variant="success" className="gap-1">
                                <CheckCircle2 className="h-3 w-3" /> Đúng
                              </Badge>
                            )}
                            {ans.isCorrect === false && (
                              <Badge variant="danger" className="gap-1">
                                <XCircle className="h-3 w-3" /> {isUnanswered ? 'Bỏ trống' : 'Sai'}
                              </Badge>
                            )}
                          </div>
                          <span className="text-xs font-semibold text-slate-600 tabular-nums">
                            Điểm: {ans.awardedScore != null ? fmtNum(ans.awardedScore) : '—'} / {fmtNum(ans.points)}
                          </span>
                        </div>

                        <p className="whitespace-pre-wrap text-sm font-medium text-slate-900 leading-relaxed">
                          {ans.content}
                        </p>

                        {isObj ? (
                          <div className="space-y-1.5">
                            {(ans.options || []).map((opt, idx) => {
                              const picked = selectedSet.has(opt.id)
                              const right = Boolean(opt.isCorrect)
                              let boxCls = 'border-slate-200 bg-slate-50/40 text-slate-700'
                              if (picked && right) {
                                boxCls = 'border-emerald-300 bg-emerald-50 text-emerald-900 font-medium'
                              } else if (picked && !right) {
                                boxCls = 'border-rose-300 bg-rose-50 text-rose-900 font-medium'
                              } else if (!picked && right) {
                                boxCls = 'border-emerald-200 bg-emerald-50/40 text-emerald-800'
                              }
                              return (
                                <div key={opt.id} className={cn('flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs', boxCls)}>
                                  <span>
                                    <strong className="mr-1.5">{String.fromCharCode(65 + idx)}.</strong>
                                    {opt.content}
                                  </span>
                                  <div className="flex shrink-0 items-center gap-1.5">
                                    {picked && (
                                      <span className={cn('rounded px-1.5 py-0.5 text-[11px] font-semibold', right ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800')}>
                                        HS chọn
                                      </span>
                                    )}
                                    {right && (
                                      <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-800">
                                        Đáp án đúng
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        ) : (
                          <div className="space-y-2 text-xs">
                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                              <div className="mb-1 font-bold uppercase tracking-wide text-slate-500">
                                Bài làm của {detailQuery.data.studentName}
                              </div>
                              <p className="whitespace-pre-wrap text-sm text-slate-800">
                                {ans.essayAnswer?.trim() || '—'}
                              </p>
                            </div>
                            {ans.referenceAnswer && (
                              <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
                                <div className="mb-1 font-bold uppercase tracking-wide text-emerald-700">
                                  Đáp án tham khảo (Barem)
                                </div>
                                <p className="whitespace-pre-wrap text-slate-800">{ans.referenceAnswer}</p>
                              </div>
                            )}
                            {ans.feedback && (
                              <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-3">
                                <div className="mb-1 font-bold uppercase tracking-wide text-indigo-700">
                                  Nhận xét của giáo viên
                                </div>
                                <p className="whitespace-pre-wrap text-slate-800">{ans.feedback}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
