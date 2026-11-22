import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, Layers, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/api/service'
import { useAuth } from '@/auth/AuthContext'
import { getSubjectPreset, isContentAdminRole } from '@/constants'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable } from '@/components/ui/data-table'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ConfirmModal, EmptyState, ErrorState, FieldError, LoadingState, PageHeader, SubjectIcon } from '@/components/common/StateFeedback'
import { cn } from '@/lib/utils'

function ChapterFormDialog({ item, subjects, chapters, selectedSubject, onClose }) {
  const queryClient = useQueryClient()
  const { register, handleSubmit, setError, watch, formState: { errors } } = useForm({
    defaultValues: item || { name: '', orderIndex: 1, subjectId: selectedSubject || '' },
  })
  const subjectId = watch('subjectId')

  const mutation = useMutation({
    mutationFn: (body) => (item ? api.updateChapter(item.id, body) : api.createChapter(body)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chapters'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['availability'] })
      toast.success(item ? 'Đã cập nhật chương bài' : 'Đã thêm chương bài mới')
      onClose()
    },
    onError: (error) => {
      Object.entries(error.fieldErrors || {}).forEach(([name, message]) => setError(name, { message }))
      if (!error.fieldErrors || !Object.keys(error.fieldErrors).length) {
        setError('root', { message: error.message })
      }
    },
  })

  const submit = (values) => {
    const duplicate = chapters.some(
      (c) =>
        c.id !== item?.id &&
        c.subjectId === Number(values.subjectId) &&
        c.orderIndex === Number(values.orderIndex)
    )
    if (duplicate) {
      return setError('orderIndex', { message: 'Số thứ tự này đã tồn tại trong môn học đã chọn' })
    }
    mutation.mutate({
      name: values.name.trim(),
      subjectId: Number(values.subjectId),
      orderIndex: Number(values.orderIndex),
    })
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !mutation.isPending) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item ? 'Sửa chương bài' : 'Thêm chương bài mới'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(submit)} noValidate className="space-y-4">
          {errors.root && (
            <Alert variant="destructive">
              <AlertDescription>{errors.root.message}</AlertDescription>
            </Alert>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="ch-subject">Môn học trực thuộc</Label>
              <Select id="ch-subject" {...register('subjectId', { required: 'Vui lòng chọn môn học' })}>
                <option value="">Chọn môn học...</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} - {s.name}
                  </option>
                ))}
              </Select>
              <FieldError>{errors.subjectId?.message}</FieldError>
            </div>
            <div>
              <Label htmlFor="ch-order">Số thứ tự (STT)</Label>
              <Input
                id="ch-order"
                type="number"
                min={1}
                {...register('orderIndex', {
                  required: 'Số thứ tự là bắt buộc',
                  min: { value: 1, message: 'Giá trị tối thiểu là 1' },
                  valueAsNumber: true,
                })}
              />
              <FieldError>{errors.orderIndex?.message}</FieldError>
            </div>
          </div>

          <div>
            <Label htmlFor="ch-name">Tên chương bài</Label>
            <Input
              id="ch-name"
              maxLength={80}
              placeholder="VD: Ứng dụng đạo hàm để khảo sát hàm số"
              {...register('name', {
                required: 'Tên chương là bắt buộc',
                maxLength: { value: 80, message: 'Tối đa 80 ký tự' },
              })}
            />
            <FieldError>{errors.name?.message}</FieldError>
          </div>

          <p className="text-xs text-slate-500">
            Số thứ tự quy định vị trí chương bài trong{' '}
            <strong className="text-slate-700">
              {subjects.find((s) => s.id === Number(subjectId))?.name || 'môn học'}
            </strong>.
          </p>

          <DialogFooter>
            <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
              Hủy
            </Button>
            <Button type="submit" variant="teal" disabled={mutation.isPending}>
              {mutation.isPending ? 'Đang lưu...' : 'Lưu chương bài'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function ChaptersPage() {
  const { user } = useAuth()
  const isAdmin = isContentAdminRole(user?.role)
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const selectedSubject = params.get('subjectId') || ''
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const queryClient = useQueryClient()

  useEffect(() => {
    document.title = 'Chương bài | Exam Matrix'
  }, [])

  const subjects = useQuery({ queryKey: ['subjects'], queryFn: api.getSubjects })
  const chapters = useQuery({
    queryKey: ['chapters', selectedSubject],
    queryFn: () => api.getChapters(selectedSubject ? { subjectId: selectedSubject } : {}),
  })
  const allChapters = useQuery({ queryKey: ['chapters', 'all'], queryFn: () => api.getChapters({}) })

  const deleteMutation = useMutation({
    mutationFn: api.deleteChapter,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chapters'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['availability'] })
      toast.success('Đã xóa chương bài')
      setDeleting(null)
    },
    onError: (error) => toast.error(error.message || 'Không thể xóa chương bài'),
  })

  const rawChapters = useMemo(() => chapters.data?.content || chapters.data || [], [chapters.data])
  const allChapterList = useMemo(() => allChapters.data?.content || allChapters.data || [], [allChapters.data])
  const allSubList = useMemo(() => subjects.data || [], [subjects.data])

  const filteredChapters = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('vi')
    if (!q) return rawChapters
    return rawChapters.filter((item) => item.name.toLocaleLowerCase('vi').includes(q))
  }, [rawChapters, search])

  const countBySubject = useMemo(() => {
    const map = {}
    allChapterList.forEach((c) => {
      map[c.subjectId] = (map[c.subjectId] || 0) + 1
    })
    return map
  }, [allChapterList])

  const columns = useMemo(
    () => [
      {
        accessorKey: 'orderIndex',
        header: 'STT',
        cell: ({ row }) => (
          <span className="inline-flex h-7 min-w-8 items-center justify-center rounded-md bg-slate-100 px-2 text-xs font-bold text-slate-800 tabular-nums">
            #{String(row.original.orderIndex || 1).padStart(2, '0')}
          </span>
        ),
      },
      {
        accessorKey: 'name',
        header: 'Tên chương bài',
        cell: ({ row }) => (
          <div>
            <div className="font-bold text-slate-900">{row.original.name}</div>
            <div className="text-xs text-slate-500">Thứ tự {row.original.orderIndex}</div>
          </div>
        ),
      },
      {
        id: 'subject',
        header: 'Môn học',
        cell: ({ row }) => {
          const subject = allSubList.find((s) => s.id === row.original.subjectId)
          const preset = getSubjectPreset(subject?.code, subject?.name)
          return (
            <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold ${preset.badgeClass}`}>
              <SubjectIcon codeOrName={subject?.code} name={subject?.name} size={13} />
              {subject?.name || 'Môn học'}
            </span>
          )
        },
      },
      {
        id: 'actions',
        header: 'Thao tác',
        meta: { headClassName: 'text-right', cellClassName: 'text-right' },
        cell: ({ row }) => (
          <div className="inline-flex items-center justify-end gap-1.5">
            <Button variant="outline" size="sm" asChild>
              <Link to={`/cau-hoi?chapterId=${row.original.id}`}>
                Xem câu hỏi
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
            {isAdmin && (
              <>
                <Button variant="ghost" size="icon" aria-label="Sửa chương" onClick={() => setEditing(row.original)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Xóa chương"
                  className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                  onClick={() => setDeleting(row.original)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        ),
      },
    ],
    [allSubList, isAdmin]
  )

  const loading = subjects.isLoading || chapters.isLoading || allChapters.isLoading

  return (
    <div className="space-y-5">
      <PageHeader
        accent="teal"
        eyebrow="DANH MỤC HỌC LIỆU"
        title="Chương bài"
        description="Chọn môn học ở thanh điều hướng bên trái để xem và quản lý phân phối chương bài tương ứng."
        action={
          <div className="flex flex-wrap items-center gap-2.5">
            <Tabs value="chapters" onValueChange={(v) => { if (v === 'subjects') navigate('/mon-hoc') }}>
              <TabsList>
                <TabsTrigger value="subjects">Môn học ({allSubList.length})</TabsTrigger>
                <TabsTrigger value="chapters">Chương bài ({allChapterList.length})</TabsTrigger>
              </TabsList>
            </Tabs>
            {isAdmin && (
              <Button variant="teal" onClick={() => setEditing({})}>
                <Plus className="h-4 w-4" />
                Thêm chương mới
              </Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">

        <Card className="lg:col-span-4 xl:col-span-3 h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm uppercase tracking-wider text-slate-600">Chọn môn học</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 p-3 pt-0">
            <button
              type="button"
              onClick={() => setParams({})}
              className={cn(
                'flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition-colors cursor-pointer',
                selectedSubject === ''
                  ? 'bg-teal-50 text-teal-900 ring-1 ring-teal-200'
                  : 'text-slate-700 hover:bg-slate-50'
              )}
            >
              <span className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-teal-700" />
                Tất cả môn học
              </span>
              <span className="text-xs font-bold tabular-nums text-slate-500">{allChapterList.length}</span>
            </button>

            {allSubList.map((subject) => {
              const preset = getSubjectPreset(subject.code, subject.name)
              const active = String(subject.id) === selectedSubject
              return (
                <button
                  key={subject.id}
                  type="button"
                  onClick={() => setParams({ subjectId: String(subject.id) })}
                  className={cn(
                    'flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors cursor-pointer',
                    active
                      ? 'bg-teal-50 font-semibold text-teal-900 ring-1 ring-teal-200'
                      : 'text-slate-700 hover:bg-slate-50'
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${preset.iconBgClass}`}>
                      <SubjectIcon codeOrName={subject.code} name={subject.name} size={14} />
                    </span>
                    <span className="truncate">{subject.name}</span>
                  </span>
                  <span className="shrink-0 text-xs font-bold tabular-nums text-slate-500">
                    {countBySubject[subject.id] || 0}
                  </span>
                </button>
              )
            })}
          </CardContent>
        </Card>

        <div className="space-y-4 lg:col-span-8 xl:col-span-9">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
            <div className="relative min-w-[220px] flex-1 max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm theo tên chương bài..."
                className="pl-9"
              />
            </div>
            <span className="text-xs font-semibold text-slate-600 tabular-nums">
              {filteredChapters.length} chương bài
            </span>
          </div>

          {loading ? (
            <LoadingState label="Đang tải danh mục chương bài..." />
          ) : chapters.isError || subjects.isError || allChapters.isError ? (
            <ErrorState
              error={chapters.error || subjects.error || allChapters.error}
              onRetry={() => {
                chapters.refetch()
                subjects.refetch()
                allChapters.refetch()
              }}
            />
          ) : !filteredChapters.length ? (
            <EmptyState
              title="Chưa có chương bài phù hợp"
              description="Hãy thử chọn môn học khác hoặc thêm chương bài mới."
            />
          ) : (
            <DataTable columns={columns} data={filteredChapters} getRowId={(r) => String(r.id)} />
          )}
        </div>
      </div>

      {editing && (
        <ChapterFormDialog
          item={editing.id ? editing : null}
          subjects={allSubList}
          chapters={allChapterList}
          selectedSubject={selectedSubject}
          onClose={() => setEditing(null)}
        />
      )}
      {deleting && (
        <ConfirmModal
          title="Xác nhận xóa chương bài"
          message={`Xóa chương “${deleting.name}”? Nếu chương đã có câu hỏi hoặc ma trận đề sử dụng, hệ thống sẽ từ chối để tránh mất dữ liệu.`}
          onClose={() => setDeleting(null)}
          onConfirm={() => deleteMutation.mutate(deleting.id)}
          busy={deleteMutation.isPending}
        />
      )}
    </div>
  )
}
