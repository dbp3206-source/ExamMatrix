import { useMemo } from 'react'
import katex from 'katex'
import { cn } from '@/lib/utils'

/**
 * Normalizes ASCII / Unicode mathematical text into clean LaTeX markup.
 */
export function convertAsciiMathToLatex(expr) {
  if (!expr || typeof expr !== 'string') return ''
  let s = expr.trim()

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

const nestedParen = '\\((?:[^()]|\\([^()]*\\))*\\)'
const nestedBracket = '\\[(?:[^\\[\\]]|\\[[^\\[\\]]*\\])*\\]'

const fnAtom = `[a-zA-Z][a-zA-Z0-9_]*(?:['’]+)?${nestedParen}`
const mathPrefix = '(?:(?:(?:Σ|∑|∫)\\s*\\([^)]+\\)|∫₀¹|lim\\s*\\([^)]+\\))\\s*)?'
const mathAtom = `(?:(?:sqrt|√)\\s*(?:${nestedParen}|[a-zA-Z0-9]+)|\\\\[a-zA-Z]+(?:\\{[^}]*\\}|\\([^)]*\\))?|${fnAtom}|(?:${nestedParen}|${nestedBracket})(?:\\^[a-zA-Z0-9α-ω()+-]+|[²³⁴ⁿˣᵃ])?!*|(?:sin|cos|tan|cot|ln|log|exp)\\^?\\d*(?:${nestedParen})?|[a-zA-Z0-9α-ω_²³⁴ⁿˣᵃ₀-₉∞]+(?![à-ỹÀ-ỸđĐ])(?:\\^[a-zA-Z0-9α-ω()+-]+|[²³⁴ⁿˣᵃ]|°)?!*)`
const mathTerm = `${mathPrefix}(?:[-+]\\s*)?${mathAtom}`
const mathExpr = `(?:${mathTerm}(?:\\s*(?:[-+*·/=±]|->)\\s*${mathTerm}|,\\s*[-+]?(?:\\d+|∞))*)`

// Compound math expression with math-specific operators or tokens
const compoundMath = `(?:${mathAtom}(?:\\s*[-+*·/±]\\s*${mathAtom})+)`

// Enhanced LHS for equations
const mathLhs = `(?:(?:lim\\s*\\([^)]+\\)\\s*)?(?:[a-zA-Z][a-zA-Z0-9_]*(?:['’]+)?(?:${nestedParen})?|${nestedParen}|\\\\[a-zA-Z]+|log[₀-₉a-zₐ-ₜ]+(?:\\([^)]+\\)|[a-zA-Z0-9_]+)|det\\([a-zA-Z]\\)|[α-ωΑ-Ω]|\\{[a-zA-Z0-9_]+\\}|[a-zA-Z0-9_]+)(?:\\^[a-zA-Z0-9α-ω()+-]+|[²³⁴ⁿˣᵃ])?(?:\\s*[-+*·/]\\s*(?:${nestedParen}|[a-zA-Z0-9_]+)(?:\\^[a-zA-Z0-9α-ω()+-]+|[²³⁴ⁿˣᵃ])?)*)`

const mathFormulaPattern = new RegExp(
  [
    // 1. Summations, Integrals with range
    `(?:(?:Σ|∑|∫)\\s*\\([^)]+\\)|∫₀¹)\\s*(?:(?:${nestedBracket}|${nestedParen}|[a-zA-Z0-9α-ω_²³⁴ⁿˣᵃ₀-₉∞]+(?![à-ỹÀ-ỸđĐ])(?:\\^[a-zA-Z0-9α-ω()+-]+)?!*)(?:\\s*[-+*·/=±]\\s*(?:${nestedBracket}|${nestedParen}|[a-zA-Z0-9α-ω_²³⁴ⁿˣᵃ₀-₉∞]+(?![à-ỹÀ-ỸđĐ])(?:\\^[a-zA-Z0-9α-ω()+-]+)?!*))*)*`,
    // 2. Equations / Relations: LHS op RHS (e.g. x^2 - 4x + 3 = 0, y = f(x), (x-1)^2 = 4, f'(1) = 5)
    `${mathLhs}\\s*(?:<=|>=|!=|==|=|<|>|≤|≥|≠|≈)\\s*${mathExpr}`,
    // 3. Sequences in curly braces: {un}, {x_n}
    '\\{[a-zA-Z][a-zA-Z0-9_]*\\}',
    // 4. Standalone compound expressions (e.g. (-1)^(n-1) · n / 5^n, (1/9)·e^3, x^(2n) / (2n)!)
    compoundMath,
    // 5. Standalone fractions and ratios: 3^(n-2) / n!, 1 / (x + 1)^2, 25/36, π/2
    `${mathTerm}\\s*\\/\\s*${mathTerm}`,
    // 6. Standalone Greek letters: α, β, π, φ, ω, etc.
    '(?<![\\p{L}\\p{N}])[α-ωΑ-Ω](?![\\p{L}\\p{N}])',
    // 7. Derivatives e.g. f'(x), f'(1), y'
    '[a-zA-Z][\'’]+(?:\\([a-zA-Z0-9,\\s+-]+\\))?',
    // 8. Trig/Math function expressions e.g. cos^2(2x)
    `\\b(?:sin|cos|tan|cot|ln|log|exp)\\^?\\d*${nestedParen}`,
    // 9. Intervals e.g. (0; +∞), (-∞; 0), [0; 1]
    '\\([+-]?(?:\\d+|∞)\\s*;\\s*[+-]?(?:\\d+|∞)\\)|\\[\\d+\\s*;\\s*\\d+\\]',
    // 10. Expressions with ^ or superscripts e.g. 3x² - 3, 3x², x²
    '\\b[a-zA-Z0-9_]+(?:\\^[a-zA-Z0-9α-ω()+-]+|[²³⁴ⁿˣᵃ])(?:\\s*[-+*·/]\\s*(?:\\([^)]+\\)|[a-zA-Z0-9_]+)(?:\\^[a-zA-Z0-9α-ω()+-]+|[²³⁴ⁿˣᵃ])?)*'
  ].join('|'),
  'gu'
)

/**
 * Splits input text into regular text tokens and math tokens.
 */
export function parseContentTokens(text) {
  if (!text || typeof text !== 'string') return []

  // Check explicit LaTeX
  const latexRegex = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|\\\[[\s\S]+?\\\]|\\\([^\n]+?\\\))/g
  const explicitMatches = Array.from(text.matchAll(latexRegex))
  if (explicitMatches.length > 0) {
    const parts = []
    let lastIdx = 0
    for (const match of explicitMatches) {
      const offset = match.index
      if (offset > lastIdx) {
        parts.push({ type: 'text', value: text.slice(lastIdx, offset) })
      }
      let math = match[0]
      let display = false
      if (math.startsWith('$$') && math.endsWith('$$')) {
        math = math.slice(2, -2)
        display = true
      } else if (math.startsWith('\\[') && math.endsWith('\\]')) {
        math = math.slice(2, -2)
        display = true
      } else if (math.startsWith('$') && math.endsWith('$')) {
        math = math.slice(1, -1)
      } else if (math.startsWith('\\(') && math.endsWith('\\)')) {
        math = math.slice(2, -2)
      }
      parts.push({ type: 'latex', value: math, display })
      lastIdx = offset + match[0].length
    }
    if (lastIdx < text.length) {
      parts.push({ type: 'text', value: text.slice(lastIdx) })
    }
    return parts
  }

  // ASCII math tokenization
  const matches = Array.from(text.matchAll(mathFormulaPattern))
  if (matches.length === 0) {
    return [{ type: 'text', value: text }]
  }

  const parts = []
  let lastIdx = 0

  for (const match of matches) {
    const matchStart = match.index
    if (matchStart < lastIdx) continue

    const matchStr = match[0]
    const leadingWs = matchStr.match(/^\s*/)[0].length
    const actualStart = matchStart + leadingWs
    const trimmed = matchStr.slice(leadingWs).replace(/[.,;:?\s]+$/, '')
    if (!trimmed) continue

    if (actualStart > lastIdx) {
      parts.push({ type: 'text', value: text.slice(lastIdx, actualStart) })
    }

    parts.push({ type: 'ascii-math', value: trimmed })
    lastIdx = actualStart + trimmed.length
  }

  if (lastIdx < text.length) {
    parts.push({ type: 'text', value: text.slice(lastIdx) })
  }

  return parts
}

