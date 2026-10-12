import { createContext, useCallback, useContext, useMemo } from 'react'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { DEMO_USERS, findDemoUser } from '@/data/demoUsers'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useLocalStorage('caremate.auth', null)

  const login = useCallback(
    ({ email, password, role }) => {
      const found = findDemoUser(email)
      const match = found && found.password === password ? found : null
      if (match) {
        setUser(match)
        return { ok: true, user: match }
      }
      const fallback = DEMO_USERS.find((u) => u.role === role)
      if (fallback && fallback.password === password) {
        setUser(fallback)
        return { ok: true, user: fallback }
      }
      return { ok: false, message: 'Invalid credentials. Try the demo password `caremate123`.' }
    },
    [setUser],
  )

  const registerCustomer = useCallback(
    (payload) => {
      const created = {
        id: `cu-${Math.floor(300 + Math.random() * 600)}`,
        role: 'customer',
        name: payload.fullName,
        email: payload.email,
        phone: payload.mobile,
        password: payload.password,
        avatar: '',
        city: payload.city || 'Mumbai, MH',
        area: payload.area || '',
        address: payload.address || '',
        patientInfo: payload.patientInfo || null,
        joinedOn: new Date().toISOString().slice(0, 10),
        isDemoAccount: true,
      }
      setUser(created)
      return { ok: true, user: created }
    },
    [setUser],
  )

  const registerCaregiver = useCallback(
    (payload) => {
      const created = {
        id: `cg-${Math.floor(130 + Math.random() * 600)}`,
        role: 'caregiver',
        caregiverId: `cg-${Math.floor(130 + Math.random() * 600)}`,
        name: payload.fullName,
        email: payload.email,
        phone: payload.mobile,
        password: payload.password,
        avatar: '',
        city: payload.city || 'Mumbai, MH',
        area: payload.area || '',
        address: payload.address || '',
        qualification: payload.qualification,
        experienceYears: Number(payload.experience || 0),
        verificationStatus: 'Pending',
        joinedOn: new Date().toISOString().slice(0, 10),
        isDemoAccount: true,
      }
      setUser(created)
      return { ok: true, user: created }
    },
    [setUser],
  )

  const updateProfile = useCallback(
    (patch) => {
      setUser((prev) => (prev ? { ...prev, ...patch } : prev))
    },
    [setUser],
  )

  const logout = useCallback(() => setUser(null), [setUser])

  const value = useMemo(
    () => ({ user, isLoggedIn: Boolean(user), login, logout, registerCustomer, registerCaregiver, updateProfile }),
    [user, login, logout, registerCustomer, registerCaregiver, updateProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
