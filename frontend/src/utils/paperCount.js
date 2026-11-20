export function parsePaperCount(value) {
  if (typeof value !== 'string' || value.trim() === '') return null

  const count = Number(value)
  if (!Number.isSafeInteger(count) || count < 1 || count > 20) return null

  return count
}
