import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadGoogleIdentityScript } from '../src/utils/googleIdentity.js'

test('a timed-out Google SDK load is removed and can be retried', async (t) => {
  const scripts = []
  let timeout
  t.after(() => {
    delete globalThis.window
    delete globalThis.document
  })
  globalThis.window = {
    setTimeout(callback) { timeout = callback; return 1 },
    clearTimeout() {},
  }
  globalThis.document = {
    querySelector: () => scripts.at(-1) ?? null,
    createElement() {
      return {
        dataset: {},
        listeners: {},
        addEventListener(type, listener) { this.listeners[type] = listener },
        remove() { scripts.splice(scripts.indexOf(this), 1) },
      }
    },
    head: { appendChild(script) { scripts.push(script) } },
  }
  const first = loadGoogleIdentityScript()
  timeout()
  await assert.rejects(first, /Quá thời gian/)
  assert.equal(scripts.length, 0)

  const second = loadGoogleIdentityScript()
  assert.notEqual(first, second)
  const id = {}
  window.google = { accounts: { id } }
  scripts[0].listeners.load()
  assert.equal(await second, id)
})
