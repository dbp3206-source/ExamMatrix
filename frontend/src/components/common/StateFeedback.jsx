import {
  AlertCircle,
  Atom,
  BookOpen,
  BookOpenText,
  Calculator,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Dna,
  FlaskConical,
  Globe,
  Inbox,
  Landmark,
  Languages,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { difficultyMeta, getSubjectPreset } from '@/constants'
import { cn } from '@/lib/utils'

const ICON_MAP = {
  Calculator,
  Atom,
  FlaskConical,
  Dna,
  Landmark,
  Languages,
  BookOpenText,
  Globe,
  Cpu,
  BookOpen,
}

export function SubjectIcon({ codeOrName, name, size = 18, className }) {
  const preset = getSubjectPreset(codeOrName, name)
  const IconComp = ICON_MAP[preset.iconName] || BookOpen
  return <IconComp size={size} className={className} aria-hidden="true" />
}

export function DifficultyBadge({ value, className }) {
  const meta = difficultyMeta(value)
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold whitespace-nowrap',
        meta.bgClass,
        className
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', meta.dotClass)} aria-hidden="true" />
      {meta.label}
    </span>
  )
}

export function PageHeader({ eyebrow, title, description, action, accent = 'indigo' }) {
  const eyebrowColor =
    accent === 'teal'
      ? 'text-teal-700'
      : accent === 'amber'
        ? 'text-amber-700'
        : 'text-indigo-700'

  return (
    <header className="mb-6 flex flex-col gap-4 border-b border-slate-200/80 pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 space-y-1">
        {eyebrow && (
          <div className={cn('text-[11px] font-bold uppercase tracking-widest', eyebrowColor)}>
            {eyebrow}
          </div>
        )}
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-[26px] break-words">
          {title}
        </h1>
        {description && (
          <p className="max-w-3xl text-sm text-slate-600 leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {action && <div className="flex flex-wrap items-center gap-2.5 shrink-0">{action}</div>}
    </header>
  )
}

export function LoadingState({ label = 'Đang tải dữ liệu...' }) {
  return (
    <div
      role="status"
      className="flex flex-col items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-6 py-12 text-center shadow-xs"
    >
      <Loader2 className="h-6 w-6 animate-spin text-indigo-600" aria-hidden="true" />
      <span className="text-sm font-medium text-slate-600">{label}</span>
    </div>
  )
}

export function EmptyState({ title = 'Chưa có dữ liệu', description = 'Không có bản ghi phù hợp với điều kiện hiện tại.', action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white/80 px-6 py-12 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-500">
        <Inbox className="h-5 w-5" aria-hidden="true" />
      </div>
      <strong className="text-base font-bold text-slate-900">{title}</strong>
      <p className="max-w-md text-sm text-slate-600">{description}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export function ErrorState({ error, onRetry }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-3 rounded-xl border border-rose-200 bg-rose-50/70 px-6 py-10 text-center"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-100 text-rose-700">
        <AlertCircle className="h-5 w-5" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <strong className="block text-base font-bold text-rose-950">Không thể tải dữ liệu</strong>
        <p className="text-sm text-rose-800">{error?.message || 'Đã có lỗi xảy ra.'}</p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5" />
          Thử lại
        </Button>
      )}
    </div>
  )
}

export function ConfirmModal({
  title = 'Xác nhận thao tác',
  message,
  onConfirm,
  onClose,
  busy = false,
  confirmLabel = 'Xóa',
  variant = 'destructive',
}) {
  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose?.() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="pt-1 text-slate-700 leading-relaxed">{message}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Hủy
          </Button>
          <Button variant={variant} disabled={busy} onClick={onConfirm}>
            {busy ? 'Đang xử lý...' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function Pagination({ page, totalPages, onChange }) {
  if (!totalPages || totalPages <= 1) return null
  return (
    <nav className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-xs" aria-label="Phân trang">
      <Button variant="outline" size="sm" disabled={page <= 0} onClick={() => onChange(page - 1)}>
        <ChevronLeft className="h-4 w-4" />
        Trang trước
      </Button>
      <span className="text-xs font-semibold text-slate-600 tabular-nums">
        Trang {page + 1} / {totalPages}
      </span>
      <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => onChange(page + 1)}>
        Trang sau
        <ChevronRight className="h-4 w-4" />
      </Button>
    </nav>
  )
}

export function FieldError({ children }) {
  if (!children) return null
  return (
    <span role="alert" className="mt-1 block text-xs font-medium text-rose-600">
      {children}
    </span>
  )
}
