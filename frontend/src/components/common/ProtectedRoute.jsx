import { Link, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { ShieldAlert } from 'lucide-react'
import { PageSkeleton } from '@/components/common/States'

export function ProtectedRoute({ roles, children, fallback }) {
  const { isLoggedIn, user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <PageSkeleton />
      </div>
    )
  }

  if (!isLoggedIn) {
    const isTargetingAdmin = roles?.includes('admin') || location.pathname.startsWith('/admin')
    const redirectTarget = isTargetingAdmin ? '/admin/login' : '/login'
    return <Navigate to={redirectTarget} state={{ from: location.pathname + location.search }} replace />
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
        <Link to="/" className="mt-6 text-sm font-semibold text-primary-700 hover:underline">
          Back to home
        </Link>
      </div>
    )
  }

  return fallback ?? children
}

export default ProtectedRoute
