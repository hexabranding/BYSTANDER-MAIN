import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { ShieldAlert } from 'lucide-react'

export function ProtectedRoute({ roles, children, fallback }) {
  const { isLoggedIn, user } = useAuth()
  const location = useLocation()

  if (!isLoggedIn) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  if (roles && !roles.includes(user?.role)) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center justify-center px-6 py-24 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-danger-50 text-danger-600">
          <ShieldAlert className="h-6 w-6" />
        </span>
        <h1 className="mt-4 font-display text-xl font-extrabold text-ink">Access restricted</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Your account does not have permission to view this area. Sign in with a matching demo account to continue.
        </p>
        <a href="/" className="mt-6 text-sm font-semibold text-primary-700 hover:underline">
          Back to home
        </a>
      </div>
    )
  }

  return fallback ?? children
}

export default ProtectedRoute
