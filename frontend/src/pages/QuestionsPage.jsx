import { useMemo, useState } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/service'
import { useAuth } from '../auth/AuthContext'
import { DIFFICULTIES, QUESTION_TYPES, difficultyLabel, typeLabel } from '../constants'
import { Badge, ConfirmModal, EmptyState, ErrorState, FieldError, LoadingState, Modal, PageHeader, Pagination } from '../components/UI'
import { useToast } from '../components/ToastProvider'

const blankAnswers = [{ content: '', isCorrect: true }, { content: '', isCorrect: false }]

function QuestionForm({ item, subjects, allChapters, onClose }) {
  const queryClient = useQueryClient()
  const { notify } = useToast()
  const [answerError, setAnswerError] = useState('')
  const initialSubjectId = item ? allChapters.find((chapter) => chapter.id === Number(item.chapterId))?.subjectId || '' : ''
  const defaultValues = item
    ? { ...structuredClone(item), subjectId: initialSubjectId, answers: Array.isArray(item.answers) ? structuredClone(item.answers) : [], referenceAnswer: item.referenceAnswer ?? '' }
    : { subjectId: '', chapterId: '', content: '', difficulty: 'MEDIUM', type: 'SINGLE_CHOICE', answers: structuredClone(blankAnswers), referenceAnswer: '' }
  const { register, control, watch, handleSubmit, setError, setValue, clearErrors, formState: { errors } } = useForm({ defaultValues })
  const { fields, append, remove, replace } = useFieldArray({ control, name: 'answers' })
  const type = watch('type')
  const subjectId = watch('subjectId')
  const answers = watch('answers') || []
  const chapters = useMemo(() => allChapters.filter((chapter) => chapter.subjectId === Number(subjectId)), [allChapters, subjectId])

  const mutation = useMutation({
    mutationFn: (body) => item ? api.updateQuestion(item.id, body) : api.createQuestion(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questions'] })
      queryClient.invalidateQueries({ queryKey: ['availability'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      notify(item ? 'Đã cập nhật câu hỏi' : 'Đã thêm câu hỏi')
      onClose()
    },
    onError: (error) => {
      const fieldErrors = error.fieldErrors || error.response?.data?.fieldErrors || {}
      Object.entries(fieldErrors).forEach(([name, message]) => setError(name, { message }))
      if (!Object.keys(fieldErrors).length) setError('root', { message: error.message || error.response?.data?.message || 'Không thể lưu câu hỏi' })
    },
  })

  const handleTypeChange = (nextType) => {
    setAnswerError('')
    clearErrors(['answers', 'referenceAnswer'])
    if (nextType === 'ESSAY') replace([])
    else if (nextType === 'TRUE_FALSE') replace([{ content: 'Đúng', isCorrect: true }, { content: 'Sai', isCorrect: false }])
    else if (type === 'ESSAY') replace(structuredClone(blankAnswers))
  }

  const submit = (values) => {
    setAnswerError('')
    if (values.type === 'ESSAY') {
      mutation.mutate({ chapterId: Number(values.chapterId), content: values.content.trim(), difficulty: values.difficulty, type: values.type, answers: [], referenceAnswer: values.referenceAnswer.trim() })
      return
    }
    const objectiveAnswers = values.answers || []
    const correct = objectiveAnswers.filter((answer) => answer.isCorrect).length
    if (objectiveAnswers.length < 2) return setAnswerError('Câu hỏi cần ít nhất hai đáp án')
    if (values.type !== 'MULTIPLE_CHOICE' && correct !== 1) return setAnswerError('Loại câu hỏi này phải có đúng một đáp án đúng')
    if (values.type === 'MULTIPLE_CHOICE' && correct < 1) return setAnswerError('Phải chọn ít nhất một đáp án đúng')
    mutation.mutate({ chapterId: Number(values.chapterId), content: values.content.trim(), difficulty: values.difficulty, type: values.type, answers: objectiveAnswers.map(({ content, isCorrect }) => ({ content: content.trim(), isCorrect: Boolean(isCorrect) })), referenceAnswer: null })
  }

  const toggleCorrect = (index) => {
    if (type !== 'MULTIPLE_CHOICE') answers.forEach((_, answerIndex) => setValue(`answers.${answerIndex}.isCorrect`, answerIndex === index))
  }

  return <Modal title={item ? 'Sửa câu hỏi' : 'Thêm câu hỏi'} onClose={onClose} wide>
    <form onSubmit={handleSubmit(submit)} noValidate>
      {errors.root && <div className="alert error">{errors.root.message}</div>}
      <div className="form-grid two">
        <label>Môn học<select value={subjectId} onChange={(event) => { setValue('subjectId', event.target.value); setValue('chapterId', '') }}><option value="">Chọn môn học</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.code} - {subject.name}</option>)}</select></label>
        <label>Chương<select {...register('chapterId', { required: 'Vui lòng chọn chương' })}><option value="">Chọn chương</option>{chapters.map((chapter) => <option key={chapter.id} value={chapter.id}>{chapter.orderIndex}. {chapter.name}</option>)}</select></label>
        <span />
        <FieldError>{errors.chapterId?.message}</FieldError>
        <label>Độ khó<select {...register('difficulty')}>{DIFFICULTIES.map((difficulty) => <option key={difficulty.value} value={difficulty.value}>{difficulty.label}</option>)}</select></label>
        <label>Loại câu hỏi<select {...register('type', { onChange: (event) => handleTypeChange(event.target.value) })}>{QUESTION_TYPES.map((questionType) => <option key={questionType.value} value={questionType.value}>{questionType.label}</option>)}</select></label>
        <label className="span-two">Nội dung câu hỏi<textarea rows="4" maxLength="3000" {...register('content', { required: 'Nội dung câu hỏi là bắt buộc', validate: (value) => Boolean(value.trim()) || 'Nội dung câu hỏi không được chỉ chứa khoảng trắng', maxLength: { value: 3000, message: 'Nội dung câu hỏi tối đa 3000 ký tự' } })} /></label>
        <FieldError>{errors.content?.message}</FieldError>
      </div>

      {type === 'ESSAY' ? <div className="essay-answer-field">
        <label>Đáp án tham khảo / Hướng dẫn chấm<textarea rows="8" maxLength="10000" {...register('referenceAnswer', { required: 'Đáp án tham khảo là bắt buộc', validate: (value) => Boolean(value?.trim()) || 'Đáp án tham khảo không được chỉ chứa khoảng trắng', maxLength: { value: 10000, message: 'Đáp án tham khảo tối đa 10000 ký tự' } })} /></label>
        <FieldError>{errors.referenceAnswer?.message}</FieldError>
        <p className="form-help">Tối đa 10000 ký tự. Nội dung được lưu dưới dạng văn bản thuần.</p>
      </div> : <fieldset className="answer-fieldset">
        <legend>Danh sách đáp án</legend>
        {fields.map((field, index) => <div className="answer-row" key={field.id}>
          <label><input type={type === 'MULTIPLE_CHOICE' ? 'checkbox' : 'radio'} name="correct-answer" checked={Boolean(answers[index]?.isCorrect)} onChange={(event) => type === 'MULTIPLE_CHOICE' ? setValue(`answers.${index}.isCorrect`, event.target.checked) : toggleCorrect(index)} /> Đáp án đúng</label>
          <div><input aria-label={`Nội dung đáp án ${index + 1}`} readOnly={type === 'TRUE_FALSE'} {...register(`answers.${index}.content`, { required: 'Không được để trống đáp án', validate: (value) => Boolean(value.trim()) || 'Đáp án không được chỉ chứa khoảng trắng' })} /><FieldError>{errors.answers?.[index]?.content?.message}</FieldError></div>
          {type !== 'TRUE_FALSE' && fields.length > 2 && <button type="button" className="text-button danger-text" onClick={() => remove(index)}>Xóa dòng</button>}
        </div>)}
        {type !== 'TRUE_FALSE' && <button type="button" className="button secondary small" onClick={() => append({ content: '', isCorrect: false })}>Thêm dòng đáp án</button>}
        <FieldError>{answerError}</FieldError>
      </fieldset>}

      <div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>Hủy</button><button className="button" disabled={mutation.isPending}>{mutation.isPending ? 'Đang lưu...' : 'Lưu câu hỏi'}</button></div>
    </form>
  </Modal>
}

