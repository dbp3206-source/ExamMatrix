import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { ArrowLeft, Check, Eye, Globe, Lock, Plus, Printer, RotateCcw, Search, Send, Settings2, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { api, getAllMatrices } from '@/api/service'
import { difficultyLabel, examTypeLabel, getSubjectPreset, typeLabel } from '@/constants'
import { formatDate } from '@/utils'
import type {
  AccessType,
  ApiErrorShape,
  ExamPaperDetail,
  ExamPaperSummary,
  MatrixSummary,
  PaginatedResponse,
  PaperSummaryQueryParams,
  SubjectItem,
} from '@/types/domain'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable } from '@/components/ui/data-table'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ConfirmModal, EmptyState, ErrorState, LoadingState, PageHeader, Pagination, SubjectIcon } from '@/components/common/StateFeedback'
import { MathRenderer } from '@/components/common/MathRenderer'
import { cn } from '@/lib/utils'

interface PapersLocationState {
  generatedPapers?: ExamPaperSummary[]
}

function accessTypeLabel(accessType?: AccessType | string): string {
  return accessType === 'PRIVATE' ? 'Lớp học' : 'Công khai'
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const msg = (error as ApiErrorShape).message
    if (typeof msg === 'string' && msg.trim()) return msg
  }
  return fallback
}

