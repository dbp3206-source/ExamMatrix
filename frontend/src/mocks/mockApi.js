import { seedData } from './seed'
import { newId } from '../utils'

const STORAGE_KEY = 'exam_matrix_mock_db_v1'
const CURRENT_SCHEMA_VERSION = 3
const wait = (value, delay = 220) => new Promise((resolve, reject) => setTimeout(() => {
  if (sessionStorage.getItem('exam_mock_force_error') === 'true') {
    sessionStorage.removeItem('exam_mock_force_error')
    reject(new Error('Lỗi mô phỏng. Vui lòng thử lại.'))
  } else resolve(structuredClone(value))
}, delay))

const read = () => {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved) {
    const current = JSON.parse(saved)
    if (!current.assignments) current.assignments = structuredClone(seedData.assignments || [])
    if (!current.classes) current.classes = structuredClone(seedData.classes || [])
    if (!current.attempts) current.attempts = []
    if (!current.users.some((u) => u.role === 'STUDENT')) {
      const student = seedData.users.find((u) => u.role === 'STUDENT')
      if (student) current.users.push(student)
    }
    if ((current.papers || []).length === 0 && seedData.papers.length > 0) {
      current.papers = structuredClone(seedData.papers)
    }
    if (Number(current.schemaVersion || 1) < CURRENT_SCHEMA_VERSION) {
      const essayQuestions = seedData.questions.filter((item) => item.type === 'ESSAY' && !(current.questions || []).some((question) => question.id === item.id))
      const essayMatrices = seedData.matrices.filter((item) => item.examType === 'ESSAY' && !(current.matrices || []).some((matrix) => matrix.id === item.id))
      const upgraded = {
        ...current,
        schemaVersion: CURRENT_SCHEMA_VERSION,
        questions: [...(current.questions || []).map((item) => ({ ...item, answers: Array.isArray(item.answers) ? item.answers : [], referenceAnswer: item.referenceAnswer ?? null })), ...structuredClone(essayQuestions)],
        matrices: [...(current.matrices || []).map((item) => ({ ...item, examType: item.examType || 'OBJECTIVE' })), ...structuredClone(essayMatrices)],
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(upgraded))
      return upgraded
    }
    return current
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seedData))
  return structuredClone(seedData)
}
const write = (db) => localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
const publicUser = ({ password: _password, ...user }) => user
const fail = (message, fieldErrors = {}) => Promise.reject({ message, fieldErrors })
const page = (items, params = {}) => {
  const current = Math.max(Number(params.page) || 0, 0)
  const size = Math.max(Number(params.size) || 10, 1)
  return { content: items.slice(current * size, current * size + size), page: current, size, totalElements: items.length, totalPages: Math.ceil(items.length / size) }
}
const textMatch = (value, search) => String(value || '').toLocaleLowerCase('vi').includes(String(search || '').trim().toLocaleLowerCase('vi'))
const normalizeQuestion = (item) => item ? { ...item, answers: Array.isArray(item.answers) ? item.answers : [], referenceAnswer: item.referenceAnswer ?? null } : item
const normalizeMatrix = (item) => item ? { ...item, examType: item.examType || 'OBJECTIVE' } : item
const normalizePaper = (item) => item ? { ...item, questions: (item.questions || []).map(normalizeQuestion) } : item
const matchesExamType = (question, examType) => examType === 'ESSAY' ? question.type === 'ESSAY' : question.type !== 'ESSAY'
const validateQuestion = (body) => {
  if (!String(body.content || '').trim()) return { message: 'Dữ liệu câu hỏi không hợp lệ', fieldErrors: { content: 'Nội dung câu hỏi là bắt buộc' } }
  if (String(body.content).trim().length > 3000) return { message: 'Dữ liệu câu hỏi không hợp lệ', fieldErrors: { content: 'Nội dung câu hỏi tối đa 3000 ký tự' } }
  if (body.type === 'ESSAY') {
    const referenceAnswer = String(body.referenceAnswer || '').trim()
    if (!referenceAnswer) return { message: 'Dữ liệu câu hỏi không hợp lệ', fieldErrors: { referenceAnswer: 'Đáp án tham khảo là bắt buộc' } }
    if (referenceAnswer.length > 10000) return { message: 'Dữ liệu câu hỏi không hợp lệ', fieldErrors: { referenceAnswer: 'Đáp án tham khảo tối đa 10000 ký tự' } }
    if ((body.answers || []).length) return { message: 'Câu hỏi tự luận không được có danh sách đáp án' }
    return null
  }
  const answers = body.answers || []
  const correct = answers.filter((answer) => answer.isCorrect).length
  if (answers.length < 2) return { message: 'Câu hỏi trắc nghiệm cần ít nhất hai đáp án' }
  if (body.type === 'MULTIPLE_CHOICE' ? correct < 1 : correct !== 1) return { message: 'Số đáp án đúng không hợp lệ' }
  return null
}

