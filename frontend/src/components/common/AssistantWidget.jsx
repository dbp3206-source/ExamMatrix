import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Mascot } from 'page-mascot'
import {
  ArrowRight,
  Bell,
  BookOpenCheck,
  CheckCircle2,
  CircleHelp,
  ClipboardCheck,
  Grid3X3,
  GripVertical,
  Inbox,
  Lightbulb,
  MessageSquarePlus,
  RotateCcw,
  UserCheck,
  Users,
  X,
} from 'lucide-react'
import { api } from '@/api/service'
import { useAuth } from '@/auth/AuthContext'
import { roleLabel } from '@/constants'
import { cn } from '@/lib/utils'

const POSITION_STORAGE_KEY = 'exam_assistant_position_v1'
const SEEN_APPROVED_PREFIX = 'exam_seen_approved_classes_v1_'
const VIEWPORT_PADDING = 12
const DRAG_THRESHOLD_PX = 5
const DEFAULT_WIDGET_WIDTH = 168
const DEFAULT_WIDGET_HEIGHT = 76

function clampPosition(pos, width, height) {
  if (typeof window === 'undefined') return pos
  const maxX = Math.max(VIEWPORT_PADDING, window.innerWidth - width - VIEWPORT_PADDING)
  const maxY = Math.max(VIEWPORT_PADDING, window.innerHeight - height - VIEWPORT_PADDING)
  return {
    x: Math.min(Math.max(VIEWPORT_PADDING, pos.x), maxX),
    y: Math.min(Math.max(VIEWPORT_PADDING, pos.y), maxY),
  }
}

function loadSavedPosition() {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(POSITION_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (typeof parsed?.x === 'number' && typeof parsed?.y === 'number' && Number.isFinite(parsed.x) && Number.isFinite(parsed.y)) {
      return clampPosition(parsed, DEFAULT_WIDGET_WIDTH, DEFAULT_WIDGET_HEIGHT)
    }
  } catch {
    return null
  }
  return null
}

function loadSeenApprovedIds(userId) {
  if (typeof window === 'undefined' || !userId) return []
  try {
    const raw = window.localStorage.getItem(`${SEEN_APPROVED_PREFIX}${userId}`)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : []
  } catch {
    return []
  }
}

function saveSeenApprovedIds(userId, ids) {
  if (typeof window === 'undefined' || !userId) return
  try {
    const unique = Array.from(new Set(ids.filter((item) => typeof item === 'string')))
    window.localStorage.setItem(`${SEEN_APPROVED_PREFIX}${userId}`, JSON.stringify(unique))
  } catch {
    return
  }
}

const directions = '/mascots/exam-matrix-directions.png'
const reactions = '/mascots/exam-matrix-reactions.png'

const helpByPath = [
  {
    match: (path) => path.startsWith('/ma-tran/'),
    title: 'Sinh đề có kiểm soát',
    message: 'Mỗi ô cấu hình cần đủ câu khả dụng. Số mã đề nhận số nguyên từ 1 đến 20; mã đề mới tạo ở trạng thái bản nháp (PRIVATE, chưa phát hành) để rà trước khi phát hành.',
  },
  {
    match: (path) => path === '/cau-hoi',
    title: 'Nhập câu hỏi an toàn',
    message: 'Xem trước tệp DOCX hoặc PDF, kiểm tra môn, chương, đáp án và số câu hợp lệ rồi mới xác nhận lưu.',
  },
  {
    match: (path) => path === '/giao-vien/cham-thi',
    title: 'Bàn chấm bài',
    message: 'Câu trắc nghiệm được chấm tự động. Bài có tự luận chỉ hoàn tất sau khi giáo viên lưu điểm và nhận xét.',
  },
  {
    match: (path) => path === '/hoc-sinh/de-thi',
    title: 'Chọn đề phù hợp',
    message: 'Kiểm tra phạm vi lớp và thời lượng trước khi bắt đầu. Bài đang làm có thể tiếp tục từ danh sách này.',
  },
  {
    match: (path) => path === '/hoc-sinh/gop-y',
    title: 'Góp ý & Đề xuất',
    message: 'Gửi góp ý hệ thống hoặc đề xuất thêm môn học, đề thi tới quản trị viên và giáo viên các lớp bạn đang theo học.',
  },
  {
    match: (path) => path.startsWith('/hoc-sinh/ket-qua/'),
    title: 'Đọc kết quả bài thi',
    message: 'Điểm trắc nghiệm có sau khi nộp. Nếu bài có tự luận, kết quả cuối cùng chỉ xuất hiện sau khi giáo viên chấm xong.',
  },
  {
    match: (path) => path === '/nguoi-dung',
    title: 'Quản lý quyền truy cập',
    message: 'Xác nhận đúng vai trò trước khi tạo tài khoản hoặc khóa người dùng; tài khoản bị khóa không thể đăng nhập.',
  },
]

