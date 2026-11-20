import test from 'node:test'
import assert from 'node:assert/strict'
import { createSampleDocxBlob } from '../src/utils/docxSample.js'
import { parsePaperCount } from '../src/utils/paperCount.js'
import { isPublicAuthUrl, resolvePostLoginTarget, shouldInvalidateSessionOnAuthError } from '../src/utils/authHelpers.js'
import { DIFFICULTIES, attemptStatusMeta, getSubjectPreset, scoreCardTone } from '../src/constants/index.js'

test('createSampleDocxBlob generates a valid ZIP/DOCX blob containing all 4 question types', async () => {
  const blob = createSampleDocxBlob()
  assert.ok(blob.size > 500)
  const buf = new Uint8Array(await blob.arrayBuffer())
  // ZIP magic PK\x03\x04
  assert.equal(buf[0], 0x50)
  assert.equal(buf[1], 0x4b)
  assert.equal(buf[2], 0x03)
  assert.equal(buf[3], 0x04)

  const text = new TextDecoder().decode(buf)
  assert.ok(text.includes('[Trắc nghiệm]'))
  assert.ok(text.includes('[Nhiều đáp án]'))
  assert.ok(text.includes('[Đúng sai]'))
  assert.ok(text.includes('[Tự luận]'))
  assert.ok(text.includes('Đáp án tham khảo:'))
})

test('getSubjectPreset matches code and Vietnamese subject names', () => {
  assert.equal(getSubjectPreset('MATH', 'Toán học').key, 'math')
  assert.equal(getSubjectPreset('SUB01', 'Vật lý nâng cao').key, 'phys')
  assert.equal(getSubjectPreset('HOA', 'Hóa học hữu cơ').key, 'chem')
  assert.equal(getSubjectPreset('ENG10', 'Tiếng Anh').key, 'eng')
  assert.equal(getSubjectPreset('HIST', 'Lịch sử').key, 'hist')
  assert.equal(getSubjectPreset('BIO', 'Sinh học').key, 'bio')
})

test('DIFFICULTIES only uses EASY, MEDIUM, HARD', () => {
  assert.deepEqual(
    DIFFICULTIES.map((d) => d.value),
    ['EASY', 'MEDIUM', 'HARD']
  )
})

test('attemptStatusMeta returns tone for all attempt statuses', () => {
  assert.equal(attemptStatusMeta('COMPLETED').tone, 'success')
  assert.equal(attemptStatusMeta('IN_PROGRESS').tone, 'warning')
  assert.equal(attemptStatusMeta('WAITING_GRADING').tone, 'warning')
  assert.equal(attemptStatusMeta('AVAILABLE').tone, 'neutral')
})

test('scoreCardTone reflects passing, below-50%, zero, and missing scores', () => {
  assert.equal(scoreCardTone(3, 6).tone, 'success')
  assert.equal(scoreCardTone(6, 6).tone, 'success')
  assert.equal(scoreCardTone(2, 6).tone, 'warning')
  assert.equal(scoreCardTone(0.75, 2).tone, 'warning')
  assert.equal(scoreCardTone(0, 6).tone, 'danger')
  assert.equal(scoreCardTone(null, 6).tone, 'neutral')
  assert.equal(scoreCardTone('', 6).tone, 'neutral')
  assert.equal(scoreCardTone(0, 0).tone, 'neutral')
})

test('parsePaperCount preserves the 1–20 integer contract without coercing invalid input', () => {
  for (const value of ['1', '1.0', ' 2 ', '20']) {
    assert.ok(parsePaperCount(value) >= 1)
    assert.ok(parsePaperCount(value) <= 20)
  }

  for (const value of ['', ' ', '0', '-1', '1.5', '21', '1e3', 'NaN']) {
    assert.equal(parsePaperCount(value), null, `Expected ${JSON.stringify(value)} to be rejected`)
  }
})

test('isPublicAuthUrl matches login, Google challenge, Google login, and register only', () => {
  assert.equal(isPublicAuthUrl('/auth/login'), true)
  assert.equal(isPublicAuthUrl('/auth/google/student/challenge'), true)
  assert.equal(isPublicAuthUrl('/auth/google/student'), true)
  assert.equal(isPublicAuthUrl('/auth/register/student?ref=1'), true)
  assert.equal(isPublicAuthUrl('/auth/me'), false)
  assert.equal(isPublicAuthUrl('/auth/logout'), false)
  assert.equal(isPublicAuthUrl('/auth/password'), false)
})

test('resolvePostLoginTarget routes students to student overview and teachers/admins to main workspace', () => {
  assert.equal(resolvePostLoginTarget('STUDENT', undefined), '/hoc-sinh/tong-quan')
  assert.equal(resolvePostLoginTarget('STUDENT', '/ma-tran'), '/hoc-sinh/tong-quan')
  assert.equal(resolvePostLoginTarget('STUDENT', '/hoc-sinh/de-thi'), '/hoc-sinh/de-thi')
  assert.equal(resolvePostLoginTarget('STUDENT', '/ho-so'), '/ho-so')
  assert.equal(resolvePostLoginTarget('TEACHER', undefined), '/')
  assert.equal(resolvePostLoginTarget('TEACHER', '/hoc-sinh/de-thi'), '/')
  assert.equal(resolvePostLoginTarget('TEACHER', '/ma-tran'), '/ma-tran')
  assert.equal(resolvePostLoginTarget('ADMIN', '/nguoi-dung'), '/nguoi-dung')
})

test('shouldInvalidateSessionOnAuthError only invalidates matching active session on 401/423', () => {
  // Matching active session -> invalidate
  assert.equal(shouldInvalidateSessionOnAuthError({
    activeToken: 'token-a',
    requestToken: 'token-a',
    urlPath: '/dashboard/analytics',
    status: 401,
  }), true)
  assert.equal(shouldInvalidateSessionOnAuthError({
    activeToken: 'token-a',
    requestToken: 'token-a',
    urlPath: '/student/exams',
    status: 423,
  }), true)

  // Stale request from previous login after switching to token-b -> do NOT invalidate
  assert.equal(shouldInvalidateSessionOnAuthError({
    activeToken: 'token-b',
    requestToken: 'token-a',
    urlPath: '/dashboard/analytics',
    status: 401,
  }), false)

  // Delayed 401 after user already logged out (activeToken is null) -> do NOT invalidate/redirect
  assert.equal(shouldInvalidateSessionOnAuthError({
    activeToken: null,
    requestToken: 'token-a',
    urlPath: '/dashboard/analytics',
    status: 401,
  }), false)

  // Public auth endpoints and logout -> do NOT invalidate
  assert.equal(shouldInvalidateSessionOnAuthError({
    activeToken: 'token-a',
    requestToken: 'token-a',
    urlPath: '/auth/login',
    status: 401,
  }), false)
  assert.equal(shouldInvalidateSessionOnAuthError({
    activeToken: 'token-a',
    requestToken: 'token-a',
    urlPath: '/auth/logout',
    status: 401,
  }), false)
})
