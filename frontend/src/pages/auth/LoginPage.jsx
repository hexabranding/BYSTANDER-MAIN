import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Eye,
  EyeOff,
  HeartHandshake,
  ShieldAlert,
  ShieldCheck,
  Siren,
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

const PUBLIC_ROLE_OPTIONS = [
  {
    id: 'customer',
    label: 'Customer',
    icon: HeartHandshake,
    heading: 'Welcome back',
    subtitle: 'Sign in with your email and a one-time verification code.',
  },
  {
    id: 'caregiver',
    label: 'Caretaker',
    icon: Stethoscope,
    heading: 'Caretaker sign-in',
    subtitle: 'Track your shifts, earnings and verification progress.',
  },
  {
    id: 'ambulance',
    label: 'Ambulance',
    icon: Siren,
    heading: 'Ambulance Driver sign-in',
    subtitle: 'Manage your emergency on-call status and vehicle details.',
  },
]

const ADMIN_ROLE_OPTION = {
  id: 'admin',
  label: 'Admin',
  icon: ShieldCheck,
  heading: 'Operations sign-in',
  subtitle: 'Review verifications, payouts, complaints and SOS alerts.',
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
  const [rememberedEmail, setRememberedEmail] = useLocalStorage('bystander.rememberedEmail', '')
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
  const [statusNotice, setStatusNotice] = useState(null)

  // Unified Customer OTP Login State
  const [customerStep, setCustomerStep] = useState('email') // 'email' | 'otp'
  const [customerEmail, setCustomerEmail] = useState(rememberedEmail || '')
  const [customerOtp, setCustomerOtp] = useState('')
  const [customerLoading, setCustomerLoading] = useState(false)
  const [customerUsePassword, setCustomerUsePassword] = useState(false)

  const handleRequestCustomerOtp = async (e) => {
    e?.preventDefault?.()
    const clean = String(customerEmail || '').trim().toLowerCase()
    if (!clean || !clean.includes('@')) {
      toast.error('Please enter a valid email address.')
      return
    }
    setCustomerLoading(true)
    setStatusNotice(null)
    try {
      const res = await requestGuestOtp(clean, 'login')
      if (res.ok) {
        setCustomerStep('otp')
        toast.success('Verification code sent!', {
          description: `Enter the 6-digit code sent to ${clean}`,
        })
        if (res.data?.devOtp) {
          toast.info(`Development test code: ${res.data.devOtp}`, { duration: 8000 })
        }
      } else {
        setStatusNotice(res.message || 'No customer account found with this email. Please sign up first.')
        toast.error(res.message || 'No customer account found with this email.')
      }
    } catch (err) {
      const msg = err.message || 'Failed to request code'
      setStatusNotice(msg)
      toast.error(msg)
    } finally {
      setCustomerLoading(false)
    }
  }

  const handleVerifyCustomerOtp = async (e) => {
    e?.preventDefault?.()
    const cleanOtp = String(customerOtp || '').trim()
    if (!cleanOtp || cleanOtp.length < 6) {
      toast.error('Please enter the complete 6-digit verification code.')
      return
    }
    setCustomerLoading(true)
    try {
      const res = await guestLogin({ email: customerEmail, otp: cleanOtp, mode: 'login' })
      if (res.ok && res.user) {
        if (remember) setRememberedEmail(customerEmail.trim())
        else setRememberedEmail('')
        toast.success(`Welcome, ${res.user.name}!`, {
          description: 'You are signed in to Bystander.',
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
      setCustomerLoading(false)
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

  const isCustomerOtpForm = role === 'customer' && !isAdminPortal && !customerUsePassword

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
                  if (option.id === 'customer') {
                    setCustomerUsePassword(false)
                  }
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
      <div
        id="login-main-form"
        className="rounded-card border border-line bg-white p-5 shadow-card sm:p-6 transition-all duration-200"
      >
        {isCustomerOtpForm ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary-700 text-white shadow-xs">
                  <HeartHandshake className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-wider text-primary-900">
                    Direct Email Sign-in
                  </p>
                  <p className="text-[11px] text-muted">
                    Instant access · Enter email to receive a 6-digit one-time code
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCustomerUsePassword(true)
                  setValue('email', customerEmail)
                }}
                className="rounded-lg border border-line bg-slate-50 px-2.5 py-1 text-xs font-semibold text-ink-soft hover:bg-slate-100 transition"
              >
                Use Password
              </button>
            </div>

            {statusNotice && (
              <div
                role="alert"
                className="rounded-2xl border border-amber-200 bg-amber-50/90 p-4 shadow-sm animate-in fade-in slide-in-from-top-1"
              >
                <div className="flex items-start gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-800">
                    <ShieldAlert className="h-4.5 w-4.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold uppercase tracking-wider text-amber-900">
                      Account Not Found
                    </p>
                    <p className="mt-1 text-sm font-medium leading-relaxed text-amber-800">
                      {statusNotice}
                    </p>
                    <div className="mt-2.5 flex items-center gap-3">
                      <Link
                        to="/register/customer"
                        className="inline-flex items-center gap-1 text-xs font-bold text-primary-700 hover:text-primary-900 hover:underline"
                      >
                        Create an account now &rarr;
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {customerStep === 'email' ? (
              <form onSubmit={handleRequestCustomerOtp} className="space-y-4">
                <FormField
                  label="Email address"
                  htmlFor="customer-email-input"
                  required
                  hint="We will send a 6-digit verification code. No upfront password required."
                >
                  <Input
                    id="customer-email-input"
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="Enter your email address"
                    autoFocus
                    required
                    className="h-11"
                  />
                </FormField>

                <div className="flex items-center justify-between gap-3">
                  <label
                    htmlFor="customer-remember"
                    className="flex cursor-pointer items-center gap-2 text-sm text-ink-soft"
                  >
                    <input
                      id="customer-remember"
                      type="checkbox"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                      className="h-4 w-4 rounded border-line-strong accent-[#0F766E]"
                    />
                    Remember my email
                  </label>
                </div>

                <Button
                  type="submit"
                  size="lg"
                  className="w-full bg-primary-700 hover:bg-primary-800 text-white font-bold"
                  loading={customerLoading}
                  iconRight={ArrowRight}
                >
                  Send Verification Code (OTP)
                </Button>
              </form>
            ) : (
              <form onSubmit={handleVerifyCustomerOtp} className="space-y-4">
                <div className="rounded-xl border border-primary-200 bg-primary-50/70 p-3.5 text-xs text-primary-950 flex items-center justify-between">
                  <div className="min-w-0 pr-2">
                    <p className="text-[11px] text-primary-800">Verification code sent to:</p>
                    <p className="font-bold truncate text-primary-950">{customerEmail}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setCustomerStep('email')
                      setCustomerOtp('')
                    }}
                    className="shrink-0 font-bold text-primary-800 hover:underline text-xs"
                  >
                    Change email
                  </button>
                </div>

                <FormField
                  label="Enter 6-digit verification code"
                  htmlFor="customer-otp-input"
                  required
                  hint="Check your inbox or spam folder for your 6-digit code"
                >
                  <Input
                    id="customer-otp-input"
                    type="text"
                    maxLength={6}
                    value={customerOtp}
                    onChange={(e) => setCustomerOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="• • • • • •"
                    autoFocus
                    required
                    className="font-mono text-center tracking-[0.3em] text-xl font-bold h-12"
                  />
                </FormField>

                <Button
                  type="submit"
                  size="lg"
                  className="w-full bg-primary-700 hover:bg-primary-800 text-white font-bold"
                  loading={customerLoading}
                  iconRight={ArrowRight}
                >
                  Verify &amp; Sign In
                </Button>

                <div className="flex items-center justify-between pt-1 text-xs text-muted">
                  <button
                    type="button"
                    onClick={handleRequestCustomerOtp}
                    disabled={customerLoading}
                    className="font-semibold text-primary-700 hover:underline"
                  >
                    Resend OTP Code
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCustomerUsePassword(true)
                      setValue('email', customerEmail)
                    }}
                    className="font-semibold hover:text-ink hover:underline"
                  >
                    Use Password Instead
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : (
          <form
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            className="space-y-4"
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

            {!isAdminPortal && role === 'customer' && (
              <div className="pt-1 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setCustomerUsePassword(false)
                    setCustomerStep('email')
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-700 hover:text-primary-800 hover:underline"
                >
                  <Zap className="h-3.5 w-3.5" /> Sign in with Email OTP code instead &rarr;
                </button>
              </div>
            )}
          </form>
        )}
      </div>

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
              New to Bystander?{' '}
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
