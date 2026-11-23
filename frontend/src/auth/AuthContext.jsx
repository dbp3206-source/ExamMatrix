import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/service'
import { disableGoogleAutoSelect } from '../utils/googleIdentity'
import { clearAllEssayDrafts } from '../utils/essayDraftStorage'

const AuthContext = createContext(null)
const TOKEN_KEY = 'exam_access_token'
const USER_KEY = 'exam_current_user'
const REFRESH_BEFORE_EXPIRY_MS = 25 * 60 * 1000
const ACTIVE_IDLE_LIMIT_MS = 45 * 60 * 1000
const REFRESH_CHECK_INTERVAL_MS = 60 * 1000

function parseJwtExpMs(token) {
  if (!token || typeof token !== 'string') return null
  const parts = token.split('.')
  if (parts.length < 2) return null
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    const payload = JSON.parse(atob(padded))
    return typeof payload?.exp === 'number' ? payload.exp * 1000 : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const queryClient = useQueryClient()
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY))
  const lastActivityRef = useRef(Date.now())
  const refreshingRef = useRef(false)

  const session = useQuery({
    queryKey: ['session', token],
    queryFn: api.me,
    enabled: Boolean(token),
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: true,
  })
  const user = token ? session.data : null

  useEffect(() => {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user))
  }, [user])

  const clearSessionOnly = useCallback(async () => {
    await queryClient.cancelQueries()
    clearAllEssayDrafts()
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setToken(null)
    queryClient.clear()
  }, [queryClient])

  useEffect(() => {
    const syncSession = (event) => {
      if (event.key !== TOKEN_KEY && event.key !== null) return
      queryClient.cancelQueries()
      queryClient.clear()
      setToken(localStorage.getItem(TOKEN_KEY))
    }
    const handleInvalidated = () => {
      clearSessionOnly()
    }
    window.addEventListener('storage', syncSession)
    window.addEventListener('exam:auth-invalidated', handleInvalidated)
    return () => {
      window.removeEventListener('storage', syncSession)
      window.removeEventListener('exam:auth-invalidated', handleInvalidated)
    }
  }, [clearSessionOnly, queryClient])

  const establishSession = useCallback(async (result) => {
    if (!result?.accessToken || !result?.user) {
      throw new Error('Phản hồi đăng nhập từ máy chủ không hợp lệ')
    }
    await queryClient.cancelQueries()
    queryClient.clear()
    localStorage.setItem(TOKEN_KEY, result.accessToken)
    localStorage.setItem(USER_KEY, JSON.stringify(result.user))
    queryClient.setQueryData(['session', result.accessToken], result.user)
    lastActivityRef.current = Date.now()
    setToken(result.accessToken)
    return result.user
  }, [queryClient])

  useEffect(() => {
    if (!token || !user) return undefined

    const markActive = () => {
      lastActivityRef.current = Date.now()
    }
    window.addEventListener('pointerdown', markActive, { passive: true })
    window.addEventListener('keydown', markActive, { passive: true })
    window.addEventListener('scroll', markActive, { passive: true })
    window.addEventListener('focus', markActive)

    const maybeRefresh = async () => {
      if (refreshingRef.current) return
      const expMs = parseJwtExpMs(token)
      if (!expMs) return
      const now = Date.now()
      const timeLeft = expMs - now
      const recentlyActive = now - lastActivityRef.current <= ACTIVE_IDLE_LIMIT_MS
      if (timeLeft > 0 && timeLeft <= REFRESH_BEFORE_EXPIRY_MS && recentlyActive) {
        refreshingRef.current = true
        try {
          const next = await api.refreshSession()
          if (next?.accessToken && next?.user && localStorage.getItem(TOKEN_KEY) === token) {
            localStorage.setItem(TOKEN_KEY, next.accessToken)
            localStorage.setItem(USER_KEY, JSON.stringify(next.user))
            queryClient.setQueryData(['session', next.accessToken], next.user)
            setToken(next.accessToken)
          }
        } catch {
          // Keep the current session on a transient refresh failure.
        } finally {
          refreshingRef.current = false
        }
      }
    }

    const timer = window.setInterval(maybeRefresh, REFRESH_CHECK_INTERVAL_MS)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('pointerdown', markActive)
      window.removeEventListener('keydown', markActive)
      window.removeEventListener('scroll', markActive)
      window.removeEventListener('focus', markActive)
    }
  }, [token, user, queryClient])

  const login = useCallback(async (credentials) => {
    const result = await api.login(credentials)
    return establishSession(result)
  }, [establishSession])

  const loginWithGoogle = useCallback(async (credential) => {
    const result = await api.googleStudentLogin(credential)
    return establishSession(result)
  }, [establishSession])

  const logout = useCallback(async () => {
    const request = api.logout().catch(() => undefined)
    disableGoogleAutoSelect()
    await clearSessionOnly()
    await request
  }, [clearSessionOnly])

  const updateLocalUser = useCallback((next) => {
    localStorage.setItem(USER_KEY, JSON.stringify(next))
    queryClient.setQueryData(['session', token], next)
  }, [queryClient, token])

  const value = useMemo(() => ({
    user,
    login,
    loginWithGoogle,
    logout,
    clearSessionOnly,
    updateLocalUser,
    isAuthenticated: Boolean(token && user),
    isChecking: Boolean(token) && session.isPending,
    authError: token ? session.error : null,
    retrySession: session.refetch,
  }), [user, login, loginWithGoogle, logout, clearSessionOnly, updateLocalUser, token, session.isPending, session.error, session.refetch])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
