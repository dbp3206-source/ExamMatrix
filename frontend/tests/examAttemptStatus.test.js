import test from 'node:test'
import assert from 'node:assert/strict'
import {
  classifyAttemptStatus,
  isAttemptCancelledError,
  isAttemptClosedError,
  isCancelledAttemptStatus,
  isSubmittedAttemptStatus,
} from '../src/utils/examAttemptStatus.ts'

test('only SUBMITTED, WAITING_GRADING, COMPLETED confirm submission', () => {
  assert.equal(isSubmittedAttemptStatus('SUBMITTED'), true)
  assert.equal(isSubmittedAttemptStatus('WAITING_GRADING'), true)
  assert.equal(isSubmittedAttemptStatus('COMPLETED'), true)
  assert.equal(isSubmittedAttemptStatus('IN_PROGRESS'), false)
  assert.equal(isSubmittedAttemptStatus('CANCELLED'), false)
  assert.equal(isSubmittedAttemptStatus(null), false)
  assert.equal(isSubmittedAttemptStatus(undefined), false)
  assert.equal(isSubmittedAttemptStatus(''), false)
  assert.equal(isSubmittedAttemptStatus('WEIRD_STATE'), false)
})

test('classifyAttemptStatus distinguishes IN_PROGRESS, SUBMITTED, CANCELLED, and UNKNOWN', () => {
  assert.equal(classifyAttemptStatus('IN_PROGRESS'), 'IN_PROGRESS')
  assert.equal(classifyAttemptStatus('SUBMITTED'), 'SUBMITTED')
  assert.equal(classifyAttemptStatus('WAITING_GRADING'), 'SUBMITTED')
  assert.equal(classifyAttemptStatus('COMPLETED'), 'SUBMITTED')
  assert.equal(classifyAttemptStatus('CANCELLED'), 'CANCELLED')
  assert.equal(isCancelledAttemptStatus('CANCELLED'), true)
  assert.equal(classifyAttemptStatus(undefined), 'UNKNOWN')
  assert.equal(classifyAttemptStatus(''), 'UNKNOWN')
  assert.equal(classifyAttemptStatus('EXPIRED'), 'UNKNOWN')
})

test('409 and cancelled messages are detected as closed/cancelled errors', () => {
  assert.equal(isAttemptClosedError({ status: 409, message: 'Lượt làm bài đã bị hủy' }), true)
  assert.equal(isAttemptCancelledError({ status: 409, message: 'Lượt làm bài đã bị hủy' }), true)
  assert.equal(isAttemptClosedError({ status: 400, message: 'Bài thi đã nộp trước đó' }), true)
  assert.equal(isAttemptCancelledError({ status: 400, message: 'Bài thi đã nộp trước đó' }), false)
  assert.equal(isAttemptClosedError({ status: 500, message: 'Lỗi máy chủ' }), false)
})
