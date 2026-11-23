import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BookOpen,
  Clock,
  Eye,
  Globe,
  Lock,
  Play,
  RotateCcw,
  Search,
} from 'lucide-react'
import { api } from '@/api/service'
import { attemptStatusMeta, examTypeLabel } from '@/constants'
import { formatDateTime } from '@/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConfirmModal, EmptyState, ErrorState, LoadingState, PageHeader } from '@/components/common/StateFeedback'
import { cn } from '@/lib/utils'

function fmtTen(val) {
  if (val == null || Number.isNaN(Number(val))) return null
  const n = Number(val)
  return Number.isInteger(n) ? `${n}/10` : `${n.toFixed(2).replace(/\.?0+$/, '')}/10`
}

export default function StudentExamsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [retakeTarget, setRetakeTarget] = useState(null)
  const subjectIdParam = searchParams.get('subjectId') || ''
  const pageParam = Math.max(0, Number.parseInt(searchParams.get('page') || '0', 10) || 0)
  const sortByParam = searchParams.get('sortBy') || 'publishedAt'
  const sortDirParam = searchParams.get('sortDir') === 'asc' ? 'asc' : 'desc'
  const urlSearch = searchParams.get('search') || ''

  const [searchDraft, setSearchDraft] = useState(urlSearch)

  useEffect(() => {
    document.title = 'Đề thi & Luyện tập | Exam Matrix'
  }, [])

  useEffect(() => {
    setSearchDraft(urlSearch)
  }, [urlSearch])

  const updateParams = useCallback((patch, resetPage = false) => {
    const next = new URLSearchParams(searchParams)
    Object.entries(patch).forEach(([k, v]) => {
      if (v === '' || v == null) next.delete(k)
      else next.set(k, String(v))
    })
    if (resetPage) next.set('page', '0')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchDraft.trim() !== urlSearch) {
        updateParams({ search: searchDraft.trim() }, true)
      }
    }, 280)
    return () => clearTimeout(timer)
  }, [searchDraft, updateParams, urlSearch])

  const subjectsQuery = useQuery({
    queryKey: ['student', 'exam-subjects'],
    queryFn: () => api.getStudentExamSubjects(),
    staleTime: 10000,
  })

  const examsQuery = useQuery({
    queryKey: ['student', 'exams', subjectIdParam, urlSearch, sortByParam, sortDirParam, pageParam],
    queryFn: () =>
      api.getStudentExams({
        subjectId: subjectIdParam ? Number(subjectIdParam) : undefined,
        search: urlSearch || undefined,
        sortBy: sortByParam,
        sortDir: sortDirParam,
        page: pageParam,
        size: 10,
      }),
    placeholderData: (prev) => prev,
  })

  const subjectCounts = useMemo(() => subjectsQuery.data || [], [subjectsQuery.data])
  const totalAvailableAll = useMemo(
    () => subjectCounts.reduce((acc, s) => acc + Number(s.examCount || 0), 0),
    [subjectCounts],
  )

  const exams = examsQuery.data?.content || []
  const totalPages = examsQuery.data?.totalPages ?? 0
  const totalElements = examsQuery.data?.totalElements ?? 0

  const toggleSort = (field) => {
    if (sortByParam === field) {
      updateParams({ sortBy: field, sortDir: sortDirParam === 'desc' ? 'asc' : 'desc' }, true)
    } else {
      updateParams({ sortBy: field, sortDir: 'desc' }, true)
    }
  }

  const SortIcon = ({ field }) => {
    if (sortByParam !== field) return <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
    return sortDirParam === 'asc'
      ? <ArrowUp className="h-3.5 w-3.5 text-teal-700" />
      : <ArrowDown className="h-3.5 w-3.5 text-teal-700" />
  }

  const renderAction = (exam) => {
    const status = exam.attemptStatus
    if (!status) {
      return (
        <Button size="sm" variant="teal" asChild>
          <Link to={`/hoc-sinh/lam-bai/${exam.paperId}`}>
            <Play className="h-3.5 w-3.5" />
            Bắt đầu làm
          </Link>
        </Button>
      )
    }
    if (status === 'IN_PROGRESS') {
      return (
        <div className="inline-flex items-center justify-end gap-1.5">
          <Button size="sm" variant="teal" asChild>
            <Link to={`/hoc-sinh/lam-bai/${exam.paperId}`}>
              <Play className="h-3.5 w-3.5" />
              Tiếp tục
            </Link>
          </Button>
          <Button size="sm" variant="outline" onClick={() => setRetakeTarget(exam)}>
            <RotateCcw className="h-3.5 w-3.5" />
            Làm lại
          </Button>
        </div>
      )
    }
    if (status === 'WAITING_GRADING' || status === 'SUBMITTED' || status === 'COMPLETED') {
      return (
        <div className="inline-flex items-center justify-end gap-1.5">
          <Button size="sm" variant="outline" asChild>
            <Link to={`/hoc-sinh/ket-qua/${exam.attemptId}`}>
              <Eye className="h-3.5 w-3.5" />
              {status === 'COMPLETED' ? 'Xem kết quả' : 'Xem trạng thái'}
            </Link>
          </Button>
          <Button size="sm" variant="teal" asChild>
            <Link to={`/hoc-sinh/lam-bai/${exam.paperId}?forceNew=1`}>
              <RotateCcw className="h-3.5 w-3.5" />
              Làm lại
            </Link>
          </Button>
        </div>
      )
    }
    return (
      <Button size="sm" variant="teal" asChild>
        <Link to={`/hoc-sinh/lam-bai/${exam.paperId}?forceNew=1`}>
          <RotateCcw className="h-3.5 w-3.5" />
          Làm lại
        </Link>
      </Button>
    )
  }

  return (
    <div className="space-y-6 pb-20" data-role="student">
      <PageHeader
        accent="teal"
        title="Đề thi & Luyện tập"
        description="Chọn môn học để lọc nhanh đề thi khả dụng, mặc định sắp xếp theo đề phát hành mới nhất."
      />

      <section aria-label="Lọc theo môn học" className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => updateParams({ subjectId: '' }, true)}
          className={cn(
            'inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-colors cursor-pointer',
            !subjectIdParam
              ? 'border-teal-600 bg-teal-700 text-white shadow-xs'
              : 'border-slate-200 bg-white text-slate-700 hover:border-teal-300 hover:bg-teal-50/40',
          )}
        >
          <BookOpen className="h-3.5 w-3.5" />
          <span>Tất cả</span>
          <span
            className={cn(
              'rounded-full px-1.5 py-0.5 text-[11px] tabular-nums',
              !subjectIdParam ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600',
            )}
          >
            {totalAvailableAll}
          </span>
        </button>

        {subjectCounts.map((sub) => {
          const active = subjectIdParam === String(sub.subjectId)
          return (
            <button
              key={sub.subjectId}
              type="button"
              onClick={() => updateParams({ subjectId: String(sub.subjectId) }, true)}
              className={cn(
                'inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-colors cursor-pointer',
                active
                  ? 'border-teal-600 bg-teal-700 text-white shadow-xs'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-teal-300 hover:bg-teal-50/40',
              )}
            >
              <span>{sub.subjectName}</span>
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-[11px] tabular-nums',
                  active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600',
                )}
              >
                {sub.examCount}
              </span>
            </button>
          )
        })}
      </section>

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            placeholder="Tìm theo mã đề hoặc tên đề..."
            aria-label="Tìm đề thi theo mã hoặc tên"
            className="pl-9"
          />
        </div>
        <div className="text-xs font-semibold text-slate-600 tabular-nums">
          {totalElements} đề thi khả dụng
        </div>
      </div>

      {examsQuery.isPending ? (
        <LoadingState label="Đang tải danh sách đề thi..." />
      ) : examsQuery.isError ? (
        <ErrorState error={examsQuery.error} onRetry={examsQuery.refetch} />
      ) : exams.length === 0 ? (
        <EmptyState
          title="Không tìm thấy đề thi phù hợp"
          description="Thử chọn môn học khác hoặc xóa từ khóa tìm kiếm."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => toggleSort('examCode')}
                      className="inline-flex items-center gap-1 hover:text-teal-700 cursor-pointer"
                    >
                      Mã đề
                      <SortIcon field="examCode" />
                    </button>
                  </th>
                  <th className="px-4 py-3 border-l border-slate-200/70">
                    <button
                      type="button"
                      onClick={() => toggleSort('title')}
                      className="inline-flex items-center gap-1 hover:text-teal-700 cursor-pointer"
                    >
                      Đề thi &amp; Môn học
                      <SortIcon field="title" />
                    </button>
                  </th>
                  <th className="px-4 py-3 border-l border-slate-200/70 text-right">
                    <button
                      type="button"
                      onClick={() => toggleSort('duration')}
                      className="inline-flex items-center gap-1 hover:text-teal-700 cursor-pointer"
                    >
                      Thời lượng
                      <SortIcon field="duration" />
                    </button>
                  </th>
                  <th className="px-4 py-3 border-l border-slate-200/70">Phạm vi</th>
                  <th className="px-4 py-3 border-l border-slate-200/70">Trạng thái</th>
                  <th className="px-4 py-3 border-l border-slate-200/70 text-right">
                    <button
                      type="button"
                      onClick={() => toggleSort('publishedAt')}
                      className="inline-flex items-center gap-1 hover:text-teal-700 cursor-pointer"
                    >
                      Phát hành
                      <SortIcon field="publishedAt" />
                    </button>
                  </th>
                  <th className="px-4 py-3 border-l border-slate-200/70 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {exams.map((exam) => {
                  const statusMeta = exam.attemptStatus ? attemptStatusMeta(exam.attemptStatus) : null
                  const scoreText = exam.attemptStatus === 'COMPLETED' ? fmtTen(exam.scoreOnTen) : null
                  return (
                    <tr key={exam.paperId} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Badge variant="indigo" className="tabular-nums">#{exam.examCode}</Badge>
                      </td>
                      <td className="px-4 py-3 border-l border-slate-100">
                        <div className="font-semibold text-slate-900">{exam.title}</div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span>{exam.subjectName}</span>
                          <span>·</span>
                          <span>{examTypeLabel(exam.examType)}</span>
                          <span>·</span>
                          <span className="tabular-nums">{exam.totalQuestions} câu</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 border-l border-slate-100 text-right whitespace-nowrap tabular-nums text-slate-700">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-slate-400" />
                          {exam.duration} phút
                        </span>
                      </td>
                      <td className="px-4 py-3 border-l border-slate-100 whitespace-nowrap">
                        <Badge variant={exam.accessType === 'PRIVATE' ? 'warning' : 'success'}>
                          {exam.accessType === 'PRIVATE' ? (
                            <><Lock className="h-3 w-3" /> Lớp học</>
                          ) : (
                            <><Globe className="h-3 w-3" /> Công khai</>
                          )}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 border-l border-slate-100 whitespace-nowrap">
                        {!statusMeta ? (
                          <Badge variant="neutral">Chưa làm</Badge>
                        ) : (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge variant={statusMeta.variant || statusMeta.tone}>{statusMeta.label}</Badge>
                            {exam.attemptNumber && (
                              <Badge variant="neutral" className="text-[11px]">Lần {exam.attemptNumber}</Badge>
                            )}
                            {scoreText && (
                              <span className="text-xs font-bold tabular-nums text-teal-700">{scoreText}</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 border-l border-slate-100 text-right whitespace-nowrap text-xs tabular-nums text-slate-500">
                        {formatDateTime(exam.publishedAt || exam.createdAt)}
                      </td>
                      <td className="px-4 py-3 border-l border-slate-100 text-right whitespace-nowrap">
                        {renderAction(exam)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-600">
              <span className="tabular-nums">
                Trang {pageParam + 1} / {totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pageParam <= 0}
                  onClick={() => updateParams({ page: pageParam - 1 })}
                >
                  Trước
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pageParam + 1 >= totalPages}
                  onClick={() => updateParams({ page: pageParam + 1 })}
                >
                  Sau
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {retakeTarget && (
        <ConfirmModal
          title="Làm lại bài thi từ đầu?"
          message={`Lượt thi đang làm dở của đề "${retakeTarget.title}" (Lần ${retakeTarget.attemptNumber || 1}) sẽ được đánh dấu Đã hủy và hệ thống mở lượt làm mới (Lần ${(retakeTarget.attemptNumber || 1) + 1}).`}
          confirmText="Làm lại ngay"
          onCancel={() => setRetakeTarget(null)}
          onConfirm={() => {
            const targetId = retakeTarget.paperId
            setRetakeTarget(null)
            navigate(`/hoc-sinh/lam-bai/${targetId}?forceNew=1`)
          }}
        />
      )}
    </div>
  )
}
