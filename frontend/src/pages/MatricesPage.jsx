import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CheckCircle2, Clock, FileSpreadsheet, Grid3X3, Layers, Lock, Pencil, Plus, Printer, Search, Trash2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { emitAssistantHint } from '@/utils/assistant'
import { api } from '@/api/service'
import { useAuth } from '@/auth/AuthContext'
import { DIFFICULTIES, EXAM_TYPES, examTypeLabel, getSubjectPreset } from '@/constants'
import { formatDate } from '@/utils'
import { parsePaperCount } from '@/utils/paperCount'
import {
  clearPendingGenerationRequest,
  findAnyPendingGenerationRequest,
  loadPendingGenerationRequest,
  savePendingGenerationRequest,
} from '@/utils/generationRequestStorage'
import GenerationAdviceModal from '@/components/matrices/GenerationAdviceModal'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable } from '@/components/ui/data-table'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import {
  ConfirmModal,
  DifficultyBadge,
  EmptyState,
  ErrorState,
  FieldError,
  LoadingState,
  PageHeader,
  Pagination,
  SubjectIcon,
} from '@/components/common/StateFeedback'
import { cn } from '@/lib/utils'

const keyOf = (chapterId, difficulty) => `${chapterId}-${difficulty}`

function ConfigTable({ chapters, availability, quantities, setQuantity }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-sm text-left">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-600">Chương bài</th>
            {DIFFICULTIES.map((difficulty) => (
              <th key={difficulty.value} className="px-4 py-3 text-center">
                <DifficultyBadge value={difficulty.value} />
              </th>
            ))}
            <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-600">Tổng</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {chapters.map((chapter) => {
            const rowTotal = DIFFICULTIES.reduce(
              (sum, difficulty) => sum + Number(quantities[keyOf(chapter.id, difficulty.value)] || 0),
              0
            )
            return (
              <tr key={chapter.id} className="hover:bg-slate-50/50">
                <td className="px-4 py-3 font-semibold text-slate-900">
                  {chapter.orderIndex}. {chapter.name}
                </td>
                {DIFFICULTIES.map((difficulty) => {
                  const key = keyOf(chapter.id, difficulty.value)
                  const available =
                    availability.find((item) => item.chapterId === chapter.id && item.difficulty === difficulty.value)
                      ?.available || 0
                  const value = Number(quantities[key] || 0)
                  const isOver = value > available

                  return (
                    <td key={difficulty.value} className="px-4 py-3 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <Input
                          aria-label={`${chapter.name} - ${difficulty.label}`}
                          className={cn(
                            'h-9 w-20 text-center font-bold tabular-nums',
                            isOver && 'border-rose-500 bg-rose-50 text-rose-800 focus-visible:ring-rose-500'
                          )}
                          type="number"
                          min={0}
                          step={1}
                          value={value}
                          onChange={(event) =>
                            setQuantity(key, Math.max(0, Math.floor(Number(event.target.value)) || 0))
                          }
                        />
                        {isOver ? (
                          <span className="text-[11px] font-semibold text-rose-700 tabular-nums">
                            Có {available} · thiếu {value - available}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-500 tabular-nums">
                            Khả dụng: <strong>{available}</strong>
                          </span>
                        )}
                      </div>
                    </td>
                  )
                })}
                <td className="px-4 py-3 text-center font-extrabold text-indigo-700 tabular-nums">{rowTotal}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function MatrixFormDialog({ item, subjects, allChapters, onClose }) {
  const queryClient = useQueryClient()
  const [subjectId, setSubjectId] = useState(item?.subjectId ? String(item.subjectId) : '')
  const [examType, setExamType] = useState(item?.examType || 'OBJECTIVE')
  const [quantities, setQuantities] = useState(() =>
    Object.fromEntries((item?.configs || []).map((c) => [keyOf(c.chapterId, c.difficulty), c.quantity]))
  )
  const [configError, setConfigError] = useState('')
  const { register, handleSubmit, setError, formState: { errors } } = useForm({
    defaultValues: item || { title: '', duration: 45, totalQuestions: 12 },
  })

  const availability = useQuery({
    queryKey: ['availability', subjectId, examType],
    queryFn: () => api.getAvailability({ subjectId, examType }),
    enabled: Boolean(subjectId),
  })

  const chapters = useMemo(
    () => allChapters.filter((chapter) => chapter.subjectId === Number(subjectId)),
    [allChapters, subjectId]
  )
  const totalConfigured = Object.values(quantities).reduce((sum, value) => sum + Number(value || 0), 0)

  const mutation = useMutation({
    mutationFn: (body) => (item ? api.updateMatrix(item.id, body) : api.createMatrix(body)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matrices'] })
      queryClient.invalidateQueries({ queryKey: ['matrix'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success(item ? 'Đã cập nhật ma trận thành công' : 'Đã tạo ma trận thành công')
      onClose()
    },
    onError: (error) =>
      setError('root', {
        message: error.message || error.response?.data?.message || 'Không thể lưu ma trận',
      }),
  })

  const resetConfiguration = () => {
    setQuantities({})
    setConfigError('')
  }

  const submit = (values) => {
    setConfigError('')
    if (!subjectId) return setError('subjectId', { message: 'Vui lòng chọn môn học' })
    if (!availability.isSuccess || availability.isFetching) {
      return setConfigError('Chưa thể xác nhận số câu hỏi khả dụng. Vui lòng đợi tải xong.')
    }
    const total = Number(values.totalQuestions)
    if (totalConfigured !== total) {
      return setConfigError(`Tổng số câu cấu hình hiện là ${totalConfigured}, phải bằng đúng ${total} câu.`)
    }
    const over = availability.data.find(
      (entry) => Number(quantities[keyOf(entry.chapterId, entry.difficulty)] || 0) > entry.available
    )
    if (over) {
      return setConfigError('Cấu hình đang yêu cầu nhiều hơn số câu hỏi hiện có trong ngân hàng.')
    }
    const configs = Object.entries(quantities)
      .filter(([, quantity]) => Number(quantity) > 0)
      .map(([key, quantity]) => {
        const [chapterId, difficulty] = key.split('-')
        return { chapterId: Number(chapterId), difficulty, quantity: Number(quantity) }
      })
    mutation.mutate({
      subjectId: Number(subjectId),
      examType,
      title: values.title.trim(),
      duration: Number(values.duration),
      totalQuestions: total,
      configs,
    })
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !mutation.isPending) onClose() }}>
      <DialogContent wide>
        <DialogHeader>
          <DialogTitle>{item ? 'Chỉnh sửa ma trận đề thi' : 'Thêm ma trận đề thi mới'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(submit)} noValidate className="space-y-5">
          {errors.root && (
            <Alert variant="destructive">
              <AlertDescription>{errors.root.message}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="m-title">Tiêu đề ma trận</Label>
              <Input
                id="m-title"
                maxLength={100}
                placeholder="VD: Kiểm tra giữa kỳ 1 - Toán 12"
                {...register('title', {
                  required: 'Tiêu đề là bắt buộc',
                  maxLength: { value: 100, message: 'Tối đa 100 ký tự' },
                })}
              />
              <FieldError>{errors.title?.message}</FieldError>
            </div>

            <div>
              <Label htmlFor="m-subject">Môn học áp dụng</Label>
              <Select
                id="m-subject"
                value={subjectId}
                disabled={Boolean(item)}
                onChange={(event) => {
                  setSubjectId(event.target.value)
                  resetConfiguration()
                }}
              >
                <option value="">Chọn môn học</option>
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.code} - {subject.name}
                  </option>
                ))}
              </Select>
              <FieldError>{errors.subjectId?.message}</FieldError>
            </div>

            <div>
              <Label htmlFor="m-type">Hình thức đề thi</Label>
              <Select
                id="m-type"
                value={examType}
                disabled={Boolean(item)}
                onChange={(event) => {
                  setExamType(event.target.value)
                  resetConfiguration()
                }}
              >
                {EXAM_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="m-duration">Thời lượng (phút)</Label>
                <Input
                  id="m-duration"
                  type="number"
                  min={1}
                  {...register('duration', {
                    valueAsNumber: true,
                    required: 'Thời gian là bắt buộc',
                    min: { value: 1, message: 'Phải lớn hơn 0' },
                  })}
                />
                <FieldError>{errors.duration?.message}</FieldError>
              </div>

              <div>
                <Label htmlFor="m-total">Tổng số câu</Label>
                <Input
                  id="m-total"
                  type="number"
                  min={1}
                  {...register('totalQuestions', {
                    valueAsNumber: true,
                    required: 'Tổng số câu là bắt buộc',
                    min: { value: 1, message: 'Phải lớn hơn 0' },
                  })}
                />
                <FieldError>{errors.totalQuestions?.message}</FieldError>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Phân bổ câu hỏi {examType === 'ESSAY' ? 'tự luận' : 'trắc nghiệm'}
                </h3>
                <p className="text-xs text-slate-500">
                  Tổng đã cấu hình: <strong className="text-indigo-700 tabular-nums">{totalConfigured}</strong> câu
                </p>
              </div>
            </div>

            {!subjectId ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
                Chọn môn học ở trên để mở bảng phân bổ chương × độ khó.
              </div>
            ) : availability.isLoading ? (
              <LoadingState label="Đang kiểm tra số lượng câu hỏi khả dụng..." />
            ) : availability.isError ? (
              <ErrorState error={availability.error} onRetry={availability.refetch} />
            ) : !chapters.length ? (
              <EmptyState title="Môn học chưa có chương bài" description="Vui lòng thiết lập chương bài trước khi cấu hình ma trận." />
            ) : (
              <ConfigTable
                chapters={chapters}
                availability={availability.data}
                quantities={quantities}
                setQuantity={(key, value) => setQuantities((current) => ({ ...current, [key]: value }))}
              />
            )}
            <FieldError>{configError}</FieldError>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
              Hủy
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending || !subjectId || !availability.isSuccess || availability.isFetching}
            >
              {mutation.isPending ? 'Đang lưu...' : 'Lưu ma trận'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function MatricesPage() {
  const [filters, setFilters] = useState({ search: '', subjectId: '', examType: '', page: 0, size: 10 })
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const queryClient = useQueryClient()

  useEffect(() => {
    document.title = 'Ma trận đề | Exam Matrix'
  }, [])

  const subjects = useQuery({ queryKey: ['subjects'], queryFn: api.getSubjects })
  const chapters = useQuery({ queryKey: ['chapters', 'all'], queryFn: () => api.getChapters({}) })
  const matrices = useQuery({ queryKey: ['matrices', filters], queryFn: () => api.getMatrices(filters) })

  const deleteMutation = useMutation({
    mutationFn: api.deleteMatrix,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matrices'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Đã xóa ma trận đề thi')
      if (matrices.data?.content.length === 1) {
        setFilters((current) => ({ ...current, page: Math.max(0, current.page - 1) }))
      }
      setDeleting(null)
    },
    onError: (error) => {
      toast.error(error.message || 'Không thể xóa ma trận đã sinh đề')
      setDeleting(null)
    },
  })

  const setFilter = (name, value) =>
    setFilters((current) => ({ ...current, [name]: value, page: name === 'page' ? value : 0 }))

  const subjectList = useMemo(() => subjects.data || [], [subjects.data])

  const columns = useMemo(
    () => [
      {
        accessorKey: 'title',
        header: 'Tiêu đề ma trận',
        cell: ({ row }) => (
          <Link to={`/ma-tran/${row.original.id}`} className="font-bold text-slate-900 hover:text-indigo-700">
            {row.original.title}
          </Link>
        ),
      },
      {
        accessorKey: 'examType',
        header: 'Hình thức',
        cell: ({ row }) => (
          <Badge variant={row.original.examType === 'ESSAY' ? 'amber' : 'indigo'}>
            {examTypeLabel(row.original.examType)}
          </Badge>
        ),
      },
      {
        id: 'subject',
        header: 'Môn học',
        cell: ({ row }) => {
          const subject = subjectList.find((s) => s.id === row.original.subjectId)
          const preset = getSubjectPreset(subject?.code, subject?.name)
          return (
            <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold ${preset.badgeClass}`}>
              <SubjectIcon codeOrName={subject?.code} name={subject?.name} size={13} />
              {subject?.name || '—'}
            </span>
          )
        },
      },
      {
        accessorKey: 'duration',
        header: 'Thời lượng',
        cell: ({ row }) => <span className="tabular-nums">{row.original.duration} phút</span>,
      },
      {
        accessorKey: 'totalQuestions',
        header: 'Số câu',
        cell: ({ row }) => <span className="font-bold text-slate-900 tabular-nums">{row.original.totalQuestions} câu</span>,
      },
      {
        accessorKey: 'updatedAt',
        header: 'Cập nhật',
        cell: ({ row }) => <span className="text-xs text-slate-500">{formatDate(row.original.updatedAt)}</span>,
      },
      {
        id: 'actions',
        header: 'Thao tác',
        meta: { headClassName: 'text-right', cellClassName: 'text-right' },
        cell: ({ row }) => (
          <div className="inline-flex items-center justify-end gap-1.5">
            <Button variant="outline" size="sm" asChild>
              <Link to={`/ma-tran/${row.original.id}`}>
                Chi tiết & Sinh đề
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
            <Button variant="ghost" size="icon" aria-label="Sửa ma trận" onClick={() => setEditing(row.original)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Xóa ma trận"
              className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
              onClick={() => setDeleting(row.original)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ),
      },
    ],
    [subjectList]
  )

  if (subjects.isLoading || chapters.isLoading) return <LoadingState label="Đang tải dữ liệu môn học..." />
  if (subjects.isError || chapters.isError) {
    return (
      <ErrorState
        error={subjects.error || chapters.error}
        onRetry={() => {
          subjects.refetch()
          chapters.refetch()
        }}
      />
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        accent="indigo"
        eyebrow="CẤU TRÚC ĐỀ THI"
        title="Quản lý ma trận đề"
        description="Phân bổ số câu theo chương và ba mức độ khó, kiểm tra khả dụng trước khi sinh 1–20 mã đề."
        action={
          <Button onClick={() => setEditing({})}>
            <Plus className="h-4 w-4" />
            Thêm ma trận
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs sm:grid-cols-3">
        <div>
          <Label htmlFor="mat-search">Tìm kiếm</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              id="mat-search"
              value={filters.search}
              onChange={(e) => setFilter('search', e.target.value)}
              placeholder="Tìm tiêu đề ma trận..."
              className="pl-9"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="mat-subject">Môn học</Label>
          <Select id="mat-subject" value={filters.subjectId} onChange={(e) => setFilter('subjectId', e.target.value)}>
            <option value="">Tất cả môn học</option>
            {subjectList.map((s) => (
              <option key={s.id} value={s.id}>{s.code} - {s.name}</option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="mat-type">Hình thức đề</Label>
          <Select id="mat-type" value={filters.examType} onChange={(e) => setFilter('examType', e.target.value)}>
            <option value="">Tất cả hình thức</option>
            {EXAM_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </Select>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs font-semibold text-slate-600" aria-live="polite">
        <span className="tabular-nums">{matrices.data?.totalElements ?? 0} ma trận trong phạm vi hiện tại</span>
        <span className="tabular-nums">Trang {Number(matrices.data?.page ?? filters.page) + 1}</span>
      </div>

      {matrices.isLoading ? (
        <LoadingState label="Đang tải danh sách ma trận đề..." />
      ) : matrices.isError ? (
        <ErrorState error={matrices.error} onRetry={matrices.refetch} />
      ) : !matrices.data.content.length ? (
        <EmptyState
          title="Chưa có ma trận đề thi"
          description="Tạo ma trận đầu tiên để bắt đầu cấu hình và sinh đề thi tự động."
        />
      ) : (
        <>
          <DataTable columns={columns} data={matrices.data.content} getRowId={(r) => String(r.id)} />
          <Pagination
            page={matrices.data.page}
            totalPages={matrices.data.totalPages}
            onChange={(page) => setFilter('page', page)}
          />
        </>
      )}

      {editing && (
        <MatrixFormDialog
          item={editing.id ? editing : null}
          subjects={subjectList}
          allChapters={chapters.data}
          onClose={() => setEditing(null)}
        />
      )}

      {deleting && (
        <ConfirmModal
          title="Xác nhận xóa ma trận đề"
          message={`Bạn có chắc muốn xóa ma trận “${deleting.title}”? Lưu ý: Nếu ma trận đã được dùng để sinh đề thi, hệ thống sẽ từ chối xóa (409) để bảo toàn cấu trúc đề đã phát hành.`}
          onClose={() => setDeleting(null)}
          onConfirm={() => deleteMutation.mutate(deleting.id)}
          busy={deleteMutation.isPending}
        />
      )}
    </div>
  )
}

export function MatrixDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [number, setNumber] = useState('1')
  const [paperPage, setPaperPage] = useState(0)
  const [confirmGenerate, setConfirmGenerate] = useState(false)
  const [adviceData, setAdviceData] = useState(null)
  const [adviceLoading, setAdviceLoading] = useState(false)
  const [adviceStaleError, setAdviceStaleError] = useState('')
  const [pendingRequestId, setPendingRequestId] = useState(null)
  const [uncertainRetry, setUncertainRetry] = useState(null)

  useEffect(() => {
    document.title = 'Chi tiết ma trận | Exam Matrix'
  }, [])

  const matrix = useQuery({ queryKey: ['matrix', id], queryFn: () => api.getMatrix(id) })
  const examType = matrix.data?.examType || 'OBJECTIVE'
  const subjects = useQuery({ queryKey: ['subjects'], queryFn: api.getSubjects })
  const chapters = useQuery({ queryKey: ['chapters', 'all'], queryFn: () => api.getChapters({}) })
  const availability = useQuery({
    queryKey: ['availability', matrix.data?.subjectId, examType],
    queryFn: () => api.getAvailability({ subjectId: matrix.data.subjectId, examType }),
    enabled: Boolean(matrix.data),
  })
  const papers = useQuery({
    queryKey: ['papers', 'summary', { matrixId: id, page: paperPage, size: 8 }],
    queryFn: () => api.getPaperSummaries({ matrixId: id, page: paperPage, size: 8 }),
  })

  const requestedPaperCount = parsePaperCount(number)
  const validPaperCount = requestedPaperCount !== null
  const currentAdviceDecisionHash = 'ORIGINAL'

  const getStorageScope = (count = requestedPaperCount, adviceHash = currentAdviceDecisionHash) => ({
    userId: user?.id,
    matrixId: id,
    numberOfPapers: count,
    adviceDecisionHash: adviceHash,
  })

  useEffect(() => {
    if (!validPaperCount || !id) return
    const saved = findAnyPendingGenerationRequest({
      userId: user?.id,
      matrixId: id,
      numberOfPapers: requestedPaperCount,
    })
    if (saved?.requestId) {
      setUncertainRetry({
        requestId: saved.requestId,
        numberOfPapers: requestedPaperCount,
        adviceDecisionHash: saved.adviceDecisionHash || currentAdviceDecisionHash,
        adviceAdjustment: saved.adviceAdjustment || null,
        snapshotVersion: saved.snapshotVersion || null,
        message: saved.message || 'Phát hiện yêu cầu sinh đề đang chờ xác nhận từ phiên trước.',
      })
    } else {
      setUncertainRetry((prev) => (prev && prev.numberOfPapers === requestedPaperCount ? null : prev))
    }
  }, [currentAdviceDecisionHash, id, requestedPaperCount, user?.id, validPaperCount])

  const createRequestUuid = () => {
    if (typeof globalThis.crypto?.randomUUID === 'function') {
      return globalThis.crypto.randomUUID()
    }
    throw new Error('Trình duyệt không hỗ trợ crypto.randomUUID() để tạo mã chống trùng lặp.')
  }

  const buildAdviceDecisionHash = (advice, apply) => {
    if (!apply || !advice?.increaseCell || !advice?.decreaseCell) return 'ORIGINAL'
    return `ADVICE:${advice.snapshotVersion || 'none'}:${advice.increaseCell.chapterId}-${advice.decreaseCell.chapterId}-${advice.increaseCell.difficulty}`
  }

  const resolveOrCreateRequestId = (count, adviceHash) => {
    const scope = getStorageScope(count, adviceHash)
    const saved = loadPendingGenerationRequest(scope)
    if (saved?.requestId) return saved.requestId
    if (uncertainRetry && uncertainRetry.numberOfPapers === count && uncertainRetry.adviceDecisionHash === adviceHash) {
      return uncertainRetry.requestId
    }
    return createRequestUuid()
  }

  const openGenerateFlow = async () => {
    if (!validPaperCount || adviceLoading || generate.isPending) return

    const savedPending = findAnyPendingGenerationRequest({
      userId: user?.id,
      matrixId: id,
      numberOfPapers: requestedPaperCount,
    })
    if (savedPending?.requestId) {
      setPendingRequestId(savedPending.requestId)
      setUncertainRetry({
        requestId: savedPending.requestId,
        numberOfPapers: requestedPaperCount,
        adviceDecisionHash: savedPending.adviceDecisionHash || 'ORIGINAL',
        adviceAdjustment: savedPending.adviceAdjustment || null,
        snapshotVersion: savedPending.snapshotVersion || null,
        message: savedPending.message || 'Đang dùng lại mã yêu cầu chưa rõ kết quả từ phiên trước.',
      })
      setConfirmGenerate(true)
      return
    }

    setAdviceLoading(true)
    setAdviceStaleError('')
    try {
      const advice = await api.getGenerationAdvice(id, { numberOfPapers: requestedPaperCount })
      if (advice?.recommended && advice.increaseCell && advice.decreaseCell) {
        setAdviceData(advice)
        return
      }

      setUncertainRetry(null)
      setPendingRequestId(createRequestUuid())
      setConfirmGenerate(true)
    } catch (error) {
      const status = error?.status ?? error?.response?.status
      if (status === 400 || status === 403 || status === 404 || status === 409) {
        toast.error(error?.message || 'Ma trận chưa đủ điều kiện sinh đề')
        return
      }

      toast.warning('Không tải được gợi ý phân bổ từ lịch sử lớp. Bạn vẫn có thể sinh đề theo ma trận gốc.')
      setUncertainRetry(null)
      setPendingRequestId(createRequestUuid())
      setConfirmGenerate(true)
    } finally {
      setAdviceLoading(false)
    }
  }

  const refreshAdviceFromModal = async () => {
    if (!validPaperCount || adviceLoading) return
    setAdviceLoading(true)
    setAdviceStaleError('')
    try {
      const fresh = await api.getGenerationAdvice(id, { numberOfPapers: requestedPaperCount })
      if (fresh?.recommended && fresh.increaseCell && fresh.decreaseCell) {
        setAdviceData(fresh)
        toast.info('Đã cập nhật đề xuất mới nhất từ máy chủ.')
      } else {
        setAdviceData(null)
        toast.info('Đề xuất trước đó không còn hiệu lực theo dữ liệu hiện tại. Bạn có thể sinh theo ma trận gốc.')
        setPendingRequestId(createRequestUuid())
        setConfirmGenerate(true)
      }
    } catch (error) {
      toast.error(error?.message || 'Không thể làm mới đề xuất lúc này.')
    } finally {
      setAdviceLoading(false)
    }
  }

  const handleGenerateFromAdvice = (applyAdvice) => {
    if (!validPaperCount || generate.isPending) return
    const decisionHash = buildAdviceDecisionHash(adviceData, applyAdvice)
    const reqId = resolveOrCreateRequestId(requestedPaperCount, decisionHash)
    setPendingRequestId(reqId)
    generate.mutate({
      numberOfPapers: requestedPaperCount,
      requestId: reqId,
      adviceDecisionHash: decisionHash,
      ...(applyAdvice && adviceData?.increaseCell && adviceData?.decreaseCell
        ? {
            snapshotVersion: adviceData.snapshotVersion,
            adviceAdjustment: {
              increaseChapterId: adviceData.increaseCell.chapterId,
              decreaseChapterId: adviceData.decreaseCell.chapterId,
              difficulty: adviceData.increaseCell.difficulty,
            },
          }
        : {}),
    })
  }

  const generate = useMutation({
    mutationFn: ({ numberOfPapers, requestId, adviceDecisionHash = 'ORIGINAL', adviceAdjustment, snapshotVersion }) => {
      savePendingGenerationRequest(
        getStorageScope(numberOfPapers, adviceDecisionHash),
        {
          requestId,
          adviceAdjustment: adviceAdjustment || null,
          snapshotVersion: snapshotVersion || null,
          message: 'Đang gửi yêu cầu sinh đề...',
        }
      )
      const payload = { numberOfPapers, requestId }
      if (adviceAdjustment) payload.adviceAdjustment = adviceAdjustment
      if (snapshotVersion) payload.snapshotVersion = snapshotVersion
      return api.generatePapers(id, payload)
    },
    onSuccess: (items, variables) => {
      const list = Array.isArray(items) ? items : []
      clearPendingGenerationRequest(
        getStorageScope(variables?.numberOfPapers ?? requestedPaperCount, variables?.adviceDecisionHash || 'ORIGINAL')
      )
      setConfirmGenerate(false)
      setAdviceData(null)
      setAdviceStaleError('')
      setPendingRequestId(null)
      setUncertainRetry(null)
      queryClient.invalidateQueries({ queryKey: ['papers'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-analytics'] })
      const allDraftPrivate =
        list.length > 0 && list.every((paper) => paper?.isPublished === false && paper?.accessType === 'PRIVATE')
      const allPublished = list.length > 0 && list.every((paper) => paper?.isPublished === true)
      const firstAccessLabel = list[0]?.accessType === 'PUBLIC' ? 'Công khai' : 'Lớp học'
      toast.success(
        allDraftPrivate
          ? `Đã sinh ${list.length} mã đề bản nháp mới`
          : `Đã sinh thành công ${list.length} mã đề thi mới`
      )
      emitAssistantHint({
        title: allDraftPrivate ? 'Đã sinh mã đề bản nháp' : 'Đã sinh mã đề thi',
        message: allDraftPrivate
          ? `Đã tạo ${list.length} mã đề ở trạng thái Bản nháp (Lớp học). Hãy rà nội dung và phát hành khi sẵn sàng.`
          : allPublished
            ? `Đã tạo ${list.length} mã đề (${firstAccessLabel}, đã phát hành).`
            : `Đã tạo ${list.length} mã đề. Mở màn hình rà đề để kiểm tra trạng thái phát hành và quyền truy cập.`,
        tone: 'success',
      })
      if (list.length === 1 && list[0]?.id) {
        navigate(`/de-thi/${list[0].id}?review=1`, {
          state: { fromGenerate: true, generatedPaper: list[0] },
        })
      } else if (list.length > 0) {
        const ids = list.map((paper) => paper.id).filter(Boolean).join(',')
        navigate(`/de-thi?matrixId=${id}&review=${encodeURIComponent(ids)}`, {
          state: { fromGenerate: true, generatedPapers: list },
        })
      }
    },
    onError: (error, variables) => {
      const message = error.message || error.response?.data?.message || 'Không thể sinh đề thi'
      const status = error.status ?? error.response?.status
      const isUncertainOutcome = !status || status >= 500
      const scope = getStorageScope(
        variables?.numberOfPapers ?? requestedPaperCount,
        variables?.adviceDecisionHash || 'ORIGINAL'
      )
      if (isUncertainOutcome && variables?.requestId) {
        savePendingGenerationRequest(scope, {
          requestId: variables.requestId,
          adviceAdjustment: variables.adviceAdjustment || null,
          snapshotVersion: variables.snapshotVersion || null,
          message,
        })
        setUncertainRetry({
          requestId: variables.requestId,
          numberOfPapers: variables.numberOfPapers,
          adviceDecisionHash: variables?.adviceDecisionHash || 'ORIGINAL',
          adviceAdjustment: variables.adviceAdjustment || null,
          snapshotVersion: variables.snapshotVersion || null,
          message,
        })
      } else {
        clearPendingGenerationRequest(scope)
        setUncertainRetry(null)
        setConfirmGenerate(false)
        setPendingRequestId(null)
        if (status === 409 && variables?.adviceAdjustment && adviceData) {
          setAdviceStaleError(message)
        }
      }
      toast.error(message)
      emitAssistantHint({
        title: 'Chưa sinh được đề',
        message: `${message} Kiểm tra câu khả dụng trong từng ô ma trận và số mã đề từ 1 đến 20.`,
        tone: 'error',
      })
    },
  })

  if (matrix.isLoading || subjects.isLoading || chapters.isLoading || availability.isLoading) {
    return <LoadingState label="Đang tải thông tin chi tiết ma trận..." />
  }
  if (matrix.isError || !matrix.data) {
    return <ErrorState error={matrix.error || new Error('Không tìm thấy ma trận đề yêu cầu')} onRetry={matrix.refetch} />
  }
  if (subjects.isError || chapters.isError || availability.isError) {
    return (
      <ErrorState
        error={subjects.error || chapters.error || availability.error}
        onRetry={() => {
          subjects.refetch()
          chapters.refetch()
          availability.refetch()
        }}
      />
    )
  }

  const subject = subjects.data.find((item) => item.id === matrix.data.subjectId)
  const subjectChapters = chapters.data.filter((ch) => ch.subjectId === matrix.data.subjectId)
  const configChapters = Array.from(new Set(matrix.data.configs.map((c) => c.chapterId)))
    .map((chId) => subjectChapters.find((c) => c.id === chId) || chapters.data.find((c) => c.id === chId))
    .filter(Boolean)

  const invalid = matrix.data.configs.some(
    (config) =>
      config.quantity >
      (availability.data.find(
        (item) => item.chapterId === config.chapterId && item.difficulty === config.difficulty
      )?.available || 0)
  )
  const total = matrix.data.configs.reduce((sum, config) => sum + config.quantity, 0)
  const canGenerate =
    availability.isSuccess &&
    !availability.isFetching &&
    !invalid &&
    total === matrix.data.totalQuestions &&
    validPaperCount

  const paperCount = papers.data?.totalElements || 0

  return (
    <div className="space-y-6">
      <PageHeader
        accent="indigo"
        eyebrow="CHI TIẾT MA TRẬN & SINH ĐỀ"
        title={matrix.data.title}
        description={`${subject?.name || ''} · ${examTypeLabel(examType)} · Cập nhật ngày ${formatDate(matrix.data.updatedAt)}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {paperCount > 0 && (
              <Badge variant="indigo">
                <Lock className="h-3 w-3" />
                Đã sinh {paperCount} mã đề (khóa sửa/xóa)
              </Badge>
            )}
            <Button variant="outline" onClick={() => navigate('/ma-tran')}>
              <ArrowLeft className="h-4 w-4" />
              Danh sách ma trận
            </Button>
          </div>
        }
      />

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-label="Thông số ma trận đề">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Hình thức đề</div>
              <div className="text-base font-bold text-slate-900">{examTypeLabel(examType)}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-50 text-sky-700">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Thời gian làm bài</div>
              <div className="text-base font-bold text-slate-900 tabular-nums">{matrix.data.duration} phút</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
              <Grid3X3 className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Tổng số câu</div>
              <div className="text-base font-bold text-slate-900 tabular-nums">{matrix.data.totalQuestions} câu</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Đề đã sinh</div>
              <div className="text-base font-bold text-slate-900 tabular-nums">{paperCount} mã đề</div>
            </div>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Lưới phân bổ Chương × Độ khó</CardTitle>
            <CardDescription>So sánh số lượng yêu cầu theo ma trận và số câu khả dụng trong ngân hàng.</CardDescription>
          </div>
          {canGenerate ? (
            <Badge variant="success">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Đủ điều kiện sinh đề
            </Badge>
          ) : (
            <Badge variant="danger">
              <AlertTriangle className="h-3.5 w-3.5" />
              Chưa đủ câu hỏi khả dụng
            </Badge>
          )}
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-600">Chương bài</th>
                  {DIFFICULTIES.map((diff) => (
                    <th key={diff.value} className="px-4 py-3 text-center">
                      <DifficultyBadge value={diff.value} />
                    </th>
                  ))}
                  <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-600">Tổng chương</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {configChapters.map((ch) => {
                  const rowSum = DIFFICULTIES.reduce((sum, diff) => {
                    const cfg = matrix.data.configs.find((c) => c.chapterId === ch.id && c.difficulty === diff.value)
                    return sum + (cfg?.quantity || 0)
                  }, 0)

                  return (
                    <tr key={ch.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {ch.orderIndex}. {ch.name}
                      </td>
                      {DIFFICULTIES.map((diff) => {
                        const cfg = matrix.data.configs.find((c) => c.chapterId === ch.id && c.difficulty === diff.value)
                        const qty = cfg?.quantity || 0
                        const available =
                          availability.data.find((a) => a.chapterId === ch.id && a.difficulty === diff.value)?.available || 0
                        const shortage = qty > available

                        return (
                          <td key={diff.value} className="px-4 py-3 text-center">
                            {qty === 0 ? (
                              <span className="text-xs text-slate-400 tabular-nums">0 / {available}</span>
                            ) : (
                              <div className="inline-flex flex-col items-center gap-0.5">
                                <span
                                  className={cn(
                                    'rounded-md px-2.5 py-0.5 text-xs font-bold tabular-nums',
                                    shortage ? 'bg-rose-100 text-rose-800' : 'bg-indigo-50 text-indigo-800'
                                  )}
                                >
                                  {qty} / {available}
                                </span>
                                {shortage && (
                                  <span className="text-[11px] font-semibold text-rose-700">Thiếu {qty - available}</span>
                                )}
                              </div>
                            )}
                          </td>
                        )
                      })}
                      <td className="px-4 py-3 text-center font-extrabold text-indigo-700 tabular-nums">{rowSum} câu</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {total !== matrix.data.totalQuestions && (
            <Alert variant="destructive" className="mt-4">
              <AlertDescription>
                Tổng số câu trong cấu hình ({total}) không bằng tổng số câu quy định ({matrix.data.totalQuestions}).
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card className="border-indigo-200 bg-indigo-50/40">
        <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-slate-900">
              Sinh đề thi từ ma trận ({examType === 'ESSAY' ? 'Tự luận' : 'Trắc nghiệm'})
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <div className="flex items-center gap-2">
              <Label htmlFor="gen-count" className="mb-0 whitespace-nowrap">Số mã đề:</Label>
              <Input
                id="gen-count"
                type="number"
                min={1}
                max={20}
                step={1}
                value={number}
                onChange={(event) => {
                  setNumber(event.target.value)
                  if (uncertainRetry && parsePaperCount(event.target.value) !== uncertainRetry.numberOfPapers) {
                    setUncertainRetry(null)
                  }
                }}
                onBlur={() => {
                  if (!validPaperCount) {
                    emitAssistantHint({ title: 'Số mã đề chưa hợp lệ', message: 'Nhập số nguyên từ 1 đến 20. Giá trị ngoài phạm vi sẽ không tự đổi.', tone: 'warning' })
                  }
                }}
                aria-invalid={!validPaperCount}
                aria-describedby="gen-count-help"
                className="w-20 text-center font-bold tabular-nums"
              />
            </div>
            <Button
              disabled={!canGenerate || generate.isPending || adviceLoading}
              onClick={openGenerateFlow}
            >
              <Printer className="h-4 w-4" />
              {adviceLoading
                ? 'Đang kiểm tra gợi ý...'
                : generate.isPending
                  ? 'Đang sinh đề...'
                  : uncertainRetry && uncertainRetry.numberOfPapers === requestedPaperCount
                    ? 'Thử lại sinh đề'
                    : 'Sinh đề từ ma trận'}
            </Button>
          </div>
        </CardContent>
        <div id="gen-count-help" className="px-6 pb-5 text-xs text-slate-600 space-y-2" aria-live="polite">
          {!validPaperCount && (
            <div className="font-medium text-rose-700">
              Nhập số nguyên từ 1 đến 20.
            </div>
          )}
          {uncertainRetry && uncertainRetry.numberOfPapers === requestedPaperCount && (
            <Alert variant="warning">
              <AlertDescription className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span>
                  Lần gửi trước chưa rõ kết quả ({uncertainRetry.message}). Bấm &ldquo;Thử lại sinh đề&rdquo; để dùng lại cùng mã yêu cầu tránh tạo trùng.
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    clearPendingGenerationRequest(
                      getStorageScope(requestedPaperCount, uncertainRetry?.adviceDecisionHash || currentAdviceDecisionHash)
                    )
                    setUncertainRetry(null)
                  }}
                >
                  Tạo yêu cầu mới
                </Button>
              </AlertDescription>
            </Alert>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle>Danh sách mã đề đã sinh</CardTitle>
            <CardDescription>Các mã đề độc lập đã tạo từ ma trận này.</CardDescription>
          </div>
          <Button variant="link" asChild className="px-0">
            <Link to={`/de-thi?matrixId=${id}`}>
              Xem tất cả trong kho đề
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {papers.isLoading ? (
            <LoadingState label="Đang tải danh sách đề thi..." />
          ) : papers.isError ? (
            <ErrorState error={papers.error} onRetry={papers.refetch} />
          ) : papers.data?.content.length ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {papers.data.content.map((paper) => (
                  <div
                    key={paper.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <Badge variant="indigo">#{paper.examCode}</Badge>
                      <div className="text-xs text-slate-500 tabular-nums pt-1">
                        {paper.questionCount ?? paper.questions?.length ?? 0} câu · {formatDate(paper.createdAt)}
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => navigate(`/de-thi/${paper.id}`)}>
                      Xem & In
                    </Button>
                  </div>
                ))}
              </div>
              <Pagination
                page={papers.data?.page ?? paperPage}
                totalPages={papers.data?.totalPages ?? 0}
                onChange={setPaperPage}
              />
            </div>
          ) : (
            <EmptyState
              title="Chưa có đề thi nào được sinh"
              description="Thiết lập số mã đề từ 1 đến 20 và bấm 'Sinh đề từ ma trận'."
            />
          )}
        </CardContent>
      </Card>
      {adviceData && (
        <GenerationAdviceModal
          advice={adviceData}
          busy={generate.isPending || adviceLoading}
          staleError={adviceStaleError}
          onRefreshAdvice={refreshAdviceFromModal}
          onKeepOriginal={() => handleGenerateFromAdvice(false)}
          onApplyAdvice={() => handleGenerateFromAdvice(true)}
          onClose={() => {
            if (!generate.isPending && !adviceLoading) {
              setAdviceData(null)
              setAdviceStaleError('')
            }
          }}
        />
      )}
      {confirmGenerate && (
        <ConfirmModal
          title={uncertainRetry ? `Thử lại tạo ${requestedPaperCount} mã đề?` : `Tạo ${requestedPaperCount} mã đề bản nháp?`}
          message={
            uncertainRetry
              ? `Lần gửi trước chưa rõ kết quả (${uncertainRetry.message}). Hệ thống sẽ gửi lại cùng mã yêu cầu cho ${requestedPaperCount} mã đề để không sinh trùng.`
              : `Tạo ${requestedPaperCount} mã đề ở trạng thái Bản nháp (Lớp học). Bạn có thể rà nội dung và phát hành ngay sau khi tạo.`
          }
          confirmLabel={uncertainRetry ? `Thử lại tạo ${requestedPaperCount} mã đề` : `Tạo ${requestedPaperCount} mã đề`}
          variant="default"
          busy={generate.isPending}
          onClose={() => {
            if (!generate.isPending) {
              setConfirmGenerate(false)
              if (!uncertainRetry) setPendingRequestId(null)
            }
          }}
          onConfirm={() => {
            if (!validPaperCount || !pendingRequestId) return
            generate.mutate({
              numberOfPapers: requestedPaperCount,
              requestId: pendingRequestId,
              adviceDecisionHash: uncertainRetry?.adviceDecisionHash || 'ORIGINAL',
              ...(uncertainRetry?.adviceAdjustment
                ? {
                    adviceAdjustment: uncertainRetry.adviceAdjustment,
                    snapshotVersion: uncertainRetry.snapshotVersion || undefined,
                  }
                : {}),
            })
          }}
        />
      )}
    </div>
  )
}
