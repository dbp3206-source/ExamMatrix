import axios from 'axios'
import { normalizeError } from '../utils'
import { isPublicAuthUrl, normalizeAuthPath, shouldInvalidateSessionOnAuthError } from '../utils/authHelpers'

export { isPublicAuthUrl }

const httpClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

function extractBearerToken(headers) {
  if (!headers) return null
  const raw = typeof headers.get === 'function'
    ? headers.get('Authorization')
    : (headers.Authorization || headers.authorization)
  if (typeof raw !== 'string') return null
  return raw.startsWith('Bearer ') ? raw.slice(7).trim() : raw.trim()
}

httpClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('exam_access_token')
  if (token && !isPublicAuthUrl(config.url)) {
    config.headers.Authorization = `Bearer ${token}`
    config._authTokenSnapshot = token
  }
  if (config.params) {
    config.params = Object.fromEntries(Object.entries(config.params).filter(([, value]) => value !== '' && value != null))
  }
  return config
})

httpClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const normalized = normalizeError(error)
    error.message = normalized.message
    error.fieldErrors = normalized.fieldErrors
    error.status = error.response?.status
    error.code = error.response?.data?.code
    const urlPath = normalizeAuthPath(error.config?.url)
    const activeToken = localStorage.getItem('exam_access_token')
    const requestToken = error.config?._authTokenSnapshot ?? extractBearerToken(error.config?.headers)
    if (shouldInvalidateSessionOnAuthError({ activeToken, requestToken, urlPath, status: error.status })) {
      localStorage.removeItem('exam_access_token')
      localStorage.removeItem('exam_current_user')
      window.dispatchEvent(new CustomEvent('exam:auth-invalidated', {
        detail: { status: error.status, message: error.message },
      }))
      if (window.location.pathname !== '/dang-nhap') window.location.assign('/dang-nhap?expired=1')
    }
    return Promise.reject(error)
  },
)

export default httpClient
