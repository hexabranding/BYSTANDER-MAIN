import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { ArrowRight, Eye, EyeOff, HeartHandshake, KeyRound, ShieldCheck, Stethoscope } from 'lucide-react'
import { useDocumentTitle } from '@/hooks/useUi'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { useAuth } from '@/context/AuthContext'
import { FormField, Input } from '@/components/forms/FormField'
import { Button } from '@/components/common/Button'
import { Tabs } from '@/components/common/Tabs'
import { DEMO_USERS, DEMO_PASSWORD } from '@/data/demoUsers'
import { initials } from '@/utils/format'

const ROLE_OPTIONS = [
  {
    id: 'customer',
    label: 'Customer',
    icon: HeartHandshake,
    heading: 'Welcome back',
    subtitle: 'Sign in to book verified caregivers for your family.',
    demoEmail: 'priya.sharma@example.com',
  },
  {
    id: 'caregiver',
    label: 'Caregiver',
    icon: Stethoscope,
    heading: 'Caregiver sign-in',
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

const ROLE_TABS = ROLE_OPTIONS.map((r) => ({ id: r.id, label: r.label }))

const homeFor = (role) =>
  role === 'admin' ? '/admin/dashboard' : role === 'caregiver' ? '/caregiver/dashboard' : '/customer/dashboard'

export function LoginPage() {
  useDocumentTitle('Sign in')
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { login } = useAuth()
  const [rememberedEmail, setRememberedEmail] = useLocalStorage('caremate.rememberedEmail', '')

  const initialRole = ROLE_OPTIONS.some((r) => r.id === searchParams.get('role')) ? searchParams.get('role') : 'customer'
  const [role, setRole] = useState(initialRole)
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(Boolean(rememberedEmail))

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

  const onSubmit = ({ email, password }) => {
    const result = login({ email: email.trim(), password, role })
    if (!result.ok) {
      toast.error(result.message)
      setError('password', { type: 'server', message: result.message })
      return
    }
    if (remember) setRememberedEmail(email.trim())
    else setRememberedEmail('')
    toast.success(`Welcome back, ${result.user.name}`)
    navigate(homeFor(result.user.role), { replace: true })
  }

  const applyDemoAccount = (user) => {
    setValue('email', user.email, { shouldDirty: true, shouldTouch: true, shouldValidate: true })
    setValue('password', DEMO_PASSWORD, { shouldDirty: true, shouldTouch: true, shouldValidate: true })
    setRole(user.role)
    toast.info(`Filled in ${user.name}'s demo credentials`)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-ink">{activeRole.heading}</h1>
        <p className="mt-1.5 text-sm text-muted">{activeRole.subtitle}</p>
      </div>

      <Tabs tabs={ROLE_TABS} active={role} onChange={setRole} />

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <FormField label="Email address" htmlFor="login-email" required error={errors.email?.message}>
          <Input
            id="login-email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
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
          hint="Demo password for all seeded accounts: caremate123"
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

      <div className="rounded-card border border-line bg-white p-4 shadow-card">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-bold text-ink">
            <KeyRound className="h-4 w-4 text-primary-700" /> Demo accounts
          </p>
          <span className="rounded-full bg-warning-50 px-2 py-0.5 text-[11px] font-bold text-warning-700 ring-1 ring-inset ring-warning-400/50">
            Demo only
          </span>
        </div>
        <p className="mt-1 text-xs text-muted">
          Seeded demo profiles â€” password <span className="font-semibold text-ink-soft">{DEMO_PASSWORD}</span>. Nothing
          here is a real person.
        </p>
        <ul className="mt-3 space-y-2">
          {DEMO_USERS.map((user) => (
            <li key={user.id} className="flex items-center gap-3 rounded-xl border border-line bg-slate-50/70 p-2.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-mint-100 text-xs font-bold text-primary-800">
                {initials(user.name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
                <p className="truncate text-xs capitalize text-muted">
                  {user.role} Â· {user.email}
                </p>
              </div>
              <Button variant="secondary" size="xs" onClick={() => applyDemoAccount(user)}>
                Use this account
              </Button>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-2 text-center text-sm text-muted">
        <p>
          New to CareMate?{' '}
          <Link to="/register" className="font-semibold text-primary-700 hover:text-primary-800">
            Create an account
          </Link>
        </p>
        <p>
          Are you a caregiver or nurse?{' '}
          <Link to="/register/caregiver" className="font-semibold text-primary-700 hover:text-primary-800">
            Apply to join
          </Link>
        </p>
      </div>
    </div>
  )
}

export default LoginPage
