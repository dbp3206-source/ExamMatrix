import type { ApiErrorShape } from '@/types/domain'

export const CONFIRMED_SUBMITTED_STATUSES = Object.freeze([
  'SUBMITTED',
  'WAITING_GRADING',
  'COMPLETED',
] as const)

export type ClassifiedAttemptStatus = 'IN_PROGRESS' | 'SUBMITTED' | 'CANCELLED' | 'UNKNOWN'

export function isSubmittedAttemptStatus(status: unknown): boolean {
  return (
    typeof status === 'string' &&
    (CONFIRMED_SUBMITTED_STATUSES as readonly string[]).includes(status)
  )
}

export function isCancelledAttemptStatus(status: unknown): boolean {
  return status === 'CANCELLED'
}

export function isInProgressAttemptStatus(status: unknown): boolean {
  return status === 'IN_PROGRESS'
}

export function classifyAttemptStatus(status: unknown): ClassifiedAttemptStatus {
  if (isInProgressAttemptStatus(status)) return 'IN_PROGRESS'
  if (isSubmittedAttemptStatus(status)) return 'SUBMITTED'
  if (isCancelledAttemptStatus(status)) return 'CANCELLED'
  return 'UNKNOWN'
}

export function isAttemptClosedError(error: unknown): boolean {
  const err = error as ApiErrorShape | null | undefined
  const status = err?.status ?? err?.response?.status
  const message = String(err?.message || err?.response?.data?.message || '')
  if (status === 409) return true
  if (
    status === 400 &&
    /đã nộp|hết thời gian|đã bị hủy|không còn ở trạng thái|hủy/i.test(message)
  ) {
    return true
  }
  return false
}

export function isAttemptCancelledError(error: unknown): boolean {
  const err = error as ApiErrorShape | null | undefined
  const status = err?.status ?? err?.response?.status
  const message = String(err?.message || err?.response?.data?.message || '')
  if (status === 409 && /hủy|cancelled/i.test(message)) return true
  if (status === 400 && /đã bị hủy|cancelled/i.test(message)) return true
  return false
}
