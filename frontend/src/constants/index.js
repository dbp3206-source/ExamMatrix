export const DIFFICULTIES = [
  {
    value: 'EASY',
    label: 'Dễ',
    shortLabel: 'Dễ',
    order: 1,
    color: '#059669',
    bgClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    dotClass: 'bg-emerald-600',
    desc: 'Mức độ khó của câu hỏi: dễ',
  },
  {
    value: 'MEDIUM',
    label: 'Trung bình',
    shortLabel: 'TB',
    order: 2,
    color: '#0284C7',
    bgClass: 'bg-sky-50 text-sky-800 border-sky-200',
    dotClass: 'bg-sky-600',
    desc: 'Mức độ khó của câu hỏi: trung bình',
  },
  {
    value: 'HARD',
    label: 'Khó',
    shortLabel: 'Khó',
    order: 3,
    color: '#D97706',
    bgClass: 'bg-amber-50 text-amber-900 border-amber-300',
    dotClass: 'bg-amber-600',
    desc: 'Mức độ khó của câu hỏi: khó',
  },
]

export const QUESTION_TYPES = [
  { value: 'SINGLE_CHOICE', label: 'Trắc nghiệm 1 đáp án', shortLabel: '1 đáp án' },
  { value: 'MULTIPLE_CHOICE', label: 'Trắc nghiệm nhiều đáp án', shortLabel: 'Nhiều đáp án' },
  { value: 'TRUE_FALSE', label: 'Đúng / Sai', shortLabel: 'Đúng / Sai' },
  { value: 'ESSAY', label: 'Tự luận', shortLabel: 'Tự luận' },
]

export const EXAM_TYPES = [
  { value: 'OBJECTIVE', label: 'Trắc nghiệm' },
  { value: 'ESSAY', label: 'Tự luận' },
]

export const difficultyLabel = (value) => DIFFICULTIES.find((item) => item.value === value)?.label || value
export const difficultyShort = (value) => DIFFICULTIES.find((item) => item.value === value)?.shortLabel || value
export const difficultyMeta = (value) =>
  DIFFICULTIES.find((item) => item.value === value) || {
    value,
    label: value || '—',
    shortLabel: value || '—',
    color: '#64748B',
    bgClass: 'bg-slate-100 text-slate-700 border-slate-200',
    dotClass: 'bg-slate-500',
  }

export const typeLabel = (value) => QUESTION_TYPES.find((item) => item.value === value)?.label || value
export const typeShortLabel = (value) => QUESTION_TYPES.find((item) => item.value === value)?.shortLabel || value
export const examTypeLabel = (value) => EXAM_TYPES.find((item) => item.value === (value || 'OBJECTIVE'))?.label || value

export const roleLabel = (value) => {
  if (value === 'ADMIN') return 'Quản trị viên'
  if (value === 'STUDENT') return 'Học sinh'
  return 'Giáo viên bộ môn'
}

export const REQUEST_STATUSES = [
  { value: 'PENDING', label: 'Chờ duyệt', tone: 'warning' },
  { value: 'APPROVED', label: 'Đã duyệt', tone: 'success' },
  { value: 'REJECTED', label: 'Đã từ chối', tone: 'danger' },
  { value: 'REVOKED', label: 'Đã thu hồi', tone: 'neutral' },
]
export const requestStatusMeta = (val) => REQUEST_STATUSES.find((s) => s.value === val) || { label: val || '—', tone: 'neutral' }

export const ATTEMPT_STATUSES = [
  { value: 'AVAILABLE', label: 'Chưa làm', tone: 'neutral' },
  { value: 'IN_PROGRESS', label: 'Đang làm', tone: 'warning' },
  { value: 'SUBMITTED', label: 'Đã nộp', tone: 'warning' },
  { value: 'WAITING_GRADING', label: 'Chờ chấm', tone: 'warning' },
  { value: 'COMPLETED', label: 'Hoàn thành', tone: 'success' },
  { value: 'CANCELLED', label: 'Đã hủy', tone: 'danger' },
]
export const attemptStatusMeta = (val) => ATTEMPT_STATUSES.find((s) => s.value === val) || { label: val || '—', tone: 'neutral' }

export function scoreCardTone(score, maxScore) {
  if (
    score == null ||
    maxScore == null ||
    String(score).trim() === '' ||
    String(maxScore).trim() === '' ||
    Number(maxScore) <= 0 ||
    Number.isNaN(Number(score)) ||
    Number.isNaN(Number(maxScore))
  ) {
    return {
      tone: 'neutral',
      box: 'border-slate-200 bg-slate-50',
      label: 'text-slate-600',
      value: 'text-slate-900',
      denom: 'text-slate-500',
      scale: 'text-slate-700',
    }
  }
  const ratio = Number(score) / Number(maxScore)
  if (ratio >= 0.5) {
    return {
      tone: 'success',
      box: 'border-emerald-200 bg-emerald-50/70',
      label: 'text-emerald-800',
      value: 'text-emerald-900',
      denom: 'text-emerald-700',
      scale: 'text-emerald-800',
    }
  }
  if (ratio > 0) {
    return {
      tone: 'warning',
      box: 'border-amber-200 bg-amber-50/70',
      label: 'text-amber-800',
      value: 'text-amber-900',
      denom: 'text-amber-700',
      scale: 'text-amber-800',
    }
  }
  return {
    tone: 'danger',
    box: 'border-rose-200 bg-rose-50/70',
    label: 'text-rose-800',
    value: 'text-rose-900',
    denom: 'text-rose-700',
    scale: 'text-rose-800',
  }
}

