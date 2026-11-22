import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Layers, LayoutGrid, List, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/api/service'
import { useAuth } from '@/auth/AuthContext'
import { getSubjectPreset, isContentAdminRole } from '@/constants'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DataTable } from '@/components/ui/data-table'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmModal, EmptyState, ErrorState, FieldError, LoadingState, PageHeader, SubjectIcon } from '@/components/common/StateFeedback'

function SubjectFormDialog({ item, onClose }) {
  const queryClient = useQueryClient()
  const { register, handleSubmit, setError, formState: { errors } } = useForm({
    defaultValues: item || { code: '', name: '', description: '' },
  })

  const mutation = useMutation({
    mutationFn: (body) => (item ? api.updateSubject(item.id, body) : api.createSubject(body)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success(item ? 'Đã cập nhật môn học' : 'Đã thêm môn học thành công')
      onClose()
    },
    onError: (error) => {
      Object.entries(error.fieldErrors || {}).forEach(([name, message]) => setError(name, { message }))
      if (!error.fieldErrors || !Object.keys(error.fieldErrors).length) {
        setError('root', { message: error.message })
      }
    },
  })

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !mutation.isPending) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item ? 'Chỉnh sửa môn học' : 'Thêm môn học mới'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((values) => mutation.mutate(values))} noValidate className="space-y-4">
          {errors.root && (
            <Alert variant="destructive">
              <AlertDescription>{errors.root.message}</AlertDescription>
            </Alert>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="subject-code">Mã môn học (VD: MATH)</Label>
              <Input
                id="subject-code"
                autoFocus
                maxLength={10}
                placeholder="VD: MATH"
                {...register('code', {
                  required: 'Mã môn học là bắt buộc',
                  maxLength: { value: 10, message: 'Tối đa 10 ký tự' },
                })}
              />
              <FieldError>{errors.code?.message}</FieldError>
            </div>
            <div>
              <Label htmlFor="subject-name">Tên môn học</Label>
              <Input
                id="subject-name"
                maxLength={50}
                placeholder="VD: Toán học"
                {...register('name', {
                  required: 'Tên môn học là bắt buộc',
                  maxLength: { value: 50, message: 'Tối đa 50 ký tự' },
                })}
              />
              <FieldError>{errors.name?.message}</FieldError>
            </div>
          </div>

          <div>
            <Label htmlFor="subject-desc">Mô tả môn học</Label>
            <Textarea
              id="subject-desc"
              rows={3}
              placeholder="Thông tin ngắn gọn về môn học..."
              {...register('description')}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
              Hủy
            </Button>
            <Button type="submit" variant="teal" disabled={mutation.isPending}>
              {mutation.isPending ? 'Đang lưu...' : 'Lưu môn học'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function SubjectsPage() {
  const { user } = useAuth()
  const isAdmin = isContentAdminRole(user?.role)
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState('grid')
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const queryClient = useQueryClient()

  useEffect(() => {
    document.title = 'Môn học | Exam Matrix'
  }, [])

  const query = useQuery({ queryKey: ['subjects'], queryFn: api.getSubjects })
  const chaptersQuery = useQuery({ queryKey: ['chapters', 'all'], queryFn: () => api.getChapters({}) })

  const deleteMutation = useMutation({
    mutationFn: api.deleteSubject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Đã xóa môn học')
      setDeleting(null)
    },
    onError: (error) => toast.error(error.message || 'Không thể xóa môn học'),
  })

  const chapterRows = useMemo(
    () => (Array.isArray(chaptersQuery.data) ? chaptersQuery.data : chaptersQuery.data?.content || []),
    [chaptersQuery.data]
  )

  const chapterCountMap = useMemo(() => {
    const map = {}
    chapterRows.forEach((ch) => {
      map[ch.subjectId] = (map[ch.subjectId] || 0) + 1
    })
    return map
  }, [chapterRows])

  const allItems = useMemo(() => query.data || [], [query.data])

  const filteredItems = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('vi')
    if (!q) return allItems
    return allItems.filter((x) =>
      `${x.code} ${x.name} ${x.description || ''}`.toLocaleLowerCase('vi').includes(q)
    )
  }, [allItems, search])

  const columns = useMemo(
    () => [
      {
        accessorKey: 'code',
        header: 'Mã môn',
        cell: ({ row }) => {
          const preset = getSubjectPreset(row.original.code, row.original.name)
          return (
            <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-bold ${preset.badgeClass}`}>
              <SubjectIcon codeOrName={row.original.code} name={row.original.name} size={13} />
              {row.original.code}
            </span>
          )
        },
      },
      {
        accessorKey: 'name',
        header: 'Tên môn học',
        cell: ({ row }) => <span className="font-bold text-slate-900">{row.original.name}</span>,
      },
      {
        id: 'chapters',
        header: 'Số chương',
        cell: ({ row }) => (
          <span className="font-semibold text-slate-700 tabular-nums">
            {chapterCountMap[row.original.id] || 0} chương
          </span>
        ),
      },
      {
        accessorKey: 'description',
        header: 'Mô tả',
        cell: ({ row }) => (
          <span className="line-clamp-2 max-w-md text-slate-600">{row.original.description || '—'}</span>
        ),
      },
      {
        id: 'actions',
        header: 'Thao tác',
        meta: { headClassName: 'text-right', cellClassName: 'text-right' },
        cell: ({ row }) => (
          <div className="inline-flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to={`/chuong?subjectId=${row.original.id}`}>Xem chương</Link>
            </Button>
            {isAdmin && (
              <>
                <Button variant="ghost" size="icon" aria-label="Sửa môn học" onClick={() => setEditing(row.original)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Xóa môn học"
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
    [chapterCountMap, isAdmin]
  )

  return (
    <div className="space-y-5">
      <PageHeader
        accent="teal"
        eyebrow="DANH MỤC HỌC LIỆU"
        title="Môn học"
        description="Quản lý mã, tên và mô tả môn học; mở chương bài để tiếp tục tổ chức ngân hàng câu hỏi."
        action={
          <div className="flex flex-wrap items-center gap-2.5">
            <Tabs value="subjects" onValueChange={(v) => { if (v === 'chapters') navigate('/chuong') }}>
              <TabsList>
                <TabsTrigger value="subjects">Môn học ({allItems.length})</TabsTrigger>
                <TabsTrigger value="chapters">Chương bài ({chapterRows.length})</TabsTrigger>
              </TabsList>
            </Tabs>
            {isAdmin && (
              <Button variant="teal" onClick={() => setEditing({})}>
                <Plus className="h-4 w-4" />
                Thêm môn học
              </Button>
            )}
          </div>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
        <div className="relative min-w-[240px] flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo mã, tên hoặc mô tả môn học..."
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('grid')}
          >
            <LayoutGrid className="h-4 w-4" />
            Thẻ môn học
          </Button>
          <Button
            variant={viewMode === 'table' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('table')}
          >
            <List className="h-4 w-4" />
            Bảng
          </Button>
        </div>
      </div>

      {query.isLoading || chaptersQuery.isLoading ? (
        <LoadingState label="Đang tải danh mục môn học..." />
      ) : query.isError || chaptersQuery.isError ? (
        <ErrorState
          error={query.error || chaptersQuery.error}
          onRetry={() => {
            query.refetch()
            chaptersQuery.refetch()
          }}
        />
      ) : !filteredItems.length ? (
        <EmptyState title="Không tìm thấy môn học" description="Thử thay đổi từ khóa tìm kiếm hoặc thêm môn học mới." />
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map((item) => {
            const preset = getSubjectPreset(item.code, item.name)
            const chCount = chapterCountMap[item.id] || 0
            return (
              <Card key={item.id} className="flex flex-col justify-between border-slate-200 transition-shadow hover:shadow-md">
                <CardContent className="space-y-4 p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${preset.iconBgClass}`}>
                      <SubjectIcon codeOrName={item.code} name={item.name} size={22} />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge className={preset.badgeClass}>{item.code}</Badge>
                      {isAdmin && (
                        <>
                          <Button variant="ghost" size="icon" aria-label={`Sửa ${item.name}`} onClick={() => setEditing(item)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Xóa ${item.name}`}
                            className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                            onClick={() => setDeleting(item)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <h3 className="text-lg font-bold text-slate-900">{item.name}</h3>
                    <p className="line-clamp-2 min-h-[40px] text-sm text-slate-600">
                      {item.description || 'Chưa có mô tả cho môn học này.'}
                    </p>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 tabular-nums">
                      <Layers className="h-3.5 w-3.5 text-teal-600" />
                      {chCount} chương bài
                    </span>
                    <Button variant="outline" size="sm" asChild>
                      <Link to={`/chuong?subjectId=${item.id}`}>
                        Xem chương bài
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        <DataTable columns={columns} data={filteredItems} getRowId={(r) => String(r.id)} />
      )}

      {editing && <SubjectFormDialog item={editing.id ? editing : null} onClose={() => setEditing(null)} />}
      {deleting && (
        <ConfirmModal
          title="Xác nhận xóa môn học"
          message={`Xóa môn học “${deleting.name}”? Thao tác này sẽ xóa toàn bộ chương bài, câu hỏi, ma trận và đề thi thuộc môn học này.`}
          onClose={() => setDeleting(null)}
          onConfirm={() => deleteMutation.mutate(deleting.id)}
          busy={deleteMutation.isPending}
        />
      )}
    </div>
  )
}
