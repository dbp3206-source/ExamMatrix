/**
 * Normalizes ASCII / Unicode mathematical text into clean LaTeX markup.
 */
export function convertAsciiMathToLatex(expr) {
  if (!expr || typeof expr !== 'string') return ''
  let s = expr.trim()

  s = s.replace(/∫₀¹/g, '\\int_{0}^{1} ')

  // 0. Unicode Superscripts and Subscripts
  s = s.replace(/²/g, '^2')
  s = s.replace(/³/g, '^3')
  s = s.replace(/⁴/g, '^4')
  s = s.replace(/ⁿ/g, '^n')
  s = s.replace(/ˣ/g, '^x')
  s = s.replace(/ᵃ/g, '^a')
  s = s.replace(/₀/g, '_0')
  s = s.replace(/₁/g, '_1')
  s = s.replace(/₂/g, '_2')
  s = s.replace(/ₐ/g, '_a')
  s = s.replace(/∫₀¹/g, '\\int_{0}^{1} ')

  // 1. Summations: Σ(n=1..∞), Σ(n=1->∞), Σ(n=1...oo)
  s = s.replace(/Σ\s*\(\s*([a-zA-Z])\s*=\s*(\d+|\w+)\s*(?:\.{2,3}|->)\s*(∞|oo|inf(?:inity)?|\w+)\s*\)/g, (m, v, from, to) => {
    const toTex = (to === '∞' || to === 'oo' || to.startsWith('inf')) ? '\\infty' : to
    return `\\sum_{${v}=${from}}^{${toTex}} `
  })
  s = s.replace(/Σ/g, '\\sum ')
  s = s.replace(/∑/g, '\\sum ')

  // 2. Integrals: ∫(0..1) or ∫
  s = s.replace(/∫\s*\(\s*([^.]+)\.\.([^)]+)\s*\)/g, '\\int_{$1}^{$2} ')
  s = s.replace(/∫/g, '\\int ')

  // 3. Limits: lim(x->0) or lim
  s = s.replace(/lim\s*\(\s*([a-zA-Z])\s*->\s*([^)]+)\s*\)/g, (m, v, to) => {
    const toTex = (to === '∞' || to === 'oo' || to.startsWith('inf')) ? '\\infty' : to
    return `\\lim_{${v} \\to ${toTex}} `
  })

  // 4. Constants and Symbols
  s = s.replace(/∞/g, '\\infty ')
  s = s.replace(/·/g, ' \\cdot ')
  s = s.replace(/(?<=\d|\w|\))\s*\*\s*(?=\d|\w|\()/g, ' \\cdot ')
  s = s.replace(/(?:<=|≤)/g, ' \\le ')
  s = s.replace(/(?:>=|≥)/g, ' \\ge ')
  s = s.replace(/(?:!=|≠)/g, ' \\ne ')
  s = s.replace(/≈/g, ' \\approx ')
  s = s.replace(/±/g, ' \\pm ')

  // 5. Trig and Standard Functions (before subscripts so \ln isn't turned into l_{n})
  s = s.replace(/\b(sin|cos|tan|cot|ln|log|exp)\s*\^\s*(\d+|\w+)\s*\(([^)]+)\)/g, '\\$1^{$2}($3)')
  s = s.replace(/\b(sin|cos|tan|cot|ln|log|exp)\s*\(([^)]+)\)/g, '\\$1($2)')
  s = s.replace(/(?<!\\)\b(sin|cos|tan|cot|ln|log|exp)\b/g, '\\$1 ')

  // 6. Sequences & Subscripts (exclude common function names)
  s = s.replace(/\{([a-zA-Z])([a-zA-Z0-9]+)\}/g, '\\{$1_{$2}\\}')
  s = s.replace(/(?<!\\)\b(?!(?:sin|cos|tan|cot|ln|log|exp|in|on|an)\b)([a-zA-Z])([nki]|\d)\b/g, '$1_{$2}')

  // 7. Greek letters & symbols
  s = s.replace(/(?<![\p{L}\p{N}])α(?![\p{L}\p{N}])/gu, '\\alpha ')
  s = s.replace(/(?<![\p{L}\p{N}])β(?![\p{L}\p{N}])/gu, '\\beta ')
  s = s.replace(/(?<![\p{L}\p{N}])π(?![\p{L}\p{N}])/gu, '\\pi ')
  s = s.replace(/(?<![\p{L}\p{N}])θ(?![\p{L}\p{N}])/gu, '\\theta ')
  s = s.replace(/(?<![\p{L}\p{N}])λ(?![\p{L}\p{N}])/gu, '\\lambda ')
  s = s.replace(/(?<![\p{L}\p{N}])Δ(?![\p{L}\p{N}])/gu, '\\Delta ')
  s = s.replace(/(?<![\p{L}\p{N}])δ(?![\p{L}\p{N}])/gu, '\\delta ')
  s = s.replace(/(?<![\p{L}\p{N}])Ω(?![\p{L}\p{N}])/gu, '\\Omega ')
  s = s.replace(/(?<![\p{L}\p{N}])ω(?![\p{L}\p{N}])/gu, '\\omega ')
  s = s.replace(/(?<![\p{L}\p{N}])γ(?![\p{L}\p{N}])/gu, '\\gamma ')
  s = s.replace(/(?<![\p{L}\p{N}])σ(?![\p{L}\p{N}])/gu, '\\sigma ')
  s = s.replace(/(?<![\p{L}\p{N}])φ(?![\p{L}\p{N}])/gu, '\\varphi ')
  s = s.replace(/(?<![\p{L}\p{N}])ϕ(?![\p{L}\p{N}])/gu, '\\phi ')
  s = s.replace(/(?<![\p{L}\p{N}])Φ(?![\p{L}\p{N}])/gu, '\\Phi ')
  s = s.replace(/(?<![\p{L}\p{N}])μ(?![\p{L}\p{N}])/gu, '\\mu ')
  s = s.replace(/(?<![\p{L}\p{N}])ε(?![\p{L}\p{N}])/gu, '\\varepsilon ')
  s = s.replace(/(?<![\p{L}\p{N}])ρ(?![\p{L}\p{N}])/gu, '\\rho ')
  s = s.replace(/(\d+)\s*°/g, '$1^\\circ')

  // 8. Square roots
  s = s.replace(/(?:sqrt|√)\s*\(([^)]+)\)/g, '\\sqrt{$1}')
  s = s.replace(/(?:sqrt|√)\s*([a-zA-Z0-9]+)/g, '\\sqrt{$1}')

  // 9. Exponents: ^(...) or ^\alpha or ^2
  s = s.replace(/\^\(([^)]+)\)/g, '^{$1}')
  s = s.replace(/\^([a-zA-Z0-9α-ωΑ-Ω]+)/g, '^{$1}')

  if (/^\d+(?:\.\d+)?\s*\/\s*\d+(?:\.\d+)?$/.test(s)) {
    const [numerator, denominator] = s.split('/').map(part => part.trim())
    return `\\frac{${numerator}}{${denominator}}`
  }

  // 10. Fractions
  const numPat = '(?:\\\\sqrt\\{[^}]+\\}|\\\\[a-zA-Z]+(?:\\^\\{[^}]+\\}|\\^[a-zA-Z0-9α-ω+-]+)?(?:\\([^)]+\\))?|(?:\\([^)]+\\)|\\[[^\\]]+\\])(?:\\^\\{[^}]+\\}|\\^[a-zA-Z0-9α-ω+-]+|\\^\\([^)]+\\))?|[-+]?[a-zA-Z0-9_]+(?:\\^\\{[^}]+\\}|\\^[a-zA-Z0-9α-ω+-]+|\\^\\([^)]+\\))?)'
  const denPat = '(?:\\\\sqrt\\{[^}]+\\}|\\\\[a-zA-Z]+(?:\\^\\{[^}]+\\}|\\^[a-zA-Z0-9α-ω+-]+)?(?:\\([^)]+\\))?!*|\\([^)]+\\)(?:\\^\\{[^}]+\\}|\\^[a-zA-Z0-9α-ω+-]+|\\^\\([^)]+\\))?!*|[a-zA-Z0-9_]+(?:\\^\\{[^}]+\\}|\\^[a-zA-Z0-9α-ω+-]+|\\^\\([^)]+\\))?!*)'
  const fracRegex = new RegExp(`(${numPat})\\s*\\/\\s*(${denPat})`, 'g')
  s = s.replace(fracRegex, (match, num, den) => {
    return `\\frac{${stripOuterParens(num)}}{${stripOuterParens(den)}}`
  })

  return s
}

