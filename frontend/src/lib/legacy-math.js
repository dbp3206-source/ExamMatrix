// A small grammar for the notation stored in the question bank.
const atom = /(?:\d+(?:\.\d+)?|sin|cos|tan|cot|ln|log|exp|arctan|arcsin|arccos|sqrt|[a-zA-Z][nki](?![\p{L}\p{M}\p{N}])|[a-zA-Zα-ωΑ-Ω∞√])/uy
const word = /[\p{L}\p{M}]/u
const functions = new Set(['sin', 'cos', 'tan', 'cot', 'ln', 'log', 'exp', 'arctan', 'arcsin', 'arccos', 'sqrt', '√'])
const superscripts = { '²': '2', '³': '3', '⁴': '4', 'ⁿ': 'n', 'ˣ': 'x', 'ᵃ': 'a' }

export function readLegacyFormula(text, start = 0) {
  let pos = start
  let recognizable = false

  function take(pattern) {
    pattern.lastIndex = pos
    const match = pattern.exec(text)
    if (match) pos = pattern.lastIndex
    return match
  }

  function primary(depth) {
    if (depth > 24) return null
    const root = take(/căn bậc ([a-z]|\d+) của ([a-z]|\d+)(?![\p{L}\p{M}\p{N}])/uy)
    if (root) {
      recognizable = true
      return { tex: `\\sqrt[${root[1]}]{${root[2]}}` }
    }
    if (take(/\.\.\.|…/uy)) return { tex: '\\cdots' }
    const sum = take(/[Σ∑]\(\s*([a-z])\s*=\s*(\d+)\s*\.{2,3}\s*(∞|\d+)\s*\)\s*/uy)
    if (sum) {
      const body = expression(2, depth + 1)
      if (!body) return null
      recognizable = true
      return { tex: `\\sum_{${sum[1]}=${sum[2]}}^{${sum[3] === '∞' ? '\\infty' : sum[3]}} ${body.tex}` }
    }
    const group = take(/[([{|]/y)
    if (group) {
      take(/[^\S\n]*/y)
      const inner = expression(0, depth + 1)
      const closing = { '(': ')', '[': ']', '{': '}', '|': '|' }[group[0]]
      take(/[^\S\n]*/y)
      if (!inner || text[pos] !== closing) return null
      pos++
      if (closing === '}') recognizable = true
      const escaped = closing === '}' ? '\\' : ''
      return { tex: `\\left${escaped}${group[0]}${inner.tex}\\right${escaped}${closing}`, inner: closing === ')' ? inner.tex : null }
    }
    const symbol = take(atom)?.[0]
    if (!symbol) return null
    if (functions.has(symbol)) {
      const power = take(/\^(\d+)|([²³⁴])/uy)
      if (text[pos] !== '(') return null
      const arg = primary(depth + 1)
      if (!arg) return null
      recognizable = true
      if (symbol === '√' || symbol === 'sqrt') return { tex: `\\sqrt{${arg.inner}}` }
      const exponent = power ? `^{${power[1] || superscripts[power[2]]}}` : ''
      return { tex: `\\${symbol}${exponent}${arg.tex}`, callable: false }
    }
    if (word.test(text[pos] || '') && !/^\d/.test(symbol)) return null
    const subscript = take(/_([a-zA-Z0-9]+)|([₀₁₂₃₄₅₆₇₈₉ₙ])/uy)
    if (subscript) recognizable = true
    const tex = symbol.length === 2 && /^[A-Za-z][nki]$/.test(symbol)
      ? `${symbol[0]}_{${symbol[1]}}`
      : symbol === '∞' ? '\\infty' : symbol
    const sub = subscript?.[1] ?? (subscript?.[2] === 'ₙ' ? 'n' : subscript ? String(subscript[2].codePointAt(0) - 8320) : '')
    return { tex: sub ? `${tex}_{${sub}}` : tex, numeric: /^\d/.test(symbol), callable: /^[a-zA-Z]$/.test(symbol) }
  }

  function operand(depth) {
    const sign = take(/[+-]/y)?.[0]
    if (sign) take(/[^\S\n]*/y)
    const base = primary(depth)
    if (!base) return null
    if (base.callable && text[pos] === '(') {
      const arg = primary(depth + 1)
      if (!arg) return null
      base.tex += arg.tex
      recognizable = true
    }
    const superscript = take(/[²³⁴ⁿˣᵃ]/uy)?.[0]
    const power = !superscript && take(/\^/y)
    if (power || superscript) {
      const exponent = power && primary(depth + 1)
      if (power && !exponent) return null
      base.tex += `^{${superscript ? superscripts[superscript] : exponent.inner ?? exponent.tex}}`
      base.inner = null
      base.numeric = false
      recognizable = true
    }
    if (text[pos] === '!') {
      pos++
      base.tex += '!'
      base.numeric = false
      recognizable = true
    }
    if (sign) return { tex: sign + base.tex }
    return base
  }

  function expression(minPrecedence, depth) {
    if (depth > 24) return null
    let left = operand(depth)
    if (!left) return null
    for (;;) {
      const endOfLeft = pos
      const marked = recognizable
      const op = take(/[^\S\n]*(<=|>=|!=|[=<>≤≥≠≈+\-–−·*×/±])[^\S\n]*/uy)?.[1]
      const implicit = !op && /[a-zA-Zα-ωΑ-Ω(]/u.test(text[pos] || '')
      const precedence = !op || /[·*×/]/u.test(op) ? 2 : /[+\-–−±]/u.test(op) ? 1 : 0
      if ((!op && !implicit) || precedence < minPrecedence) {
        pos = endOfLeft
        break
      }
      const right = expression(precedence + 1, depth + 1)
      if (!right) {
        if (op) return null
        pos = endOfLeft
        recognizable = marked
        break
      }
      if (op === '/' && (text[pos] === '/' || /[\p{L}\p{M}\p{N}]/u.test(text[pos] || ''))) return null
      if (precedence === 0 || (op === '/' && left.numeric && right.numeric)) recognizable = true
      const symbols = { '·': '\\cdot ', '*': '\\cdot ', '×': '\\times ', '≤': '\\le ', '<=': '\\le ', '≥': '\\ge ', '>=': '\\ge ', '≠': '\\ne ', '!=': '\\ne ', '≈': '\\approx ', '±': '\\pm ', '–': '-', '−': '-' }
      left = { tex: op === '/' ? `\\frac{${left.inner ?? left.tex}}{${right.inner ?? right.tex}}` : left.tex + (symbols[op] ?? op ?? '') + right.tex }
    }
    return left
  }

  const result = expression(0, 0)
  if (!result || !recognizable || /[\p{L}\p{M}\p{N}_/^]/u.test(text[pos] || '')) return null
  return { value: text.slice(start, pos), latex: result.tex }
}
