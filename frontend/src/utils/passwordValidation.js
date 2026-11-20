export const BCRYPT_MAX_BYTES = 72
export const BCRYPT_MAX_BYTES_MESSAGE = 'Mật khẩu không được vượt quá 72 byte UTF-8'

const utf8Encoder = new TextEncoder()

export function utf8ByteLength(value) {
  if (value == null) return 0
  return utf8Encoder.encode(String(value)).length
}

export function isWithinBcryptLimit(value, { trim = false } = {}) {
  if (value == null) return true
  const normalized = trim ? String(value).trim() : String(value)
  return utf8ByteLength(normalized) <= BCRYPT_MAX_BYTES
}

export function validateBcryptPasswordLength(value, { trim = false } = {}) {
  if (isWithinBcryptLimit(value, { trim })) return true
  const normalized = trim ? String(value ?? '').trim() : String(value ?? '')
  const bytes = utf8ByteLength(normalized)
  return `${BCRYPT_MAX_BYTES_MESSAGE} (hiện tại ${bytes} byte).`
}
