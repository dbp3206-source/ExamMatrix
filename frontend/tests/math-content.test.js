import assert from 'node:assert/strict'
import test from 'node:test'
import katex from 'katex'
import { convertAsciiMathToLatex, parseContentTokens } from '../src/lib/math-content.js'

test('preserves ambiguous notation and prose verbatim', () => {
  for (const value of ['a+b/c', 'TCP/IP', '2026-11-23']) {
    assert.deepEqual(parseContentTokens(value), [{ type: 'text', value }])
  }
})

test('retains decimal operands and integral bounds', () => {
  assert.deepEqual(parseContentTokens('1.5/2'), [{ type: 'ascii-math', value: '1.5/2', latex: '\\frac{1.5}{2}' }])
  assert.equal(convertAsciiMathToLatex('1.5/2'), '\\frac{1.5}{2}')
  assert.equal(convertAsciiMathToLatex('∫₀¹'), '\\int_{0}^{1} ')
})

test('renders imported questions and answers without changing their source text', () => {
  const examples = [
    ['Khai triển hàm số f(x) = 1 / (x + 1)^2 thành chuỗi Maclaurin và tính tổng S = Σ(n=1..∞) [(-1)^(n-1) · n / 5^n].', 2],
    ['Chuỗi số Σ(n=1..∞) sin(π(1/n + 2n)) là chuỗi số phân kì.', 1],
    ['Cho dãy số {un} với un = n^α · (e^(1/n²) – 1), α là tham số.', 3],
    ['Tổng chuỗi số S = Σ(n=1..∞) 3^(n-2) / n! bằng (1/9) · e³.', 2],
    ['f(x) = Σ(n=1..∞) (-1)^(n-1) · n · x^(n-1), |x| < 1; S = 5/36.', 3],
    ['Khai triển hàm số f(x) = cos²(2x) thành chuỗi Maclaurin.', 1],
    ['Xét Sn = (căn bậc n của e) · (1/(n + 1) + 1/(n + 2) + ... + 1/(n + n)).', 1],
  ]
  for (const [source, count] of examples) {
    const tokens = parseContentTokens(source)
    assert.equal(tokens.map(token => token.value).join(''), source)
    const formulas = tokens.filter(token => token.type === 'ascii-math')
    assert.equal(formulas.length, count, source)
    for (const { value, latex } of formulas) {
      assert.match(katex.renderToString(latex ?? convertAsciiMathToLatex(value)), /katex/)
    }
  }
  assert.equal(parseContentTokens('x = a+b/c')[0].latex, 'x=a+\\frac{b}{c}')
})

test('reads legacy notation alongside explicit display LaTeX', () => {
  const tokens = parseContentTokens('x² và $$y=2$$')
  assert.deepEqual(tokens.map(token => token.type), ['ascii-math', 'text', 'latex'])
  assert.equal(tokens[2].value, 'y=2')
  assert.equal(tokens[2].display, true)
})
