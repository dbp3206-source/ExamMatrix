import test from 'node:test'
import assert from 'node:assert/strict'
import {
  BCRYPT_MAX_BYTES,
  isWithinBcryptLimit,
  utf8ByteLength,
  validateBcryptPasswordLength,
} from '../src/utils/passwordValidation.js'

test('ASCII 72 bytes passes and 73 bytes fails BCrypt limit', () => {
  const pass72 = 'a'.repeat(72)
  const pass73 = 'a'.repeat(73)
  assert.equal(utf8ByteLength(pass72), 72)
  assert.equal(isWithinBcryptLimit(pass72), true)
  assert.equal(validateBcryptPasswordLength(pass72), true)

  assert.equal(utf8ByteLength(pass73), 73)
  assert.equal(isWithinBcryptLimit(pass73), false)
  assert.match(String(validateBcryptPasswordLength(pass73)), /72 byte UTF-8/)
})

test('Vietnamese multi-byte UTF-8 characters are measured by byte length, not char count', () => {
  // 'ế' is 3 bytes in UTF-8; 24 * 3 = 72 bytes (passes), 25 * 3 = 75 bytes (fails)
  const vn72 = 'ế'.repeat(24)
  const vn75 = 'ế'.repeat(25)
  assert.equal(vn72.length, 24)
  assert.equal(utf8ByteLength(vn72), BCRYPT_MAX_BYTES)
  assert.equal(validateBcryptPasswordLength(vn72), true)

  assert.equal(vn75.length, 25)
  assert.equal(utf8ByteLength(vn75), 75)
  assert.match(String(validateBcryptPasswordLength(vn75)), /75 byte/)
})

test('trim option mirrors @BcryptPasswordLength(trim = true) for class passwords', () => {
  const padded72 = `  ${'a'.repeat(72)}  `
  assert.equal(isWithinBcryptLimit(padded72, { trim: false }), false)
  assert.equal(isWithinBcryptLimit(padded72, { trim: true }), true)
})
