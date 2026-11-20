import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildGenerationRequestKey,
  clearPendingGenerationRequest,
  findAnyPendingGenerationRequest,
  loadPendingGenerationRequest,
  savePendingGenerationRequest,
} from '../src/utils/generationRequestStorage.js'

function createMemoryStorage() {
  const map = new Map()
  return {
    get length() {
      return map.size
    },
    key: (index) => Array.from(map.keys())[index] ?? null,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  }
}

test('persists and restores pendingRequestId keyed by user, matrix, count, and advice hash', () => {
  const storage = createMemoryStorage()
  const scopeA = { userId: 'u1', matrixId: 'm1', numberOfPapers: 4, adviceDecisionHash: 'ORIGINAL' }
  const scopeB = { userId: 'u1', matrixId: 'm1', numberOfPapers: 4, adviceDecisionHash: 'ADVICE:v1' }

  assert.notEqual(buildGenerationRequestKey(scopeA), buildGenerationRequestKey(scopeB))

  savePendingGenerationRequest(scopeA, { requestId: 'uuid-1234', message: 'Network timeout' }, storage)
  const restoredA = loadPendingGenerationRequest(scopeA, storage)
  const restoredB = loadPendingGenerationRequest(scopeB, storage)

  assert.equal(restoredA?.requestId, 'uuid-1234')
  assert.equal(restoredA?.message, 'Network timeout')
  assert.equal(restoredB, null)

  clearPendingGenerationRequest(scopeA, storage)
  assert.equal(loadPendingGenerationRequest(scopeA, storage), null)
})

test('findAnyPendingGenerationRequest restores ADVICE pending request with adjustment and snapshotVersion across reload', () => {
  const storage = createMemoryStorage()
  const adviceScope = {
    userId: 'u1',
    matrixId: 'm1',
    numberOfPapers: 3,
    adviceDecisionHash: 'ADVICE:snap1:10-11-MEDIUM',
  }
  const adjustment = { increaseChapterId: 10, decreaseChapterId: 11, difficulty: 'MEDIUM' }

  savePendingGenerationRequest(
    adviceScope,
    {
      requestId: 'uuid-advice-99',
      adviceAdjustment: adjustment,
      snapshotVersion: 'snap1',
      message: '504 Gateway Timeout',
    },
    storage
  )

  const found = findAnyPendingGenerationRequest({ userId: 'u1', matrixId: 'm1', numberOfPapers: 3 }, storage)
  assert.equal(found?.requestId, 'uuid-advice-99')
  assert.equal(found?.adviceDecisionHash, 'ADVICE:snap1:10-11-MEDIUM')
  assert.equal(found?.snapshotVersion, 'snap1')
  assert.deepEqual(found?.adviceAdjustment, adjustment)

  assert.equal(findAnyPendingGenerationRequest({ userId: 'u1', matrixId: 'm1', numberOfPapers: 4 }, storage), null)
})