function stripOuterParens(str) {
  if (!str || typeof str !== 'string') return ''
  const s = str.trim()
  if (s.startsWith('(') && s.endsWith(')')) {
    let depth = 0
    for (let i = 0; i < s.length - 1; i++) {
      if (s[i] === '(') depth++
      else if (s[i] === ')') {
        depth--
        if (depth === 0) return s
      }
    }
    if (depth === 1) {
      return s.slice(1, -1).trim()
    }
  }
  return s
}

// Treat ambiguous prose as plain text. Detect standalone, unambiguous legacy notation.
const legacyMath = /(?<![\p{L}\p{N}_./])(?:∫₀¹(?=\s|$)|[a-zA-Z][²³⁴ⁿˣᵃ](?![\p{L}\p{N}])|[α-ωΑ-Ω](?![\p{L}\p{N}])|\d+(?:\.\d+)?\s*\/\s*\d+(?:\.\d+)?(?![\p{L}\p{N}./]))/gu

export function parseContentTokens(text) {
  if (!text || typeof text !== 'string') return []
  const explicit = /(?<!\\)(\$\$[\s\S]+?\$\$|\$[^$\n]+?(?<!\\)\$|\\\[[\s\S]+?\\\]|\\\([^\n]+?\\\))/g
  const tokens = []
  const appendLegacy = (value) => {
    let cursor = 0
    for (const match of value.matchAll(legacyMath)) {
      if (match.index > cursor) tokens.push({ type: 'text', value: value.slice(cursor, match.index) })
      tokens.push({ type: 'ascii-math', value: match[0] })
      cursor = match.index + match[0].length
    }
    if (cursor < value.length) tokens.push({ type: 'text', value: value.slice(cursor) })
  }
  let cursor = 0
  for (const match of text.matchAll(explicit)) {
    appendLegacy(text.slice(cursor, match.index))
    const raw = match[0]
    const delimiterLength = raw.startsWith('$$') || raw.startsWith('\\') ? 2 : 1
    tokens.push({
      type: 'latex',
      value: raw.slice(delimiterLength, -delimiterLength),
      raw,
      display: raw.startsWith('$$') || raw.startsWith('\\['),
    })
    cursor = match.index + raw.length
  }
  appendLegacy(text.slice(cursor))
  return tokens
}
