import { Lock, FileCheck2, LayoutDashboard } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/common/Button'

/**
 * Route guard that restricts unverified caregivers to Dashboard and Documents only.
 * When admin approves/verifies the caregiver, all locked routes become accessible.
 */
export function CaregiverVerifiedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return null
  }

  const isVerified =
    user?.role !== 'caregiver' ||
    user?.verified === true ||
    String(user?.verificationStatus || '').toLowerCase() === 'verified'

  if (!isVerified) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center justify-center rounded-2xl border border-line bg-white p-8 text-center shadow-card sm:p-12 my-8">
        <span className="grid h-16 w-16 place-items-center rounded-2xl bg-amber-50 text-amber-600 shadow-sm border border-amber-200">
          <Lock className="h-8 w-8" />
        </span>
        <h2 className="mt-5 font-display text-2xl font-bold text-ink">Verification Required</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          This section is locked while your verification is pending. Once our operations team reviews and approves your submitted credentials, you will have complete access to jobs, shifts, and earnings.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button variant="primary" to="/caregiver/documents" icon={FileCheck2}>
            Go to Documents
          </Button>
          <Button variant="secondary" to="/caregiver/dashboard" icon={LayoutDashboard}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    )
  }

  return children
}

export default CaregiverVerifiedRoute
