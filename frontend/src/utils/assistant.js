export function emitAssistantHint({ title, message, tone = 'info' }) {
  if (typeof window === 'undefined') return

  window.dispatchEvent(new CustomEvent('exam:assistant-hint', {
    detail: { title, message, tone },
  }))
}