export const mockApi = {
  async login(body) {
    const user = read().users.find((item) => item.username === body.username && item.password === body.password)
    if (!user) return fail('Tên đăng nhập hoặc mật khẩu không đúng')
    if (user.status !== 'ACTIVE') return fail('Tài khoản đã bị khóa')
    return wait({ accessToken: `mock-token-${user.id}`, user: publicUser(user) }, 450)
  },
  me: () => {
    const token = localStorage.getItem('exam_access_token')
    const user = read().users.find((item) => token === `mock-token-${item.id}`)
    if (!user) return fail('Phiên đăng nhập không hợp lệ')
    if (user.status !== 'ACTIVE') return fail('Tài khoản đã bị khóa')
    return wait(publicUser(user))
  },
  logout: () => wait({ success: true }),
  async updateProfile(body) {
    const db = read(); const current = JSON.parse(localStorage.getItem('exam_current_user') || '{}')
    const index = db.users.findIndex((item) => item.id === current.id)
    if (index < 0) return fail('Không tìm thấy người dùng')
    if (db.users.some((item) => item.id !== current.id && item.email === body.email)) return fail('Email đã được sử dụng', { email: 'Email đã được sử dụng' })
    db.users[index] = { ...db.users[index], fullName: body.fullName, email: body.email }
    write(db); return wait(publicUser(db.users[index]))
  },
  async changePassword(body) {
    const db = read(); const current = JSON.parse(localStorage.getItem('exam_current_user') || '{}')
    const user = db.users.find((item) => item.id === current.id)
    if (user?.password !== body.currentPassword) return fail('Mật khẩu hiện tại không đúng', { currentPassword: 'Mật khẩu hiện tại không đúng' })
    user.password = body.newPassword; write(db); return wait({ success: true })
  },
  getRoles: () => wait([{ id: 1, name: 'ADMIN' }, { id: 2, name: 'TEACHER' }]),
  getUsers: async (params = {}) => {
    let items = read().users.map(publicUser)
    if (params.search) items = items.filter((u) => textMatch(u.username, params.search) || textMatch(u.fullName, params.search) || textMatch(u.email, params.search))
    if (params.role) items = items.filter((u) => u.role === params.role)
    if (params.status) items = items.filter((u) => u.status === params.status)
    return wait(page(items, params))
  },
  getUser: (id) => wait(publicUser(read().users.find((item) => item.id === id))),
  async createUser(body) {
    const db = read()
    if (db.users.some((item) => item.username === body.username)) return fail('Tên đăng nhập đã tồn tại', { username: 'Tên đăng nhập đã tồn tại' })
    if (db.users.some((item) => item.email === body.email)) return fail('Email đã được sử dụng', { email: 'Email đã được sử dụng' })
    const item = { id: newId(), ...body, role: 'TEACHER', status: 'ACTIVE', createdAt: new Date().toISOString() }
    db.users.push(item); write(db); return wait(publicUser(item))
  },
  async updateUser(id, body) {
    const db = read(); const index = db.users.findIndex((item) => item.id === id)
    if (index < 0) return fail('Không tìm thấy người dùng')
    db.users[index] = { ...db.users[index], ...body, password: db.users[index].password }; write(db)
    return wait(publicUser(db.users[index]))
  },
  async updateUserStatus(id, status) {
    const db = read(); const user = db.users.find((item) => item.id === id)
    if (!user) return fail('Không tìm thấy người dùng')
    user.status = status; write(db); return wait(publicUser(user))
  },
  getSubjects: () => wait(read().subjects),
  getSubject: (id) => wait(read().subjects.find((item) => item.id === Number(id))),
  async createSubject(body) {
    const db = read(); const code = body.code.trim().toUpperCase()
    if (db.subjects.some((item) => item.code === code)) return fail('Mã môn học đã tồn tại', { code: 'Mã môn học đã tồn tại' })
    const item = { id: Math.max(0, ...db.subjects.map((x) => x.id)) + 1, ...body, code }; db.subjects.push(item); write(db); return wait(item)
  },
  async updateSubject(id, body) {
    const db = read(); const index = db.subjects.findIndex((item) => item.id === Number(id)); const code = body.code.trim().toUpperCase()
    if (db.subjects.some((item) => item.id !== Number(id) && item.code === code)) return fail('Mã môn học đã tồn tại', { code: 'Mã môn học đã tồn tại' })
    db.subjects[index] = { ...db.subjects[index], ...body, code }; write(db); return wait(db.subjects[index])
  },
  async deleteSubject(id) {
    const db = read(); const subjectId = Number(id)
    if (db.chapters.some((item) => item.subjectId === subjectId)) return fail('Không thể xóa môn học đang có chương')
    db.subjects = db.subjects.filter((item) => item.id !== subjectId); write(db); return wait({ success: true })
  },
  async getChapters(params = {}) {
    let items = read().chapters
    if (params.subjectId) items = items.filter((item) => item.subjectId === Number(params.subjectId))
    return wait([...items].sort((a, b) => a.orderIndex - b.orderIndex))
  },
  getChapter: (id) => wait(read().chapters.find((item) => item.id === Number(id))),
  async createChapter(body) {
    const db = read(); const data = { ...body, subjectId: Number(body.subjectId), orderIndex: Number(body.orderIndex) }
    if (db.chapters.some((item) => item.subjectId === data.subjectId && item.orderIndex === data.orderIndex)) return fail('Số thứ tự đã tồn tại trong môn học', { orderIndex: 'Số thứ tự đã tồn tại trong môn học' })
    const item = { id: Math.max(0, ...db.chapters.map((x) => x.id)) + 1, ...data }; db.chapters.push(item); write(db); return wait(item)
  },
  async updateChapter(id, body) {
    const db = read(); const data = { ...body, subjectId: Number(body.subjectId), orderIndex: Number(body.orderIndex) }
    if (db.chapters.some((item) => item.id !== Number(id) && item.subjectId === data.subjectId && item.orderIndex === data.orderIndex)) return fail('Số thứ tự đã tồn tại trong môn học', { orderIndex: 'Số thứ tự đã tồn tại trong môn học' })
    const index = db.chapters.findIndex((item) => item.id === Number(id)); db.chapters[index] = { ...db.chapters[index], ...data }; write(db); return wait(db.chapters[index])
  },
  async deleteChapter(id) {
    const db = read(); const chapterId = Number(id)
    if (db.questions.some((item) => item.chapterId === chapterId)) return fail('Không thể xóa chương đang có câu hỏi')
    db.chapters = db.chapters.filter((item) => item.id !== chapterId); write(db); return wait({ success: true })
  },
  async getQuestions(params = {}) {
    const db = read(); let items = db.questions
    if (params.search) items = items.filter((item) => textMatch(item.content, params.search))
    if (params.subjectId) { const ids = db.chapters.filter((c) => c.subjectId === Number(params.subjectId)).map((c) => c.id); items = items.filter((q) => ids.includes(q.chapterId)) }
    if (params.chapterId) items = items.filter((q) => q.chapterId === Number(params.chapterId))
    if (params.difficulty) items = items.filter((q) => q.difficulty === params.difficulty)
    if (params.type) items = items.filter((q) => q.type === params.type)
    return wait({ ...page(items.map(normalizeQuestion), params) })
  },
  getQuestion: (id) => wait(normalizeQuestion(read().questions.find((item) => item.id === id))),
  async createQuestion(body) {
    const validation = validateQuestion(body); if (validation) return fail(validation.message, validation.fieldErrors)
    const db = read(); const isEssay = body.type === 'ESSAY'; const item = { ...body, id: newId(), chapterId: Number(body.chapterId), answers: isEssay ? [] : body.answers.map((a) => ({ ...a, id: newId() })), referenceAnswer: isEssay ? body.referenceAnswer.trim() : null, teacherId: JSON.parse(localStorage.getItem('exam_current_user') || '{}').id, createdAt: new Date().toISOString() }
    db.questions.push(item); write(db); return wait(item)
  },
  async updateQuestion(id, body) {
    const validation = validateQuestion(body); if (validation) return fail(validation.message, validation.fieldErrors)
    const db = read(); const index = db.questions.findIndex((item) => item.id === id); const currentUser = JSON.parse(localStorage.getItem('exam_current_user') || '{}')
    if (index < 0) return fail('Không tìm thấy câu hỏi')
    if (currentUser.role !== 'ADMIN' && db.questions[index].teacherId !== currentUser.id) return fail('Bạn không có quyền cập nhật câu hỏi này')
    const isEssay = body.type === 'ESSAY'
    db.questions[index] = { ...db.questions[index], ...body, chapterId: Number(body.chapterId), answers: isEssay ? [] : body.answers.map((a) => ({ ...a, id: a.id || newId() })), referenceAnswer: isEssay ? body.referenceAnswer.trim() : null }; write(db); return wait(db.questions[index])
  },
  async deleteQuestion(id) { const db = read(); const question = db.questions.find((item) => item.id === id); const currentUser = JSON.parse(localStorage.getItem('exam_current_user') || '{}'); if (!question) return fail('Không tìm thấy câu hỏi'); if (currentUser.role !== 'ADMIN' && question.teacherId !== currentUser.id) return fail('Bạn không có quyền xóa câu hỏi này'); db.questions = db.questions.filter((item) => item.id !== id); write(db); return wait({ success: true }) },
  async getAvailability(params = {}) {
    const db = read(); const examType = params.examType || 'OBJECTIVE'; const chapters = db.chapters.filter((c) => !params.subjectId || c.subjectId === Number(params.subjectId))
    return wait(chapters.flatMap((chapter) => ['EASY', 'MEDIUM', 'HARD'].map((difficulty) => ({ chapterId: chapter.id, difficulty, available: db.questions.filter((q) => q.chapterId === chapter.id && q.difficulty === difficulty && matchesExamType(q, examType)).length }))))
  },
  async getMatrices(params = {}) {
    let items = read().matrices.map(normalizeMatrix)
    if (params.search) items = items.filter((item) => textMatch(item.title, params.search))
    if (params.subjectId) items = items.filter((item) => item.subjectId === Number(params.subjectId))
    if (params.examType) items = items.filter((item) => item.examType === params.examType)
    return wait(page(items, params))
  },
  getMatrix: (id) => wait(normalizeMatrix(read().matrices.find((item) => item.id === id))),
  async createMatrix(body) {
    const db = read(); const current = JSON.parse(localStorage.getItem('exam_current_user') || '{}'); const now = new Date().toISOString()
    const item = { ...body, id: newId(), subjectId: Number(body.subjectId), examType: body.examType || 'OBJECTIVE', teacherId: current.id, createdAt: now, updatedAt: now }; db.matrices.push(item); write(db); return wait(item)
  },
  async updateMatrix(id, body) { const db = read(); const index = db.matrices.findIndex((item) => item.id === id); db.matrices[index] = { ...db.matrices[index], ...body, subjectId: Number(body.subjectId), examType: body.examType || db.matrices[index].examType || 'OBJECTIVE', updatedAt: new Date().toISOString() }; write(db); return wait(db.matrices[index]) },
  async deleteMatrix(id) { const db = read(); if (db.papers.some((p) => p.matrixId === id)) return fail('Không thể xóa ma trận đã sinh đề'); db.matrices = db.matrices.filter((item) => item.id !== id); write(db); return wait({ success: true }) },
  async generatePapers(id, body) {
    const db = read(); const matrix = normalizeMatrix(db.matrices.find((item) => item.id === id))
    if (!matrix) return fail('Không tìm thấy ma trận')
    for (const config of matrix.configs) if (db.questions.filter((q) => q.chapterId === config.chapterId && q.difficulty === config.difficulty && matchesExamType(q, matrix.examType)).length < config.quantity) return fail('Số câu hỏi khả dụng không đủ để sinh đề')
    const existing = db.papers.filter((p) => p.matrixId === id).length
    const generated = Array.from({ length: Number(body.numberOfPapers) }, (_, index) => {
      const questions = matrix.configs.flatMap((config) => db.questions.filter((q) => q.chapterId === config.chapterId && q.difficulty === config.difficulty && matchesExamType(q, matrix.examType)).sort(() => Math.random() - 0.5).slice(0, config.quantity)).sort(() => Math.random() - 0.5).map((q, order) => ({ id: q.id, questionOrder: order + 1, content: q.content, type: q.type, difficulty: q.difficulty, answers: q.type === 'ESSAY' ? [] : (q.answers || []).map((answer) => ({ ...answer })).sort(() => Math.random() - 0.5), referenceAnswer: q.referenceAnswer ?? null }))
      return { id: newId(), matrixId: id, examCode: `M${String(existing + index + 1).padStart(2, '0')}`, createdAt: new Date().toISOString(), questions }
    })
    db.papers.push(...generated); write(db); return wait(generated, 600)
  },
  async getPapers(params = {}) { let items = read().papers.map(normalizePaper); if (params.matrixId) items = items.filter((item) => item.matrixId === params.matrixId); return wait(page(items, params)) },
  getPaper: (id) => wait(normalizePaper(read().papers.find((item) => item.id === id))),
  async deletePaper(id) { const db = read(); db.papers = db.papers.filter((item) => item.id !== id); write(db); return wait({ success: true }) },
  async getDashboard() {
    const db = read(); const difficulty = ['EASY', 'MEDIUM', 'HARD'].map((key) => ({ difficulty: key, count: db.questions.filter((q) => q.difficulty === key).length }))
    return wait({ totalSubjects: db.subjects.length, totalChapters: db.chapters.length, totalQuestions: db.questions.length, totalMatrices: db.matrices.length, totalPapers: db.papers.length, difficulty, recentMatrices: [...db.matrices].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))).slice(0, 5) })
  },
  async registerStudent(body) {
    const db = read()
    if (db.users.some((item) => item.username === body.username)) return fail('Tên đăng nhập đã tồn tại', { username: 'Tên đăng nhập đã tồn tại' })
    if (db.users.some((item) => item.email === body.email)) return fail('Email đã được sử dụng', { email: 'Email đã được sử dụng' })
    const user = { id: newId(), ...body, role: 'STUDENT', status: 'ACTIVE', createdAt: new Date().toISOString() }
    db.users.push(user); write(db)
    return wait({ accessToken: `mock-token-${user.id}`, user: publicUser(user) }, 400)
  },
  getTeachers: async () => {
    const db = read()
    return wait(db.users.filter((u) => u.role === 'TEACHER' && u.status === 'ACTIVE').map(publicUser))
  },
  async getTeacherClass() {
    const db = read(); const currentUser = JSON.parse(localStorage.getItem('exam_current_user') || '{}')
    let cls = db.classes.find((c) => c.teacherId === currentUser.id)
    if (!cls) {
      cls = { id: newId(), teacherId: currentUser.id, name: `Lớp của ${currentUser.fullName}`, classCode: `CLASS_${currentUser.username.toUpperCase()}`, joinPassword: '123', createdAt: new Date().toISOString() }
      db.classes.push(cls); write(db)
    }
    const studentCount = db.assignments.filter((a) => a.teacherId === currentUser.id && a.status === 'APPROVED').length
    return wait({ ...cls, teacherName: currentUser.fullName, studentCount, hasPassword: true })
  },
  async updateTeacherClass(body) {
    const db = read(); const currentUser = JSON.parse(localStorage.getItem('exam_current_user') || '{}')
    let cls = db.classes.find((c) => c.teacherId === currentUser.id)
    if (!cls) {
      cls = { id: newId(), teacherId: currentUser.id, name: body.name, classCode: body.classCode, joinPassword: body.password || '123', createdAt: new Date().toISOString() }
      db.classes.push(cls)
    } else {
      cls.name = body.name
      cls.classCode = body.classCode
      if (body.password) cls.joinPassword = body.password
    }
    write(db)
    const studentCount = db.assignments.filter((a) => a.teacherId === currentUser.id && a.status === 'APPROVED').length
    return wait({ ...cls, teacherName: currentUser.fullName, studentCount, hasPassword: true })
  },
  async createTeacherRequest(body) {
    const db = read(); const currentUser = JSON.parse(localStorage.getItem('exam_current_user') || '{}')
    let cls = db.classes.find((c) => (body.teacherId && c.teacherId === body.teacherId) || (body.classCode && c.classCode === body.classCode))
    if (!cls && body.teacherId) {
      const teacher = db.users.find((u) => u.id === body.teacherId)
      if (teacher) {
        cls = { id: newId(), teacherId: teacher.id, name: `Lớp của ${teacher.fullName}`, classCode: `CLASS_${teacher.username.toUpperCase()}`, joinPassword: '123', createdAt: new Date().toISOString() }
        db.classes.push(cls)
      }
    }
    if (!cls) return fail('Không tìm thấy lớp học của giáo viên')
    if (body.password && body.password !== cls.joinPassword) return fail('Mật khẩu lớp học không chính xác')

    let assignment = db.assignments.find((a) => a.studentId === currentUser.id)
    const teacher = db.users.find((u) => u.id === cls.teacherId)
    if (assignment) {
      assignment.teacherId = cls.teacherId
      assignment.classId = cls.id
      assignment.status = 'APPROVED'
      assignment.requestedAt = new Date().toISOString()
      assignment.reviewedAt = new Date().toISOString()
      assignment.decisionNote = 'Tham gia bằng mật khẩu lớp học'
    } else {
      assignment = {
        id: newId(),
        studentId: currentUser.id,
        teacherId: cls.teacherId,
        classId: cls.id,
        status: 'APPROVED',
        requestedAt: new Date().toISOString(),
        reviewedAt: new Date().toISOString(),
        decisionNote: 'Tham gia bằng mật khẩu lớp học',
      }
      db.assignments.push(assignment)
    }
    write(db)
    return wait({
      ...assignment,
      studentName: currentUser.fullName,
      studentEmail: currentUser.email,
      teacherName: teacher?.fullName,
      teacherEmail: teacher?.email,
      classCode: cls.classCode,
      className: cls.name,
    })
  },
  async getCurrentTeacherRequest() {
    const db = read(); const currentUser = JSON.parse(localStorage.getItem('exam_current_user') || '{}')
    const assignment = db.assignments.find((a) => a.studentId === currentUser.id)
    if (!assignment) return wait(null)
    const teacher = db.users.find((u) => u.id === assignment.teacherId)
    const cls = db.classes.find((c) => c.id === assignment.classId || c.teacherId === assignment.teacherId)
    return wait({
      ...assignment,
      studentName: currentUser.fullName,
      studentEmail: currentUser.email,
      teacherName: teacher?.fullName,
      teacherEmail: teacher?.email,
      classCode: cls?.classCode,
      className: cls?.name,
    })
  },
  async getTeacherStudentRequests(params = {}) {
    const db = read(); const currentUser = JSON.parse(localStorage.getItem('exam_current_user') || '{}')
    let items = db.assignments.filter((a) => a.teacherId === currentUser.id)
    if (params.status) items = items.filter((a) => a.status === params.status)
    const mapped = items.map((a) => {
      const student = db.users.find((u) => u.id === a.studentId)
      return {
        ...a,
        studentName: student?.fullName || 'Học sinh',
        studentEmail: student?.email || '',
      }
    })
    return wait(page(mapped, params))
  },
  async reviewStudentRequest(requestId, body) {
    const db = read()
    const assignment = db.assignments.find((a) => a.id === requestId)
    if (!assignment) return fail('Không tìm thấy yêu cầu')
    assignment.status = body.status
    assignment.decisionNote = body.decisionNote || null
    assignment.reviewedAt = new Date().toISOString()
    write(db)
    const student = db.users.find((u) => u.id === assignment.studentId)
    const teacher = db.users.find((u) => u.id === assignment.teacherId)
    return wait({
      ...assignment,
      studentName: student?.fullName,
      studentEmail: student?.email,
      teacherName: teacher?.fullName,
    })
  },
  async getStudentExams(params = {}) {
    const db = read(); const currentUser = JSON.parse(localStorage.getItem('exam_current_user') || '{}')
    const assignment = db.assignments.find((a) => a.studentId === currentUser.id && a.status === 'APPROVED')

    const accessible = db.papers.filter((paper) => {
      const isPub = paper.isPublished !== false
      if (!isPub) return false
      if (paper.accessType === 'PUBLIC' || !paper.accessType) return true
      const matrix = db.matrices.find((m) => m.id === paper.matrixId)
      return matrix && assignment && matrix.teacherId === assignment.teacherId
    }).map((paper) => {
      const matrix = db.matrices.find((m) => m.id === paper.matrixId)
      const subject = db.subjects.find((s) => s.id === matrix?.subjectId)
      const teacher = db.users.find((u) => u.id === matrix?.teacherId)
      const attempt = db.attempts.find((att) => att.studentId === currentUser.id && att.paperId === paper.id)

      return {
        paperId: paper.id,
        examCode: paper.examCode,
        title: matrix?.title || 'Đề thi',
        teacherName: teacher?.fullName || '',
        subjectName: subject?.name || '',
        examType: matrix?.examType || 'OBJECTIVE',
        duration: matrix?.duration || 45,
        totalQuestions: (paper.questions || []).length,
        accessType: paper.accessType || 'PUBLIC',
        attemptStatus: attempt?.status || 'AVAILABLE',
        attemptId: attempt?.id || null,
        createdAt: paper.createdAt,
      }
    })
    return wait(page(accessible, params))
  },
  async getStudentExam(paperId) {
    const db = read()
    const paper = db.papers.find((p) => p.id === paperId)
    if (!paper) return fail('Không tìm thấy đề thi')
    const matrix = db.matrices.find((m) => m.id === paper.matrixId)
    const subject = db.subjects.find((s) => s.id === matrix?.subjectId)
    const teacher = db.users.find((u) => u.id === matrix?.teacherId)

    const sanitizedQuestions = (paper.questions || []).map((q, idx) => ({
      id: q.id,
      questionOrder: q.questionOrder || idx + 1,
      content: q.content,
      type: q.type,
      difficulty: q.difficulty,
      points: q.points || 1,
      answers: q.type === 'ESSAY' ? [] : (q.answers || []).map((a) => ({ id: a.id, content: a.content })),
    }))

    return wait({
      paperId: paper.id,
      examCode: paper.examCode,
      title: matrix?.title || 'Đề thi',
      subjectName: subject?.name || '',
      examType: matrix?.examType || 'OBJECTIVE',
      duration: matrix?.duration || 45,
      totalQuestions: sanitizedQuestions.length,
      teacherName: teacher?.fullName || '',
      accessType: paper.accessType || 'PUBLIC',
      questions: sanitizedQuestions,
    })
  },
  async startExamAttempt(paperId) {
    const db = read(); const currentUser = JSON.parse(localStorage.getItem('exam_current_user') || '{}')
    const paper = db.papers.find((p) => p.id === paperId)
    if (!paper) return fail('Không tìm thấy đề thi')
    const matrix = db.matrices.find((m) => m.id === paper.matrixId)

    let attempt = db.attempts.find((a) => a.studentId === currentUser.id && a.paperId === paperId)
    if (attempt) {
      if (attempt.status === 'IN_PROGRESS') {
        const elapsed = (Date.now() - new Date(attempt.startedAt).getTime()) / 1000
        const durationSeconds = (matrix?.duration || 45) * 60
        const remaining = Math.max(0, Math.round(durationSeconds - elapsed))
        return wait({ attemptId: attempt.id, startedAt: attempt.startedAt, durationMinutes: matrix?.duration || 45, remainingSeconds: remaining, status: attempt.status })
      }
      return fail('Bạn đã hoàn thành bài thi này')
    }

    const durationMinutes = matrix?.duration || 45
    const totalPoints = (paper.questions || []).reduce((sum, q) => sum + (Number(q.points) || 1), 0)
    attempt = {
      id: newId(),
      paperId,
      studentId: currentUser.id,
      teacherId: matrix?.teacherId,
      status: 'IN_PROGRESS',
      startedAt: new Date().toISOString(),
      maxScore: totalPoints || 10,
      score: null,
      answers: {},
    }
    db.attempts.push(attempt)
    write(db)
    return wait({ attemptId: attempt.id, startedAt: attempt.startedAt, durationMinutes, remainingSeconds: durationMinutes * 60, status: 'IN_PROGRESS' })
  },
  async saveAttemptAnswer(attemptId, body) {
    const db = read()
    const attempt = db.attempts.find((a) => a.id === attemptId)
    if (!attempt || attempt.status !== 'IN_PROGRESS') return fail('Không thể lưu câu trả lời')
    attempt.answers[body.questionId] = {
      selectedAnswerIds: body.selectedAnswerIds || [],
      essayAnswer: body.essayAnswer || null,
    }
    write(db)
    return wait({ success: true }, 80)
  },
  async submitExamAttempt(attemptId) {
    const db = read()
    const attempt = db.attempts.find((a) => a.id === attemptId)
    if (!attempt) return fail('Không tìm thấy bài thi')
    const paper = db.papers.find((p) => p.id === attempt.paperId)
    const matrix = db.matrices.find((m) => m.id === paper?.matrixId)

    attempt.submittedAt = new Date().toISOString()
    let hasEssay = false
    let totalScore = 0

    const gradedAnswers = (paper?.questions || []).map((q, idx) => {
      const studentAns = attempt.answers[q.id] || {}
      if (q.type === 'ESSAY') {
        hasEssay = true
        return {
          questionId: q.id,
          questionOrder: idx + 1,
          content: q.content,
          type: q.type,
          points: q.points || 1,
          essayAnswer: studentAns.essayAnswer || null,
          selectedAnswerIds: [],
          awardedScore: null,
          feedback: null,
          isCorrect: null,
        }
      }
      const correctIds = (q.answers || []).filter((a) => a.isCorrect).map((a) => a.id)
      const selected = studentAns.selectedAnswerIds || []
      const isCorrect = correctIds.length > 0 && correctIds.length === selected.length && correctIds.every((id) => selected.includes(id))
      const pts = isCorrect ? (Number(q.points) || 1) : 0
      totalScore += pts
      return {
        questionId: q.id,
        questionOrder: idx + 1,
        content: q.content,
        type: q.type,
        points: q.points || 1,
        essayAnswer: null,
        selectedAnswerIds: selected,
        awardedScore: pts,
        feedback: null,
        isCorrect,
      }
    })

    if (hasEssay) {
      attempt.status = 'WAITING_GRADING'
      attempt.score = null
    } else {
      attempt.status = 'COMPLETED'
      attempt.score = totalScore
      attempt.gradedAt = new Date().toISOString()
    }
    attempt.gradedAnswers = gradedAnswers
    write(db)

    const subject = db.subjects.find((s) => s.id === matrix?.subjectId)
    return wait({
      attemptId: attempt.id,
      paperId: paper?.id,
      examCode: paper?.examCode,
      paperTitle: matrix?.title,
      subjectName: subject?.name,
      examType: matrix?.examType,
      status: attempt.status,
      score: attempt.score,
      maxScore: attempt.maxScore,
      startedAt: attempt.startedAt,
      submittedAt: attempt.submittedAt,
      gradedAt: attempt.gradedAt,
      answers: gradedAnswers,
    })
  },
  async getAttemptResult(attemptId) {
    const db = read()
    const attempt = db.attempts.find((a) => a.id === attemptId)
    if (!attempt) return fail('Không tìm thấy kết quả bài thi')
    const paper = db.papers.find((p) => p.id === attempt.paperId)
    const matrix = db.matrices.find((m) => m.id === paper?.matrixId)
    const subject = db.subjects.find((s) => s.id === matrix?.subjectId)

    const isCompleted = attempt.status === 'COMPLETED'
    const answers = (attempt.gradedAnswers || []).map((a) => ({
      ...a,
      awardedScore: isCompleted ? a.awardedScore : null,
      feedback: isCompleted ? a.feedback : null,
      isCorrect: isCompleted ? a.isCorrect : null,
    }))

    return wait({
      attemptId: attempt.id,
      paperId: paper?.id,
      examCode: paper?.examCode,
      paperTitle: matrix?.title,
      subjectName: subject?.name,
      examType: matrix?.examType,
      status: attempt.status,
      score: isCompleted ? attempt.score : null,
      maxScore: attempt.maxScore,
      startedAt: attempt.startedAt,
      submittedAt: attempt.submittedAt,
      gradedAt: attempt.gradedAt,
      answers,
    })
  },
  async getPendingGrading(params = {}) {
    const db = read(); const currentUser = JSON.parse(localStorage.getItem('exam_current_user') || '{}')
    const pending = db.attempts.filter((a) => a.status === 'WAITING_GRADING' && (currentUser.role === 'ADMIN' || a.teacherId === currentUser.id)).map((a) => {
      const student = db.users.find((u) => u.id === a.studentId)
      const paper = db.papers.find((p) => p.id === a.paperId)
      const matrix = db.matrices.find((m) => m.id === paper?.matrixId)
      return {
        attemptId: a.id,
        paperId: a.paperId,
        paperTitle: matrix?.title || 'Đề thi',
        studentId: a.studentId,
        studentName: student?.fullName || 'Học sinh',
        studentEmail: student?.email || '',
        submittedAt: a.submittedAt,
        status: a.status,
        examType: matrix?.examType || 'ESSAY',
      }
    })
    return wait(page(pending, params))
  },
  async getGradingAttempt(attemptId) {
    const db = read()
    const attempt = db.attempts.find((a) => a.id === attemptId)
    if (!attempt) return fail('Không tìm thấy bài thi')
    const paper = db.papers.find((p) => p.id === attempt.paperId)
    const matrix = db.matrices.find((m) => m.id === paper?.matrixId)
    const student = db.users.find((u) => u.id === attempt.studentId)

    const answers = (paper?.questions || []).map((q, idx) => {
      const existing = (attempt.gradedAnswers || []).find((ans) => ans.questionId === q.id) || {}
      return {
        attemptAnswerId: existing.questionId || q.id,
        questionId: q.id,
        questionOrder: idx + 1,
        content: q.content,
        type: q.type,
        points: q.points || 1,
        essayAnswer: existing.essayAnswer || (attempt.answers[q.id]?.essayAnswer) || null,
        referenceAnswer: q.referenceAnswer || null,
        selectedAnswerIds: existing.selectedAnswerIds || (attempt.answers[q.id]?.selectedAnswerIds) || [],
        awardedScore: existing.awardedScore != null ? existing.awardedScore : null,
        feedback: existing.feedback || '',
        isCorrect: existing.isCorrect,
      }
    })

    return wait({
      attemptId: attempt.id,
      paperId: paper?.id,
      paperTitle: matrix?.title,
      studentId: student?.id,
      studentName: student?.fullName,
      studentEmail: student?.email,
      submittedAt: attempt.submittedAt,
      status: attempt.status,
      examType: matrix?.examType,
      score: attempt.score,
      maxScore: attempt.maxScore,
      answers,
    })
  },
  async gradeAttemptAnswer(attemptId, attemptAnswerId, body) {
    const db = read()
    const attempt = db.attempts.find((a) => a.id === attemptId)
    if (!attempt) return fail('Không tìm thấy bài thi')
    const ans = (attempt.gradedAnswers || []).find((a) => a.questionId === attemptAnswerId)
    if (ans) {
      ans.awardedScore = Number(body.awardedScore)
      ans.feedback = body.feedback
    }
    write(db)
    return wait({ success: true })
  },
  async completeGrading(attemptId, _body) {
    const db = read()
    const attempt = db.attempts.find((a) => a.id === attemptId)
    if (!attempt) return fail('Không tìm thấy bài thi')
    const sum = (attempt.gradedAnswers || []).reduce((acc, a) => acc + (Number(a.awardedScore) || 0), 0)
    attempt.score = sum
    attempt.status = 'COMPLETED'
    attempt.gradedAt = new Date().toISOString()
    write(db)
    return wait({ success: true })
  },
  async updatePaperAccess(id, body) {
    const db = read()
    const paper = db.papers.find((p) => p.id === id)
    if (!paper) return fail('Không tìm thấy đề thi')
    if (body.accessType) paper.accessType = body.accessType
    if (body.isPublished !== undefined) paper.isPublished = body.isPublished
    write(db)
    return wait(normalizePaper(paper))
  },
  async previewImportQuestions(formData) {
    const file = formData.get('file')
    if (!file) return fail('File import không được để trống')
    const name = file.name || 'import.docx'
    if (name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg')) {
      return fail('Tính năng nhận diện từ ảnh hiện chưa được hỗ trợ do yêu cầu nghiêm ngặt không sử dụng dịch vụ AI / Cloud OCR bên ngoài.')
    }
    return wait({
      fileName: name,
      totalParsed: 2,
      validCount: 2,
      errorCount: 0,
      items: [
        {
          itemIndex: 1,
          chapterId: 1,
          chapterName: 'Hàm số và đồ thị',
          content: 'Nghiệm của phương trình 2x - 4 = 0 là gì?',
          difficulty: 'EASY',
          type: 'SINGLE_CHOICE',
          answers: [{ content: 'x = 2', isCorrect: true }, { content: 'x = -2', isCorrect: false }],
          valid: true,
          errors: [],
        },
        {
          itemIndex: 2,
          chapterId: 1,
          chapterName: 'Hàm số và đồ thị',
          content: 'Hãy giải thích định nghĩa tiệm cận đứng của đồ thị hàm số.',
          difficulty: 'MEDIUM',
          type: 'ESSAY',
          referenceAnswer: 'Đường thẳng x = x₀ là tiệm cận đứng nếu ít nhất một trong các giới hạn một bên khi x dần tới x₀ là vô cực.',
          answers: [],
          valid: true,
          errors: [],
        },
      ],
    })
  },
  async confirmImportQuestions(body) {
    const db = read(); const currentUser = JSON.parse(localStorage.getItem('exam_current_user') || '{}')
    const saved = (body.items || []).map((item) => {
      const q = {
        id: newId(),
        chapterId: Number(item.chapterId),
        teacherId: currentUser.id,
        content: item.content,
        difficulty: item.difficulty,
        type: item.type,
        referenceAnswer: item.referenceAnswer || null,
        answers: item.type === 'ESSAY' ? [] : (item.answers || []).map((a) => ({ id: newId(), content: a.content, isCorrect: Boolean(a.isCorrect) })),
        createdAt: new Date().toISOString(),
      }
      db.questions.push(q)
      return q
    })
    write(db)
    return wait(saved)
  },
}