/**
 * Safely renders a LaTeX formula into HTML with KaTeX.
 */
function renderKaTeXHtml(latex, displayMode = false) {
  try {
    return katex.renderToString(latex, {
      displayMode,
      throwOnError: true,
      output: 'htmlAndMathml',
      strict: false,
    })
  } catch (err) {
    console.warn('[MathRenderer] KaTeX render error:', err)
    return null
  }
}

/**
 * Core component to render math-formatted content.
 */
export function MathRenderer({ content, enabled = true, className = '', inline = true }) {
  const tokens = useMemo(() => {
    if (!content) return []
    if (!enabled) return [{ type: 'text', value: content }]
    return parseContentTokens(content)
  }, [content, enabled])

  if (!content) return null

  if (!enabled) {
    return <span className={className}>{content}</span>
  }

  return (
    <span className={cn('math-content leading-relaxed', className)}>
      {tokens.map((token, index) => {
        if (token.type === 'text') {
          return <span key={index}>{token.value}</span>
        }

        const latex = token.type === 'ascii-math' ? convertAsciiMathToLatex(token.value) : token.value
        const isDisplay = Boolean(token.display) && !inline
        const html = renderKaTeXHtml(latex, isDisplay)

        if (!html) {
          return (
            <code key={index} className="mx-0.5 rounded bg-slate-100 px-1 py-0.5 text-xs font-mono text-slate-700">
              {token.value}
            </code>
          )
        }

        return (
          <span
            key={index}
            className={cn('inline-math align-baseline select-text', isDisplay && 'block my-2 text-center')}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )
      })}
    </span>
  )
}

export default MathRenderer
