import { useEffect, useMemo, useState } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { Check, Download, Eye, FileUp, Pencil, Plus, RotateCcw, Search, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { emitAssistantHint } from '@/utils/assistant'
import { api } from '@/api/service'
import { useAuth } from '@/auth/AuthContext'
import { DIFFICULTIES, QUESTION_TYPES, getSubjectPreset, isContentAdminRole, typeLabel, typeShortLabel } from '@/constants'
import { downloadSampleDocx } from '@/utils/docxSample'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
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

const blankAnswers = () => [
  { content: '', isCorrect: true },
  { content: '', isCorrect: false },
]

function QuestionFormDialog({ item, subjects, allChapters, onClose }) {
  const queryClient = useQueryClient()
  const [answerError, setAnswerError] = useState('')
  const initialSubjectId = item
    ? allChapters.find((chapter) => chapter.id === Number(item.chapterId))?.subjectId || ''
    : ''

  const defaultValues = item
    ? {
        ...structuredClone(item),
        subjectId: String(initialSubjectId),
        chapterId: String(item.chapterId || ''),
        answers: Array.isArray(item.answers) ? structuredClone(item.answers) : [],
        referenceAnswer: item.referenceAnswer ?? '',
      }
    : {
        subjectId: '',
        chapterId: '',
        content: '',
        difficulty: 'MEDIUM',
        type: 'SINGLE_CHOICE',
        answers: blankAnswers(),
        referenceAnswer: '',
      }

  const { register, control, watch, handleSubmit, setError, setValue, clearErrors, formState: { errors } } = useForm({ defaultValues })
  const { fields, append, remove, replace } = useFieldArray({ control, name: 'answers' })
  const type = watch('type')
  const subjectId = watch('subjectId')
  const contentVal = watch('content') || ''
  const refVal = watch('referenceAnswer') || ''
  const answers = watch('answers') || []

  const chapters = useMemo(
    () => allChapters.filter((chapter) => chapter.subjectId === Number(subjectId)),
    [allChapters, subjectId]
  )

  const mutation = useMutation({
    mutationFn: (body) => (item ? api.updateQuestion(item.id, body) : api.createQuestion(body)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questions'] })
      queryClient.invalidateQueries({ queryKey: ['availability'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success(item ? 'Đã cập nhật câu hỏi thành công' : 'Đã thêm câu hỏi thành công')
      onClose()
    },
    onError: (error) => {
      const fieldErrors = error.fieldErrors || error.response?.data?.fieldErrors || {}
      Object.entries(fieldErrors).forEach(([name, message]) => setError(name, { message }))
      if (!Object.keys(fieldErrors).length) {
        setError('root', { message: error.message || error.response?.data?.message || 'Không thể lưu câu hỏi' })
      }
    },
  })

  const handleTypeChange = (nextType) => {
    setAnswerError('')
    clearErrors(['answers', 'referenceAnswer'])
    if (nextType === 'ESSAY') {
      replace([])
    } else if (nextType === 'TRUE_FALSE') {
      replace([
        { content: 'Đúng', isCorrect: true },
        { content: 'Sai', isCorrect: false },
      ])
    } else if (type === 'ESSAY' || type === 'TRUE_FALSE') {
      replace(blankAnswers())
    } else if (nextType === 'SINGLE_CHOICE' && answers.length > 0) {
      const firstCorrectIdx = Math.max(0, answers.findIndex((a) => Boolean(a?.isCorrect)))
      answers.forEach((_, idx) => setValue(`answers.${idx}.isCorrect`, idx === firstCorrectIdx))
    }
  }

  const toggleCorrect = (index) => {
    if (type !== 'MULTIPLE_CHOICE') {
      answers.forEach((_, idx) => setValue(`answers.${idx}.isCorrect`, idx === index))
    }
  }

  const submit = (values) => {
    setAnswerError('')
    if (values.type === 'ESSAY') {
      mutation.mutate({
        chapterId: Number(values.chapterId),
        content: values.content.trim(),
        difficulty: values.difficulty,
        type: values.type,
        answers: [],
        referenceAnswer: values.referenceAnswer.trim(),
      })
      return
    }

    const objectiveAnswers = values.answers || []
    const correct = objectiveAnswers.filter((a) => a.isCorrect).length
    if (objectiveAnswers.length < 2) return setAnswerError('Câu hỏi cần ít nhất hai phương án đáp án')
    if (values.type !== 'MULTIPLE_CHOICE' && correct !== 1) return setAnswerError('Loại câu hỏi này phải có đúng một đáp án đúng')
    if (values.type === 'MULTIPLE_CHOICE' && correct < 1) return setAnswerError('Phải chọn ít nhất một đáp án đúng')

    mutation.mutate({
      chapterId: Number(values.chapterId),
      content: values.content.trim(),
      difficulty: values.difficulty,
      type: values.type,
      answers: objectiveAnswers.map(({ content, isCorrect }) => ({
        content: content.trim(),
        isCorrect: Boolean(isCorrect),
      })),
      referenceAnswer: null,
    })
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !mutation.isPending) onClose() }}>
      <DialogContent wide>
        <DialogHeader>
          <DialogTitle>{item ? 'Chỉnh sửa câu hỏi' : 'Thêm câu hỏi mới'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(submit)} noValidate className="space-y-4">
          {errors.root && (
            <Alert variant="destructive">
              <AlertDescription>{errors.root.message}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="q-subject">Môn học</Label>
              <Select
                id="q-subject"
                value={subjectId}
                onChange={(event) => {
                  setValue('subjectId', event.target.value)
                  setValue('chapterId', '')
                }}
              >
                <option value="">Chọn môn học</option>
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.code} - {subject.name}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label htmlFor="q-chapter">Chương bài</Label>
              <Select id="q-chapter" {...register('chapterId', { required: 'Vui lòng chọn chương bài' })}>
                <option value="">Chọn chương bài</option>
                {chapters.map((chapter) => (
                  <option key={chapter.id} value={chapter.id}>
                    {chapter.orderIndex}. {chapter.name}
                  </option>
                ))}
              </Select>
              <FieldError>{errors.chapterId?.message}</FieldError>
            </div>

            <div>
              <Label htmlFor="q-difficulty">Độ khó</Label>
              <Select id="q-difficulty" {...register('difficulty')}>
                {DIFFICULTIES.map((difficulty) => (
                  <option key={difficulty.value} value={difficulty.value}>
                    {difficulty.label}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label htmlFor="q-type">Hình thức câu hỏi</Label>
              <Select id="q-type" {...register('type', { onChange: (event) => handleTypeChange(event.target.value) })}>
                {QUESTION_TYPES.map((qt) => (
                  <option key={qt.value} value={qt.value}>
                    {qt.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="q-content">Nội dung câu hỏi</Label>
              <span className="text-[11px] text-slate-400 tabular-nums">{contentVal.length}/3000</span>
            </div>
            <Textarea
              id="q-content"
              rows={4}
              maxLength={3000}
              placeholder="Nhập nội dung đề bài câu hỏi..."
              {...register('content', {
                required: 'Nội dung câu hỏi là bắt buộc',
                validate: (value) => Boolean(value.trim()) || 'Nội dung câu hỏi không được chỉ chứa khoảng trắng',
                maxLength: { value: 3000, message: 'Nội dung câu hỏi tối đa 3000 ký tự' },
              })}
            />
            <FieldError>{errors.content?.message}</FieldError>
          </div>

          {type === 'ESSAY' ? (
            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="q-ref">Đáp án tham khảo / Hướng dẫn chấm (Barem)</Label>
                <span className="text-[11px] text-slate-400 tabular-nums">{refVal.length}/10000</span>
              </div>
              <Textarea
                id="q-ref"
                rows={6}
                maxLength={10000}
                placeholder="Nhập barem tiêu chí và nội dung cho điểm chi tiết..."
                {...register('referenceAnswer', {
                  required: 'Đáp án tham khảo là bắt buộc',
                  validate: (value) => Boolean(value?.trim()) || 'Đáp án tham khảo không được chỉ chứa khoảng trắng',
                  maxLength: { value: 10000, message: 'Đáp án tham khảo tối đa 10000 ký tự' },
                })}
              />
              <FieldError>{errors.referenceAnswer?.message}</FieldError>
            </div>
          ) : (
            <fieldset className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
              <legend className="px-1.5 text-xs font-bold uppercase tracking-wider text-slate-600">
                Danh sách phương án đáp án
              </legend>
              {fields.map((field, index) => (
                <div key={field.id} className="flex items-start gap-3">
                  <label className="mt-2.5 flex shrink-0 items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
                    <input
                      type={type === 'MULTIPLE_CHOICE' ? 'checkbox' : 'radio'}
                      name="correct-answer"
                      checked={Boolean(answers[index]?.isCorrect)}
                      onChange={(event) =>
                        type === 'MULTIPLE_CHOICE'
                          ? setValue(`answers.${index}.isCorrect`, event.target.checked)
                          : toggleCorrect(index)
                      }
                      className="h-4 w-4 accent-teal-700"
                    />
                    <span>Đúng</span>
                  </label>
                  <div className="flex-1">
                    <Input
                      aria-label={`Nội dung đáp án ${index + 1}`}
                      placeholder={`Phương án ${String.fromCharCode(65 + index)}...`}
                      readOnly={type === 'TRUE_FALSE'}
                      {...register(`answers.${index}.content`, {
                        required: 'Không được để trống đáp án',
                        validate: (value) => Boolean(value.trim()) || 'Đáp án không được chỉ chứa khoảng trắng',
                      })}
                    />
                    <FieldError>{errors.answers?.[index]?.content?.message}</FieldError>
                  </div>
                  {type !== 'TRUE_FALSE' && fields.length > 2 && (
                    <Button type="button" variant="ghost" size="sm" className="text-rose-600 hover:text-rose-700" onClick={() => remove(index)}>
                      Xóa
                    </Button>
                  )}
                </div>
              ))}
              {type !== 'TRUE_FALSE' && (
                <Button type="button" variant="outline" size="sm" onClick={() => append({ content: '', isCorrect: false })}>
                  <Plus className="h-3.5 w-3.5" />
                  Thêm đáp án
                </Button>
              )}
              <FieldError>{answerError}</FieldError>
            </fieldset>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
              Hủy
            </Button>
            <Button type="submit" variant="teal" disabled={mutation.isPending}>
              {mutation.isPending ? 'Đang lưu...' : 'Lưu câu hỏi'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function extractConfirmErrorDetails(err, validItems) {
  const fieldErrors = err?.fieldErrors || err?.response?.data?.fieldErrors || {}
  const locations = []
  const flaggedItemIndices = new Set()

  Object.entries(fieldErrors).forEach(([field, msg]) => {
    const match = /^items\[(\d+)\](?:\.(.+))?$/.exec(field)
    if (match) {
      const idx = Number(match[1])
      const itemIndex = validItems[idx]?.itemIndex || idx + 1
      flaggedItemIndices.add(itemIndex)
      locations.push(`Câu #${itemIndex}: ${msg}`)
    } else if (msg) {
      locations.push(`${field}: ${msg}`)
    }
  })

  const message = err?.message || err?.response?.data?.message || 'Không thể lưu câu hỏi vào hệ thống'
  const msgMatch = /(?:câu|item)\s+#?(\d+)/i.exec(message)
  if (msgMatch) {
    const pos = Number(msgMatch[1])
    const mapped = validItems[pos - 1]?.itemIndex || pos
    flaggedItemIndices.add(mapped)
  }

  return { message, locations, flaggedItemIndices }
}

function QuestionImportModal({ subjects, allChapters, onClose }) {
  const queryClient = useQueryClient()
  const [step, setStep] = useState(1)
  const [selectedFile, setSelectedFile] = useState(null)
  const [subjectId, setSubjectId] = useState('')
  const [chapterId, setChapterId] = useState('')
  const [previewData, setPreviewData] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [errorLocations, setErrorLocations] = useState([])
  const [flaggedIndices, setFlaggedIndices] = useState(() => new Set())
  const [confirmRequestId, setConfirmRequestId] = useState(null)

  const chapters = useMemo(
    () => allChapters.filter((chapter) => !subjectId || chapter.subjectId === Number(subjectId)),
    [allChapters, subjectId]
  )

  const resetPreview = () => {
    setPreviewData(null)
    setErrorMessage('')
    setErrorLocations([])
    setFlaggedIndices(new Set())
    setConfirmRequestId(null)
    setStep(1)
  }

  const previewMutation = useMutation({
    mutationFn: (formData) => api.previewImportQuestions(formData),
    onSuccess: (data) => {
      setPreviewData(data)
      setErrorMessage('')
      setErrorLocations([])
      setFlaggedIndices(new Set())
      setStep(2)
      emitAssistantHint({
        title: 'Đã đọc xong tài liệu',
        message: `Có ${data.validCount || 0} câu hợp lệ trong bản xem trước. Hãy kiểm tra đáp án, môn và chương trước khi lưu.`,
        tone: 'success',
      })
    },
    onError: (err) => {
      const details = extractConfirmErrorDetails(err, [])
      setErrorMessage(details.message)
      setErrorLocations(details.locations)
      emitAssistantHint({ title: 'Chưa đọc được tài liệu', message: `${details.message} Hỗ trợ DOCX/PDF có văn bản, tối đa 10 MB, 500 câu, PDF tối đa 150 trang.`, tone: 'error' })
    },
  })

  const confirmMutation = useMutation({
    mutationFn: (body) => api.confirmImportQuestions(body),
    onSuccess: (data) => {
      setConfirmRequestId(null)
      toast.success(`Đã nhập thành công ${data.length} câu hỏi vào ngân hàng`)
      emitAssistantHint({
        title: 'Đã nhập câu hỏi',
        message: `${data.length} câu đã được thêm vào ngân hàng. Có thể kiểm tra lại danh sách và độ sẵn sàng của ma trận.`,
        tone: 'success',
      })
      queryClient.invalidateQueries({ queryKey: ['questions'] })
      queryClient.invalidateQueries({ queryKey: ['availability'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-analytics'] })
      onClose()
    },
    onError: (err) => {
      const validItems = (previewData?.items || []).filter((item) => item.valid)
      const details = extractConfirmErrorDetails(err, validItems)
      setErrorMessage(details.message)
      setErrorLocations(details.locations)
      setFlaggedIndices(details.flaggedItemIndices)
      emitAssistantHint({ title: 'Chưa lưu được câu hỏi', message: details.message, tone: 'error' })
    },
  })

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    setPreviewData(null)
    setErrorMessage('')
    setErrorLocations([])
    setFlaggedIndices(new Set())
    setSelectedFile(null)
    if (!file) return
    if (!/\.(docx|pdf)$/i.test(file.name) || file.size === 0 || file.size > 10 * 1024 * 1024) {
      e.target.value = ''
      setErrorMessage('Chọn tệp .docx hoặc .pdf có nội dung và dung lượng tối đa 10 MB.')
      emitAssistantHint({ title: 'Định dạng tài liệu chưa phù hợp', message: 'Chọn tệp DOCX hoặc PDF có văn bản, tối đa 10 MB, 500 câu, PDF tối đa 150 trang.', tone: 'warning' })
      return
    }
    setSelectedFile(file)
  }

  const handlePreview = (e) => {
    e.preventDefault()
    if (!selectedFile) {
      setErrorMessage('Vui lòng chọn tệp Word (.docx) hoặc PDF (.pdf)')
      emitAssistantHint({ title: 'Chưa có tệp để phân tích', message: 'Chọn tệp DOCX hoặc PDF trước khi tạo bản xem trước.', tone: 'warning' })
      return
    }
    const formData = new FormData()
    formData.append('file', selectedFile)
    if (subjectId) formData.append('subjectId', subjectId)
    if (chapterId && Number(chapterId) > 0) formData.append('chapterId', chapterId)
    setErrorMessage('')
    setErrorLocations([])
    previewMutation.mutate(formData)
  }

  const handleConfirm = () => {
    if (!previewData?.items) return
    const validItems = previewData.items.filter((item) => item.valid)
    if (!validItems.length) {
      setErrorMessage('Không có câu hỏi hợp lệ nào để lưu.')
      return
    }
    const missingChapter = validItems.some((item) => !(Number(item.chapterId || chapterId) > 0))
    if (missingChapter) {
      setErrorMessage('Vui lòng chọn Chương bài mặc định hợp lệ trước khi lưu câu hỏi.')
      return
    }
    setErrorMessage('')
    setErrorLocations([])
    setFlaggedIndices(new Set())

    const requestId =
      confirmRequestId ||
      (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`)
    if (!confirmRequestId) setConfirmRequestId(requestId)
    confirmMutation.mutate({
      requestId,
      subjectId: subjectId ? Number(subjectId) : undefined,
      items: validItems.map((item) => ({
        chapterId: Number(item.chapterId || chapterId),
        content: item.content,
        difficulty: item.difficulty || 'MEDIUM',
        type: item.type,
        referenceAnswer: item.referenceAnswer || null,
        answers: item.answers || [],
      })),
    })
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !previewMutation.isPending && !confirmMutation.isPending) onClose() }}>
      <DialogContent wide>
        <DialogHeader>
          <DialogTitle>Nhập câu hỏi từ tài liệu Word (.docx) / PDF (.pdf)</DialogTitle>
          <div className="flex items-center gap-2 pt-2 text-xs font-semibold">
            <span className={cn('rounded-full px-2.5 py-0.5', step === 1 ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-600')}>
              Bước 1: Chọn tệp & Hướng dẫn
            </span>
            <span className="text-slate-400">/</span>
            <span className={cn('rounded-full px-2.5 py-0.5', step === 2 ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-600')}>
              Bước 2: Kiểm tra chi tiết & Xác nhận
            </span>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {errorMessage && (
            <Alert variant="destructive">
              <AlertDescription className="space-y-1.5">
                <p>{errorMessage}</p>
                {errorLocations.length > 0 && (
                  <ul className="list-disc pl-5 text-xs space-y-0.5">
                    {errorLocations.map((loc, idx) => (
                      <li key={idx}>{loc}</li>
                    ))}
                  </ul>
                )}
              </AlertDescription>
            </Alert>
          )}

          {step === 1 && (
            <form onSubmit={handlePreview} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="imp-subject">Môn học áp dụng</Label>
                  <Select
                    id="imp-subject"
                    value={subjectId}
                    onChange={(e) => {
                      setSubjectId(e.target.value)
                      setChapterId('')
                    }}
                  >
                    <option value="">Chọn môn học</option>
                    {subjects.map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.code} - {sub.name}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <Label htmlFor="imp-chapter">Chương bài mặc định</Label>
                  <Select id="imp-chapter" value={chapterId} onChange={(e) => setChapterId(e.target.value)}>
                    <option value="">Chọn chương bài</option>
                    {chapters.map((ch) => (
                      <option key={ch.id} value={ch.id}>
                        {ch.orderIndex}. {ch.name}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-start">
                <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 lg:col-span-5">
                  <div>
                    <Label htmlFor="imp-file">Tệp tài liệu (.docx, .pdf)</Label>
                    <Input id="imp-file" type="file" accept=".docx,.pdf" onChange={handleFileChange} required />
                  </div>
                  <p className="text-xs text-slate-600">
                    Giới hạn: <strong>10 MB</strong> · tối đa <strong>500 câu</strong> · tối đa <strong>150 trang PDF</strong>.
                  </p>
                  <Button type="button" variant="outline" size="sm" onClick={downloadSampleDocx} className="w-full">
                    <Download className="h-3.5 w-3.5" />
                    Tải mẫu DOCX
                  </Button>
                </div>

                <div className="space-y-2.5 rounded-xl border border-teal-200 bg-teal-50/60 p-4 lg:col-span-7">
                  <div className="text-sm font-bold text-teal-950">Tài liệu cần theo mẫu</div>
                  <ul className="space-y-1.5 text-xs text-slate-800">
                    <li>
                      <strong>Dòng câu hỏi:</strong> bắt đầu bằng <code>Câu 1:</code>, <code>Bài 1:</code> hoặc <code>Question 1:</code>
                    </li>
                    <li>
                      <strong>Phương án:</strong> mỗi lựa chọn bắt đầu bằng <code>A.</code>, <code>B.</code>, <code>C.</code>, <code>D.</code>
                    </li>
                    <li>
                      <strong>Đáp án:</strong> ghi <code>Đáp án: B</code> (trắc nghiệm) hoặc <code>Đáp án tham khảo: ...</code> (tự luận)
                    </li>
                  </ul>
                  <pre className="overflow-x-auto rounded-lg border border-teal-100 bg-white/95 px-3 py-2 text-[11px] leading-relaxed text-slate-800">
{`Câu 1: Giao thức nào đảm bảo truyền dữ liệu tin cậy?
A. UDP
B. TCP
Đáp án: B

Câu 2: Trình bày khái niệm lớp và đối tượng trong OOP.
Đáp án tham khảo: Lớp là bản thiết kế, đối tượng là thể hiện cụ thể của lớp.`}
                  </pre>
                  <p className="text-[11px] leading-relaxed text-amber-900 bg-amber-50/80 border border-amber-200/80 rounded-lg px-2.5 py-2">
                    PDF quét và bố cục phức tạp có thể chưa tách được do hỗ trợ OCR còn hạn chế. Vui lòng dùng bản có văn bản hoặc tải mẫu DOCX. Cảm ơn thầy cô đã thông cảm.
                  </p>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={onClose} disabled={previewMutation.isPending}>
                  Đóng
                </Button>
                <Button type="submit" variant="teal" disabled={!selectedFile || previewMutation.isPending}>
                  <Upload className="h-4 w-4" />
                  {previewMutation.isPending ? 'Đang phân tích tệp...' : 'Phân tích & Xem trước'}
                </Button>
              </DialogFooter>
            </form>
          )}

          {step === 2 && previewData && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="space-y-0.5">
                  <div className="text-sm font-bold text-slate-900">Tệp: {previewData.fileName}</div>
                  <div className="text-xs text-slate-600 tabular-nums">
                    Tổng phân tích: <strong>{previewData.totalParsed}</strong> · Hợp lệ:{' '}
                    <strong className="text-emerald-700">{previewData.validCount}</strong> · Lỗi:{' '}
                    <strong className="text-rose-700">{previewData.errorCount}</strong>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={resetPreview} disabled={confirmMutation.isPending}>
                  Chọn tệp khác
                </Button>
              </div>

              {previewData.errorCount > 0 && (
                <Alert variant="warning">
                  <AlertDescription className="space-y-1.5 text-xs">
                    <div className="font-bold">
                      Vị trí các câu chưa hợp lệ ({previewData.errorCount} câu — sẽ không được lưu nếu bạn xác nhận):
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {previewData.items
                        .filter((item) => !item.valid)
                        .map((item, idx) => {
                          const pos = item.itemIndex || idx + 1
                          return (
                            <Button
                              key={pos}
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-6 bg-white px-2 text-[11px]"
                              onClick={() =>
                                document.getElementById(`import-item-${pos}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                              }
                            >
                              Câu #{pos}
                            </Button>
                          )
                        })}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
                {previewData.items.map((item, idx) => {
                  const pos = item.itemIndex || idx + 1
                  const hasConfirmFlag = flaggedIndices.has(pos)
                  return (
                  <div
                    key={pos}
                    id={`import-item-${pos}`}
                    className={cn(
                      'rounded-xl border p-4 space-y-2.5',
                      item.valid && !hasConfirmFlag ? 'border-slate-200 bg-white' : 'border-rose-300 bg-rose-50/60'
                    )}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-slate-600">Câu #{pos}</span>
                        <Badge variant="neutral">{typeLabel(item.type)}</Badge>
                        <DifficultyBadge value={item.difficulty} />
                        {item.chapterName && <Badge variant="teal">{item.chapterName}</Badge>}
                      </div>
                      <Badge variant={item.valid && !hasConfirmFlag ? 'success' : 'danger'}>
                        {hasConfirmFlag ? 'Lỗi khi lưu' : item.valid ? 'Hợp lệ' : 'Cần sửa'}
                      </Badge>
                    </div>

                    <div className="text-sm font-semibold text-slate-900 whitespace-pre-line">{item.content}</div>

                    {item.type === 'ESSAY' ? (
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-700 whitespace-pre-line">
                        <strong className="text-slate-900">Đáp án tham khảo: </strong>
                        {item.referenceAnswer || '—'}
                      </div>
                    ) : (
                      <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                        {(item.answers || []).map((ans, aIdx) => (
                          <li
                            key={aIdx}
                            className={cn(
                              'flex items-start gap-2 rounded-lg border px-2.5 py-1.5 text-xs',
                              ans.isCorrect
                                ? 'border-emerald-300 bg-emerald-50 font-semibold text-emerald-900'
                                : 'border-slate-200 bg-slate-50 text-slate-700'
                            )}
                          >
                            <span className="font-bold">{String.fromCharCode(65 + aIdx)}.</span>
                            <span className="flex-1 whitespace-pre-line">{ans.content}</span>
                            {ans.isCorrect && <Check className="h-3.5 w-3.5 shrink-0 text-emerald-700" />}
                          </li>
                        ))}
                      </ul>
                    )}

                    {item.errors?.length > 0 && (
                      <div className="text-xs font-medium text-rose-700">
                        Vị trí Câu #{pos}: {item.errors.join('; ')}
                      </div>
                    )}
                  </div>
                  )
                })}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setStep(1)} disabled={confirmMutation.isPending}>
                  Quay lại
                </Button>
                <Button
                  variant="teal"
                  disabled={previewData.validCount === 0 || confirmMutation.isPending}
                  onClick={handleConfirm}
                >
                  {confirmMutation.isPending ? 'Đang lưu...' : `Xác nhận lưu ${previewData.validCount} câu hỏi`}
                </Button>
              </DialogFooter>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default function QuestionsPage() {
  const { user } = useAuth()
  const isAdmin = isContentAdminRole(user?.role)
  const [searchParams] = useSearchParams()
  const [filters, setFilters] = useState(() => ({
    search: '',
    subjectId: '',
    chapterId: searchParams.get('chapterId') || '',
    difficulty: '',
    type: '',
    page: 0,
    size: 10,
  }))
  const [selectedId, setSelectedId] = useState(null)
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const queryClient = useQueryClient()

  useEffect(() => {
    document.title = 'Ngân hàng câu hỏi | Exam Matrix'
  }, [])

  const subjects = useQuery({ queryKey: ['subjects'], queryFn: api.getSubjects })
  const chapters = useQuery({ queryKey: ['chapters', 'all'], queryFn: () => api.getChapters({}) })
  const questions = useQuery({ queryKey: ['questions', filters], queryFn: () => api.getQuestions(filters) })

  const deleteMutation = useMutation({
    mutationFn: api.deleteQuestion,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questions'] })
      queryClient.invalidateQueries({ queryKey: ['availability'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Đã xóa câu hỏi khỏi ngân hàng')
      if (questions.data?.content.length === 1) {
        setFilters((current) => ({ ...current, page: Math.max(0, current.page - 1) }))
      }
      if (deleting?.id === selectedId) setSelectedId(null)
      setDeleting(null)
    },
    onError: (error) => toast.error(error.message || 'Không thể xóa câu hỏi'),
  })

  const setFilter = (name, value) =>
    setFilters((previous) => ({
      ...previous,
      [name]: value,
      page: name === 'page' ? value : 0,
      ...(name === 'subjectId' ? { chapterId: '' } : {}),
    }))

  const resetFilters = () =>
    setFilters({ search: '', subjectId: '', chapterId: '', difficulty: '', type: '', page: 0, size: 10 })

  const filteredChapters = useMemo(
    () => (chapters.data || []).filter((c) => !filters.subjectId || c.subjectId === Number(filters.subjectId)),
    [chapters.data, filters.subjectId]
  )

  const list = useMemo(() => questions.data?.content || [], [questions.data])
  const selectedItem = useMemo(() => {
    if (!list.length) return null
    return list.find((item) => item.id === selectedId) || list[0]
  }, [list, selectedId])

  if (subjects.isLoading || chapters.isLoading) return <LoadingState label="Đang tải danh mục môn học & chương bài..." />
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

  const selectedChapter = selectedItem ? chapters.data.find((c) => c.id === selectedItem.chapterId) : null
  const selectedSubject = selectedChapter ? subjects.data.find((s) => s.id === selectedChapter.subjectId) : null
  const canModifySelected = selectedItem && (isAdmin || selectedItem.teacherId === user?.id)

  return (
    <div className="space-y-5">
      <PageHeader
        accent="teal"
        eyebrow="NGÂN HÀNG CÂU HỎI"
        title="Ngân hàng câu hỏi"
        description="Tra cứu nhanh theo môn, chương, độ khó và hình thức; xem trước đáp án trực tiếp ở khung bên phải."
        action={
          <div className="flex flex-wrap items-center gap-2.5">
            <Button variant="outline" onClick={() => setIsImportOpen(true)}>
              <FileUp className="h-4 w-4" />
              Nhập Word / PDF
            </Button>
            <Button variant="teal" onClick={() => setEditing({})}>
              <Plus className="h-4 w-4" />
              Thêm câu hỏi
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-2.5 rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-12 xl:items-end">
        <div className="sm:col-span-2 md:col-span-3 xl:col-span-4">
          <Label htmlFor="f-search">Tìm nội dung</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              id="f-search"
              value={filters.search}
              onChange={(e) => setFilter('search', e.target.value)}
              placeholder="Tìm nội dung câu hỏi..."
              className="pl-9"
            />
          </div>
        </div>

        <div className="xl:col-span-2">
          <Label htmlFor="f-subject">Môn học</Label>
          <Select id="f-subject" value={filters.subjectId} onChange={(e) => setFilter('subjectId', e.target.value)}>
            <option value="">Tất cả môn</option>
            {subjects.data.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
        </div>

        <div className="xl:col-span-2">
          <Label htmlFor="f-chapter">Chương bài</Label>
          <Select id="f-chapter" value={filters.chapterId} onChange={(e) => setFilter('chapterId', e.target.value)}>
            <option value="">Tất cả chương</option>
            {filteredChapters.map((c) => (
              <option key={c.id} value={c.id}>{c.orderIndex}. {c.name}</option>
            ))}
          </Select>
        </div>

        <div className="xl:col-span-2">
          <Label htmlFor="f-diff">Độ khó</Label>
          <Select id="f-diff" value={filters.difficulty} onChange={(e) => setFilter('difficulty', e.target.value)}>
            <option value="">Tất cả độ khó</option>
            {DIFFICULTIES.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </Select>
        </div>

        <div className="xl:col-span-2 flex items-end gap-2">
          <div className="flex-1">
            <Label htmlFor="f-type">Hình thức</Label>
            <Select id="f-type" value={filters.type} onChange={(e) => setFilter('type', e.target.value)}>
              <option value="">Tất cả</option>
              {QUESTION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.shortLabel}</option>
              ))}
            </Select>
          </div>
          {(filters.search || filters.subjectId || filters.chapterId || filters.difficulty || filters.type) && (
            <Button variant="ghost" size="icon" onClick={resetFilters} title="Đặt lại bộ lọc" aria-label="Đặt lại bộ lọc">
              <RotateCcw className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between text-xs font-semibold text-slate-600" aria-live="polite">
        <span className="tabular-nums">{questions.data?.totalElements ?? 0} câu hỏi phù hợp</span>
        <span className="tabular-nums">Trang {Number(questions.data?.page ?? filters.page) + 1}</span>
      </div>

      {questions.isLoading ? (
        <LoadingState label="Đang tải danh sách câu hỏi..." />
      ) : questions.isError ? (
        <ErrorState error={questions.error} onRetry={questions.refetch} />
      ) : !list.length ? (
        <EmptyState
          title="Chưa tìm thấy câu hỏi phù hợp"
          description="Thử thay đổi bộ lọc hoặc thêm câu hỏi mới vào ngân hàng."
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">

          <div className="space-y-3 lg:col-span-7">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs divide-y divide-slate-100">
              {list.map((item) => {
                const chapter = chapters.data.find((c) => c.id === item.chapterId)
                const subject = subjects.data.find((s) => s.id === chapter?.subjectId)
                const preset = getSubjectPreset(subject?.code, subject?.name)
                const isSelected = selectedItem?.id === item.id
                const canModify = isAdmin || item.teacherId === user?.id

                return (
                  <div
                    key={item.id}
                    className={cn(
                      'flex flex-col gap-2.5 p-4 transition-colors cursor-pointer',
                      isSelected ? 'bg-teal-50/70 ring-1 ring-inset ring-teal-200' : 'hover:bg-slate-50/80'
                    )}
                    onClick={() => setSelectedId(item.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="line-clamp-2 text-sm font-semibold text-slate-900 leading-snug">
                        {item.content}
                      </p>
                      <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Xem trước"
                          onClick={() => setSelectedId(item.id)}
                        >
                          <Eye className="h-4 w-4 text-slate-600" />
                        </Button>
                        {canModify && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Sửa câu hỏi"
                              onClick={() => setEditing(item)}
                            >
                              <Pencil className="h-4 w-4 text-slate-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Xóa câu hỏi"
                              className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                              onClick={() => setDeleting(item)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${preset.badgeClass}`}>
                        <SubjectIcon codeOrName={subject?.code} name={subject?.name} size={12} />
                        {subject?.name || '—'}
                      </span>
                      {chapter && (
                        <span className="text-xs text-slate-500 truncate max-w-[180px]">{chapter.name}</span>
                      )}
                      <DifficultyBadge value={item.difficulty} />
                      <Badge variant="neutral">{typeShortLabel(item.type)}</Badge>
                    </div>
                  </div>
                )
              })}
            </div>

            <Pagination
              page={questions.data.page}
              totalPages={questions.data.totalPages}
              onChange={(page) => setFilter('page', page)}
            />
          </div>

          <aside className="lg:col-span-5">
            {selectedItem && (
              <Card className="lg:sticky lg:top-20 border-slate-200">
                <CardHeader className="border-b border-slate-100 pb-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <DifficultyBadge value={selectedItem.difficulty} />
                      <Badge variant="neutral">{typeLabel(selectedItem.type)}</Badge>
                    </div>
                    {canModifySelected && (
                      <div className="flex items-center gap-1.5">
                        <Button variant="outline" size="sm" onClick={() => setEditing(selectedItem)}>
                          <Pencil className="h-3.5 w-3.5" />
                          Sửa
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => setDeleting(selectedItem)}>
                          <Trash2 className="h-3.5 w-3.5" />
                          Xóa
                        </Button>
                      </div>
                    )}
                  </div>
                  <CardTitle className="pt-2 text-base">Xem trước câu hỏi</CardTitle>
                  <div className="text-xs text-slate-500">
                    {selectedSubject?.name || '—'} · {selectedChapter?.name || '—'}
                  </div>
                </CardHeader>

                <CardContent className="space-y-4 p-5">
                  <div className="rounded-xl border border-slate-200 bg-[#F8F7F4] p-4 text-sm font-medium leading-relaxed text-slate-900 whitespace-pre-line">
                    {selectedItem.content}
                  </div>

                  {selectedItem.type === 'ESSAY' ? (
                    <div className="space-y-1.5">
                      <div className="text-xs font-bold uppercase tracking-wider text-teal-800">
                        Đáp án tham khảo & Barem chấm
                      </div>
                      <div className="rounded-xl border border-teal-200 bg-teal-50/60 p-4 text-sm leading-relaxed text-slate-800 whitespace-pre-line">
                        {selectedItem.referenceAnswer || 'Chưa có đáp án tham khảo.'}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-600">
                        Phương án đáp án
                      </div>
                      <ol className="space-y-2">
                        {(selectedItem.answers || []).map((ans, idx) => (
                          <li
                            key={ans.id || idx}
                            className={cn(
                              'flex items-start justify-between gap-2 rounded-lg border px-3 py-2 text-sm',
                              ans.isCorrect
                                ? 'border-emerald-300 bg-emerald-50 font-semibold text-emerald-950'
                                : 'border-slate-200 bg-white text-slate-700'
                            )}
                          >
                            <div className="flex items-start gap-2">
                              <span className="font-bold text-slate-500">{String.fromCharCode(65 + idx)}.</span>
                              <span className="whitespace-pre-line">{ans.content}</span>
                            </div>
                            {ans.isCorrect && (
                              <Badge variant="success" className="shrink-0">
                                <Check className="h-3 w-3" />
                                Đáp án đúng
                              </Badge>
                            )}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </aside>
        </div>
      )}

      {editing && (
        <QuestionFormDialog
          item={editing.id ? editing : null}
          subjects={subjects.data}
          allChapters={chapters.data}
          onClose={() => setEditing(null)}
        />
      )}

      {isImportOpen && (
        <QuestionImportModal
          subjects={subjects.data}
          allChapters={chapters.data}
          onClose={() => setIsImportOpen(false)}
        />
      )}

      {deleting && (
        <ConfirmModal
          title="Xác nhận xóa câu hỏi"
          message="Xóa câu hỏi này khỏi ngân hàng? Nếu câu hỏi đã được sử dụng trong đề thi, hệ thống sẽ giữ lại và báo lỗi 409."
          onClose={() => setDeleting(null)}
          onConfirm={() => deleteMutation.mutate(deleting.id)}
          busy={deleteMutation.isPending}
        />
      )}
    </div>
  )
}
