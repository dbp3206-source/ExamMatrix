import { useMemo } from 'react'
import katex from 'katex'
import { cn } from '@/lib/utils'

import { convertAsciiMathToLatex, parseContentTokens } from '@/lib/math-content'

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
              {token.raw ?? token.value}
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
