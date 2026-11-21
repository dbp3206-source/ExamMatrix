import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Inbox, MailOpen } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/api/service'
import { formatDateTime } from '@/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/StateFeedback'
import { cn } from '@/lib/utils'

interface FeedbackItem {
  id: string
  studentId: string
  studentName: string
  studentEmail: string
  category: 'SYSTEM_FEEDBACK' | 'SUBJECT_REQUEST' | 'EXAM_REQUEST' | 'OTHER'
  title: string
  content: string
  isRead: boolean
  recipientLabels: string[]
  createdAt: string
}

interface InboxResponse {
  unreadCount: number
  items: FeedbackItem[]
}

const CATEGORY_LABELS: Record<FeedbackItem['category'], { label: string; variant: 'indigo' | 'success' | 'warning' | 'neutral' }> = {
  SYSTEM_FEEDBACK: { label: 'Góp ý hệ thống', variant: 'indigo' },
  SUBJECT_REQUEST: { label: 'Đề xuất môn học', variant: 'success' },
  EXAM_REQUEST: { label: 'Đề xuất đề thi', variant: 'warning' },
  OTHER: { label: 'Ý kiến khác', variant: 'neutral' },
}

export default function FeedbackInboxButton({ role }: { role: 'ADMIN' | 'TEACHER' }) {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState<'ALL' | 'UNREAD'>('ALL')

  useEffect(() => {
    if (searchParams.get('inbox') === '1') {
      setOpen(true)
      const next = new URLSearchParams(searchParams)
      next.delete('inbox')
      setSearchParams(next, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const inboxQuery = useQuery<InboxResponse>({
    queryKey: ['feedbacks', 'inbox'],
    queryFn: () => api.getFeedbackInbox(),
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  })

  const markReadMutation = useMutation({
    mutationFn: (id: string) => api.markFeedbackRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedbacks', 'inbox'] })
      queryClient.invalidateQueries({ queryKey: ['notifications', 'summary'] })
    },
    onError: (err: Error) => {
      toast.error(err?.message || 'Không thể cập nhật trạng thái đã đọc')
    },
  })

  const unreadCount = inboxQuery.data?.unreadCount ?? 0
  const items = useMemo(() => inboxQuery.data?.items ?? [], [inboxQuery.data])
  const visibleItems = useMemo(
    () => (filter === 'UNREAD' ? items.filter((item) => !item.isRead) : items),
    [items, filter],
  )

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant={unreadCount > 0 ? 'default' : 'outline'}
        onClick={() => setOpen(true)}
        className="relative"
      >
        <Inbox className="h-3.5 w-3.5" />
        Hòm thư góp ý
        {unreadCount > 0 && (
          <span className="ml-1 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white tabular-nums">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Inbox className="h-5 w-5 text-indigo-600" />
              Hòm thư góp ý học sinh
              {unreadCount > 0 && (
                <Badge variant="warning" className="tabular-nums">
                  {unreadCount} chưa đọc
                </Badge>
              )}
            </DialogTitle>
            <p className="text-xs text-slate-500">
              {role === 'ADMIN'
                ? 'Hiển thị toàn bộ góp ý, đề xuất môn học và đề thi từ học sinh trên hệ thống.'
                : 'Hiển thị các góp ý, đề xuất từ học sinh đang theo học lớp của bạn.'}
            </p>
          </DialogHeader>

          <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
              <button
                type="button"
                onClick={() => setFilter('ALL')}
                className={cn(
                  'rounded-md px-3 py-1 text-xs font-semibold transition-colors cursor-pointer',
                  filter === 'ALL' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900',
                )}
              >
                Tất cả ({items.length})
              </button>
              <button
                type="button"
                onClick={() => setFilter('UNREAD')}
                className={cn(
                  'rounded-md px-3 py-1 text-xs font-semibold transition-colors cursor-pointer',
                  filter === 'UNREAD' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900',
                )}
              >
                Chưa đọc ({unreadCount})
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pr-1 space-y-3">
            {inboxQuery.isPending ? (
              <LoadingState label="Đang tải hòm thư..." />
            ) : inboxQuery.isError ? (
              <ErrorState error={inboxQuery.error} onRetry={inboxQuery.refetch} />
            ) : visibleItems.length === 0 ? (
              <EmptyState
                title={filter === 'UNREAD' ? 'Không có góp ý chưa đọc' : 'Hòm thư đang trống'}
                description={
                  filter === 'UNREAD'
                    ? 'Bạn đã xem toàn bộ góp ý trong hòm thư.'
                    : 'Góp ý từ học sinh sẽ xuất hiện tại đây.'
                }
              />
            ) : (
              visibleItems.map((item) => {
                const cat = CATEGORY_LABELS[item.category] || CATEGORY_LABELS.OTHER
                return (
                  <div
                    key={item.id}
                    className={cn(
                      'rounded-xl border p-4 space-y-2 transition-colors',
                      item.isRead ? 'border-slate-200 bg-white' : 'border-indigo-200 bg-indigo-50/40',
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {!item.isRead && (
                            <span className="h-2 w-2 rounded-full bg-indigo-600" aria-label="Chưa đọc" />
                          )}
                          <Badge variant={cat.variant}>{cat.label}</Badge>
                          <span className="text-xs text-slate-500 tabular-nums">{formatDateTime(item.createdAt)}</span>
                        </div>
                        <h3 className="text-sm font-bold text-slate-900">{item.title}</h3>
                        <div className="text-xs text-slate-600">
                          <strong>{item.studentName}</strong> ({item.studentEmail})
                        </div>
                      </div>

                      {!item.isRead ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={markReadMutation.isPending}
                          onClick={() => markReadMutation.mutate(item.id)}
                        >
                          <Check className="h-3.5 w-3.5" />
                          Đánh dấu đã đọc
                        </Button>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400">
                          <MailOpen className="h-3.5 w-3.5" />
                          Đã đọc
                        </span>
                      )}
                    </div>

                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{item.content}</p>

                    <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs text-slate-500">
                      <span>Lớp học:</span>
                      {(item.recipientLabels || []).map((label) => (
                        <span key={label} className="rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
