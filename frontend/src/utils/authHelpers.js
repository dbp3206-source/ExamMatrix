const PUBLIC_AUTH_PATHS = new Set([
  '/auth/login',
  '/auth/google/student/challenge',
  '/auth/google/student',
  '/auth/register/student',
  '/auth/register/student/request-otp',
  '/auth/register/student/resend-otp',
])

export function normalizeAuthPath(url) {
  return String(url || '').split('?')[0].replace(/\/+$/, '')
}

export function isPublicAuthUrl(url) {
  return PUBLIC_AUTH_PATHS.has(normalizeAuthPath(url))
}

export function resolvePostLoginTarget(role, fromPath) {
  if (role === 'STUDENT') {
    if (fromPath && (fromPath.startsWith('/hoc-sinh/') || fromPath === '/ho-so')) {
      return fromPath
    }
    return '/hoc-sinh/tong-quan'
  }
  if (role === 'USER_ADMIN') {
    if (fromPath === '/nguoi-dung' || fromPath === '/ho-so') {
      return fromPath
    }
    return '/nguoi-dung'
  }
  if (role === 'CONTENT_ADMIN') {
    if (fromPath && fromPath !== '/dang-nhap' && fromPath !== '/nguoi-dung' && !fromPath.startsWith('/hoc-sinh/')) {
      return fromPath
    }
    return '/'
  }
  if (fromPath && fromPath !== '/dang-nhap' && !fromPath.startsWith('/hoc-sinh/')) {
    return fromPath
  }
  return '/'
}

export function shouldInvalidateSessionOnAuthError({ activeToken, requestToken, urlPath, status }) {
  if (![401, 423].includes(status)) return false
  const normalized = normalizeAuthPath(urlPath)
  if (isPublicAuthUrl(normalized) || normalized === '/auth/logout') return false
  if (!activeToken) return false
  return !requestToken || activeToken === requestToken
}
