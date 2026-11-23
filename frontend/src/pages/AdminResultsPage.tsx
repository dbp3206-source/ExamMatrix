import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, ArrowUpDown, ClipboardCheck, FileText, GraduationCap, Search, UserCheck } from 'lucide-react'
import { api } from '@/api/service'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/StateFeedback'
import { formatDateTime } from '@/utils'

interface UserItem {
  id: string
  username: string
  email: string
  fullName: string
  role: string
}

interface AdminResultRow {
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
  scoreOnTen: number | null
  rawScore: number | null
  maxScore: number | null
  gradedAt: string | null
  submittedAt: string | null
  gradedByName: string | null
  inTeacherClass: boolean
  isAssignedPaper: boolean
  relationLabel: string
}

interface PageResult<T> {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

function formatTenScore(val: number | null | undefined) {
  if (val == null || Number.isNaN(Number(val))) return '—'
  const num = Number(val)
  return Number.isInteger(num) ? `${num}/10` : `${num.toFixed(2).replace(/\.?0+$/, '')}/10`
}

export default function AdminResultsPage() {
  const [selectedRole, setSelectedRole] = useState<'TEACHER' | 'STUDENT' | 'ADMIN'>('TEACHER')
  const [userSearch, setUserSearch] = useState('')
  const [selectedUserId, setSelectedUserId] = useState<string>('')

  const [essayPage, setEssayPage] = useState(0)
  const [essaySort, setEssaySort] = useState<{ sortBy: string; sortDir: 'asc' | 'desc' }>({ sortBy: 'gradedAt', sortDir: 'desc' })

  const [objScope, setObjScope] = useState<'BOTH' | 'CLASS_STUDENTS' | 'ASSIGNED_PAPERS'>('BOTH')
  const [objPage, setObjPage] = useState(0)
  const [objSort, setObjSort] = useState<{ sortBy: string; sortDir: 'asc' | 'desc' }>({ sortBy: 'gradedAt', sortDir: 'desc' })

  const [studentPage, setStudentPage] = useState(0)
  const [studentSort, setStudentSort] = useState<{ sortBy: string; sortDir: 'asc' | 'desc' }>({ sortBy: 'gradedAt', sortDir: 'desc' })

  const usersQuery = useQuery<UserItem[]>({
    queryKey: ['admin-results-users', selectedRole, userSearch],
    queryFn: () => api.getAdminResultUsers({ role: selectedRole, search: userSearch.trim() || undefined }),
  })

  const users = useMemo(() => usersQuery.data || [], [usersQuery.data])
  const effectiveUserId = useMemo(() => {
    if (selectedUserId && users.some((u) => u.id === selectedUserId)) return selectedUserId
    return users[0]?.id || ''
  }, [selectedUserId, users])
  const selectedUser = useMemo(() => users.find((u) => u.id === effectiveUserId) || null, [users, effectiveUserId])

  const isGraderView = selectedRole === 'TEACHER' || selectedRole === 'ADMIN'

  const essaysQuery = useQuery<PageResult<AdminResultRow>>({
    queryKey: ['admin-results-essays', effectiveUserId, essayPage, essaySort.sortBy, essaySort.sortDir],
    queryFn: () =>
      api.getAdminTeacherEssays(effectiveUserId, {
        page: essayPage,
        size: 10,
        sortBy: essaySort.sortBy,
        sortDir: essaySort.sortDir,
      }),
    enabled: Boolean(effectiveUserId && isGraderView),
  })

  const objectivesQuery = useQuery<PageResult<AdminResultRow>>({
    queryKey: ['admin-results-objectives', effectiveUserId, objScope, objPage, objSort.sortBy, objSort.sortDir],
    queryFn: () =>
      api.getAdminTeacherObjectives(effectiveUserId, {
        scope: objScope,
        page: objPage,
        size: 10,
        sortBy: objSort.sortBy,
        sortDir: objSort.sortDir,
      }),
    enabled: Boolean(effectiveUserId && selectedRole === 'TEACHER'),
  })

  const studentResultsQuery = useQuery<PageResult<AdminResultRow>>({
    queryKey: ['admin-results-student', effectiveUserId, studentPage, studentSort.sortBy, studentSort.sortDir],
    queryFn: () =>
      api.getAdminStudentResults(effectiveUserId, {
        page: studentPage,
        size: 10,
        sortBy: studentSort.sortBy,
        sortDir: studentSort.sortDir,
      }),
    enabled: Boolean(effectiveUserId && selectedRole === 'STUDENT'),
  })

  const toggleSort = (
    current: { sortBy: string; sortDir: 'asc' | 'desc' },
    setter: (next: { sortBy: string; sortDir: 'asc' | 'desc' }) => void,
    resetPage: () => void,
    field: string,
  ) => {
    resetPage()
    if (current.sortBy === field) {
      setter({ sortBy: field, sortDir: current.sortDir === 'desc' ? 'asc' : 'desc' })
    } else {
      setter({ sortBy: field, sortDir: 'desc' })
    }
  }

  const SortIcon = ({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) => {
    if (!active) return <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
    return dir === 'asc' ? <ArrowUp className="h-3.5 w-3.5 text-indigo-600" /> : <ArrowDown className="h-3.5 w-3.5 text-indigo-600" />
  }

  return (
    <div className="space-y-6 pb-16">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Kết quả kiểm tra &amp; chấm thi</h1>
          <p className="mt-1 text-sm text-slate-600">
            Tra cứu theo vai trò và từng tài khoản trên thang điểm 10 thống nhất.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="grid gap-4 lg:grid-cols-[auto_1fr_1.4fr] lg:items-end">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">Vai trò</label>
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
              {[
                { key: 'TEACHER' as const, label: 'Giáo viên', icon: UserCheck },
                { key: 'STUDENT' as const, label: 'Học sinh', icon: GraduationCap },
                { key: 'ADMIN' as const, label: 'Quản trị viên', icon: ClipboardCheck },
              ].map((item) => {
                const Icon = item.icon
                const active = selectedRole === item.key
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setSelectedRole(item.key)
                      setSelectedUserId('')
                      setEssayPage(0)
                      setObjPage(0)
                      setStudentPage(0)
                    }}
                    className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                      active ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {item.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label htmlFor="admin-result-user-search" className="mb-1.5 block text-xs font-semibold text-slate-600">
              Tìm người dùng
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="admin-result-user-search"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Tên, email hoặc tài khoản"
                className="pl-9"
              />
            </div>
          </div>

          <div>
            <label htmlFor="admin-result-user-select" className="mb-1.5 block text-xs font-semibold text-slate-600">
              Chọn đối tượng ({users.length})
            </label>
            <select
              id="admin-result-user-select"
              value={effectiveUserId}
              onChange={(e) => {
                setSelectedUserId(e.target.value)
                setEssayPage(0)
                setObjPage(0)
                setStudentPage(0)
              }}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
            >
              {users.length === 0 ? (
                <option value="">Không có tài khoản phù hợp</option>
              ) : (
                users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName} ({u.email || u.username})
                  </option>
                ))
              )}
            </select>
          </div>
        </div>
      </div>

      {usersQuery.isPending ? (
        <LoadingState label="Đang tải danh sách người dùng..." />
      ) : usersQuery.isError ? (
        <ErrorState error={usersQuery.error} onRetry={usersQuery.refetch} />
      ) : !selectedUser ? (
        <EmptyState title="Chưa chọn người dùng" description="Vui lòng chọn một tài khoản để xem kết quả." />
      ) : isGraderView ? (
        <div className="space-y-6">

          <section className="rounded-xl border border-slate-200 bg-white shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Bài tự luận do {selectedUser.fullName} chấm
                </h2>
                <p className="text-xs text-slate-500">
                  Tổng {essaysQuery.data?.totalElements ?? 0} bài đã chấm hoàn tất
                </p>
              </div>
            </div>

            {essaysQuery.isPending ? (
              <div className="p-6"><LoadingState label="Đang tải bài tự luận..." /></div>
            ) : essaysQuery.isError ? (
              <div className="p-6"><ErrorState error={essaysQuery.error} onRetry={essaysQuery.refetch} /></div>
            ) : !essaysQuery.data?.content?.length ? (
              <div className="p-6"><EmptyState title="Chưa có bài tự luận đã chấm" description="Người dùng này chưa hoàn tất chấm bài tự luận nào." /></div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[780px] text-left text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-600">
                      <tr>
                        <th className="px-4 py-3">Học sinh</th>
                        <th className="px-4 py-3 border-l border-slate-200/70">Lớp</th>
                        <th className="px-4 py-3 border-l border-slate-200/70">Môn / Đề thi</th>
                        <th className="px-4 py-3 border-l border-slate-200/70 text-right">
                          <button
                            type="button"
                            onClick={() => toggleSort(essaySort, setEssaySort, () => setEssayPage(0), 'score')}
                            className="inline-flex items-center gap-1 font-semibold hover:text-indigo-700"
                          >
                            Điểm (thang 10)
                            <SortIcon active={essaySort.sortBy === 'score'} dir={essaySort.sortDir} />
                          </button>
                        </th>
                        <th className="px-4 py-3 border-l border-slate-200/70 text-right">
                          <button
                            type="button"
                            onClick={() => toggleSort(essaySort, setEssaySort, () => setEssayPage(0), 'gradedAt')}
                            className="inline-flex items-center gap-1 font-semibold hover:text-indigo-700"
                          >
                            Ngày chấm
                            <SortIcon active={essaySort.sortBy === 'gradedAt'} dir={essaySort.sortDir} />
                          </button>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {essaysQuery.data.content.map((row) => (
                        <tr key={row.attemptId} className="hover:bg-slate-50/60">
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-900">{row.studentName}</div>
                            <div className="text-xs text-slate-500">{row.studentEmail}</div>
                          </td>
                          <td className="px-4 py-3 border-l border-slate-100 text-slate-700">
                            {row.className ? `${row.className} (${row.classCode})` : '—'}
                          </td>
                          <td className="px-4 py-3 border-l border-slate-100">
                            <div className="font-medium text-slate-900">{row.paperTitle} (Lần {row.attemptNumber || 1})</div>
                            <div className="text-xs text-slate-500">{row.subjectName} · Mã {row.examCode}</div>
                          </td>
                          <td className="px-4 py-3 border-l border-slate-100 text-right font-semibold tabular-nums text-slate-900">
                            {formatTenScore(row.scoreOnTen)}
                          </td>
                          <td className="px-4 py-3 border-l border-slate-100 text-right text-xs tabular-nums text-slate-600">
                            {formatDateTime(row.gradedAt || row.submittedAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {essaysQuery.data.totalPages > 1 && (
                  <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-xs text-slate-600">
                    <span>Trang {essayPage + 1} / {essaysQuery.data.totalPages}</span>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" disabled={essayPage <= 0} onClick={() => setEssayPage((p) => p - 1)}>Trước</Button>
                      <Button size="sm" variant="outline" disabled={essayPage + 1 >= essaysQuery.data.totalPages} onClick={() => setEssayPage((p) => p + 1)}>Sau</Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>

          {selectedRole === 'TEACHER' && (
            <section className="rounded-xl border border-slate-200 bg-white shadow-xs">
              <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Kết quả trắc nghiệm liên quan</h2>
                  <p className="text-xs text-slate-500">
                    {objectivesQuery.data?.totalElements ?? 0} lượt thi (chống trùng theo lượt thi)
                  </p>
                </div>
                <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
                  {[
                    { key: 'BOTH' as const, label: 'Cả hai' },
                    { key: 'CLASS_STUDENTS' as const, label: 'Học sinh thuộc lớp' },
                    { key: 'ASSIGNED_PAPERS' as const, label: 'Đề đã giao' },
                  ].map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => {
                        setObjScope(item.key)
                        setObjPage(0)
                      }}
                      className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                        objScope === item.key ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {objectivesQuery.isPending ? (
                <div className="p-6"><LoadingState label="Đang tải kết quả trắc nghiệm..." /></div>
              ) : objectivesQuery.isError ? (
                <div className="p-6"><ErrorState error={objectivesQuery.error} onRetry={objectivesQuery.refetch} /></div>
              ) : !objectivesQuery.data?.content?.length ? (
                <div className="p-6"><EmptyState title="Chưa có lượt làm trắc nghiệm" description="Không có lượt thi phù hợp phạm vi đang chọn." /></div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[860px] text-left text-sm">
                      <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-600">
                        <tr>
                          <th className="px-4 py-3">Học sinh</th>
                          <th className="px-4 py-3 border-l border-slate-200/70">Lớp lúc thi</th>
                          <th className="px-4 py-3 border-l border-slate-200/70">Môn / Đề thi</th>
                          <th className="px-4 py-3 border-l border-slate-200/70">Quan hệ</th>
                          <th className="px-4 py-3 border-l border-slate-200/70 text-right">
                            <button
                              type="button"
                              onClick={() => toggleSort(objSort, setObjSort, () => setObjPage(0), 'score')}
                              className="inline-flex items-center gap-1 font-semibold hover:text-indigo-700"
                            >
                              Điểm
                              <SortIcon active={objSort.sortBy === 'score'} dir={objSort.sortDir} />
                            </button>
                          </th>
                          <th className="px-4 py-3 border-l border-slate-200/70 text-right">
                            <button
                              type="button"
                              onClick={() => toggleSort(objSort, setObjSort, () => setObjPage(0), 'gradedAt')}
                              className="inline-flex items-center gap-1 font-semibold hover:text-indigo-700"
                            >
                              Thời điểm
                              <SortIcon active={objSort.sortBy === 'gradedAt'} dir={objSort.sortDir} />
                            </button>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {objectivesQuery.data.content.map((row) => (
                          <tr key={row.attemptId} className="hover:bg-slate-50/60">
                            <td className="px-4 py-3">
                              <div className="font-medium text-slate-900">{row.studentName}</div>
                              <div className="text-xs text-slate-500">{row.studentEmail}</div>
                            </td>
                            <td className="px-4 py-3 border-l border-slate-100 text-slate-700">
                              {row.className ? `${row.className}` : '—'}
                            </td>
                            <td className="px-4 py-3 border-l border-slate-100">
                              <div className="font-medium text-slate-900">{row.paperTitle} (Lần {row.attemptNumber || 1})</div>
                              <div className="text-xs text-slate-500">{row.subjectName} · Mã {row.examCode}</div>
                            </td>
                            <td className="px-4 py-3 border-l border-slate-100">
                              <Badge variant={row.inTeacherClass && row.isAssignedPaper ? 'indigo' : 'outline'}>
                                {row.relationLabel}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 border-l border-slate-100 text-right font-semibold tabular-nums text-slate-900">
                              {formatTenScore(row.scoreOnTen)}
                            </td>
                            <td className="px-4 py-3 border-l border-slate-100 text-right text-xs tabular-nums text-slate-600">
                              {formatDateTime(row.gradedAt || row.submittedAt)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {objectivesQuery.data.totalPages > 1 && (
                    <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-xs text-slate-600">
                      <span>Trang {objPage + 1} / {objectivesQuery.data.totalPages}</span>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" disabled={objPage <= 0} onClick={() => setObjPage((p) => p - 1)}>Trước</Button>
                        <Button size="sm" variant="outline" disabled={objPage + 1 >= objectivesQuery.data.totalPages} onClick={() => setObjPage((p) => p + 1)}>Sau</Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </section>
          )}
        </div>
      ) : (

        <section className="rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-indigo-600" />
              <h2 className="text-base font-bold text-slate-900">Lịch sử bài thi của {selectedUser.fullName}</h2>
            </div>
            <span className="text-xs text-slate-500">{studentResultsQuery.data?.totalElements ?? 0} lượt thi</span>
          </div>
          {studentResultsQuery.isPending ? (
            <div className="p-6"><LoadingState label="Đang tải bài thi học sinh..." /></div>
          ) : studentResultsQuery.isError ? (
            <div className="p-6"><ErrorState error={studentResultsQuery.error} onRetry={studentResultsQuery.refetch} /></div>
          ) : !studentResultsQuery.data?.content?.length ? (
            <div className="p-6"><EmptyState title="Học sinh chưa có lượt thi" description="Chưa ghi nhận bài làm nào từ tài khoản này." /></div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[740px] text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-600">
                    <tr>
                      <th className="px-4 py-3">Môn / Đề thi</th>
                      <th className="px-4 py-3 border-l border-slate-200/70">Lớp lúc thi</th>
                      <th className="px-4 py-3 border-l border-slate-200/70">Loại đề</th>
                      <th className="px-4 py-3 border-l border-slate-200/70 text-right">
                        <button
                          type="button"
                          onClick={() => toggleSort(studentSort, setStudentSort, () => setStudentPage(0), 'score')}
                          className="inline-flex items-center gap-1 font-semibold hover:text-indigo-700"
                        >
                          Điểm
                          <SortIcon active={studentSort.sortBy === 'score'} dir={studentSort.sortDir} />
                        </button>
                      </th>
                      <th className="px-4 py-3 border-l border-slate-200/70 text-right">
                        <button
                          type="button"
                          onClick={() => toggleSort(studentSort, setStudentSort, () => setStudentPage(0), 'gradedAt')}
                          className="inline-flex items-center gap-1 font-semibold hover:text-indigo-700"
                        >
                          Thời điểm
                          <SortIcon active={studentSort.sortBy === 'gradedAt'} dir={studentSort.sortDir} />
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {studentResultsQuery.data.content.map((row) => (
                      <tr key={row.attemptId} className="hover:bg-slate-50/60">
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900">{row.paperTitle} (Lần {row.attemptNumber || 1})</div>
                          <div className="text-xs text-slate-500">{row.subjectName} · Mã {row.examCode}</div>
                        </td>
                        <td className="px-4 py-3 border-l border-slate-100 text-slate-700">{row.className || '—'}</td>
                        <td className="px-4 py-3 border-l border-slate-100">
                          <Badge variant="outline">{row.examType === 'ESSAY' ? 'Tự luận' : 'Trắc nghiệm'}</Badge>
                        </td>
                        <td className="px-4 py-3 border-l border-slate-100 text-right font-semibold tabular-nums text-slate-900">
                          {formatTenScore(row.scoreOnTen)}
                        </td>
                        <td className="px-4 py-3 border-l border-slate-100 text-right text-xs tabular-nums text-slate-600">
                          {formatDateTime(row.gradedAt || row.submittedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {studentResultsQuery.data.totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-xs text-slate-600">
                  <span>Trang {studentPage + 1} / {studentResultsQuery.data.totalPages}</span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" disabled={studentPage <= 0} onClick={() => setStudentPage((p) => p - 1)}>Trước</Button>
                    <Button size="sm" variant="outline" disabled={studentPage + 1 >= studentResultsQuery.data.totalPages} onClick={() => setStudentPage((p) => p + 1)}>Sau</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      )}
    </div>
  )
}
