import { useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
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
  Sparkles,
  Stethoscope,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { useDocumentTitle } from '@/hooks/useUi'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { useAuth } from '@/context/AuthContext'
import { FormField, Input } from '@/components/forms/FormField'
import { Button } from '@/components/common/Button'
import { DEMO_USERS, DEMO_PASSWORD } from '@/data/demoUsers'
import { initials } from '@/utils/format'

const ROLE_OPTIONS = [
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
    id: 'admin',
    label: 'Admin',
    icon: ShieldCheck,
    heading: 'Operations sign-in',
    subtitle: 'Review verifications, payouts, complaints and SOS alerts.',
    demoEmail: 'admin@caremate.in',
  },
]

const homeFor = (role) =>
  role === 'admin' ? '/admin/dashboard' : role === 'caregiver' ? '/caregiver/dashboard' : '/customer/dashboard'

export function LoginPage() {
  useDocumentTitle('Sign in')
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { login } = useAuth()
  const [rememberedEmail, setRememberedEmail] = useLocalStorage('caremate.rememberedEmail', '')
  const redirectTo = location.state?.from || null

  const initialRole = ROLE_OPTIONS.some((r) => r.id === searchParams.get('role')) ? searchParams.get('role') : 'customer'
  const [role, setRole] = useState(initialRole)
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(Boolean(rememberedEmail))
  const [showDemo, setShowDemo] = useState(false)
  const [statusNotice, setStatusNotice] = useState(null)

  const activeRole = ROLE_OPTIONS.find((r) => r.id === role) || ROLE_OPTIONS[0]

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
    const result = await login({ email: email.trim(), password, role })
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
    setRole(user.role)
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
            'bg-gradient-to-br from-primary-700 to-primary-900',
            'shadow-[0_14px_28px_-14px_rgba(15,118,110,0.9)]',
          )}
          aria-hidden="true"
        >
          <activeRole.icon className="h-5.5 w-5.5" />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary-700">
            {activeRole.label} account
          </p>
          <h1 className="mt-0.5 font-display text-2xl font-extrabold text-ink">{activeRole.heading}</h1>
          <p className="mt-1 text-sm text-muted">{activeRole.subtitle}</p>
        </div>
      </div>

      {/* ---------------- role switcher ---------------- */}
      <div
        role="group"
        aria-label="Choose account type"
        className="grid grid-cols-3 gap-1.5 rounded-card border border-line bg-slate-100/80 p-1.5"
      >
        {ROLE_OPTIONS.map((option) => {
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
              {DEMO_USERS.length} seeded profiles · password{' '}
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
            {DEMO_USERS.map((user) => (
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
              Nothing here is a real person. Selecting a profile fills the form above — then press Sign in.
            </li>
          </ul>
        ) : null}
      </div>

      {/* ---------------- footer links ---------------- */}
      <div className="rounded-card border border-dashed border-line-strong bg-slate-50/60 px-4 py-4 text-center text-sm">
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
      </div>
    </div>
  )
}

export default LoginPage
