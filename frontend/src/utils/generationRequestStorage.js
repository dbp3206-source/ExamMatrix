const STORAGE_PREFIX = 'exam_matrix_pending_gen_req_v1'

export function buildGenerationRequestPrefix({ userId, matrixId, numberOfPapers }) {
  const safeUser = userId != null && String(userId).trim() ? String(userId).trim() : 'anon'
  const safeMatrix = matrixId != null ? String(matrixId).trim() : ''
  const safeCount = Number(numberOfPapers) || 0
  return `${STORAGE_PREFIX}:${safeUser}:${safeMatrix}:${safeCount}:`
}

export function buildGenerationRequestKey({ userId, matrixId, numberOfPapers, adviceDecisionHash = 'ORIGINAL' }) {
  const safeAdvice = adviceDecisionHash ? String(adviceDecisionHash) : 'ORIGINAL'
  return `${buildGenerationRequestPrefix({ userId, matrixId, numberOfPapers })}${safeAdvice}`
}

export function getStorage(customStorage) {
  if (customStorage) return customStorage
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      return window.sessionStorage
    }
  } catch {
    return null
  }
  return null
}

export function loadPendingGenerationRequest(params, customStorage) {
  const storage = getStorage(customStorage)
  if (!storage) return null
  const key = buildGenerationRequestKey(params)
  try {
    const raw = storage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed.requestId !== 'string' || !parsed.requestId.trim()) {
      storage.removeItem(key)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function findAnyPendingGenerationRequest(params, customStorage) {
  const storage = getStorage(customStorage)
  if (!storage || typeof storage.length !== 'number' || typeof storage.key !== 'function') {
    return loadPendingGenerationRequest({ ...params, adviceDecisionHash: 'ORIGINAL' }, customStorage)
  }
  const prefix = buildGenerationRequestPrefix(params)
  let latest = null
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i)
    if (!key || !key.startsWith(prefix)) continue
    try {
      const raw = storage.getItem(key)
      if (!raw) continue
      const parsed = JSON.parse(raw)
      if (!parsed || typeof parsed.requestId !== 'string' || !parsed.requestId.trim()) {
        storage.removeItem(key)
        continue
      }
      if (!latest || (parsed.updatedAt || 0) > (latest.updatedAt || 0)) {
        latest = parsed
      }
    } catch {
      continue
    }
  }
  return latest
}

export function savePendingGenerationRequest(params, payload, customStorage) {
  const storage = getStorage(customStorage)
  if (!storage) return
  const key = buildGenerationRequestKey(params)
  try {
    storage.setItem(
      key,
      JSON.stringify({
        requestId: payload.requestId,
        numberOfPapers: Number(params.numberOfPapers),
        adviceDecisionHash: params.adviceDecisionHash || 'ORIGINAL',
        adviceAdjustment: payload.adviceAdjustment || null,
        snapshotVersion: payload.snapshotVersion || null,
        message: payload.message || null,
        updatedAt: Date.now(),
      })
    )
  } catch {
    return
  }
}

export function clearPendingGenerationRequest(params, customStorage) {
  const storage = getStorage(customStorage)
  if (!storage) return
  const key = buildGenerationRequestKey(params)
  try {
    storage.removeItem(key)
  } catch {
    return
  }
}
