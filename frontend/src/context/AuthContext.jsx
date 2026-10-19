import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import * as authService from '@/services/authService'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // 1. Restore authenticated session on application mount via GET /api/auth/me
  useEffect(() => {
    let isMounted = true

    const restoreSession = async () => {
      try {
        const result = await authService.getMe()
        if (isMounted) {
          if (result.ok && result.user) {
            setUser(result.user)
          } else {
            setUser(null)
          }
        }
      } catch {
        if (isMounted) {
          setUser(null)
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    restoreSession()

    return () => {
      isMounted = false
    }
  }, [])

  // 2. Login via POST /api/auth/login
  const login = useCallback(async ({ identifier, email, password, role }) => {
    const cleanId = identifier || email
    const result = await authService.login({ identifier: cleanId, password, role })
    if (result.ok && result.user) {
      setUser(result.user)
    }
    return result
  }, [])

  // 3. Register customer via POST /api/auth/register/customer
  const registerCustomer = useCallback(async (payload) => {
    const result = await authService.registerCustomer(payload)
    if (result.ok && result.user) {
      setUser(result.user)
    }
    return result
  }, [])

  // 4. Register caregiver via POST /api/auth/register/caregiver
  const registerCaregiver = useCallback(async (payload) => {
    const result = await authService.registerCaregiver(payload)
    if (result.ok && result.user) {
      setUser(result.user)
    }
    return result
  }, [])

  // 5. Update authenticated user profile fields
  const updateProfile = useCallback((patch) => {
    setUser((prev) => (prev ? { ...prev, ...patch } : prev))
  }, [])

  // 6. Log out via POST /api/auth/logout (clears cookie on server and in-memory session)
  const logout = useCallback(async () => {
    try {
      await authService.logout()
    } finally {
      setUser(null)
    }
  }, [])

  const value = useMemo(
    () => ({
      user,
      isLoggedIn: Boolean(user),
      loading,
      login,
      logout,
      registerCustomer,
      registerCaregiver,
      updateProfile,
    }),
    [user, loading, login, logout, registerCustomer, registerCaregiver, updateProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
