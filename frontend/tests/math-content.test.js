import assert from 'node:assert/strict'
import test from 'node:test'
import { convertAsciiMathToLatex, parseContentTokens } from '../src/lib/math-content.js'

test('preserves ambiguous notation and prose verbatim', () => {
  for (const value of ['a+b/c', 'TCP/IP', '2026-11-23']) {
    assert.deepEqual(parseContentTokens(value), [{ type: 'text', value }])
  }
})

test('retains decimal operands and integral bounds', () => {
  assert.deepEqual(parseContentTokens('1.5/2'), [{ type: 'ascii-math', value: '1.5/2' }])
  assert.equal(convertAsciiMathToLatex('1.5/2'), '\\frac{1.5}{2}')
  assert.equal(convertAsciiMathToLatex('∫₀¹'), '\\int_{0}^{1} ')
})

test('reads legacy notation alongside explicit display LaTeX', () => {
  const tokens = parseContentTokens('x² và $$y=2$$')
  assert.deepEqual(tokens.map(token => token.type), ['ascii-math', 'text', 'latex'])
  assert.equal(tokens[2].value, 'y=2')
  assert.equal(tokens[2].display, true)
})
