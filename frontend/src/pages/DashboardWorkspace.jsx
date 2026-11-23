import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Crown,
  Flame,
  GraduationCap,
  Medal,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Trophy,
  UserCheck,
} from 'lucide-react'
import { api } from '@/api/service'
import { useAuth } from '@/auth/AuthContext'
import { attemptStatusMeta, isContentAdminRole } from '@/constants'
import { formatDateTime } from '@/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmptyState, ErrorState, LoadingState, PageHeader } from '@/components/common/StateFeedback'
import FeedbackInboxButton from '@/components/common/FeedbackInboxButton'
import { AnimatedBackground } from '@/components/motion-primitives/animated-background'
import { TransitionPanel } from '@/components/motion-primitives/transition-panel'
import { cn } from '@/lib/utils'

const numberFormat = new Intl.NumberFormat('vi-VN')
const fmt = (value) => numberFormat.format(Number(value) || 0)
const fmtTen = (value) => {
  if (value == null || Number.isNaN(Number(value))) return '—'
  const n = Number(value)
  return Number.isInteger(n) ? `${n}/10` : `${n.toFixed(2).replace(/\.?0+$/, '')}/10`
}

const PIE_COLORS = [
  '#2563EB',
  '#F97316',
  '#10B981',
  '#E11D48',
  '#8B5CF6',
  '#EAB308',
  '#06B6D4',
  '#EC4899',
  '#84CC16',
  '#92400E',
  '#0F766E',
  '#475569',
]
const DIFFICULTY_META = {
  EASY: { label: 'Dễ', color: '#0D9488' },
  MEDIUM: { label: 'Trung bình', color: '#D97706' },
  HARD: { label: 'Khó', color: '#DC2626' },
}

function getMondayIso(dateObj = new Date()) {
  const d = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate())
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function shiftIsoDate(iso, deltaDays) {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + deltaDays)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