const linksByRole = {
  ADMIN: [
    { to: '/?inbox=1', label: 'Hòm thư góp ý', icon: Inbox },
    { to: '/nguoi-dung', label: 'Quản lý tài khoản', icon: Users },
    { to: '/cau-hoi', label: 'Ngân hàng câu hỏi', icon: BookOpenCheck },
  ],
  TEACHER: [
    { to: '/giao-vien/duyet-hoc-sinh', label: 'Duyệt học sinh vào lớp', icon: UserCheck },
    { to: '/?inbox=1', label: 'Hòm thư góp ý', icon: Inbox },
    { to: '/ma-tran', label: 'Tạo ma trận đề', icon: Grid3X3 },
    { to: '/giao-vien/cham-thi', label: 'Bài chờ chấm', icon: ClipboardCheck },
  ],
  STUDENT: [
    { to: '/hoc-sinh/tong-quan?view=activity', label: 'Tiến độ của tôi', icon: BookOpenCheck },
    { to: '/hoc-sinh/de-thi', label: 'Đề thi & luyện tập', icon: ClipboardCheck },
    { to: '/hoc-sinh/gop-y', label: 'Góp ý & Đề xuất', icon: MessageSquarePlus },
    { to: '/ho-so', label: 'Hồ sơ cá nhân', icon: Users },
  ],
}

function getPageGuide(pathname, role) {
  const specific = helpByPath.find((item) => item.match(pathname))
  if (specific) return specific

  if (pathname === '/' || pathname === '/hoc-sinh/tong-quan') {
    return {
      title: 'Chọn một góc nhìn',
      message: 'Mỗi tab tập trung vào một câu hỏi. Phạm vi và cách tính được ghi ngay trên dashboard để bạn đọc số liệu đúng ngữ cảnh.',
    }
  }

  if (pathname === '/de-thi') {
    return {
      title: 'Kiểm tra trước khi in',
      message: 'Mở bản xem trước A4 để kiểm tra mã đề, thông tin học sinh và ngắt trang. Bản in dùng Times New Roman.',
    }
  }

  if (role === 'STUDENT') {
    return {
      title: 'Không gian học tập',
      message: 'Dùng danh sách đề để mở lượt luyện tập; xem lại điểm và câu đã làm trong từng kết quả.',
    }
  }

  return {
    title: 'Đi nhanh đến tác vụ',
    message: 'Mở một mục bên dưới để tiếp tục. Nếu thao tác tạo lỗi, thông báo gợi ý sẽ hiện tại đây.',
  }
}

const hintStyles = {
  success: 'border-teal-200 bg-teal-50 text-teal-950',
  warning: 'border-amber-200 bg-amber-50 text-amber-950',
  error: 'border-rose-200 bg-rose-50 text-rose-950',
  info: 'border-slate-200 bg-white text-slate-900',
}

