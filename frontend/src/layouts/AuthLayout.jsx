import { Link, Outlet } from 'react-router-dom'
import { ShieldCheck, Sparkles } from 'lucide-react'
import { Logo } from '@/components/common/Logo'

const points = [
  'Verified caretakers, nurses and nursing students',
  'Escrow-protected payments released after service',
  'Document-level verification reviewed by humans',
  'SOS escalation on every active booking',
]

export function AuthLayout() {
  return (
    <div className="min-h-screen bg-canvas lg:grid lg:grid-cols-[1.05fr_1fr]">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-primary-950 via-primary-900 to-primary-800 px-8 py-8 xl:px-12 xl:py-12 lg:flex lg:flex-col lg:justify-between lg:sticky lg:top-0 lg:h-screen lg:self-start">
        {/* aurora glows */}
        <div
          className="absolute -right-24 -top-24 h-96 w-96 animate-float-slow rounded-full bg-accent-500/30 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="absolute -bottom-32 -left-20 h-96 w-96 animate-float rounded-full bg-primary-400/30 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="absolute left-1/3 top-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-mint-300/15 blur-3xl"
          aria-hidden="true"
        />

        {/* dot grid, brightest top-right, faded away from the copy */}
        <div className="grid-pattern-dark grid-fade absolute inset-0 opacity-60" aria-hidden="true" />

        {/* diagonal sheen for depth */}
        <div
          className="absolute inset-0 bg-[linear-gradient(115deg,transparent_36%,rgba(255,255,255,0.07)_50%,transparent_64%)]"
          aria-hidden="true"
        />

        {/* vignette so the panel edges sink and the text pops */}
        <div className="panel-vignette absolute inset-0" aria-hidden="true" />

        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 -right-16 h-72 w-72 rounded-full border-[28px] border-white/5"
        />

        <div className="relative">
          <Logo light size="lg" />
        </div>

        <div className="relative max-w-lg">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-mint-200 backdrop-blur-sm">
            <Sparkles className="h-3.5 w-3.5" /> Frontend demonstration environment
          </span>
          <h1 className="mt-6 font-display text-4xl font-extrabold leading-[1.1] text-white">
            Care that families can{' '}
            <span className="bg-gradient-to-r from-accent-300 via-accent-400 to-mint-300 bg-clip-text text-transparent">
              actually trust
            </span>
            .
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-white/60">
            Every caretaker on CareMate passes a four-step document review before a single shift is booked. Sign in to
            explore the customer, caretaker and admin workspaces with seeded demo data.
          </p>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {points.map((p) => (
              <li
                key={p}
                className="flex items-start gap-2.5 rounded-xl border border-white/10 bg-white/5 p-3 text-sm leading-snug text-white/85 backdrop-blur-sm"
              >
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-mint-200/20 text-mint-200">
                  <ShieldCheck className="h-3.5 w-3.5" />
                </span>
                {p}
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3 border-t border-white/10 pt-6">
            {[
              { value: '4,200+', label: 'Verified caretakers' },
              { value: '18', label: 'Cities served' },
              { value: '24×7', label: 'SOS desk' },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="font-display text-xl font-extrabold tabular-nums text-white">{stat.value}</p>
                <p className="text-[11px] uppercase tracking-wider text-white/45">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-xs text-white/45">
          OTP, identity verification, camera, QR and payment flows are simulated in this demo.
        </p>
      </div>

      {/* compact brand band — the dark panel is hidden below lg */}
      <div className="relative overflow-hidden bg-gradient-to-br from-primary-950 via-primary-900 to-primary-800 px-5 py-6 lg:hidden">
        <div
          className="absolute -right-16 -top-16 h-48 w-48 animate-float-slow rounded-full bg-accent-500/30 blur-3xl"
          aria-hidden="true"
        />
        <div className="grid-pattern-dark grid-fade absolute inset-0 opacity-50" aria-hidden="true" />
        <div className="panel-vignette absolute inset-0" aria-hidden="true" />
        <div className="relative flex items-center justify-between gap-4">
          <Logo light size="lg" />
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[10px] font-bold text-mint-200 backdrop-blur-sm">
            <Sparkles className="h-3 w-3" /> Demo
          </span>
        </div>
        <p className="relative mt-4 font-display text-lg font-extrabold leading-snug text-white">
          Care that families can{' '}
          <span className="bg-gradient-to-r from-accent-300 to-mint-300 bg-clip-text text-transparent">
            actually trust
          </span>
          .
        </p>
      </div>

      <div className="flex min-h-screen flex-col px-5 py-8 sm:px-10 lg:min-h-0 lg:px-14">
        <div className="flex flex-1 items-center justify-center py-8 lg:py-10">
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
