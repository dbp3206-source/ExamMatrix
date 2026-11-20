import test from 'node:test'
import assert from 'node:assert/strict'
import { displayedSeconds, examDeadline } from '../src/utils/examClock.js'

test('an integer minute stays at 60 during the first fraction of a second', () => {
  const receivedAt = 10_000
  const deadline = examDeadline(60, receivedAt)
  assert.equal(displayedSeconds(deadline, receivedAt + 230), 60)
  assert.equal(displayedSeconds(deadline, receivedAt + 1000), 59)
  assert.equal(displayedSeconds(deadline, deadline - 1), 1)
  assert.equal(displayedSeconds(deadline, deadline), 0)
  assert.equal(displayedSeconds(deadline, deadline + 1000), 0)
})

test('hydration time counts against the countdown from receipt', () => {
  const deadline = examDeadline(7, 20_000)
  assert.equal(displayedSeconds(deadline, 25_800), 2)
  assert.equal(displayedSeconds(deadline, 29_000), 0)
})

test('an expired response differs from missing and invalid time', () => {
  assert.equal(displayedSeconds(examDeadline(0, 9000), 9000), 0)
  for (const value of [null, undefined, '', -1, Infinity, 'invalid']) {
    assert.throws(() => examDeadline(value, 9000), /Máy chủ/)
  }
})
