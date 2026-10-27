import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import {
  ArrowRight,
  ChevronDown,
  Eye,
  EyeOff,
  HeartHandshake,
  KeyRound,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Sparkles,
  Stethoscope,
  Zap,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { useDocumentTitle } from '@/hooks/useUi'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { useAuth } from '@/context/AuthContext'
import { FormField, Input } from '@/components/forms/FormField'
import { Button } from '@/components/common/Button'
import { requestGuestOtp } from '@/services/authService'
import { DEMO_USERS, DEMO_PASSWORD } from '@/data/demoUsers'
import { initials } from '@/utils/format'

const PUBLIC_ROLE_OPTIONS = [
  {
    id: 'customer',
    label: 'Customer',
    icon: HeartHandshake,
    heading: 'Welcome back',
    subtitle: 'Sign in to book verified caretakers for your family.',
    demoEmail: 'priya.sharma@example.com',
  },
  {
    id: 'caregiver',
    label: 'Caretaker',
    icon: Stethoscope,
    heading: 'Caretaker sign-in',
    subtitle: 'Track your shifts, earnings and verification progress.',
    demoEmail: 'ananya.deshmukh@example.com',
  },
  {
    id: 'ambulance',
    label: 'Ambulance',
    icon: Siren,
    heading: 'Ambulance Driver sign-in',
    subtitle: 'Manage your emergency on-call status and vehicle details.',
    demoEmail: '8075608884',
  },
]

const ADMIN_ROLE_OPTION = {
  id: 'admin',
  label: 'Admin',
  icon: ShieldCheck,
  heading: 'Operations sign-in',
  subtitle: 'Review verifications, payouts, complaints and SOS alerts.',
  demoEmail: 'admin@caremate.in',
}

const homeFor = (role) =>
  role === 'admin'
    ? '/admin/dashboard'
    : role === 'caregiver'
    ? '/caregiver/dashboard'
    : role === 'ambulance'
    ? '/ambulance/dashboard'
    : '/customer/dashboard'

export function LoginPage({ adminOnly = false }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { login, guestLogin } = useAuth()
  const [rememberedEmail, setRememberedEmail] = useLocalStorage('caremate.rememberedEmail', '')
  const redirectTo = location.state?.from || null

  const isAdminPortal = adminOnly || location.pathname === '/admin/login'

  useDocumentTitle(isAdminPortal ? 'Operations Administrator Sign in · Bystander' : 'Sign in · Bystander')

  // If someone explicitly accesses /login?role=admin, redirect them to the dedicated admin portal URL
  if (!isAdminPortal && searchParams.get('role') === 'admin') {
    return <Navigate to="/admin/login" replace />
  }

  const initialRole = isAdminPortal
    ? 'admin'
    : PUBLIC_ROLE_OPTIONS.some((r) => r.id === searchParams.get('role'))
    ? searchParams.get('role')
    : 'customer'

  const [role, setRole] = useState(initialRole)
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(Boolean(rememberedEmail))
  const [showDemo, setShowDemo] = useState(false)
  const [statusNotice, setStatusNotice] = useState(null)

  // Urgent Guest Login State
  const [guestStep, setGuestStep] = useState(null) // null | 'email' | 'otp'
  const [guestEmail, setGuestEmail] = useState('')
  const [guestOtp, setGuestOtp] = useState('')
  const [guestLoading, setGuestLoading] = useState(false)

  const handleRequestGuestOtp = async (e) => {
    e?.preventDefault?.()
    const clean = String(guestEmail || '').trim().toLowerCase()
    if (!clean || !clean.includes('@')) {
      toast.error('Please enter a valid email address.')
      return
    }
    setGuestLoading(true)
    try {
      const res = await requestGuestOtp(clean)
      if (res.ok) {
        setGuestStep('otp')
        toast.success('Verification code sent!', {
          description: `Enter the 6-digit code sent to ${clean}`,
        })
        if (res.data?.devOtp) {
          toast.info(`Development test code: ${res.data.devOtp}`, { duration: 8000 })
        }
      } else {
        toast.error(res.message || 'Failed to send OTP')
      }
    } catch (err) {
      toast.error(err.message || 'Failed to request code')
    } finally {
      setGuestLoading(false)
    }
  }

  const handleVerifyGuestOtp = async (e) => {
    e?.preventDefault?.()
    const cleanOtp = String(guestOtp || '').trim()
    if (!cleanOtp || cleanOtp.length < 6) {
      toast.error('Please enter the complete 6-digit verification code.')
      return
    }
    setGuestLoading(true)
    try {
      const res = await guestLogin({ email: guestEmail, otp: cleanOtp })
      if (res.ok && res.user) {
        toast.success(`Welcome, ${res.user.name}!`, {
          description: 'You are signed in as a guest. You can book a caretaker directly.',
        })
        const canUseRedirect =
          redirectTo && typeof redirectTo === 'string' && !redirectTo.includes('/login')
        navigate(canUseRedirect ? redirectTo : '/customer/dashboard', { replace: true })
      } else {
        toast.error(res.message || 'Invalid verification code')
      }
    } catch (err) {
      toast.error(err.message || 'Verification failed')
    } finally {
      setGuestLoading(false)
    }
  }

  const activeRole = isAdminPortal
    ? ADMIN_ROLE_OPTION
    : PUBLIC_ROLE_OPTIONS.find((r) => r.id === role) || PUBLIC_ROLE_OPTIONS[0]

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    mode: 'onTouched',
    defaultValues: { email: rememberedEmail || '', password: '' },
  })

  const onSubmit = async ({ email, password }) => {
    const effectiveRole = isAdminPortal ? 'admin' : role
    const result = await login({ email: email.trim(), password, role: effectiveRole })
    if (!result.ok) {
      const isRestricted =
        result.error?.status === 403 ||
        /suspended|blocked|blacklist|prohibited/i.test(result.message)

      if (isRestricted) {
        setStatusNotice(result.message)
        toast.error(result.message, { duration: 7000 })
        setError('password', { type: 'server', message: result.message })
      } else {
        setStatusNotice(null)
        toast.error(result.message)
        setError('password', { type: 'server', message: result.message })
      }
      return
    }
    setStatusNotice(null)
    if (remember) setRememberedEmail(email.trim())
    else setRememberedEmail('')
    toast.success(`Welcome back, ${result.user.name}`)
    const roleHome = homeFor(result.user.role)
    const canUseRedirect =
      redirectTo && typeof redirectTo === 'string' && redirectTo.startsWith(roleHome.replace('/dashboard', ''))
    navigate(canUseRedirect ? redirectTo : roleHome, { replace: true })
  }

  const applyDemoAccount = (user) => {
    setStatusNotice(null)
    setValue('email', user.email, { shouldDirty: true, shouldTouch: true, shouldValidate: true })
    setValue('password', DEMO_PASSWORD, { shouldDirty: true, shouldTouch: true, shouldValidate: true })
    if (!isAdminPortal) {
      setRole(user.role)
    }
    setShowDemo(false)
    toast.info(`Filled in ${user.name}'s demo credentials`)
  }

  return (
    <div className="space-y-5">
      {/* ---------------- header ---------------- */}
      <div className="flex items-start gap-3.5">
        <span
          className={cn(
            'grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-white',
            isAdminPortal
              ? 'bg-gradient-to-br from-slate-800 to-slate-950 shadow-[0_14px_28px_-14px_rgba(15,23,42,0.9)]'
              : 'bg-gradient-to-br from-primary-700 to-primary-900 shadow-[0_14px_28px_-14px_rgba(15,118,110,0.9)]',
          )}
          aria-hidden="true"
        >
          <activeRole.icon className="h-5.5 w-5.5" />
        </span>
        <div className="min-w-0">
          <p
            className={cn(
              'text-[11px] font-bold uppercase tracking-[0.18em]',
              isAdminPortal ? 'text-slate-700 font-extrabold' : 'text-primary-700',
            )}
          >
            {isAdminPortal ? 'Operations Administrator' : `${activeRole.label} account`}
          </p>
          <h1 className="mt-0.5 font-display text-2xl font-extrabold text-ink">{activeRole.heading}</h1>
          <p className="mt-1 text-sm text-muted">{activeRole.subtitle}</p>
        </div>
      </div>

      {/* ---------------- role switcher (public login only) ---------------- */}
      {!isAdminPortal ? (
        <div
          role="group"
          aria-label="Choose account type"
          className="grid grid-cols-3 gap-1.5 rounded-card border border-line bg-slate-100/80 p-1.5"
        >
          {PUBLIC_ROLE_OPTIONS.map((option) => {
            const selected = option.id === role
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  setRole(option.id)
                  setStatusNotice(null)
                }}
                aria-pressed={selected}
                className={cn(
                  'flex items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-xs font-bold transition',
                  selected
                    ? 'bg-white text-primary-800 shadow-card ring-1 ring-line'
                    : 'text-muted hover:text-ink',
                )}
              >
                <option.icon className={cn('h-4 w-4 shrink-0', selected && 'text-primary-700')} />
                <span className="truncate">{option.label}</span>
              </button>
            )
          })}
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-700">
          <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>Restricted Portal: System credentials with administrator privileges required.</span>
        </div>
      )}

      {/* ---------------- form ---------------- */}
      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="space-y-4 rounded-card border border-line bg-white p-5 shadow-card sm:p-6"
      >
        {statusNotice ? (
          <div
            role="alert"
            className="rounded-2xl border border-danger-200 bg-danger-50/90 p-4 shadow-sm animate-in fade-in slide-in-from-top-1"
          >
            <div className="flex items-start gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-danger-100 text-danger-700">
                <ShieldAlert className="h-4.5 w-4.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-wider text-danger-900">
                  Account Access Restricted
                </p>
                <p className="mt-1 text-sm font-medium leading-relaxed text-danger-800">
                  {statusNotice}
                </p>
                <div className="mt-2.5 flex items-center gap-3">
                  <a
                    href="mailto:support@bystander.com?subject=Account%20Suspension%20Inquiry"
                    className="inline-flex items-center gap-1 text-xs font-bold text-danger-700 hover:text-danger-900 hover:underline"
                  >
                    Contact platform support &rarr;
                  </a>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <FormField label="Email address" htmlFor="login-email" required error={errors.email?.message}>
          <Input
            id="login-email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            autoFocus
            error={errors.email?.message}
            {...register('email', {
              required: 'Email is required',
              pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email address' },
            })}
          />
        </FormField>

        <FormField
          label="Password"
          htmlFor="login-password"
          required
          error={errors.password?.message}
          hint={`Demo password for all seeded accounts: ${DEMO_PASSWORD}`}
        >
          <div className="relative">
            <Input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your password"
              autoComplete="current-password"
              className="pr-11"
              error={errors.password?.message}
              {...register('password', {
                required: 'Password is required',
                minLength: { value: 6, message: 'Password must be at least 6 characters' },
              })}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-1 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-muted transition hover:bg-slate-100 hover:text-ink"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </FormField>

        <div className="flex items-center justify-between gap-3">
          <label htmlFor="login-remember" className="flex cursor-pointer items-center gap-2 text-sm text-ink-soft">
            <input
              id="login-remember"
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="h-4 w-4 rounded border-line-strong accent-[#0F766E]"
            />
            Remember me
          </label>
          <Link to="/forgot-password" className="text-sm font-semibold text-primary-700 hover:text-primary-800">
            Forgot password?
          </Link>
        </div>

        <Button type="submit" size="lg" className="w-full" loading={isSubmitting} iconRight={ArrowRight}>
          Sign in
        </Button>
      </form>

      {/* ---------------- demo accounts ---------------- */}
      {(() => {
        const availableDemoUsers = DEMO_USERS.filter((u) =>
          isAdminPortal ? u.role === 'admin' : u.role !== 'admin',
        )
        if (availableDemoUsers.length === 0) return null

        return (
          <div className="overflow-hidden rounded-card border border-line bg-white shadow-card">
            <button
              type="button"
              onClick={() => setShowDemo((v) => !v)}
              aria-expanded={showDemo}
              aria-controls="demo-account-list"
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-slate-50"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-mint-100 text-primary-700">
                <KeyRound className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-ink">Demo accounts</span>
                <span className="block text-xs text-muted">
                  {availableDemoUsers.length} profile{availableDemoUsers.length > 1 ? 's' : ''} · password{' '}
                  <span className="font-semibold text-ink-soft">{DEMO_PASSWORD}</span>
                </span>
              </span>
              <span className="rounded-full bg-warning-50 px-2 py-0.5 text-[11px] font-bold text-warning-700 ring-1 ring-inset ring-warning-400/50">
                Demo only
              </span>
              <ChevronDown
                className={cn(
                  'h-4 w-4 shrink-0 text-faint transition-transform duration-200',
                  showDemo && 'rotate-180',
                )}
              />
            </button>

            {showDemo ? (
              <ul id="demo-account-list" className="space-y-2 border-t border-line px-4 py-4">
                {availableDemoUsers.map((user) => (
                  <li
                    key={user.id}
                    className="flex items-center gap-3 rounded-xl border border-line bg-slate-50/70 p-2.5"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-mint-100 text-xs font-bold text-primary-800">
                      {initials(user.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
                      <p className="truncate text-xs capitalize text-muted">
                        {user.role} · {user.email}
                      </p>
                    </div>
                    <Button variant="secondary" size="xs" onClick={() => applyDemoAccount(user)}>
                      Use this
                    </Button>
                  </li>
                ))}
                <li className="flex items-start gap-2 pt-1 text-[11px] leading-relaxed text-faint">
                  <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Selecting a profile fills the form above — then press Sign in.
                </li>
              </ul>
            ) : null}
          </div>
        )
      })()}

      {/* ---------------- urgent guest login ---------------- */}
      {!isAdminPortal && (
        <div className="rounded-card border border-emerald-300 bg-gradient-to-br from-emerald-50 via-teal-50/50 to-white p-4.5 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-700 text-white shadow-sm">
              <Zap className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-extrabold text-ink">Urgent Care? Fast-Track Guest Login</span>
                <span className="rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-primary-800">
                  Instant Access
                </span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                Need to book a caretaker immediately? Skip full registration and sign in with just your Email & OTP.
              </p>

              {!guestStep ? (
                <div className="mt-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setGuestStep('email')}
                    className="border-primary-600 bg-white font-bold text-primary-800 hover:bg-primary-50 text-xs shadow-sm"
                  >
                    Continue as Guest with OTP &rarr;
                  </Button>
                </div>
              ) : guestStep === 'email' ? (
                <form onSubmit={handleRequestGuestOtp} className="mt-3 space-y-2.5">
                  <div className="flex gap-2">
                    <Input
                      type="email"
                      value={guestEmail}
                      onChange={(e) => setGuestEmail(e.target.value)}
                      placeholder="Enter your email address"
                      autoFocus
                      required
                      className="bg-white text-xs h-9"
                    />
                    <Button
                      type="submit"
                      size="sm"
                      loading={guestLoading}
                      className="shrink-0 bg-primary-700 text-white hover:bg-primary-800 text-xs"
                    >
                      Send OTP
                    </Button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setGuestStep(null)}
                    className="text-[11px] font-semibold text-muted hover:text-ink"
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyGuestOtp} className="mt-3 space-y-2.5">
                  <p className="text-[11px] text-muted">
                    Enter the 6-digit verification code sent to <strong className="text-ink">{guestEmail}</strong>:
                  </p>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      maxLength={6}
                      value={guestOtp}
                      onChange={(e) => setGuestOtp(e.target.value.replace(/\D/g, ''))}
                      placeholder="6-digit OTP"
                      autoFocus
                      required
                      className="font-mono text-center tracking-widest bg-white text-sm h-9"
                    />
                    <Button
                      type="submit"
                      size="sm"
                      loading={guestLoading}
                      className="shrink-0 bg-primary-700 text-white hover:bg-primary-800 text-xs"
                    >
                      Verify & Enter
                    </Button>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <button
                      type="button"
                      onClick={() => handleRequestGuestOtp({ preventDefault: () => {} })}
                      className="font-semibold text-primary-700 hover:underline"
                    >
                      Resend OTP
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setGuestStep(null)
                        setGuestOtp('')
                      }}
                      className="font-semibold text-muted hover:text-ink"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---------------- footer links ---------------- */}
      <div className="rounded-card border border-dashed border-line-strong bg-slate-50/60 px-4 py-4 text-center text-sm">
        {isAdminPortal ? (
          <p className="text-muted text-xs leading-relaxed">
            Restricted operations portal for authorized personnel.{' '}
            <Link to="/login" className="font-semibold text-primary-700 hover:text-primary-800">
              Return to public sign-in &rarr;
            </Link>
          </p>
        ) : (
          <>
            <p className="text-muted">
              New to CareMate?{' '}
              <Link to="/register" className="font-semibold text-primary-700 hover:text-primary-800">
                Create an account
              </Link>
            </p>
            <p className="mt-2 text-muted">
              Are you a caretaker or nurse?{' '}
              <Link to="/register/caregiver" className="font-semibold text-primary-700 hover:text-primary-800">
                Apply to join
              </Link>
            </p>
            <p className="mt-2 text-muted">
              Ambulance driver or emergency service?{' '}
              <Link to="/register/ambulance" className="font-semibold text-primary-700 hover:text-primary-800">
                Register your ambulance &rarr;
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}

export default LoginPage