export const SUBJECT_PRESETS = {
  MATH: {
    key: 'math',
    iconName: 'Calculator',
    light: '#EEF2FF',
    medium: '#4F46E5',
    dark: '#312E81',
    badgeClass: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    iconBgClass: 'bg-indigo-100 text-indigo-700',
  },
  PHYS: {
    key: 'phys',
    iconName: 'Atom',
    light: '#ECFEFF',
    medium: '#0891B2',
    dark: '#164E63',
    badgeClass: 'bg-cyan-50 text-cyan-800 border-cyan-200',
    iconBgClass: 'bg-cyan-100 text-cyan-700',
  },
  CHEM: {
    key: 'chem',
    iconName: 'FlaskConical',
    light: '#F0FDFA',
    medium: '#0D9488',
    dark: '#115E59',
    badgeClass: 'bg-teal-50 text-teal-800 border-teal-200',
    iconBgClass: 'bg-teal-100 text-teal-700',
  },
  BIO: {
    key: 'bio',
    iconName: 'Dna',
    light: '#ECFDF5',
    medium: '#059669',
    dark: '#065F46',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    iconBgClass: 'bg-emerald-100 text-emerald-700',
  },
  HIST: {
    key: 'hist',
    iconName: 'Landmark',
    light: '#FFFBEB',
    medium: '#D97706',
    dark: '#92400E',
    badgeClass: 'bg-amber-50 text-amber-900 border-amber-200',
    iconBgClass: 'bg-amber-100 text-amber-800',
  },
  ENG: {
    key: 'eng',
    iconName: 'Languages',
    light: '#F0F9FF',
    medium: '#0284C7',
    dark: '#075985',
    badgeClass: 'bg-sky-50 text-sky-800 border-sky-200',
    iconBgClass: 'bg-sky-100 text-sky-700',
  },
  LIT: {
    key: 'lit',
    iconName: 'BookOpenText',
    light: '#FFF1F2',
    medium: '#E11D48',
    dark: '#881337',
    badgeClass: 'bg-rose-50 text-rose-800 border-rose-200',
    iconBgClass: 'bg-rose-100 text-rose-700',
  },
  GEO: {
    key: 'geo',
    iconName: 'Globe',
    light: '#F7FEE7',
    medium: '#65A30D',
    dark: '#3F6212',
    badgeClass: 'bg-lime-50 text-lime-800 border-lime-200',
    iconBgClass: 'bg-lime-100 text-lime-700',
  },
  CS: {
    key: 'cs',
    iconName: 'Cpu',
    light: '#F5F3FF',
    medium: '#7C3AED',
    dark: '#4C1D95',
    badgeClass: 'bg-violet-50 text-violet-800 border-violet-200',
    iconBgClass: 'bg-violet-100 text-violet-700',
  },
}

const DEFAULT_SUBJECT_PRESET = {
  key: 'default',
  iconName: 'BookOpen',
  light: '#F8FAFC',
  medium: '#475569',
  dark: '#1E293B',
  badgeClass: 'bg-slate-100 text-slate-800 border-slate-200',
  iconBgClass: 'bg-slate-100 text-slate-700',
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
}

export function getSubjectPreset(codeOrName, optionalName = '') {
  const combined = `${normalizeText(codeOrName)} ${normalizeText(optionalName)}`.trim()
  if (!combined) return DEFAULT_SUBJECT_PRESET
  if (/\b(math|toan|giai tich|dai so|hinh hoc)\b/.test(combined) || combined.includes('toan')) return SUBJECT_PRESETS.MATH
  if (/\b(phys|vat ly|vatli|ly)\b/.test(combined) || combined.includes('vat ly')) return SUBJECT_PRESETS.PHYS
  if (/\b(chem|hoa hoc|hoa)\b/.test(combined) || combined.includes('hoa')) return SUBJECT_PRESETS.CHEM
  if (/\b(bio|sinh hoc|sinh)\b/.test(combined) || combined.includes('sinh')) return SUBJECT_PRESETS.BIO
  if (/\b(hist|lich su|su)\b/.test(combined) || combined.includes('lich su')) return SUBJECT_PRESETS.HIST
  if (/\b(eng|tieng anh|anh van|ngoai ngu)\b/.test(combined) || combined.includes('tieng anh')) return SUBJECT_PRESETS.ENG
  if (/\b(lit|ngu van|van hoc)\b/.test(combined) || combined.includes('ngu van')) return SUBJECT_PRESETS.LIT
  if (/\b(geo|dia ly)\b/.test(combined) || combined.includes('dia ly')) return SUBJECT_PRESETS.GEO
  if (/\b(cs|it|tin hoc|java|oop|lap trinh)\b/.test(combined) || combined.includes('tin hoc')) return SUBJECT_PRESETS.CS
  return DEFAULT_SUBJECT_PRESET
}