function QuestionDetail({ item, chapter, subject, onClose }) {
  const isEssay = item.type === 'ESSAY'
  return <Modal title="Chi tiết câu hỏi" onClose={onClose} wide>
    <div className="detail-meta"><span>Môn học<strong>{subject?.name}</strong></span><span>Chương<strong>{chapter?.name}</strong></span><span>Độ khó<strong>{difficultyLabel(item.difficulty)}</strong></span><span>Loại<strong>{typeLabel(item.type)}</strong></span></div>
    <section className="question-detail-section"><h3>Nội dung câu hỏi</h3><div className="question-content">{item.content}</div></section>
    {isEssay ? <section className="question-detail-section"><h3>Đáp án tham khảo / Hướng dẫn chấm</h3><div className="reference-answer-content">{item.referenceAnswer || 'Chưa có đáp án tham khảo.'}</div></section> : <ol className="answer-detail">{(item.answers || []).map((answer) => <li key={answer.id || answer.content} className={answer.isCorrect ? 'correct-answer' : ''}>{answer.content}{answer.isCorrect && <Badge tone="success">Đáp án đúng</Badge>}</li>)}</ol>}
  </Modal>
}

function QuestionImportModal({ subjects, allChapters, onClose }) {
  const queryClient = useQueryClient()
  const { notify } = useToast()
  const [selectedFile, setSelectedFile] = useState(null)
  const [subjectId, setSubjectId] = useState('')
  const [chapterId, setChapterId] = useState('')
  const [previewData, setPreviewData] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')

  const chapters = useMemo(
    () => allChapters.filter((chapter) => !subjectId || chapter.subjectId === Number(subjectId)),
    [allChapters, subjectId]
  )

  const previewMutation = useMutation({
    mutationFn: (formData) => api.previewImportQuestions(formData),
    onSuccess: (data) => {
      setPreviewData(data)
      setErrorMessage('')
    },
    onError: (err) => {
      setErrorMessage(err.message || 'Không thể đọc và phân tích file')
    },
  })

  const confirmMutation = useMutation({
    mutationFn: (body) => api.confirmImportQuestions(body),
    onSuccess: (data) => {
      notify(`Đã import thành công ${data.length} câu hỏi vào ngân hàng`)
      queryClient.invalidateQueries({ queryKey: ['questions'] })
      queryClient.invalidateQueries({ queryKey: ['availability'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      onClose()
    },
    onError: (err) => {
      setErrorMessage(err.message || 'Không thể lưu câu hỏi vào hệ thống')
    },
  })

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    setErrorMessage('')
    setPreviewData(null)
    if (!file) {
      setSelectedFile(null)
      return
    }
    const name = file.name.toLowerCase()
    if (name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg')) {
      setSelectedFile(null)
      setErrorMessage('Tính năng nhận diện từ ảnh hiện chưa được hỗ trợ do yêu cầu nghiêm ngặt không sử dụng dịch vụ AI / Cloud OCR bên ngoài.')
      return
    }
    setSelectedFile(file)
  }

  const handlePreview = (e) => {
    e.preventDefault()
    if (!selectedFile) {
      setErrorMessage('Vui lòng chọn file Word (.docx) hoặc PDF (.pdf)')
      return
    }
    const formData = new FormData()
    formData.append('file', selectedFile)
    if (subjectId) formData.append('subjectId', subjectId)
    if (chapterId) formData.append('chapterId', chapterId)
    previewMutation.mutate(formData)
  }

  const handleConfirm = () => {
    if (!previewData || !previewData.items) return
    const validItems = previewData.items.filter((item) => item.valid)
    if (validItems.length === 0) {
      setErrorMessage('Không có câu hỏi hợp lệ nào để import')
      return
    }
    confirmMutation.mutate({
      subjectId: subjectId ? Number(subjectId) : undefined,
      items: validItems.map((item) => ({
        chapterId: item.chapterId || Number(chapterId),
        content: item.content,
        difficulty: item.difficulty || 'MEDIUM',
        type: item.type,
        referenceAnswer: item.referenceAnswer || null,
        answers: item.answers || [],
      })),
    })
  }

  return (
    <Modal title="Nhập câu hỏi từ file (Word / PDF)" onClose={onClose} wide>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <p className="muted" style={{ margin: 0 }}>
          Hỗ trợ tải lên file tài liệu định dạng Word (.docx) hoặc PDF (.pdf). Hệ thống sử dụng thư viện phân tích nội bộ (local), đảm bảo không gửi dữ liệu ra bên ngoài.
        </p>

        {errorMessage && <div className="alert error">{errorMessage}</div>}

        <form onSubmit={handlePreview}>
          <div className="form-grid two">
            <label>
              Môn học áp dụng
              <select
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
              </select>
            </label>

            <label>
              Chương mặc định
              <select
                value={chapterId}
                onChange={(e) => setChapterId(e.target.value)}
              >
                <option value="">Chọn chương</option>
                {chapters.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    {ch.orderIndex}. {ch.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="span-two">
              Tệp tài liệu (.docx, .pdf)
              <input
                type="file"
                accept=".docx,.pdf,.doc,.png,.jpg,.jpeg"
                onChange={handleFileChange}
                required
              />
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '14px' }}>
            <button
              type="submit"
              className="button"
              disabled={!selectedFile || previewMutation.isPending}
            >
              {previewMutation.isPending ? 'Đang đọc và phân tích file...' : 'Xem trước nội dung phân tích'}
            </button>
          </div>
        </form>

        {previewData && (
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <h3 style={{ margin: 0 }}>Kết quả phân tích: {previewData.fileName}</h3>
                <span className="subtext">
                  Tổng số câu: {previewData.totalParsed} · Hợp lệ: {previewData.validCount} · Lỗi: {previewData.errorCount}
                </span>
              </div>
              <button
                type="button"
                className="button"
                disabled={previewData.validCount === 0 || confirmMutation.isPending}
                onClick={handleConfirm}
              >
                {confirmMutation.isPending ? 'Đang lưu...' : `Xác nhận lưu ${previewData.validCount} câu hỏi hợp lệ`}
              </button>
            </div>

            <div className="table-wrap" style={{ maxHeight: '360px', overflowY: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '60px' }}>STT</th>
                    <th>Nội dung câu hỏi</th>
                    <th>Loại</th>
                    <th>Độ khó</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.items.map((item, idx) => (
                    <tr key={item.itemIndex || idx}>
                      <td>{idx + 1}</td>
                      <td className="question-cell">
                        <div>{item.content}</div>
                        {item.errors && item.errors.length > 0 && (
                          <div style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: '4px' }}>
                            {item.errors.join('; ')}
                          </div>
                        )}
                      </td>
                      <td>{typeLabel(item.type)}</td>
                      <td><Badge tone={item.difficulty === 'HARD' ? 'danger' : item.difficulty === 'MEDIUM' ? 'warning' : 'success'}>{difficultyLabel(item.difficulty)}</Badge></td>
                      <td>
                        <Badge tone={item.valid ? 'success' : 'danger'}>
                          {item.valid ? 'Hợp lệ' : 'Lỗi'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="modal-actions" style={{ marginTop: '12px' }}>
          <button type="button" className="button secondary" onClick={onClose}>
            Đóng
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default function QuestionsPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'
  const [filters, setFilters] = useState({ search: '', subjectId: '', chapterId: '', difficulty: '', type: '', page: 0, size: 8 })
  const [editing, setEditing] = useState(null)
  const [viewing, setViewing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const { notify } = useToast()
  const queryClient = useQueryClient()
  const subjects = useQuery({ queryKey: ['subjects'], queryFn: api.getSubjects })
  const chapters = useQuery({ queryKey: ['chapters', 'all'], queryFn: () => api.getChapters({}) })
  const questions = useQuery({ queryKey: ['questions', filters], queryFn: () => api.getQuestions(filters) })
  const deleteMutation = useMutation({ mutationFn: api.deleteQuestion, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['questions'] }); queryClient.invalidateQueries({ queryKey: ['availability'] }); queryClient.invalidateQueries({ queryKey: ['dashboard'] }); notify('Đã xóa câu hỏi'); if (questions.data?.content.length === 1) setFilters((current) => ({ ...current, page: Math.max(0, current.page - 1) })); setDeleting(null) }, onError: (error) => notify(error.message, 'error') })
  const setFilter = (name, value) => setFilters((previous) => ({ ...previous, [name]: value, page: name === 'page' ? value : 0, ...(name === 'subjectId' ? { chapterId: '' } : {}) }))
  const filteredChapters = (chapters.data || []).filter((chapter) => !filters.subjectId || chapter.subjectId === Number(filters.subjectId))

  if (subjects.isLoading || chapters.isLoading) return <LoadingState />
  if (subjects.isError || chapters.isError) return <ErrorState error={subjects.error || chapters.error} onRetry={() => { subjects.refetch(); chapters.refetch() }} />

  return <>
    <PageHeader
      title="Ngân hàng câu hỏi"
      description="Tìm kiếm, phân loại và quản lý câu hỏi trắc nghiệm hoặc tự luận."
      action={
        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="button" className="button secondary" onClick={() => setIsImportOpen(true)}>
            Nhập từ file (Word / PDF)
          </button>
          <button type="button" className="button" onClick={() => setEditing({})}>
            Thêm câu hỏi
          </button>
        </div>
      }
    />
    <div className="toolbar multi"><label className="search-field">Tìm nội dung<input value={filters.search} onChange={(event) => setFilter('search', event.target.value)} placeholder="Nhập nội dung câu hỏi" /></label><label>Môn học<select value={filters.subjectId} onChange={(event) => setFilter('subjectId', event.target.value)}><option value="">Tất cả</option>{subjects.data.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label><label>Chương<select value={filters.chapterId} onChange={(event) => setFilter('chapterId', event.target.value)}><option value="">Tất cả</option>{filteredChapters.map((chapter) => <option key={chapter.id} value={chapter.id}>{chapter.name}</option>)}</select></label><label>Độ khó<select value={filters.difficulty} onChange={(event) => setFilter('difficulty', event.target.value)}><option value="">Tất cả</option>{DIFFICULTIES.map((difficulty) => <option key={difficulty.value} value={difficulty.value}>{difficulty.label}</option>)}</select></label><label>Loại<select value={filters.type} onChange={(event) => setFilter('type', event.target.value)}><option value="">Tất cả</option>{QUESTION_TYPES.map((questionType) => <option key={questionType.value} value={questionType.value}>{questionType.label}</option>)}</select></label></div>
    {questions.isLoading ? <LoadingState /> : questions.isError ? <ErrorState error={questions.error} onRetry={questions.refetch} /> : !questions.data.content.length ? <EmptyState /> : <><div className="table-wrap"><table><thead><tr><th>Nội dung</th><th>Chương</th><th>Độ khó</th><th>Loại</th><th>Thao tác</th></tr></thead><tbody>{questions.data.content.map((item) => { const chapter = chapters.data.find((candidate) => candidate.id === item.chapterId); return <tr key={item.id}><td className="question-cell">{item.content}</td><td>{chapter?.name || '—'}</td><td><Badge tone={item.difficulty === 'HARD' ? 'danger' : item.difficulty === 'MEDIUM' ? 'warning' : 'success'}>{difficultyLabel(item.difficulty)}</Badge></td><td>{typeLabel(item.type)}</td><td><div className="table-actions"><button className="text-button" onClick={() => setViewing(item)}>Xem</button>{(isAdmin || item.teacherId === user?.id) && <><button className="text-button" onClick={() => setEditing(item)}>Sửa</button><button className="text-button danger-text" onClick={() => setDeleting(item)}>Xóa</button></>}</div></td></tr> })}</tbody></table></div><Pagination page={questions.data.page} totalPages={questions.data.totalPages} onChange={(page) => setFilter('page', page)} /></>}
    {editing && <QuestionForm item={editing.id ? editing : null} subjects={subjects.data} allChapters={chapters.data} onClose={() => setEditing(null)} />}
    {isImportOpen && <QuestionImportModal subjects={subjects.data} allChapters={chapters.data} onClose={() => setIsImportOpen(false)} />}
    {viewing && (() => { const chapter = chapters.data.find((candidate) => candidate.id === viewing.chapterId); return <QuestionDetail item={viewing} chapter={chapter} subject={subjects.data.find((subject) => subject.id === chapter?.subjectId)} onClose={() => setViewing(null)} /> })()}
    {deleting && <ConfirmModal message="Xóa câu hỏi này khỏi ngân hàng?" onClose={() => setDeleting(null)} onConfirm={() => deleteMutation.mutate(deleting.id)} busy={deleteMutation.isPending} />}
  </>
}