export default function AssistantWidget() {
  const { user } = useAuth()
  const location = useLocation()
  const reduceMotion = useReducedMotion()
  const role = user?.role || 'TEACHER'
  const isQuietRoute =
    location.pathname.startsWith('/hoc-sinh/lam-bai/') ||
    location.pathname.startsWith('/giao-vien/cham-thi')
  const [open, setOpen] = useState(false)
  const [hint, setHint] = useState(null)
  const [position, setPosition] = useState(loadSavedPosition)
  const [dragging, setDragging] = useState(false)
  const [dismissedBubbleKey, setDismissedBubbleKey] = useState('')
  const [seenApprovedIds, setSeenApprovedIds] = useState(() => loadSeenApprovedIds(user?.id))
  const containerRef = useRef(null)
  const triggerRef = useRef(null)
  const closeRef = useRef(null)
  const hintTimer = useRef(null)
  const dragStateRef = useRef({
    active: false,
    moved: false,
    pointerId: null,
    startClientX: 0,
    startClientY: 0,
    originX: 0,
    originY: 0,
    width: DEFAULT_WIDGET_WIDTH,
    height: DEFAULT_WIDGET_HEIGHT,
  })
  const suppressNextClickRef = useRef(false)
  const pageGuide = useMemo(() => getPageGuide(location.pathname, role), [location.pathname, role])
  const quickLinks = linksByRole[role] || linksByRole.TEACHER

  useEffect(() => {
    setSeenApprovedIds(loadSeenApprovedIds(user?.id))
    setDismissedBubbleKey('')
  }, [user?.id])

  const notificationQuery = useQuery({
    queryKey: ['notifications', 'summary', user?.id],
    queryFn: () => api.getNotificationSummary(),
    enabled: Boolean(user?.id) && !isQuietRoute,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
    staleTime: 0,
  })

  const summary = notificationQuery.data
  const pendingClassRequestCount = Number(summary?.pendingClassRequestCount || 0)
  const unreadFeedbackCount = Number(summary?.unreadFeedbackCount || 0)
  const approvedClasses = useMemo(() => summary?.approvedClasses || [], [summary])

  const unseenApprovedClasses = useMemo(() => {
    if (role !== 'STUDENT') return []
    const seenSet = new Set(seenApprovedIds)
    return approvedClasses.filter((item) => item?.assignmentId && !seenSet.has(item.assignmentId))
  }, [role, approvedClasses, seenApprovedIds])

  const acknowledgeStudentClasses = useCallback(() => {
    if (!user?.id || unseenApprovedClasses.length === 0) return
    const nextIds = [...seenApprovedIds, ...unseenApprovedClasses.map((item) => item.assignmentId)]
    saveSeenApprovedIds(user.id, nextIds)
    setSeenApprovedIds(nextIds)
  }, [user?.id, seenApprovedIds, unseenApprovedClasses])

  const activeNotification = useMemo(() => {
    if (role === 'TEACHER') {
      if (pendingClassRequestCount > 0) {
        const actions = [{ to: '/giao-vien/duyet-hoc-sinh', label: 'Xem yêu cầu →' }]
        if (unreadFeedbackCount > 0) {
          actions.push({ to: '/?inbox=1', label: 'Mở hòm thư →' })
        }
        return {
          key: `teacher-pending-${pendingClassRequestCount}-${unreadFeedbackCount}`,
          tone: 'warning',
          title: 'Yêu cầu vào lớp mới',
          message: `Có ${pendingClassRequestCount} học sinh đã gửi yêu cầu xin vào lớp.`,
          secondaryNote: unreadFeedbackCount > 0 ? `Ngoài ra có ${unreadFeedbackCount} góp ý chưa đọc trong hòm thư.` : null,
          actions,
        }
      }
      if (unreadFeedbackCount > 0) {
        return {
          key: `teacher-feedback-${unreadFeedbackCount}`,
          tone: 'info',
          title: 'Hòm thư góp ý',
          message: `Có ${unreadFeedbackCount} góp ý mới từ học sinh lớp bạn.`,
          secondaryNote: null,
          actions: [
            { to: '/?inbox=1', label: 'Mở hòm thư →' },
          ],
        }
      }
      return null
    }

    if (role === 'STUDENT' && unseenApprovedClasses.length > 0) {
      const first = unseenApprovedClasses[0]
      const message =
        unseenApprovedClasses.length === 1
          ? `Bạn đã được duyệt vào lớp ${first.className} (GV: ${first.teacherName})!`
          : `Bạn đã được duyệt vào ${unseenApprovedClasses.length} lớp học mới: ${unseenApprovedClasses.map((c) => c.className).join(', ')}!`
      return {
        key: `student-approved-${unseenApprovedClasses.map((c) => c.assignmentId).join(',')}`,
        tone: 'success',
        title: 'Đã được duyệt vào lớp',
        message,
        secondaryNote: null,
        actions: [
          { to: '/hoc-sinh/giao-vien', label: 'Xem lớp học →' },
          { to: '/hoc-sinh/de-thi', label: 'Làm đề ngay →' },
        ],
      }
    }

    if (role === 'ADMIN' && unreadFeedbackCount > 0) {
      return {
        key: `admin-feedback-${unreadFeedbackCount}`,
        tone: 'info',
        title: 'Hòm thư góp ý mới',
        message: `Có ${unreadFeedbackCount} góp ý mới trong hòm thư.`,
        secondaryNote: null,
        actions: [
          { to: '/?inbox=1', label: 'Mở hòm thư →' },
        ],
      }
    }

    return null
  }, [role, pendingClassRequestCount, unreadFeedbackCount, unseenApprovedClasses])

  const badgeCount = useMemo(() => {
    if (role === 'TEACHER') return pendingClassRequestCount + unreadFeedbackCount
    if (role === 'STUDENT') return unseenApprovedClasses.length
    if (role === 'ADMIN') return unreadFeedbackCount
    return 0
  }, [role, pendingClassRequestCount, unreadFeedbackCount, unseenApprovedClasses.length])

  const showBubble = Boolean(
    !open && !isQuietRoute && activeNotification && dismissedBubbleKey !== activeNotification.key,
  )

  const handleDismissBubble = () => {
    if (!activeNotification) return
    if (role === 'STUDENT') {
      acknowledgeStudentClasses()
    } else {
      setDismissedBubbleKey(activeNotification.key)
    }
  }

  const handleBubbleActionClick = () => {
    if (role === 'STUDENT') {
      acknowledgeStudentClasses()
    } else if (activeNotification) {
      setDismissedBubbleKey(activeNotification.key)
    }
    setOpen(false)
  }

  const savePosition = useCallback((nextPos) => {
    try {
      if (nextPos === null) {
        window.localStorage.removeItem(POSITION_STORAGE_KEY)
      } else {
        window.localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(nextPos))
      }
    } catch {
      return
    }
  }, [])

  useEffect(() => {
    const handleResize = () => {
      setPosition((current) => {
        if (!current) return null
        const rect = containerRef.current?.getBoundingClientRect()
        const next = clampPosition(
          current,
          rect?.width || DEFAULT_WIDGET_WIDTH,
          rect?.height || DEFAULT_WIDGET_HEIGHT,
        )
        savePosition(next)
        return next
      })
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [savePosition])

  useEffect(() => {
    if (isQuietRoute) {
      setOpen(false)
    }
  }, [isQuietRoute])

  useEffect(() => {
    const receiveHint = (event) => {
      const detail = event.detail || {}
      const tone = ['success', 'warning', 'error'].includes(detail.tone) ? detail.tone : 'info'
      setHint({
        title: String(detail.title || 'Gợi ý từ trợ lý').slice(0, 100),
        message: String(detail.message || '').slice(0, 280),
        tone,
      })
      window.clearTimeout(hintTimer.current)
      hintTimer.current = window.setTimeout(() => setHint(null), 12_000)
    }

    window.addEventListener('exam:assistant-hint', receiveHint)
    return () => {
      window.removeEventListener('exam:assistant-hint', receiveHint)
      window.clearTimeout(hintTimer.current)
    }
  }, [])

  useEffect(() => {
    if (!open) return undefined
    closeRef.current?.focus()
    const closeOnEscape = (event) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      triggerRef.current?.focus()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [open])

  const closePanel = () => {
    setOpen(false)
    window.requestAnimationFrame(() => triggerRef.current?.focus())
  }

  const resetPosition = () => {
    setPosition(null)
    savePosition(null)
  }

  const handlePointerDown = (event) => {
    if (event.button !== 0 && event.pointerType === 'mouse') return
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    dragStateRef.current = {
      active: true,
      moved: false,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      originX: rect.left,
      originY: rect.top,
      width: rect.width || DEFAULT_WIDGET_WIDTH,
      height: rect.height || DEFAULT_WIDGET_HEIGHT,
    }
  }

  useEffect(() => {
    const onPointerMove = (event) => {
      const drag = dragStateRef.current
      if (!drag.active || drag.pointerId !== event.pointerId) return
      const dx = event.clientX - drag.startClientX
      const dy = event.clientY - drag.startClientY
      if (!drag.moved && Math.hypot(dx, dy) >= DRAG_THRESHOLD_PX) {
        drag.moved = true
        setDragging(true)
      }
      if (!drag.moved) return
      const next = clampPosition(
        { x: drag.originX + dx, y: drag.originY + dy },
        drag.width,
        drag.height,
      )
      setPosition(next)
    }

    const onPointerEnd = (event) => {
      const drag = dragStateRef.current
      if (!drag.active || drag.pointerId !== event.pointerId) return
      const didMove = drag.moved
      drag.active = false
      drag.moved = false
      drag.pointerId = null
      if (didMove) {
        setDragging(false)
        suppressNextClickRef.current = true
        window.setTimeout(() => {
          suppressNextClickRef.current = false
        }, 0)
        const dx = event.clientX - drag.startClientX
        const dy = event.clientY - drag.startClientY
        const finalPos = clampPosition(
          { x: drag.originX + dx, y: drag.originY + dy },
          drag.width,
          drag.height,
        )
        setPosition(finalPos)
        savePosition(finalPos)
      }
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerEnd)
    window.addEventListener('pointercancel', onPointerEnd)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerEnd)
      window.removeEventListener('pointercancel', onPointerEnd)
    }
  }, [savePosition])

  const handleDragKeyDown = (event) => {
    const step = event.shiftKey ? 40 : 16
    const deltas = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    }
    const delta = deltas[event.key]
    if (!delta) return
    event.preventDefault()
    const rect = containerRef.current?.getBoundingClientRect()
    const current = position || {
      x: rect?.left ?? window.innerWidth - DEFAULT_WIDGET_WIDTH - 24,
      y: rect?.top ?? window.innerHeight - DEFAULT_WIDGET_HEIGHT - 20,
    }
    const next = clampPosition(
      { x: current.x + delta[0], y: current.y + delta[1] },
      rect?.width || DEFAULT_WIDGET_WIDTH,
      rect?.height || DEFAULT_WIDGET_HEIGHT,
    )
    setPosition(next)
    savePosition(next)
  }

  const panelOpensBelow =
    typeof window !== 'undefined' && position ? position.y < window.innerHeight * 0.45 : false
  const panelAlignsLeft =
    typeof window !== 'undefined' && position ? position.x < window.innerWidth * 0.45 : false

  return (
    <aside
      ref={containerRef}
      style={position ? { left: `${position.x}px`, top: `${position.y}px` } : undefined}
      className={cn(
        'exam-assistant fixed z-[35] flex flex-col items-end gap-2',
        !position && 'bottom-4 right-4 sm:bottom-5 sm:right-6',
        isQuietRoute && 'hidden',
      )}
      aria-label="Trợ lý Exam Matrix"
      data-quiet={isQuietRoute}
      data-dragging={dragging}
    >
      <AnimatePresence>
        {showBubble && activeNotification && (
          <motion.div
            key={activeNotification.key}
            role="status"
            aria-live="polite"
            initial={reduceMotion ? false : { opacity: 0, y: panelOpensBelow ? -6 : 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: panelOpensBelow ? -4 : 4, scale: 0.98 }}
            transition={{ duration: reduceMotion ? 0 : 0.16, ease: 'easeOut' }}
            className={cn(
              'absolute w-[min(19.5rem,calc(100vw-1.5rem))] rounded-2xl border p-3.5 shadow-[0_14px_40px_-18px_rgba(15,23,42,0.45)]',
              panelOpensBelow ? 'top-[4.75rem]' : 'bottom-[4.75rem]',
              panelAlignsLeft ? 'left-0' : 'right-0',
              activeNotification.tone === 'success'
                ? 'border-teal-300 bg-teal-50/95 text-teal-950'
                : activeNotification.tone === 'warning'
                  ? 'border-amber-300 bg-amber-50/95 text-amber-950'
                  : 'border-indigo-200 bg-white/95 text-slate-900',
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-extrabold">
                {activeNotification.tone === 'success' ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-teal-700" aria-hidden="true" />
                ) : (
                  <Bell className="h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
                )}
                <span>{activeNotification.title}</span>
              </div>
              <button
                type="button"
                onClick={handleDismissBubble}
                aria-label="Đóng thông báo"
                className="rounded-md p-0.5 text-slate-500 hover:bg-black/5 hover:text-slate-900 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="mt-1.5 text-xs font-medium leading-relaxed">{activeNotification.message}</p>
            {activeNotification.secondaryNote && (
              <p className="mt-1 text-[11px] opacity-80">{activeNotification.secondaryNote}</p>
            )}
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {activeNotification.actions.map((action) => (
                <Link
                  key={action.to}
                  to={action.to}
                  onClick={handleBubbleActionClick}
                  className={cn(
                    'inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-bold transition-colors',
                    activeNotification.tone === 'success'
                      ? 'bg-teal-700 text-white hover:bg-teal-800'
                      : activeNotification.tone === 'warning'
                        ? 'bg-amber-700 text-white hover:bg-amber-800'
                        : 'bg-indigo-600 text-white hover:bg-indigo-700',
                  )}
                >
                  {action.label}
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div
        onPointerDown={handlePointerDown}
        className={cn(
          'flex items-end gap-1.5 touch-none select-none',
          dragging ? 'cursor-grabbing' : 'cursor-grab',
        )}
        title="Kéo để di chuyển vị trí trợ lý"
      >
        <Mascot
          directions={directions}
          reactions={reactions}
          size={72}
          label="trợ lý Exam Matrix"
          className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        />
        <div className="relative mb-1 flex items-center rounded-full border border-slate-300 bg-white shadow-md transition-colors hover:border-indigo-300">
          <button
            type="button"
            onKeyDown={handleDragKeyDown}
            aria-label="Kéo hoặc dùng phím mũi tên để di chuyển vị trí trợ lý"
            title="Kéo để di chuyển trợ lý"
            className="flex h-10 items-center pl-2 pr-1 text-slate-400 hover:text-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 rounded-l-full"
          >
            <GripVertical className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <button
            ref={triggerRef}
            type="button"
            aria-label={open ? 'Đóng trợ lý Exam Matrix' : 'Mở trợ lý Exam Matrix'}
            aria-expanded={open}
            aria-controls="exam-matrix-assistant-panel"
            onClick={() => {
              if (suppressNextClickRef.current) return
              setOpen((current) => !current)
            }}
            className="flex h-10 items-center gap-1.5 rounded-r-full pr-3 pl-1 text-xs font-bold text-slate-800 transition-colors hover:bg-indigo-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            <CircleHelp className="h-4 w-4 text-indigo-700" aria-hidden="true" />
            Trợ lý
          </button>
          {badgeCount > 0 && (
            <span
              className="pointer-events-none absolute -top-1.5 -right-1.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-extrabold leading-none text-white shadow-sm ring-2 ring-white tabular-nums"
              aria-label={`${badgeCount} thông báo mới`}
            >
              {badgeCount > 99 ? '99+' : badgeCount}
            </span>
          )}
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.section
            id="exam-matrix-assistant-panel"
            role="dialog"
            aria-modal="false"
            aria-labelledby="exam-matrix-assistant-title"
            initial={reduceMotion ? false : { opacity: 0, y: panelOpensBelow ? -8 : 8, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: panelOpensBelow ? -6 : 6, scale: 0.99 }}
            transition={{ duration: reduceMotion ? 0 : 0.16, ease: 'easeOut' }}
            className={cn(
              'absolute w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-slate-200 bg-[#fffefa] text-slate-900 shadow-[0_18px_55px_-24px_rgba(15,23,42,0.45)]',
              panelOpensBelow ? 'top-[4.75rem]' : 'bottom-[4.75rem]',
              panelAlignsLeft ? 'left-0' : 'right-0',
            )}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-[#f7f5ef] px-4 py-3.5">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-teal-800">Trợ lý Exam Matrix</p>
                <h2 id="exam-matrix-assistant-title" className="mt-1 text-base font-extrabold">Thông báo & Hướng dẫn</h2>
                <p className="mt-0.5 text-xs text-slate-600">{roleLabel(role)} · kéo biểu tượng để đổi vị trí</p>
              </div>
              <div className="flex items-center gap-1">
                {position && (
                  <button
                    type="button"
                    onClick={resetPosition}
                    aria-label="Đặt lại vị trí trợ lý về góc mặc định"
                    title="Đặt lại vị trí mặc định"
                    className="rounded-lg p-1.5 text-slate-500 hover:bg-white hover:text-indigo-700 focus-visible:outline-2"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                )}
                <button ref={closeRef} type="button" onClick={closePanel} aria-label="Đóng bảng trợ lý" className="rounded-lg p-1.5 text-slate-500 hover:bg-white hover:text-slate-900 focus-visible:outline-2">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="space-y-4 p-4">
              {activeNotification && (
                <div
                  className={cn(
                    'rounded-xl border px-3.5 py-3 space-y-2',
                    activeNotification.tone === 'success'
                      ? 'border-teal-200 bg-teal-50 text-teal-950'
                      : activeNotification.tone === 'warning'
                        ? 'border-amber-200 bg-amber-50 text-amber-950'
                        : 'border-indigo-200 bg-indigo-50/70 text-slate-900',
                  )}
                >
                  <div className="flex items-center gap-2 text-xs font-bold">
                    <Bell className="h-3.5 w-3.5" />
                    {activeNotification.title}
                  </div>
                  <p className="text-xs leading-relaxed">{activeNotification.message}</p>
                  {activeNotification.secondaryNote && (
                    <p className="text-[11px] opacity-80">{activeNotification.secondaryNote}</p>
                  )}
                  <div className="flex flex-wrap gap-2 pt-0.5">
                    {activeNotification.actions.map((action) => (
                      <Link
                        key={action.to}
                        to={action.to}
                        onClick={handleBubbleActionClick}
                        className="text-xs font-bold underline underline-offset-2 hover:opacity-80"
                      >
                        {action.label}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {hint && (
                <div className={cn('rounded-xl border px-3 py-2.5', hintStyles[hint.tone])}>
                  <div className="flex items-center gap-2 text-xs font-bold"><Lightbulb className="h-3.5 w-3.5" />{hint.title}</div>
                  {hint.message && <p className="mt-1.5 text-xs leading-relaxed">{hint.message}</p>}
                </div>
              )}

              <div className="rounded-xl border border-teal-100 bg-teal-50/70 px-3.5 py-3">
                <div className="flex items-center gap-2 text-xs font-bold text-teal-950"><Lightbulb className="h-3.5 w-3.5" />{pageGuide.title}</div>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-700">{pageGuide.message}</p>
              </div>

              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Đi nhanh đến</p>
                <div className="space-y-1">
                  {quickLinks.map((item) => {
                    const Icon = item.icon
                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        onClick={() => setOpen(false)}
                        className="group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-indigo-50 hover:text-indigo-900 focus-visible:outline-2 focus-visible:outline-indigo-600"
                      >
                        <Icon className="h-4 w-4 shrink-0 text-teal-800" aria-hidden="true" />
                        <span className="flex-1">{item.label}</span>
                        <ArrowRight className="h-3.5 w-3.5 text-slate-400 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                      </Link>
                    )
                  })}
                </div>
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </aside>
  )
}
