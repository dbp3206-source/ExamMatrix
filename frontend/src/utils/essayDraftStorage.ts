const DRAFT_PREFIX = 'exam_essay_draft_v1:'

export interface EssayDraftRecord {
  userId: string
  attemptId: string
  questionId: string
  revision: number
  text: string
  updatedAt: number
}

function buildKey(userId: string, attemptId: string, questionId: string): string {
  return `${DRAFT_PREFIX}${userId}:${attemptId}:${questionId}`
}

export function saveEssayDraft(record: EssayDraftRecord): void {
  try {
    if (!record.userId || !record.attemptId || !record.questionId) return
    sessionStorage.setItem(buildKey(record.userId, record.attemptId, record.questionId), JSON.stringify(record))
  } catch {

  }
}

export function clearEssayDraft(userId: string, attemptId: string, questionId: string): void {
  try {
    if (!userId || !attemptId || !questionId) return
    sessionStorage.removeItem(buildKey(userId, attemptId, questionId))
  } catch {

  }
}

export function clearAttemptEssayDrafts(userId: string, attemptId: string): void {
  try {
    if (!userId || !attemptId) return
    const prefix = `${DRAFT_PREFIX}${userId}:${attemptId}:`
    const keys: string[] = []
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i)
      if (k && k.startsWith(prefix)) keys.push(k)
    }
    keys.forEach((k) => sessionStorage.removeItem(k))
  } catch {

  }
}

export function clearAllEssayDrafts(): void {
  try {
    const keys: string[] = []
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i)
      if (k && k.startsWith(DRAFT_PREFIX)) keys.push(k)
    }
    keys.forEach((k) => sessionStorage.removeItem(k))
  } catch {

  }
}

export function loadAttemptEssayDrafts(userId: string, attemptId: string): Record<string, EssayDraftRecord> {
  const result: Record<string, EssayDraftRecord> = {}
  try {
    if (!userId || !attemptId) return result
    const prefix = `${DRAFT_PREFIX}${userId}:${attemptId}:`
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i)
      if (!k || !k.startsWith(prefix)) continue
      const raw = sessionStorage.getItem(k)
      if (!raw) continue
      const parsed = JSON.parse(raw) as EssayDraftRecord
      if (parsed && parsed.userId === userId && parsed.attemptId === attemptId && parsed.questionId) {
        result[parsed.questionId] = parsed
      }
    }
  } catch {

  }
  return result
}
