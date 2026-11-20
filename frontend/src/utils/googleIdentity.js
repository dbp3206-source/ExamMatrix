const GIS_SCRIPT_SRC = 'https://accounts.google.com/gsi/client'

let scriptLoadPromise = null

export function loadGoogleIdentityScript() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.reject(new Error('Google Identity Services chỉ khả dụng trên trình duyệt.'))
  }

  if (window.google?.accounts?.id) {
    return Promise.resolve(window.google.accounts.id)
  }

  if (scriptLoadPromise) {
    return scriptLoadPromise
  }

  scriptLoadPromise = new Promise((resolve, reject) => {
    let settled = false
    const finishError = (message) => {
      if (settled) return
      settled = true
      scriptLoadPromise = null
      reject(new Error(message))
    }
    const finishSuccess = () => {
      if (settled) return
      if (window.google?.accounts?.id) {
        settled = true
        resolve(window.google.accounts.id)
      } else {
        finishError('Google Identity Services chưa sẵn sàng sau khi tải script.')
      }
    }

    const existing = document.querySelector(`script[src="${GIS_SCRIPT_SRC}"]`)
    if (existing) {
      if (existing.dataset.gisLoaded === 'true' && window.google?.accounts?.id) {
        finishSuccess()
        return
      }
      if (existing.dataset.gisFailed === 'true') {
        existing.remove()
      } else {
        const timeoutId = window.setTimeout(
          () => {
            existing.remove()
            finishError('Quá thời gian tải Google Identity Services. Vui lòng thử lại.')
          },
          12000
        )
        existing.addEventListener('load', () => {
          window.clearTimeout(timeoutId)
          existing.dataset.gisLoaded = 'true'
          finishSuccess()
        }, { once: true })
        existing.addEventListener('error', () => {
          window.clearTimeout(timeoutId)
          existing.dataset.gisFailed = 'true'
          finishError('Không thể tải Google Identity Services. Vui lòng kiểm tra kết nối mạng.')
        }, { once: true })
        return
      }
    }

    const script = document.createElement('script')
    script.src = GIS_SCRIPT_SRC
    script.async = true
    script.defer = true

    const timeoutId = window.setTimeout(
      () => {
        script.remove()
        finishError('Quá thời gian tải Google Identity Services. Vui lòng thử lại.')
      },
      12000
    )

    script.addEventListener('load', () => {
      window.clearTimeout(timeoutId)
      script.dataset.gisLoaded = 'true'
      finishSuccess()
    }, { once: true })

    script.addEventListener('error', () => {
      window.clearTimeout(timeoutId)
      script.dataset.gisFailed = 'true'
      finishError('Không thể tải Google Identity Services. Vui lòng kiểm tra kết nối mạng.')
    }, { once: true })

    document.head.appendChild(script)
  })

  return scriptLoadPromise
}

export function disableGoogleAutoSelect() {
  try {
    window.google?.accounts?.id?.disableAutoSelect?.()
  } catch {
    return
  }
}
