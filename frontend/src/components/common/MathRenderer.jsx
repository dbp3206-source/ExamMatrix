import { useMemo } from 'react'
import katex from 'katex'
import { cn } from '@/lib/utils'

/**
 * Normalizes ASCII / Unicode mathematical text into clean LaTeX markup.
 */
export function convertAsciiMathToLatex(expr) {
  if (!expr || typeof expr !== 'string') return ''
  let s = expr.trim()

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
  s = s.replace(/lim\s*\(\s*([a-zA-Z])\s*->\s*([^)]+)\s*\)/g, '\\lim_{$1 \\to $2} ')

  // 4. Constants and Symbols
  s = s.replace(/∞/g, '\\infty ')
  s = s.replace(/·/g, ' \\cdot ')
  s = s.replace(/(?<=\d|\w|\))\s*\*\s*(?=\d|\w|\()/g, ' \\cdot ')
  s = s.replace(/<=/g, ' \\le ')
  s = s.replace(/>=/g, ' \\ge ')
  s = s.replace(/!=/g, ' \\ne ')
  s = s.replace(/≈/g, ' \\approx ')
  s = s.replace(/±/g, ' \\pm ')

  // 5. Greek letters
  s = s.replace(/\bα\b/g, '\\alpha ')
  s = s.replace(/\bβ\b/g, '\\beta ')
  s = s.replace(/\bπ\b/g, '\\pi ')
  s = s.replace(/\bθ\b/g, '\\theta ')
  s = s.replace(/\bλ\b/g, '\\lambda ')
  s = s.replace(/\bΔ\b/g, '\\Delta ')
  s = s.replace(/\bδ\b/g, '\\delta ')
  s = s.replace(/\bΩ\b/g, '\\Omega ')
  s = s.replace(/\bω\b/g, '\\omega ')
  s = s.replace(/\bγ\b/g, '\\gamma ')
  s = s.replace(/\bσ\b/g, '\\sigma ')

  // 6. Sequences & Subscripts
  s = s.replace(/\{([a-zA-Z])([a-zA-Z0-9]+)\}/g, '\\{$1_{$2}\\}')
  s = s.replace(/\b([a-zA-Z])([nki]|\d)\b/g, '$1_{$2}')

  // 7. Trig and Standard Functions
  s = s.replace(/\b(sin|cos|tan|cot|ln|log|exp)\s*\^\s*(\d+|\w+)\s*\(([^)]+)\)/g, '\\$1^{$2}($3)')
  s = s.replace(/\b(sin|cos|tan|cot|ln|log|exp)\s*\(([^)]+)\)/g, '\\$1($2)')
  s = s.replace(/\b(sin|cos|tan|cot|ln|log|exp)\b/g, '\\$1 ')

  // 8. Square roots
  s = s.replace(/(?:sqrt|√)\s*\(([^)]+)\)/g, '\\sqrt{$1}')

  // 9. Exponents: ^(...) or ^\alpha or ^2
  s = s.replace(/\^\(([^)]+)\)/g, '^{$1}')
  s = s.replace(/\^([a-zA-Z0-9α-ωΑ-Ω]+)/g, '^{$1}')

  // 10. Fractions
  s = s.replace(/\b(\d+)\s*\/\s*([a-zA-Z0-9]+)\b/g, '\\frac{$1}{$2}')
  s = s.replace(/1\s*\/\s*(\([^)]+\)\^\{[^}]+\})/g, '\\frac{1}{$1}')
  s = s.replace(/([a-zA-Z0-9^{}()]+)\s*\/\s*([a-zA-Z0-9^{}()!]+)/g, (match, num, den) => {
    if (num.includes('\\frac')) return match
    return `\\frac{${num}}{${den}}`
  })

  return s
}

/**
 * Splits input text into regular text tokens and math tokens.
 */
export function parseContentTokens(text) {
  if (!text || typeof text !== 'string') return []

  // Check for explicit LaTeX: $$...$$, $...$, \[...\], \(...\)
  const latexRegex = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|\\\[[\s\S]+?\\\]|\\\([^\n]+?\\\))/g
  if (latexRegex.test(text)) {
    const parts = []
    let lastIdx = 0
    text.replace(latexRegex, (match, offset) => {
      if (offset > lastIdx) {
        parts.push({ type: 'text', value: text.slice(lastIdx, offset) })
      }
      let math = match
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
      lastIdx = offset + match.length
      return match
    })
    if (lastIdx < text.length) {
      parts.push({ type: 'text', value: text.slice(lastIdx) })
    }
    return parts
  }

  // Regex for ASCII / Unicode math expressions in Vietnamese question text
  const mathFormulaPattern = /(Σ\([^)]+\)\s*(?:\[[^\]]+\]|[^\s,;.]+(?:\s*[+\-*·/=]\s*(?:\([^)]+\)\^?\w*|\[[^\]]+\]|[^\s,;.]+))*)|(?:[a-zA-Z]\([a-zA-Z0-9,\s]+\)|[a-zA-Z]{1,2})\s*=\s*(?:Σ\([^)]+\)\s*)?[^\s,;:.]+(?:\s*[+\-*·/=]\s*(?:\[[^\]]+\]|\([^)]+\)\^?\w*|[^\s,;:.]+))*|\{[a-zA-Z0-9_]+\}|\([^)]+\)·e\^\d+|[a-zA-Z0-9_]+\^[a-zA-Z0-9α-ω_]+|[α-ωΑ-Ω]|\b(?:sin|cos|tan|cot)\^?\d*\(?[a-zA-Z0-9,\s+\-*/]+\)?)/gu

  const parts = []
  let lastIdx = 0

  text.replace(mathFormulaPattern, (match, offset) => {
    if (offset > lastIdx) {
      parts.push({ type: 'text', value: text.slice(lastIdx, offset) })
    }
    parts.push({ type: 'ascii-math', value: match.trim() })
    lastIdx = offset + match.length
    return match
  })

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
      throwOnError: false,
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
