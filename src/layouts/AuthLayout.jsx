import { Link, Outlet } from 'react-router-dom'
import { ShieldCheck, Sparkles } from 'lucide-react'
import { Logo } from '@/components/common/Logo'

const points = [
  'Verified caregivers, nurses and nursing students',
  'Escrow-protected payments released after service',
  'Document-level verification reviewed by humans',
  'SOS escalation on every active booking',
]

export function AuthLayout() {
  return (
    <div className="min-h-screen bg-canvas lg:grid lg:grid-cols-[1.05fr_1fr]">
      <div className="relative hidden overflow-hidden bg-primary-900 px-12 py-12 lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 grid-pattern opacity-30" aria-hidden="true" />
        <div
          className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-accent-500/25 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-primary-400/25 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative">
          <Logo light />
        </div>

        <div className="relative max-w-lg">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-mint-200">
            <Sparkles className="h-3.5 w-3.5" /> Frontend demonstration environment
          </span>
          <h1 className="mt-6 font-display text-4xl font-extrabold leading-tight text-white">
            Care that families can actually trust.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-white/70">
            Every caregiver on CareMate passes a four-step document review before a single shift is booked. Sign in to
            explore the customer, caregiver and admin workspaces with seeded demo data.
          </p>
          <ul className="mt-8 space-y-3">
            {points.map((p) => (
              <li key={p} className="flex items-start gap-3 text-sm text-white/85">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-mint-200/20 text-mint-200">
                  <ShieldCheck className="h-3.5 w-3.5" />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/45">
          OTP, identity verification, camera, QR and payment flows are simulated in this demo.
        </p>
      </div>

      <div className="flex min-h-screen flex-col px-5 py-8 sm:px-10 lg:px-14">
        <div className="flex items-center justify-between lg:hidden">
          <Logo />
        </div>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-md">
            <Outlet />
          </div>
        </div>
        <p className="text-center text-xs text-muted">
          Need help?{' '}
          <Link to="/contact" className="font-semibold text-primary-700 hover:underline">
            Contact support
          </Link>
        </p>
      </div>
    </div>
  )
}

export default AuthLayout
