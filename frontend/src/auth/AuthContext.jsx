import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/service'
import { disableGoogleAutoSelect } from '../utils/googleIdentity'
import { clearAllEssayDrafts } from '../utils/essayDraftStorage'

const AuthContext = createContext(null)
const TOKEN_KEY = 'exam_access_token'
const USER_KEY = 'exam_current_user'

export function AuthProvider({ children }) {
  const queryClient = useQueryClient()
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY))
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
    localStorage.removeItem('exam_access_token')
    localStorage.removeItem('exam_current_user')
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
    setToken(result.accessToken)
    return result.user
  }, [queryClient])

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