function formatShortDate(iso) {
  if (!iso) return ''
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

const roleViews = {
  TEACHER: [
    { id: 'bank', label: 'Ngân hàng câu hỏi', short: 'Ngân hàng' },
    { id: 'scores', label: 'Phổ điểm', short: 'Phổ điểm' },
  ],
  STUDENT: [
    { id: 'activity', label: 'Tiến độ của tôi', short: 'Tiến độ' },
    { id: 'results', label: 'Kết quả theo môn', short: 'Kết quả' },
    { id: 'chapters', label: 'Câu hỏi theo chương', short: 'Ôn tập' },
  ],
}

function useRoleView(role, defaultView) {
  const [params, setParams] = useSearchParams()
  const requested = params.get('view')
  const view = requested && roleViews[role]?.some((item) => item.id === requested) ? requested : defaultView
  const setView = (next) => {
    const updated = new URLSearchParams(params)
    updated.set('view', next)
    setParams(updated, { replace: true })
  }
  return [view, setView]
}

function VisitChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const day = payload[0]?.payload
  if (!day) return null
  return (
    <div className="min-w-[210px] rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-md">
      <div className="font-bold text-slate-900">
        {day.dayLabel} ({formatShortDate(day.date)})
      </div>
      {!day.dataCollected ? (
        <p className="mt-1.5 text-slate-500">Chưa thu thập dữ liệu phiên truy cập cho ngày này.</p>
      ) : (
        <div className="mt-2 space-y-2">
          <div className="flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-1.5 text-slate-700">
              <span className="h-2.5 w-2.5 rounded-xs bg-indigo-600" />
              Giáo viên
            </span>
            <span className="font-semibold tabular-nums text-slate-900">{fmt(day.teacherVisits)} lượt</span>
          </div>
          {day.topTeacher && (
            <div className="pl-4 text-[11px] text-slate-500">
              Dẫn đầu: <strong className="text-slate-700">{day.topTeacher.fullName}</strong> ({fmt(day.topTeacher.visits)})
            </div>
          )}
          <div className="flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-1.5 text-slate-700">
              <span className="h-2.5 w-2.5 rounded-xs bg-teal-600" />
              Học sinh
            </span>
            <span className="font-semibold tabular-nums text-slate-900">{fmt(day.studentVisits)} lượt</span>
          </div>
          {day.topStudent && (
            <div className="pl-4 text-[11px] text-slate-500">
              Dẫn đầu: <strong className="text-slate-700">{day.topStudent.fullName}</strong> ({fmt(day.topStudent.visits)})
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function RankBadge({ rank }) {
  if (rank === 1) {
    return (
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-amber-700 ring-1 ring-amber-300" title="Hạng 1">
        <Trophy className="h-4 w-4" />
      </span>
    )
  }
  if (rank === 2) {
    return (
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-slate-700 ring-1 ring-slate-300" title="Hạng 2">
        <Medal className="h-4 w-4" />
      </span>
    )
  }
  if (rank === 3) {
    return (
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-orange-100 text-orange-700 ring-1 ring-orange-300" title="Hạng 3">
        <Crown className="h-4 w-4" />
      </span>
    )
  }
  return (
    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs font-bold tabular-nums text-slate-600">
      {rank}
    </span>
  )
}

function DeltaIndicator({ isNew, rankDelta, isTopClimber }) {
  return (
    <div className="flex flex-col items-end gap-1">
      {isNew ? (
        <Badge variant="indigo" className="text-[10px]">Mới</Badge>
      ) : rankDelta > 0 ? (
        <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-emerald-700 tabular-nums">
          <TrendingUp className="h-3.5 w-3.5" />+{rankDelta}
        </span>
      ) : rankDelta < 0 ? (
        <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-rose-600 tabular-nums">
          <TrendingDown className="h-3.5 w-3.5" />{rankDelta}
        </span>
      ) : (
        <span className="text-xs text-slate-400">—</span>
      )}
      {isTopClimber && (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 ring-1 ring-amber-200">
          <Flame className="h-3 w-3 text-amber-600" />
          Tăng mạnh nhất
        </span>
      )}
    </div>
  )
}

function AdminDashboardWorkspace({ analytics, weekStart, setWeekStart, onRefresh, isFetching }) {
  const [boardRole, setBoardRole] = useState('TEACHER')
  const [focusedDayIso, setFocusedDayIso] = useState(null)

  const weekly = analytics?.adminWeeklyVisits
  const days = useMemo(() => weekly?.days || [], [weekly])
  const chartData = useMemo(
    () =>
      days.map((d) => ({
        ...d,
        shortLabel: `${d.dayLabel.replace('Thứ ', 'T').replace('Chủ nhật', 'CN')} ${formatShortDate(d.date)}`,
      })),
    [days],
  )
  const focusedDay = useMemo(
    () => days.find((d) => d.date === focusedDayIso) || null,
    [days, focusedDayIso],
  )

  const teachers = analytics?.adminTeacherLeaderboard || []
  const students = analytics?.adminStudentLeaderboard || []
  const currentMonday = getMondayIso()

  return (
    <div className="space-y-6 pb-16">
      <PageHeader
        title="Tổng quan quản trị"
        description="Lượt phiên truy cập theo tuần (GMT+7) và bảng xếp hạng hoạt động nổi bật."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <FeedbackInboxButton role="ADMIN" />
            <Button size="sm" variant="outline" asChild>
              <Link to="/ket-qua">
                Xem Kết quả
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
            <Button size="sm" variant="outline" onClick={onRefresh} disabled={isFetching}>
              <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />
              Làm mới
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-12">

        <Card className="border-slate-200 shadow-xs lg:col-span-7">
          <CardHeader className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base font-bold text-slate-900">Lượt truy cập theo ngày trong tuần</CardTitle>
              <p className="mt-0.5 text-xs text-slate-500 tabular-nums">
                {weekly ? `${formatShortDate(weekly.weekStart)} – ${formatShortDate(weekly.weekEnd)} · Múi giờ Việt Nam` : 'Tuần hiện tại'}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="outline"
                aria-label="Tuần trước"
                onClick={() => {
                  setFocusedDayIso(null)
                  setWeekStart(shiftIsoDate(weekStart, -7))
                }}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant={weekStart === currentMonday ? 'default' : 'outline'}
                onClick={() => {
                  setFocusedDayIso(null)
                  setWeekStart(currentMonday)
                }}
              >
                Tuần này
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                aria-label="Tuần sau"
                disabled={weekStart >= currentMonday}
                onClick={() => {
                  setFocusedDayIso(null)
                  setWeekStart(shiftIsoDate(weekStart, 7))
                }}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="pt-5">
            <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1.5 font-medium">
                <span className="h-2.5 w-2.5 rounded-xs bg-indigo-600" /> Giáo viên
              </span>
              <span className="inline-flex items-center gap-1.5 font-medium">
                <span className="h-2.5 w-2.5 rounded-xs bg-teal-600" /> Học sinh
              </span>
              <span className="inline-flex items-center gap-1.5 text-slate-500">
                <span className="h-2.5 w-2.5 rounded-xs border border-dashed border-slate-400 bg-slate-100" /> Chưa thu thập
              </span>
            </div>

            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 8, right: 8, left: -12, bottom: 4 }}
                  onClick={(state) => {
                    const clicked = state?.activePayload?.[0]?.payload
                    if (clicked?.date) setFocusedDayIso(clicked.date)
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="shortLabel" tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<VisitChartTooltip />} cursor={{ fill: 'rgba(99, 102, 241, 0.06)' }} />
                  <Bar dataKey="teacherVisits" name="Giáo viên" fill="#4F46E5" radius={[4, 4, 0, 0]} maxBarSize={24} />
                  <Bar dataKey="studentVisits" name="Học sinh" fill="#0D9488" radius={[4, 4, 0, 0]} maxBarSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-4 flex flex-wrap gap-1.5" role="group" aria-label="Xem chi tiết từng ngày">
              {days.map((d) => {
                const active = focusedDay?.date === d.date
                return (
                  <button
                    key={d.date}
                    type="button"
                    onClick={() => setFocusedDayIso(active ? null : d.date)}
                    className={cn(
                      'rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors tabular-nums',
                      active
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-800'
                        : d.dataCollected
                          ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                          : 'border-dashed border-slate-200 bg-slate-50/70 text-slate-400',
                    )}
                  >
                    {d.dayLabel.replace('Thứ ', 'T').replace('Chủ nhật', 'CN')} {formatShortDate(d.date)}
                  </button>
                )
              })}
            </div>

            {focusedDay && (
              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 text-xs">
                <div className="font-bold text-slate-900">
                  {focusedDay.dayLabel} ({formatShortDate(focusedDay.date)})
                </div>
                {!focusedDay.dataCollected ? (
                  <p className="mt-1 text-slate-500">Ngày chưa thu thập dữ liệu phiên truy cập.</p>
                ) : (
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-lg bg-white p-2.5 border border-slate-200/80">
                      <div className="text-slate-500">Giáo viên · <strong className="text-slate-900 tabular-nums">{fmt(focusedDay.teacherVisits)} lượt</strong></div>
                      <div className="mt-0.5 text-slate-700">
                        {focusedDay.topTeacher
                          ? `Dẫn đầu: ${focusedDay.topTeacher.fullName} (${fmt(focusedDay.topTeacher.visits)} lượt)`
                          : 'Chưa có lượt truy cập'}
                      </div>
                    </div>
                    <div className="rounded-lg bg-white p-2.5 border border-slate-200/80">
                      <div className="text-slate-500">Học sinh · <strong className="text-slate-900 tabular-nums">{fmt(focusedDay.studentVisits)} lượt</strong></div>
                      <div className="mt-0.5 text-slate-700">
                        {focusedDay.topStudent
                          ? `Dẫn đầu: ${focusedDay.topStudent.fullName} (${fmt(focusedDay.topStudent.visits)} lượt)`
                          : 'Chưa có lượt truy cập'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-xs lg:col-span-5">
          <CardHeader className="flex flex-row items-center justify-between gap-2 border-b border-slate-100 pb-4">
            <div>
              <CardTitle className="text-base font-bold text-slate-900">Bảng xếp hạng Top 10</CardTitle>
              <p className="mt-0.5 text-xs text-slate-500">
                {boardRole === 'TEACHER'
                  ? 'Ưu tiên bài chấm hoàn tất, tiếp theo là lô phát hành đề'
                  : 'Xếp hạng theo điểm bài thi cao nhất (thang điểm 10)'}
              </p>
            </div>
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
              <button
                type="button"
                onClick={() => setBoardRole('TEACHER')}
                className={cn(
                  'inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors',
                  boardRole === 'TEACHER' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900',
                )}
              >
                <UserCheck className="h-3.5 w-3.5" />
                Giáo viên
              </button>
              <button
                type="button"
                onClick={() => setBoardRole('STUDENT')}
                className={cn(
                  'inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors',
                  boardRole === 'STUDENT' ? 'bg-white text-teal-700 shadow-xs' : 'text-slate-600 hover:text-slate-900',
                )}
              >
                <GraduationCap className="h-3.5 w-3.5" />
                Học sinh
              </button>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {boardRole === 'TEACHER' ? (
              teachers.length === 0 ? (
                <div className="p-6">
                  <EmptyState title="Chưa có kết quả" description="Chưa có giáo viên nào có bài chấm hoàn tất hoặc lô phát hành đề." />
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {teachers.map((item) => (
                    <li key={item.userId} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50/70">
                      <div className="flex min-w-0 items-center gap-3">
                        <RankBadge rank={item.rank} />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-slate-900">{item.fullName}</div>
                          <div className="text-xs text-slate-500 tabular-nums">
                            {fmt(item.gradedEssaysCount)} bài chấm · {fmt(item.publishedBatchCount)} lô phát hành
                          </div>
                        </div>
                      </div>
                      <DeltaIndicator isNew={item.isNew} rankDelta={item.rankDelta} isTopClimber={item.isTopClimber} />
                    </li>
                  ))}
                </ul>
              )
            ) : students.length === 0 ? (
              <div className="p-6">
                <EmptyState title="Chưa có kết quả" description="Chưa có học sinh nào hoàn thành bài thi trên thang điểm 10." />
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {students.map((item) => (
                  <li key={item.userId} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50/70">
                    <div className="flex min-w-0 items-center gap-3">
                      <RankBadge rank={item.rank} />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-900">{item.fullName}</div>
                        <div className="text-xs text-slate-500 tabular-nums">
                          <strong className="text-teal-700">{fmtTen(item.highestScore)}</strong> cao nhất · {fmt(item.totalAttempts)} bài
                        </div>
                      </div>
                    </div>
                    <DeltaIndicator isNew={item.isNew} rankDelta={item.rankDelta} isTopClimber={item.isTopClimber} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function TeacherDashboardWorkspace({
  analytics,
  selectedSubjectId,
  setSelectedSubjectId,
  daysFilter,
  setDaysFilter,
  onRefresh,
  isFetching,
}) {
  const [view, setView] = useRoleView('TEACHER', 'bank')
  const views = roleViews.TEACHER

  const subjectPieData = useMemo(
    () =>
      (analytics?.teacherSubjectQuestionCounts || []).map((item, idx) => ({
        ...item,
        color: PIE_COLORS[idx % PIE_COLORS.length],
      })),
    [analytics],
  )
  const totalOwnedQuestions = useMemo(
    () => subjectPieData.reduce((acc, item) => acc + Number(item.count || 0), 0),
    [subjectPieData],
  )

  const effectiveSubjectId = selectedSubjectId ?? analytics?.selectedSubjectId ?? subjectPieData[0]?.subjectId ?? null
  const activeSubjectName =
    subjectPieData.find((s) => String(s.subjectId) === String(effectiveSubjectId))?.subjectName || 'Môn đang chọn'

  const difficultyPieData = useMemo(
    () =>
      (analytics?.teacherDifficultyBreakdown || []).map((item) => ({
        difficulty: item.difficulty,
        label: DIFFICULTY_META[item.difficulty]?.label || item.difficulty,
        count: Number(item.count || 0),
        color: DIFFICULTY_META[item.difficulty]?.color || '#64748B',
      })),
    [analytics],
  )
  const totalSubjectQuestions = useMemo(
    () => difficultyPieData.reduce((acc, item) => acc + item.count, 0),
    [difficultyPieData],
  )

  const histogram = analytics?.teacherScoreHistogram
  const histogramBins = histogram?.bins || []

  return (
    <div className="space-y-6 pb-16">
      <PageHeader
        title="Tổng quan giáo viên"
        description="Theo dõi ngân hàng câu hỏi bạn biên soạn và phổ điểm thang 10 của học sinh."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <FeedbackInboxButton role="TEACHER" />
            <Button size="sm" variant="outline" onClick={onRefresh} disabled={isFetching}>
              <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />
              Làm mới
            </Button>
          </div>
        }
      />

      <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100/80 p-1" role="tablist" aria-label="Góc nhìn tổng quan giáo viên">
          <AnimatedBackground
            activeId={view}
            className="rounded-lg bg-white shadow-xs"
            transition={{ type: 'spring', bounce: 0.15, duration: 0.25 }}
          >
            {views.map((item) => (
              <button
                key={item.id}
                data-id={item.id}
                type="button"
                role="tab"
                aria-selected={view === item.id}
                onClick={() => setView(item.id)}
                className={cn(
                  'rounded-lg px-4 py-2 text-sm font-semibold transition-colors cursor-pointer',
                  view === item.id ? 'text-indigo-700' : 'text-slate-600 hover:text-slate-900',
                )}
              >
                {item.label}
              </button>
            ))}
          </AnimatedBackground>
        </div>
      </div>

      <TransitionPanel activeKey={view} transition={{ duration: 0.2 }}>
        {view === 'bank' ? (
          <div className="grid gap-6 lg:grid-cols-2">
          <Card className="border-slate-200 shadow-xs">
            <CardHeader className="border-b border-slate-100 pb-4">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base font-bold text-slate-900">Câu hỏi bạn tạo theo môn</CardTitle>
                <span className="text-xs font-semibold tabular-nums text-slate-500">{fmt(totalOwnedQuestions)} câu</span>
              </div>
            </CardHeader>
            <CardContent className="pt-5">
              {subjectPieData.length === 0 ? (
                <EmptyState
                  title="Chưa có câu hỏi do bạn tạo"
                  description="Tạo thủ công hoặc nhập file Word/PDF để xem phân bố theo môn học."
                  action={
                    <Button size="sm" asChild>
                      <Link to="/cau-hoi">Mở Ngân hàng câu hỏi</Link>
                    </Button>
                  }
                />
              ) : (
                <div className="grid items-center gap-4 sm:grid-cols-2">
                  <div className="h-[230px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={subjectPieData}
                          dataKey="count"
                          nameKey="subjectName"
                          cx="50%"
                          cy="50%"
                          innerRadius={52}
                          outerRadius={86}
                          paddingAngle={2}
                          onClick={(entry) => entry?.subjectId && setSelectedSubjectId(entry.subjectId)}
                        >
                          {subjectPieData.map((entry) => (
                            <Cell
                              key={entry.subjectId}
                              fill={entry.color}
                              className="cursor-pointer outline-none"
                              stroke={String(entry.subjectId) === String(effectiveSubjectId) ? '#0F172A' : '#FFFFFF'}
                              strokeWidth={String(entry.subjectId) === String(effectiveSubjectId) ? 2 : 1}
                            />
                          ))}
                        </Pie>
                        <Tooltip formatter={(val) => [`${fmt(val)} câu`, 'Số lượng']} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="space-y-2 text-xs">
                    {subjectPieData.map((item) => {
                      const active = String(item.subjectId) === String(effectiveSubjectId)
                      return (
                        <li key={item.subjectId}>
                          <button
                            type="button"
                            onClick={() => setSelectedSubjectId(item.subjectId)}
                            className={cn(
                              'flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors',
                              active ? 'border-indigo-300 bg-indigo-50/70 font-semibold text-indigo-900' : 'border-slate-100 hover:bg-slate-50 text-slate-700',
                            )}
                          >
                            <span className="flex min-w-0 items-center gap-2">
                              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                              <span className="truncate">{item.subjectName}</span>
                            </span>
                            <span className="shrink-0 font-semibold tabular-nums">{fmt(item.count)}</span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-xs">
            <CardHeader className="flex flex-col gap-2 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base font-bold text-slate-900">Phân bố độ khó · {activeSubjectName}</CardTitle>
                <p className="text-xs text-slate-500 tabular-nums">{fmt(totalSubjectQuestions)} câu thuộc môn đang chọn</p>
              </div>
              {subjectPieData.length > 0 && (
                <select
                  aria-label="Chọn môn học xem phân bố độ khó"
                  value={effectiveSubjectId ?? ''}
                  onChange={(e) => setSelectedSubjectId(e.target.value ? Number(e.target.value) : null)}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-800"
                >
                  {subjectPieData.map((s) => (
                    <option key={s.subjectId} value={s.subjectId}>
                      {s.subjectName} ({s.count})
                    </option>
                  ))}
                </select>
              )}
            </CardHeader>
            <CardContent className="pt-5">
              {totalSubjectQuestions === 0 ? (
                <EmptyState title="Chưa có dữ liệu độ khó" description="Chọn môn học có câu hỏi do bạn biên soạn để xem tỷ lệ Dễ / Trung bình / Khó." />
              ) : (
                <div className="grid items-center gap-4 sm:grid-cols-2">
                  <div className="h-[230px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={difficultyPieData.filter((d) => d.count > 0)}
                          dataKey="count"
                          nameKey="label"
                          cx="50%"
                          cy="50%"
                          innerRadius={52}
                          outerRadius={86}
                          paddingAngle={2}
                        >
                          {difficultyPieData
                            .filter((d) => d.count > 0)
                            .map((entry) => (
                              <Cell key={entry.difficulty} fill={entry.color} />
                            ))}
                        </Pie>
                        <Tooltip formatter={(val) => [`${fmt(val)} câu`, 'Số lượng']} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="space-y-2.5 text-xs">
                    {difficultyPieData.map((d) => {
                      const pct = totalSubjectQuestions > 0 ? Math.round((d.count * 100) / totalSubjectQuestions) : 0
                      return (
                        <li key={d.difficulty} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
                          <span className="flex items-center gap-2 font-medium text-slate-800">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                            {d.label}
                          </span>
                          <span className="font-semibold tabular-nums text-slate-900">
                            {fmt(d.count)} ({pct}%)
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
          </div>
        ) : (
          <Card className="border-slate-200 shadow-xs">
          <CardHeader className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base font-bold text-slate-900">Phổ điểm thang 10</CardTitle>
              <p className="mt-0.5 text-xs text-slate-500">
                Khoảng nửa mở [a, b), khoảng cuối 9–10 bao gồm điểm 10
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Lọc phổ điểm theo môn"
                value={selectedSubjectId ?? ''}
                onChange={(e) => setSelectedSubjectId(e.target.value ? Number(e.target.value) : null)}
                className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-800"
              >
                <option value="">Tất cả môn học</option>
                {subjectPieData.map((s) => (
                  <option key={s.subjectId} value={s.subjectId}>{s.subjectName}</option>
                ))}
              </select>
              <select
                aria-label="Lọc phổ điểm theo thời gian"
                value={daysFilter ?? ''}
                onChange={(e) => setDaysFilter(e.target.value ? Number(e.target.value) : null)}
                className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-800"
              >
                <option value="">Toàn thời gian</option>
                <option value="7">7 ngày gần nhất</option>
                <option value="30">30 ngày gần nhất</option>
                <option value="90">90 ngày gần nhất</option>
              </select>
            </div>
          </CardHeader>
          <CardContent className="pt-5 space-y-5">
            <div className="grid grid-cols-3 gap-3 sm:max-w-md">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5">
                <div className="text-[11px] font-medium text-slate-500">Cỡ mẫu</div>
                <div className="mt-0.5 text-lg font-bold tabular-nums text-slate-900">{fmt(histogram?.sampleSize ?? 0)}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5">
                <div className="text-[11px] font-medium text-slate-500">Trung bình</div>
                <div className="mt-0.5 text-lg font-bold tabular-nums text-indigo-700">
                  {histogram?.mean != null ? Number(histogram.mean).toFixed(2) : '—'}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5">
                <div className="text-[11px] font-medium text-slate-500">Trung vị</div>
                <div className="mt-0.5 text-lg font-bold tabular-nums text-teal-700">
                  {histogram?.median != null ? Number(histogram.median).toFixed(2) : '—'}
                </div>
              </div>
            </div>

            {!histogram || histogram.sampleSize === 0 ? (
              <EmptyState title="Chưa có lượt thi hoàn tất" description="Chưa có bài làm đã chấm điểm trong bộ lọc đang chọn." />
            ) : (
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={histogramBins} margin={{ top: 8, right: 8, left: -12, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(val) => [`${fmt(val)} lượt`, 'Số bài']} />
                    <Bar dataKey="count" name="Số bài" fill="#4F46E5" radius={[4, 4, 0, 0]} maxBarSize={36} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
        )}
      </TransitionPanel>
    </div>
  )
}

function StudentDashboardWorkspace({ analytics, onRefresh, isFetching }) {
  const [view, setView] = useRoleView('STUDENT', 'activity')
  const views = roleViews.STUDENT

  const attempts = useMemo(() => analytics?.studentAttempts || [], [analytics])
  const subjectResults = useMemo(() => analytics?.studentSubjectResults || [], [analytics])
  const chapterProgress = useMemo(() => analytics?.studentChapterProgress || [], [analytics])

  const scoreTimeline = useMemo(() => {
    return attempts
      .filter((item) => item.status === 'COMPLETED' && item.scoreOnTen != null && !Number.isNaN(Number(item.scoreOnTen)))
      .slice(0, 20)
      .reverse()
      .map((item, idx) => ({
        index: idx + 1,
        code: item.examCode ? `#${item.examCode}` : `Lượt ${idx + 1}`,
        title: `${item.paperTitle || 'Bài thi'} (Lần ${item.attemptNumber || 1})`,
        subjectName: item.subjectName || '',
        scoreOnTen: Number(item.scoreOnTen),
      }))
  }, [attempts])

  const subjectChartData = useMemo(
    () =>
      subjectResults.map((sr, idx) => ({
        subjectName: sr.subjectName,
        averageOnTen: Number(Number(sr.averageOnTen || 0).toFixed(2)),
        attemptCount: Number(sr.attemptCount || 0),
        color: PIE_COLORS[idx % PIE_COLORS.length],
      })),
    [subjectResults],
  )

  return (
    <div className="space-y-6 pb-16">
      <PageHeader
        title="Tổng quan học tập"
        description="Theo dõi tiến độ làm bài, kết quả thang điểm 10 và mức độ nắm vững từng chương."
        action={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="teal" asChild>
              <Link to="/hoc-sinh/de-thi">
                Vào danh sách đề
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
            <Button size="sm" variant="outline" onClick={onRefresh} disabled={isFetching}>
              <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />
              Làm mới
            </Button>
          </div>
        }
      />

      <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100/80 p-1" role="tablist" aria-label="Góc nhìn tổng quan học sinh">
          <AnimatedBackground
            activeId={view}
            className="rounded-lg bg-white shadow-xs"
            transition={{ type: 'spring', bounce: 0.15, duration: 0.25 }}
          >
            {views.map((item) => (
              <button
                key={item.id}
                data-id={item.id}
                type="button"
                role="tab"
                aria-selected={view === item.id}
                onClick={() => setView(item.id)}
                className={cn(
                  'rounded-lg px-3.5 py-2 text-xs sm:text-sm font-semibold transition-colors cursor-pointer',
                  view === item.id ? 'text-teal-800' : 'text-slate-600 hover:text-slate-900',
                )}
              >
                {item.label}
              </button>
            ))}
          </AnimatedBackground>
        </div>
      </div>

      <TransitionPanel activeKey={view} transition={{ duration: 0.2 }}>
        {view === 'activity' && (
          <div className="space-y-6">
            {attempts.length === 0 ? (
              <Card className="border-slate-200 shadow-xs">
                <CardContent className="p-6">
                  <EmptyState
                    title="Chưa có lượt làm bài"
                    description="Chọn một đề thi trong mục Đề thi & Luyện tập để bắt đầu."
                    action={
                      <Button size="sm" variant="teal" asChild>
                        <Link to="/hoc-sinh/de-thi">Xem đề thi</Link>
                      </Button>
                    }
                  />
                </CardContent>
              </Card>
            ) : (
              <>
                <Card className="border-slate-200 shadow-xs">
                  <CardHeader className="flex flex-row items-center justify-between gap-2 border-b border-slate-100 pb-4">
                    <div>
                      <CardTitle className="text-base font-bold text-slate-900">Diễn biến điểm số</CardTitle>
                      <p className="mt-0.5 text-xs text-slate-500 tabular-nums">
                        {fmt(scoreTimeline.length)}/{fmt(attempts.length)} lượt đã có điểm trên thang 10
                      </p>
                    </div>
                    <Badge variant="neutral">20 lượt gần nhất</Badge>
                  </CardHeader>
                  <CardContent className="pt-5">
                    {scoreTimeline.length === 0 ? (
                      <EmptyState
                        title="Chưa có lượt đã chấm điểm"
                        description="Các bài đang làm hoặc chờ chấm sẽ xuất hiện trên biểu đồ ngay sau khi có điểm."
                      />
                    ) : (
                      <div className="h-[240px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={scoreTimeline} margin={{ top: 8, right: 16, left: -12, bottom: 4 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                            <XAxis dataKey="code" tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} />
                            <YAxis domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                            <Tooltip
                              formatter={(val) => [fmtTen(val), 'Điểm thang 10']}
                              labelFormatter={(label, payload) => {
                                const row = payload?.[0]?.payload
                                return row ? `${row.title} (${label})` : label
                              }}
                            />
                            <Line
                              type="monotone"
                              dataKey="scoreOnTen"
                              stroke="#0D9488"
                              strokeWidth={2.5}
                              dot={{ r: 4, fill: '#0D9488', stroke: '#FFFFFF', strokeWidth: 2 }}
                              activeDot={{ r: 6 }}
                              isAnimationActive={false}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-slate-200 shadow-xs">
                  <CardHeader className="border-b border-slate-100 pb-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-bold text-slate-900">Các lượt làm bài gần nhất</CardTitle>
                      <span className="text-xs font-medium text-slate-500 tabular-nums">
                        {fmt(analytics?.studentAttemptTotal ?? attempts.length)} lượt
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Đề thi</TableHead>
                            <TableHead>Môn học</TableHead>
                            <TableHead>Trạng thái</TableHead>
                            <TableHead className="text-right">Điểm (thang 10)</TableHead>
                            <TableHead className="text-right">Thời điểm</TableHead>
                            <TableHead className="text-right">Thao tác</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {attempts.map((item) => {
                            const meta = attemptStatusMeta(item.status)
                            return (
                              <TableRow key={item.attemptId}>
                                <TableCell>
                                  <div className="font-medium text-slate-900">
                                    {item.paperTitle} (Lần {item.attemptNumber || 1})
                                  </div>
                                  <div className="text-xs text-slate-500">Mã {item.examCode}</div>
                                </TableCell>
                                <TableCell className="text-slate-700">{item.subjectName}</TableCell>
                                <TableCell>
                                  <Badge variant={meta.tone}>{meta.label}</Badge>
                                </TableCell>
                                <TableCell className="text-right font-semibold tabular-nums text-slate-900">
                                  {item.status === 'COMPLETED' ? fmtTen(item.scoreOnTen) : '—'}
                                </TableCell>
                                <TableCell className="text-right text-xs tabular-nums text-slate-500">
                                  {formatDateTime(item.gradedAt || item.submittedAt || item.startedAt)}
                                </TableCell>
                                <TableCell className="text-right">
                                  {item.status === 'IN_PROGRESS' ? (
                                    <Button size="sm" variant="teal" asChild>
                                      <Link to={`/hoc-sinh/lam-bai/${item.paperId}`}>Tiếp tục</Link>
                                    </Button>
                                  ) : item.status === 'COMPLETED' || item.status === 'WAITING_GRADING' || item.status === 'CANCELLED' ? (
                                    <Button size="sm" variant="outline" asChild>
                                      <Link to={`/hoc-sinh/ket-qua/${item.attemptId}`}>Xem kết quả</Link>
                                    </Button>
                                  ) : (
                                    <span className="text-xs text-slate-400">Đã đóng</span>
                                  )}
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        )}

        {view === 'results' && (
          <Card className="border-slate-200 shadow-xs">
            <CardHeader className="border-b border-slate-100 pb-4">
              <CardTitle className="text-base font-bold text-slate-900">Điểm trung bình theo môn (thang 10)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 pt-5">
              {subjectResults.length === 0 ? (
                <EmptyState title="Chưa có kết quả đã chấm" description="Hoàn thành ít nhất một bài thi để xem điểm trung bình theo môn." />
              ) : (
                <>
                  <div className="h-[240px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={subjectChartData} margin={{ top: 8, right: 16, left: -12, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                        <XAxis dataKey="subjectName" tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} />
                        <YAxis domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                        <Tooltip formatter={(val) => [fmtTen(val), 'Điểm trung bình']} />
                        <Bar dataKey="averageOnTen" name="Điểm trung bình" radius={[6, 6, 0, 0]} maxBarSize={44} isAnimationActive={false}>
                          {subjectChartData.map((entry) => (
                            <Cell key={entry.subjectName} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {subjectResults.map((sr) => (
                      <div key={sr.subjectId} className="rounded-xl border border-slate-200 bg-white p-4">
                        <div className="text-sm font-bold text-slate-900">{sr.subjectName}</div>
                        <div className="mt-2 flex items-baseline justify-between">
                          <span className="text-2xl font-extrabold tabular-nums text-teal-700">
                            {Number(sr.averageOnTen).toFixed(2)}
                          </span>
                          <span className="text-xs text-slate-500 tabular-nums">{fmt(sr.attemptCount)} bài</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {view === 'chapters' && (
          <Card className="border-slate-200 shadow-xs">
            <CardHeader className="border-b border-slate-100 pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold text-slate-900">Tỷ lệ trả lời đúng theo chương</CardTitle>
                <span className="text-xs text-slate-500 tabular-nums">{fmt(analytics?.studentChapterAnswerCount ?? 0)} câu đã trả lời</span>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {chapterProgress.length === 0 ? (
                <div className="p-6">
                  <EmptyState title="Chưa có thống kê theo chương" description="Hoàn thành bài thi trắc nghiệm để xem tỷ lệ đúng từng chương." />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Môn học</TableHead>
                        <TableHead>Chương</TableHead>
                        <TableHead className="min-w-[160px]">Mức độ nắm vững</TableHead>
                        <TableHead className="text-right">Đúng / Tổng</TableHead>
                        <TableHead className="text-right">Tỷ lệ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {chapterProgress.map((ch) => {
                        const pct = ch.answeredCount > 0 ? Math.round((ch.correctCount * 100) / ch.answeredCount) : 0
                        const barColor = pct >= 80 ? 'bg-emerald-600' : pct >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                        return (
                          <TableRow key={`${ch.subjectId}-${ch.chapterId}`}>
                            <TableCell className="text-slate-600">{ch.subjectName}</TableCell>
                            <TableCell className="font-medium text-slate-900">{ch.chapterName}</TableCell>
                            <TableCell>
                              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                                <div className={cn('h-full rounded-full transition-[width]', barColor)} style={{ width: `${pct}%` }} />
                              </div>
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-slate-700">
                              {fmt(ch.correctCount)} / {fmt(ch.answeredCount)}
                            </TableCell>
                            <TableCell className="text-right font-semibold tabular-nums text-teal-700">{pct}%</TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </TransitionPanel>
    </div>
  )
}

export default function DashboardWorkspace() {
  const { user } = useAuth()
  const role = user?.role || 'TEACHER'

  const [weekStart, setWeekStart] = useState(() => getMondayIso())
  const [selectedSubjectId, setSelectedSubjectId] = useState(null)
  const [daysFilter, setDaysFilter] = useState(null)

  const queryParams = useMemo(() => {
    if (isContentAdminRole(role)) return { weekStart }
    if (role === 'TEACHER') return { subjectId: selectedSubjectId, days: daysFilter }
    return {}
  }, [role, weekStart, selectedSubjectId, daysFilter])

  const analyticsQuery = useQuery({
    queryKey: ['dashboard-analytics', user?.id, role, queryParams],
    queryFn: () => api.getDashboardAnalytics(queryParams),
    enabled: Boolean(user?.id),
    refetchInterval: 4000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: 0,
  })

  if (analyticsQuery.isPending) {
    return <LoadingState label="Đang tải dữ liệu tổng quan..." />
  }

  if (analyticsQuery.isError) {
    return (
      <ErrorState
        message={analyticsQuery.error?.message || 'Không thể tải dữ liệu tổng quan'}
        onRetry={analyticsQuery.refetch}
      />
    )
  }

  const analytics = analyticsQuery.data

  if (isContentAdminRole(role)) {
    return (
      <AdminDashboardWorkspace
        analytics={analytics}
        weekStart={weekStart}
        setWeekStart={setWeekStart}
        onRefresh={() => analyticsQuery.refetch()}
        isFetching={analyticsQuery.isFetching}
      />
    )
  }

  if (role === 'TEACHER') {
    return (
      <TeacherDashboardWorkspace
        analytics={analytics}
        selectedSubjectId={selectedSubjectId}
        setSelectedSubjectId={setSelectedSubjectId}
        daysFilter={daysFilter}
        setDaysFilter={setDaysFilter}
        onRefresh={() => analyticsQuery.refetch()}
        isFetching={analyticsQuery.isFetching}
      />
    )
  }

  return (
    <StudentDashboardWorkspace
      analytics={analytics}
      onRefresh={() => analyticsQuery.refetch()}
      isFetching={analyticsQuery.isFetching}
    />
  )
}
