import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Clock, MessageSquarePlus, Send } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/api/service'
import { formatDateTime } from '@/utils'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState, ErrorState, LoadingState, PageHeader } from '@/components/common/StateFeedback'

type FeedbackCategory = 'SYSTEM_FEEDBACK' | 'SUBJECT_REQUEST' | 'EXAM_REQUEST' | 'OTHER'

interface StudentFeedbackItem {
  id: string
  studentId: string
  studentName: string
  studentEmail: string
  category: FeedbackCategory
  title: string
  content: string
  isRead: boolean
  recipientLabels: string[]
  createdAt: string
}

const CATEGORY_OPTIONS: Array<{ value: FeedbackCategory; label: string; tone: 'indigo' | 'teal' | 'warning' | 'neutral' }> = [
  { value: 'SYSTEM_FEEDBACK', label: 'Góp ý hệ thống', tone: 'indigo' },
  { value: 'SUBJECT_REQUEST', label: 'Đề xuất thêm môn học', tone: 'teal' },
  { value: 'EXAM_REQUEST', label: 'Đề xuất thêm đề thi', tone: 'warning' },
  { value: 'OTHER', label: 'Ý kiến khác', tone: 'neutral' },
]

function categoryMeta(category: FeedbackCategory) {
  return CATEGORY_OPTIONS.find((item) => item.value === category) || CATEGORY_OPTIONS[3]
}

export default function StudentFeedbackPage() {
  const queryClient = useQueryClient()
  const [category, setCategory] = useState<FeedbackCategory>('SYSTEM_FEEDBACK')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [formError, setFormError] = useState('')

  useEffect(() => {
    document.title = 'Góp ý & Đề xuất | Exam Matrix'
  }, [])

  const feedbacksQuery = useQuery<StudentFeedbackItem[]>({
    queryKey: ['student', 'feedbacks'],
    queryFn: () => api.getMyFeedbacks(),
  })

  const submitMutation = useMutation({
    mutationFn: (payload: { category: FeedbackCategory; title: string; content: string }) =>
      api.submitStudentFeedback(payload),
    onSuccess: () => {
      toast.success('Đã gửi góp ý thành công. Cảm ơn bạn đã đóng góp!')
      setTitle('')
      setContent('')
      setFormError('')
      queryClient.invalidateQueries({ queryKey: ['student', 'feedbacks'] })
    },
    onError: (err: Error) => {
      const message = err?.message || 'Không thể gửi góp ý lúc này'
      setFormError(message)
      toast.error(message)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const cleanTitle = title.trim()
    const cleanContent = content.trim()
    if (cleanTitle.length < 3 || cleanTitle.length > 200) {
      setFormError('Tiêu đề cần từ 3 đến 200 ký tự.')
      return
    }
    if (cleanContent.length < 5 || cleanContent.length > 3000) {
      setFormError('Nội dung cần từ 5 đến 3000 ký tự.')
      return
    }
    setFormError('')
    submitMutation.mutate({ category, title: cleanTitle, content: cleanContent })
  }

  return (
    <div className="space-y-6 pb-20" data-role="student">
      <PageHeader
        accent="teal"
        title="Góp ý & Đề xuất"
        description="Gửi ý kiến cải thiện hệ thống hoặc đề xuất thêm môn học, đề thi. Góp ý sẽ được chuyển tới quản trị viên và giáo viên các lớp bạn đang theo học."
      />

      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="border-slate-200 shadow-xs lg:col-span-5">
          <CardHeader className="border-b border-slate-100 pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquarePlus className="h-4 w-4 text-teal-700" />
              Gửi góp ý mới
            </CardTitle>
            <CardDescription className="text-xs">
              Nếu bạn chưa tham gia lớp học nào, góp ý sẽ được gửi trực tiếp tới Quản trị viên hệ thống.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-5">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="feedback-category">Danh mục</Label>
                <select
                  id="feedback-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as FeedbackCategory)}
                  disabled={submitMutation.isPending}
                  className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                >
                  {CATEGORY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="feedback-title">Tiêu đề</Label>
                <Input
                  id="feedback-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={200}
                  placeholder="VD: Đề xuất bổ sung đề ôn tập môn Hóa học"
                  disabled={submitMutation.isPending}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="feedback-content">Nội dung chi tiết</Label>
                  <span className="text-[11px] tabular-nums text-slate-400">{content.length}/3000</span>
                </div>
                <Textarea
                  id="feedback-content"
                  rows={5}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  maxLength={3000}
                  placeholder="Mô tả rõ mong muốn, góp ý hoặc môn/đề thi bạn cần thêm..."
                  disabled={submitMutation.isPending}
                />
              </div>

              {formError && (
                <Alert variant="destructive">
                  <AlertDescription className="text-xs">{formError}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" variant="teal" className="w-full" disabled={submitMutation.isPending}>
                <Send className="h-4 w-4" />
                {submitMutation.isPending ? 'Đang gửi góp ý...' : 'Gửi góp ý'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-xs lg:col-span-7">
          <CardHeader className="border-b border-slate-100 pb-4">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">Lịch sử góp ý của bạn</CardTitle>
              <Badge variant="neutral" className="tabular-nums">
                {feedbacksQuery.data?.length ?? 0} mục
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {feedbacksQuery.isPending ? (
              <div className="p-6">
                <LoadingState label="Đang tải lịch sử góp ý..." />
              </div>
            ) : feedbacksQuery.isError ? (
              <div className="p-6">
                <ErrorState error={feedbacksQuery.error} onRetry={feedbacksQuery.refetch} />
              </div>
            ) : !feedbacksQuery.data || feedbacksQuery.data.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  title="Chưa có góp ý nào"
                  description="Góp ý hoặc đề xuất bạn gửi sẽ hiển thị tại đây cùng trạng thái tiếp nhận."
                />
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {feedbacksQuery.data.map((item) => {
                  const meta = categoryMeta(item.category)
                  return (
                    <li key={item.id} className="space-y-2 p-5">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={meta.tone === 'teal' ? 'success' : meta.tone}>{meta.label}</Badge>
                            <span className="text-xs text-slate-500 tabular-nums">{formatDateTime(item.createdAt)}</span>
                          </div>
                          <h3 className="text-sm font-bold text-slate-900">{item.title}</h3>
                        </div>
                        {item.isRead ? (
                          <Badge variant="success">
                            <CheckCircle2 className="h-3 w-3" />
                            Đã tiếp nhận
                          </Badge>
                        ) : (
                          <Badge variant="warning">
                            <Clock className="h-3 w-3" />
                            Chờ xem
                          </Badge>
                        )}
                      </div>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{item.content}</p>
                      <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs text-slate-500">
                        <span>Nơi nhận:</span>
                        {(item.recipientLabels || []).map((label, index) => (
                          <span key={`${item.id}-${index}`} className="rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                            {label}
                          </span>
                        ))}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