export default function PapersPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()
  const locationState = (location.state as PapersLocationState | null) ?? null
  const matrixId = searchParams.get('matrixId') || ''
  const reviewParam = searchParams.get('review') || ''
  const [subjectFilter, setSubjectFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [accessFilter, setAccessFilter] = useState('')
  const [publishFilter, setPublishFilter] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const pageSize = 20
  const [deleting, setDeleting] = useState<ExamPaperSummary | null>(null)
  const [accessModalPaper, setAccessModalPaper] = useState<ExamPaperSummary | null>(null)
  const [accessModalMode, setAccessModalMode] = useState<'publish' | 'settings'>('settings')
  const [editAccessType, setEditAccessType] = useState<AccessType>('PRIVATE')
  const [editIsPublished, setEditIsPublished] = useState(true)
  const [lastUpdatedAccess, setLastUpdatedAccess] = useState<ExamPaperSummary | null>(null)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  useEffect(() => {
    document.title = 'Đề thi & In ấn | Exam Matrix'
  }, [])

  const summaryParams = useMemo<PaperSummaryQueryParams>(() => {
    const params: PaperSummaryQueryParams = { page, size: pageSize }
    if (matrixId) params.matrixId = matrixId
    if (subjectFilter) params.subjectId = Number(subjectFilter)
    if (typeFilter && typeFilter !== 'ALL') params.examType = typeFilter
    if (accessFilter) params.accessType = accessFilter
    if (publishFilter === 'true' || publishFilter === 'false') {
      params.isPublished = publishFilter === 'true'
    }
    if (search.trim()) params.search = search.trim()
    return params
  }, [accessFilter, matrixId, page, pageSize, publishFilter, search, subjectFilter, typeFilter])

  const matrices = useQuery<PaginatedResponse<MatrixSummary>>({
    queryKey: ['matrices', 'all'],
    queryFn: getAllMatrices as () => Promise<PaginatedResponse<MatrixSummary>>,
  })
  const subjects = useQuery<SubjectItem[]>({
    queryKey: ['subjects'],
    queryFn: api.getSubjects as () => Promise<SubjectItem[]>,
  })
  const papers = useQuery<PaginatedResponse<ExamPaperSummary>>({
    queryKey: ['papers', 'summary', summaryParams],
    queryFn: () => api.getPaperSummaries(summaryParams) as Promise<PaginatedResponse<ExamPaperSummary>>,
  })

  const remove = useMutation({
    mutationFn: (id: string) => api.deletePaper(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['papers'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Đã xóa đề thi thành công')
      if (page > 0 && (papers.data?.content?.length || 0) <= 1) {
        setPage((current) => Math.max(0, current - 1))
      }
      setDeleting(null)
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Không thể xóa đề thi đã có học sinh làm bài'))
      setDeleting(null)
    },
  })

  const updateAccess = useMutation<
    ExamPaperSummary,
    unknown,
    { id: string; accessType: AccessType; isPublished: boolean }
  >({
    mutationFn: ({ id, accessType, isPublished }) =>
      api.updatePaperAccess(id, { accessType, isPublished }) as Promise<ExamPaperSummary>,
    onSuccess: (updated) => {
      if (updated?.id) {
        queryClient.setQueryData(['paper', updated.id], updated)
      }
      queryClient.invalidateQueries({ queryKey: ['papers'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      setLastUpdatedAccess(updated)
      const statusText = updated?.isPublished ? 'Đã phát hành' : 'Chưa phát hành (Bản nháp)'
      toast.success(`Mã đề #${updated?.examCode || ''}: ${statusText} · ${accessTypeLabel(updated?.accessType)}`)
      setAccessModalPaper(null)
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Không thể cập nhật quyền truy cập')),
  })

  const openPublishModal = (paper: ExamPaperSummary) => {
    setAccessModalMode('publish')
    setAccessModalPaper(paper)
    setEditAccessType((paper.accessType as AccessType) || 'PRIVATE')
    setEditIsPublished(true)
  }

  const openAccessModal = (paper: ExamPaperSummary) => {
    setAccessModalMode('settings')
    setAccessModalPaper(paper)
    setEditAccessType((paper.accessType as AccessType) || 'PRIVATE')
    setEditIsPublished(Boolean(paper.isPublished))
  }

  const visiblePapers = useMemo(() => papers.data?.content || [], [papers.data])
  const totalElements = papers.data?.totalElements ?? visiblePapers.length
  const totalPages = papers.data?.totalPages ?? 0
  const matrixList = useMemo(() => matrices.data?.content || [], [matrices.data])
  const subjectList = useMemo(() => subjects.data || [], [subjects.data])

  const reviewPapers = useMemo(() => {
    const ids = reviewParam.split(',').map((item) => item.trim()).filter(Boolean)
    const statePapers = Array.isArray(locationState?.generatedPapers) ? locationState.generatedPapers : []
    if (!ids.length && !statePapers.length) return []
    const targetIds = ids.length ? ids : statePapers.map((item) => item.id).filter(Boolean)
    return targetIds
      .map((paperId) => visiblePapers.find((p) => p.id === paperId) || statePapers.find((p) => p.id === paperId))
      .filter((item): item is ExamPaperSummary => Boolean(item))
  }, [locationState?.generatedPapers, visiblePapers, reviewParam])

  const dismissReviewBanner = () => {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('review')
    setSearchParams(nextParams, { replace: true })
  }

  const columns = useMemo<ColumnDef<ExamPaperSummary>[]>(
    () => [
      {
        accessorKey: 'examCode',
        header: 'Mã đề',
        cell: ({ row }) => <Badge variant="indigo">#{row.original.examCode}</Badge>,
      },
      {
        id: 'title',
        header: 'Tên đề thi & Ma trận',
        cell: ({ row }) => {
          const matrix = matrixList.find((m) => m.id === row.original.matrixId)
          const subject = subjectList.find((s) => s.id === (row.original.subjectId ?? matrix?.subjectId))
          const subjectCode = row.original.subjectCode || subject?.code
          const subjectName = row.original.subjectName || subject?.name
          const matrixTitle = row.original.matrixTitle || matrix?.title || 'Đề thi chuẩn hóa'
          const preset = getSubjectPreset(subjectCode, subjectName)
          return (
            <div className="flex items-center gap-3">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${preset.iconBgClass}`}>
                <SubjectIcon codeOrName={subjectCode} name={subjectName} size={16} />
              </div>
              <div className="min-w-0">
                <Link to={`/de-thi/${row.original.id}`} className="font-bold text-slate-900 hover:text-indigo-700">
                  {matrixTitle}
                </Link>
                <div className="text-xs text-slate-500 truncate">{subjectName || 'Môn học'}</div>
              </div>
            </div>
          )
        },
      },
      {
        id: 'examType',
        header: 'Hình thức',
        cell: ({ row }) => {
          const matrix = matrixList.find((m) => m.id === row.original.matrixId)
          const isEssay = (row.original.examType || matrix?.examType) === 'ESSAY'
          return <Badge variant={isEssay ? 'amber' : 'indigo'}>{isEssay ? 'Tự luận' : 'Trắc nghiệm'}</Badge>
        },
      },
      {
        id: 'questions',
        header: 'Quy mô',
        cell: ({ row }) => (
          <span className="font-semibold tabular-nums">
            {row.original.questionCount ?? row.original.questions?.length ?? 0} câu
          </span>
        ),
      },
      {
        id: 'access',
        header: 'Phạm vi & Phát hành',
        cell: ({ row }) => (
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant={row.original.isPublished ? 'success' : 'neutral'}>
              {row.original.isPublished ? 'Đã phát hành' : 'Chưa phát hành'}
            </Badge>
            <Badge variant={row.original.accessType === 'PRIVATE' ? 'warning' : 'indigo'}>
              {row.original.accessType === 'PRIVATE' ? (
                <><Lock className="h-3 w-3" /> Lớp học</>
              ) : (
                <><Globe className="h-3 w-3" /> Công khai</>
              )}
            </Badge>
          </div>
        ),
      },
      {
        accessorKey: 'createdAt',
        header: 'Ngày sinh đề',
        cell: ({ row }) => <span className="text-xs text-slate-500">{formatDate(row.original.createdAt)}</span>,
      },
      {
        id: 'actions',
        header: 'Thao tác',
        meta: { headClassName: 'text-right', cellClassName: 'text-right' },
        cell: ({ row }) => (
          <div className="inline-flex items-center justify-end gap-1.5">
            {!row.original.isPublished && (
              <Button variant="teal" size="sm" onClick={() => openPublishModal(row.original)}>
                <Send className="h-3.5 w-3.5" />
                Phát hành
              </Button>
            )}
            <Button variant="outline" size="sm" asChild>
              <Link to={`/de-thi/${row.original.id}`}>
                <Printer className="h-3.5 w-3.5" />
                Xem & In
              </Link>
            </Button>
            <Button variant="ghost" size="icon" aria-label="Cài đặt quyền truy cập" onClick={() => openAccessModal(row.original)}>
              <Settings2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Xóa đề thi"
              className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
              onClick={() => setDeleting(row.original)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ),
      },
    ],
    [matrixList, subjectList]
  )

  if (matrices.isLoading || subjects.isLoading) return <LoadingState label="Đang tải dữ liệu đề thi..." />
  if (matrices.isError || subjects.isError) {
    return (
      <ErrorState
        error={matrices.error || subjects.error}
        onRetry={() => {
          matrices.refetch()
          subjects.refetch()
        }}
      />
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        accent="amber"
        eyebrow="ĐỀ THI VÀ IN ẤN"
        title="Quản lý Đề thi & In ấn"
        description="Tra cứu mã đề, rà nội dung, chọn quyền Công khai hoặc Lớp học khi phát hành và in chuẩn A4."
        action={
          <Button onClick={() => navigate('/ma-tran')}>
            <Plus className="h-4 w-4" />
            Sinh đề từ ma trận
          </Button>
        }
      />

      {reviewPapers.length > 0 && (
        <Card className="border-teal-300 bg-teal-50/40">
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 pb-3">
            <div>
              <CardTitle className="text-base text-teal-950">Rà soát & Phát hành mã đề vừa sinh ({reviewPapers.length} mã đề)</CardTitle>
              <CardDescription className="text-teal-900/80">
                Mã đề mới tạo ở trạng thái Bản nháp (Lớp học). Rà nội dung từng mã đề rồi bấm Phát hành và chọn quyền truy cập.
              </CardDescription>
            </div>
            <Button variant="ghost" size="icon" aria-label="Đóng khung rà soát" onClick={dismissReviewBanner}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {reviewPapers.map((paper) => (
              <div
                key={paper.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3"
              >
                <div className="flex flex-wrap items-center gap-2.5">
                  <Badge variant="indigo">#{paper.examCode}</Badge>
                  <span className="text-xs font-semibold text-slate-700 tabular-nums">
                    {paper.questionCount ?? paper.questions?.length ?? 0} câu
                  </span>
                  <Badge variant={paper.isPublished ? 'success' : 'neutral'}>
                    {paper.isPublished ? 'Đã phát hành' : 'Chưa phát hành'}
                  </Badge>
                  <Badge variant={paper.accessType === 'PRIVATE' ? 'warning' : 'indigo'}>
                    {accessTypeLabel(paper.accessType || 'PRIVATE')}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/de-thi/${paper.id}?review=1`}>
                      <Eye className="h-3.5 w-3.5" />
                      Rà đề & In A4
                    </Link>
                  </Button>
                  {paper.isPublished ? (
                    <Button variant="outline" size="sm" onClick={() => openAccessModal(paper)}>
                      <Settings2 className="h-3.5 w-3.5" />
                      Đổi quyền
                    </Button>
                  ) : (
                    <Button variant="teal" size="sm" onClick={() => openPublishModal(paper)}>
                      <Send className="h-3.5 w-3.5" />
                      Phát hành
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {lastUpdatedAccess && (
        <Alert variant={lastUpdatedAccess.isPublished ? 'success' : 'info'}>
          <AlertDescription>
            Phản hồi từ máy chủ cho mã đề <strong>#{lastUpdatedAccess.examCode}</strong>:{' '}
            <strong>{lastUpdatedAccess.isPublished ? 'Đã phát hành' : 'Chưa phát hành (Bản nháp)'}</strong> · Phạm vi:{' '}
            <strong>{accessTypeLabel(lastUpdatedAccess.accessType)}</strong>.
            {lastUpdatedAccess.isPublished && lastUpdatedAccess.accessType === 'PRIVATE'
              ? ' Chỉ học sinh đã được duyệt vào lớp của giáo viên sở hữu đề mới có quyền truy cập.'
              : lastUpdatedAccess.isPublished && lastUpdatedAccess.accessType === 'PUBLIC'
                ? ' Học sinh đã đăng nhập có quyền mở đề theo cấu hình PUBLIC từ máy chủ.'
                : ' Học sinh chưa thể mở đề khi trạng thái chưa phát hành.'}
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative min-w-[240px] flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0) }}
              placeholder="Tìm theo mã đề, tên đề hoặc môn học..."
              className="pl-9"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Tabs value={typeFilter} onValueChange={(id) => { setTypeFilter(id); setPage(0) }}>
              <TabsList>
                <TabsTrigger value="ALL">Tất cả</TabsTrigger>
                <TabsTrigger value="OBJECTIVE">Trắc nghiệm</TabsTrigger>
                <TabsTrigger value="ESSAY">Tự luận</TabsTrigger>
              </TabsList>
            </Tabs>

            {(search || subjectFilter || matrixId || typeFilter !== 'ALL' || accessFilter || publishFilter) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch('')
                  setSubjectFilter('')
                  setTypeFilter('ALL')
                  setAccessFilter('')
                  setPublishFilter('')
                  setSearchParams({})
                  setPage(0)
                }}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Đặt lại
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label htmlFor="p-subject">Môn học</Label>
            <Select id="p-subject" value={subjectFilter} onChange={(e) => { setSubjectFilter(e.target.value); setPage(0) }}>
              <option value="">Tất cả môn học</option>
              {subjectList.map((s) => (
                <option key={s.id} value={s.id}>{s.code} - {s.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="p-matrix">Ma trận đề nguồn</Label>
            <Select
              id="p-matrix"
              value={matrixId}
              onChange={(event) => {
                setSearchParams(event.target.value ? { matrixId: event.target.value } : {})
                setPage(0)
              }}
            >
              <option value="">Tất cả ma trận nguồn</option>
              {matrixList.map((matrix) => (
                <option key={matrix.id} value={matrix.id}>{matrix.title}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="p-access-filter">Phạm vi truy cập</Label>
            <Select id="p-access-filter" value={accessFilter} onChange={(e) => { setAccessFilter(e.target.value); setPage(0) }}>
              <option value="">Tất cả phạm vi</option>
              <option value="PRIVATE">Lớp học</option>
              <option value="PUBLIC">Công khai</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="p-publish-filter">Trạng thái phát hành</Label>
            <Select id="p-publish-filter" value={publishFilter} onChange={(e) => { setPublishFilter(e.target.value); setPage(0) }}>
              <option value="">Tất cả trạng thái</option>
              <option value="true">Đã phát hành</option>
              <option value="false">Chưa phát hành (Bản nháp)</option>
            </Select>
          </div>
        </div>
      </div>

      {papers.isSuccess && (
        <div className="text-xs font-semibold text-slate-600 tabular-nums">
          {totalElements} đề phù hợp với bộ lọc hiện tại
        </div>
      )}

      {papers.isLoading ? (
        <LoadingState label="Đang tải danh sách đề thi..." />
      ) : papers.isError ? (
        <ErrorState error={papers.error} onRetry={papers.refetch} />
      ) : !visiblePapers.length ? (
        <EmptyState title="Không có đề thi phù hợp" description="Thử thay đổi bộ lọc hoặc sinh đề từ ma trận." />
      ) : (
        <>
          <DataTable columns={columns} data={visiblePapers} getRowId={(r) => String(r.id)} />
          <Pagination page={papers.data?.page ?? page} totalPages={totalPages} onChange={setPage} />
        </>
      )}

      {deleting && (
        <ConfirmModal
          title="Xác nhận xóa đề thi"
          message={`Xóa mã đề #${deleting.examCode}? Nếu đề thi đã có học sinh làm bài, hệ thống sẽ từ chối xóa (409) để bảo toàn lịch sử thi.`}
          onClose={() => setDeleting(null)}
          onConfirm={() => remove.mutate(deleting.id)}
          busy={remove.isPending}
        />
      )}

      {accessModalPaper && (
        <Dialog open onOpenChange={(open) => { if (!open && !updateAccess.isPending) setAccessModalPaper(null) }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {accessModalMode === 'publish'
                  ? `Phát hành mã đề #${accessModalPaper.examCode}`
                  : `Cài đặt quyền truy cập mã đề #${accessModalPaper.examCode}`}
              </DialogTitle>
            </DialogHeader>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault()
                updateAccess.mutate({
                  id: accessModalPaper.id,
                  accessType: editAccessType,
                  isPublished: editIsPublished,
                })
              }}
            >
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                Trạng thái hiện tại trên máy chủ:{' '}
                <strong>{accessModalPaper.isPublished ? 'Đã phát hành' : 'Chưa phát hành'}</strong> ·{' '}
                <strong>{accessTypeLabel(accessModalPaper.accessType || 'PRIVATE')}</strong>
              </div>

              <div>
                <Label htmlFor="p-access-type">Quyền truy cập khi phát hành</Label>
                <Select
                  id="p-access-type"
                  value={editAccessType}
                  onChange={(e) => setEditAccessType(e.target.value as AccessType)}
                >
                  <option value="PRIVATE">Lớp học — Chỉ học sinh đã duyệt vào lớp</option>
                  <option value="PUBLIC">Công khai — Tất cả học sinh đăng nhập</option>
                </Select>
              </div>

              <label className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editIsPublished}
                  onChange={(e) => setEditIsPublished(e.target.checked)}
                  className="h-4 w-4 accent-indigo-700"
                />
                <span>Phát hành đề thi cho học sinh</span>
              </label>

              <DialogFooter>
                <Button variant="outline" onClick={() => setAccessModalPaper(null)} disabled={updateAccess.isPending}>
                  Hủy
                </Button>
                <Button type="submit" variant={accessModalMode === 'publish' ? 'teal' : 'default'} disabled={updateAccess.isPending}>
                  {updateAccess.isPending
                    ? 'Đang lưu...'
                    : editIsPublished
                      ? 'Xác nhận phát hành'
                      : 'Lưu trạng thái bản nháp'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

export function PaperDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const isReviewMode = searchParams.get('review') === '1'
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<'exam' | 'answer'>('exam')
  const [selectedAccessType, setSelectedAccessType] = useState<string>('')
  const [publishNotice, setPublishNotice] = useState<ExamPaperSummary | null>(null)

  useEffect(() => {
    document.title = 'Xem & In đề thi A4 | Exam Matrix'
  }, [])

  const paper = useQuery<ExamPaperDetail>({
    queryKey: ['paper', id],
    queryFn: () => api.getPaper(id as string) as Promise<ExamPaperDetail>,
    enabled: Boolean(id),
  })
  const matrixQuery = useQuery<MatrixSummary>({
    queryKey: ['matrix', paper.data?.matrixId],
    queryFn: () => api.getMatrix(paper.data?.matrixId as string) as Promise<MatrixSummary>,
    enabled: Boolean(paper.data?.matrixId),
  })
  const subjects = useQuery<SubjectItem[]>({
    queryKey: ['subjects'],
    queryFn: api.getSubjects as () => Promise<SubjectItem[]>,
  })

  useEffect(() => {
    if (paper.data?.accessType) {
      setSelectedAccessType(paper.data.accessType)
    }
  }, [paper.data?.accessType])

  const publishMutation = useMutation<
    ExamPaperSummary,
    unknown,
    { accessType: AccessType; isPublished: boolean }
  >({
    mutationFn: ({ accessType, isPublished }) =>
      api.updatePaperAccess(id as string, { accessType, isPublished }) as Promise<ExamPaperSummary>,
    onSuccess: (updated) => {
      queryClient.setQueryData(['paper', id], updated)
      queryClient.invalidateQueries({ queryKey: ['papers'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      setSelectedAccessType(updated?.accessType || 'PRIVATE')
      setPublishNotice(updated)
      toast.success(
        updated?.isPublished
          ? `Đã phát hành mã đề #${updated.examCode} (${accessTypeLabel(updated.accessType)})`
          : `Đã chuyển mã đề #${updated.examCode} về chưa phát hành (${accessTypeLabel(updated.accessType)})`
      )
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Không thể cập nhật trạng thái phát hành')),
  })

  if (paper.isLoading || matrixQuery.isLoading || subjects.isLoading) {
    return <LoadingState label="Đang đóng gói đề thi khổ A4..." />
  }
  if (paper.isError || !paper.data) {
    return <ErrorState error={paper.error || new Error('Không tìm thấy đề thi')} onRetry={paper.refetch} />
  }
  if (matrixQuery.isError || subjects.isError) {
    return (
      <ErrorState
        error={matrixQuery.error || subjects.error}
        onRetry={() => {
          matrixQuery.refetch()
          subjects.refetch()
        }}
      />
    )
  }
  if (!matrixQuery.data) return <LoadingState />

  const matrix = matrixQuery.data
  const examType = matrix.examType || 'OBJECTIVE'
  const isEssayPaper = examType === 'ESSAY'
  const subject = subjects.data?.find((item) => item.id === matrix.subjectId)
  const answerModeLabel = isEssayPaper ? 'Bảng Đáp Án / Barem Chấm' : 'Đáp Án Chi Tiết'
  const documentTitle = mode === 'answer' && isEssayPaper ? 'HƯỚNG DẪN CHẤM & ĐÁP ÁN BAREM' : matrix.title
  const effectiveAccessType = (selectedAccessType || paper.data.accessType || 'PRIVATE') as AccessType

  return (
    <div className="space-y-5">
      <div className="no-print space-y-4">
        <PageHeader
          accent="amber"
          eyebrow={isReviewMode ? 'RÀ ĐỀ SAU SINH & PHÁT HÀNH' : 'XEM VÀ IN ĐỀ THI A4'}
          title={`Mã đề thi #${paper.data.examCode}`}
          description={`${matrix.title} · ${examTypeLabel(examType)} · Thời gian: ${matrix.duration ?? '—'} phút · ${paper.data.isPublished ? 'Đã phát hành' : 'Chưa phát hành'} · ${accessTypeLabel(paper.data.accessType)}`}
          action={
            <div className="flex flex-wrap items-center gap-2.5">
              <Button variant="outline" asChild>
                <Link to={`/de-thi?matrixId=${paper.data.matrixId}`}>
                  <ArrowLeft className="h-4 w-4" />
                  Danh sách đề
                </Link>
              </Button>
              <Button variant="teal" onClick={() => window.print()}>
                <Printer className="h-4 w-4" />
                In đề A4
              </Button>
            </div>
          }
        />

        <Card className={cn('border-slate-200', !paper.data.isPublished && 'border-amber-300 bg-amber-50/40')}>
          <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-slate-900">Trạng thái phát hành:</span>
                <Badge variant={paper.data.isPublished ? 'success' : 'neutral'}>
                  {paper.data.isPublished ? 'Đã phát hành' : 'Chưa phát hành (Bản nháp)'}
                </Badge>
                <Badge variant={paper.data.accessType === 'PRIVATE' ? 'warning' : 'indigo'}>
                  {accessTypeLabel(paper.data.accessType || 'PRIVATE')}
                </Badge>
              </div>
              <p className="text-xs text-slate-600">
                {paper.data.isPublished
                  ? 'Đề thi đang được mở cho học sinh theo phạm vi truy cập đã chọn.'
                  : 'Mã đề đang ở trạng thái Bản nháp (Lớp học). Rà nội dung bên dưới rồi chọn quyền truy cập và bấm Phát hành.'}
              </p>
            </div>

            <div className="flex flex-wrap items-end gap-2.5 shrink-0">
              <div>
                <Label htmlFor="detail-access-type" className="text-xs">Quyền truy cập khi phát hành</Label>
                <Select
                  id="detail-access-type"
                  value={effectiveAccessType}
                  onChange={(e) => setSelectedAccessType(e.target.value)}
                  disabled={publishMutation.isPending}
                >
                  <option value="PRIVATE">Lớp học</option>
                  <option value="PUBLIC">Công khai</option>
                </Select>
              </div>
              {paper.data.isPublished ? (
                <>
                  <Button
                    variant="default"
                    disabled={publishMutation.isPending}
                    onClick={() =>
                      publishMutation.mutate({
                        accessType: effectiveAccessType,
                        isPublished: true,
                      })
                    }
                  >
                    {publishMutation.isPending ? 'Đang cập nhật...' : 'Cập nhật quyền'}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={publishMutation.isPending}
                    onClick={() =>
                      publishMutation.mutate({
                        accessType: effectiveAccessType,
                        isPublished: false,
                      })
                    }
                  >
                    Thu hồi phát hành
                  </Button>
                </>
              ) : (
                <Button
                  variant="teal"
                  disabled={publishMutation.isPending}
                  onClick={() =>
                    publishMutation.mutate({
                      accessType: effectiveAccessType,
                      isPublished: true,
                    })
                  }
                >
                  <Send className="h-4 w-4" />
                  {publishMutation.isPending ? 'Đang phát hành...' : 'Phát hành đề thi'}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {publishNotice && (
          <Alert variant={publishNotice.isPublished ? 'success' : 'info'}>
            <AlertDescription>
              Đã cập nhật trạng thái:{' '}
              <strong>{publishNotice.isPublished ? 'Đã phát hành' : 'Bản nháp'}</strong> · Phạm vi{' '}
              <strong>{accessTypeLabel(publishNotice.accessType)}</strong>.
            </AlertDescription>
          </Alert>
        )}

        <Tabs value={mode} onValueChange={(v) => setMode(v as 'exam' | 'answer')}>
          <TabsList>
            <TabsTrigger value="exam">Bản đề thi phát học sinh</TabsTrigger>
            <TabsTrigger value="answer">{answerModeLabel}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <article className="paper-sheet mx-auto max-w-[210mm] rounded-xl border border-slate-300 bg-white p-8 shadow-sm sm:p-12">
        <header className="paper-header grid grid-cols-1 gap-4 border-b-2 border-slate-900 pb-4 mb-5 sm:grid-cols-3">
          <div className="space-y-1 text-sm">
            <strong className="block text-base uppercase">ĐỀ KIỂM TRA</strong>
            <span>Môn: <strong>{subject?.name || '—'}</strong></span>
          </div>

          <div className="space-y-1 text-center">
            <h1 className="text-lg font-extrabold uppercase text-slate-950">{documentTitle}</h1>
            {mode === 'answer' && isEssayPaper && (
              <div className="text-xs font-medium text-slate-600">{matrix.title}</div>
            )}
            <div className="text-xs text-slate-700">
              Thời gian làm bài: <strong>{matrix.duration ?? '—'} phút</strong>
            </div>
          </div>

          <div className="text-left sm:text-right space-y-1">
            <div className="inline-block border-2 border-slate-900 px-2.5 py-1 text-xs font-extrabold tracking-wide">
              MÃ ĐỀ: {paper.data.examCode}
            </div>
            <div className="text-xs text-slate-600">Ngày: {formatDate(paper.data.createdAt)}</div>
          </div>
        </header>

        {mode === 'exam' && (
          <div className="paper-student-fields mb-6 grid grid-cols-1 gap-3 border-b border-dashed border-slate-300 pb-4 text-sm sm:grid-cols-[2fr_1fr_1fr]">
            <div>Họ và tên thí sinh: ...................................</div>
            <div>Số báo danh: ................</div>
            <div>Lớp: .............</div>
          </div>
        )}

        <section className="paper-questions space-y-5">
          {[...(paper.data.questions || [])]
            .sort((a, b) => (a.questionOrder ?? 0) - (b.questionOrder ?? 0))
            .map((question) => (
              <div className="paper-question text-[15px] leading-relaxed text-slate-900" key={question.id}>
                <p className="font-normal">
                  <strong className="font-bold">Câu {question.questionOrder}</strong>
                  {question.points != null && (
                    <span className="text-xs text-slate-600"> ({question.points} điểm)</span>
                  )}
                  <strong>:</strong>{' '}
                  <span className="whitespace-pre-line"><MathRenderer content={question.content} /></span>
                </p>

                <div className="paper-meta no-print mt-1 text-[11px] font-medium text-slate-500">
                  [{difficultyLabel(question.difficulty)} · {typeLabel(question.type)}]
                </div>

                {question.type === 'ESSAY' ? (
                  mode === 'answer' && (
                    <section className="paper-reference-answer mt-2 rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm">
                      <strong className="block text-xs uppercase tracking-wider mb-1">Hướng dẫn chấm & Đáp án:</strong>
                      <div className="whitespace-pre-line text-slate-800">
                        <MathRenderer content={question.referenceAnswer || 'Chưa có đáp án tham khảo.'} />
                      </div>
                    </section>
                  )
                ) : (
                  <ol type="A" className="mt-2 ml-6 list-[upper-alpha] space-y-1 text-sm">
                    {(question.answers || []).map((answer) => {
                      const isCorrect = mode === 'answer' && answer.isCorrect
                      return (
                        <li
                          key={answer.id}
                          className={cn(isCorrect && 'paper-correct font-bold text-emerald-800')}
                        >
                          <span className="whitespace-pre-line"><MathRenderer content={answer.content} /></span>
                          {isCorrect && (
                            <span className="paper-key-mark ml-2 inline-flex items-center gap-1 rounded border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 text-[11px] font-bold text-emerald-800">
                              <Check className="h-3 w-3 no-print" />
                              ĐÁP ÁN ĐÚNG
                            </span>
                          )}
                        </li>
                      )
                    })}
                  </ol>
                )}
              </div>
            ))}
        </section>

        <footer className="paper-footer mt-8 border-t border-slate-300 pt-4 text-center text-sm font-bold text-slate-800">
          — HẾT —
          <div className="mt-1 text-xs font-normal text-slate-500">
            (Cán bộ coi thi không giải thích gì thêm)
          </div>
        </footer>
      </article>
    </div>
  )
}
