import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowRight, CheckCircle2, Eye, EyeOff, HeartHandshake, KeyRound, ShieldCheck, Sparkles, Zap } from 'lucide-react'
import { useDocumentTitle } from '@/hooks/useUi'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { useAuth } from '@/context/AuthContext'
import { FormField, Input } from '@/components/forms/FormField'
import { Button } from '@/components/common/Button'
import { requestGuestOtp, validateGuestOtp } from '@/services/authService'
import { cn } from '@/utils/cn'

export function RegisterCustomerPage() {
  useDocumentTitle('Register as customer · Bystander')
  const navigate = useNavigate()
  const { guestLogin } = useAuth()
  const [rememberedEmail, setRememberedEmail] = useLocalStorage('bystander.rememberedEmail', '')

  const [step, setStep] = useState('email') // 'email' | 'otp' | 'password'
  const [email, setEmail] = useState(rememberedEmail || '')
  const [otp, setOtp] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [remember, setRemember] = useState(Boolean(rememberedEmail))
  const [loading, setLoading] = useState(false)
  const [statusNotice, setStatusNotice] = useState(null)

  const handleRequestOtp = async (e) => {
    e?.preventDefault?.()
    const cleanEmail = String(email || '').trim().toLowerCase()
    if (!cleanEmail || !cleanEmail.includes('@')) {
      toast.error('Please enter a valid email address.')
      return
    }

    setLoading(true)
    setStatusNotice(null)
    try {
      const res = await requestGuestOtp(cleanEmail, 'signup')
      if (res.ok) {
        setStep('otp')
        toast.success('Verification code sent!', {
          description: `Enter the 6-digit code sent to ${cleanEmail}`,
        })
        if (res.data?.devOtp) {
          toast.info(`Development test code: ${res.data.devOtp}`, { duration: 8000 })
        }
      } else {
        setStatusNotice(res.message || 'An account already exists with this email. Please sign in instead.')
        toast.error(res.message || 'An account already exists with this email.')
      }
    } catch (err) {
      const msg = err.message || 'Failed to request verification code'
      setStatusNotice(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async (e) => {
    e?.preventDefault?.()
    const cleanOtp = String(otp || '').trim()
    if (!cleanOtp || cleanOtp.length < 6) {
      toast.error('Please enter the complete 6-digit verification code.')
      return
    }

    setLoading(true)
    try {
      const res = await validateGuestOtp(email.trim().toLowerCase(), cleanOtp)
      if (res.ok) {
        if (remember) setRememberedEmail(email.trim().toLowerCase())
        else setRememberedEmail('')

        setStep('password')
        toast.success('Email verified successfully!', {
          description: 'Now choose a password to complete your account registration.',
        })
      } else {
        toast.error(res.message || 'Invalid verification code')
      }
    } catch (err) {
      toast.error(err.message || 'Verification failed')
    } finally {
      setLoading(false)
    }
  }

  const handleCreatePassword = async (e) => {
    e?.preventDefault?.()
    const cleanPassword = String(password || '').trim()
    const cleanConfirm = String(confirmPassword || '').trim()

    if (!cleanPassword || cleanPassword.length < 6) {
      toast.error('Password must be at least 6 characters long.')
      return
    }

    if (cleanPassword !== cleanConfirm) {
      toast.error('Passwords do not match. Please verify.')
      return
    }

    setLoading(true)
    try {
      const res = await guestLogin({
        email: email.trim().toLowerCase(),
        otp: String(otp || '').trim(),
        password: cleanPassword,
        mode: 'signup',
      })
      if (res.ok && res.user) {
        toast.success('Account created successfully!', {
          description: 'Welcome to Bystander! You can now book verified caretakers.',
        })
        navigate('/customer/dashboard', { replace: true })
      } else {
        toast.error(res.message || 'Failed to create account')
      }
    } catch (err) {
      toast.error(err.message || 'Failed to create account')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* ---------------- header ---------------- */}
      <div className="flex items-start gap-3.5">
        <span
          className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-primary-700 to-primary-900 text-white shadow-[0_14px_28px_-14px_rgba(15,118,110,0.9)]"
          aria-hidden="true"
        >
          {step === 'password' ? <KeyRound className="h-5.5 w-5.5" /> : <HeartHandshake className="h-5.5 w-5.5" />}
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary-700">
            Customer Registration · Step {step === 'email' ? '1 of 3' : step === 'otp' ? '2 of 3' : '3 of 3'}
          </p>
          <h1 className="mt-0.5 font-display text-2xl font-extrabold text-ink">
            {step === 'password' ? 'Create your password' : 'Get started with Bystander'}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {step === 'password'
              ? 'Set a secure password for signing in to your account.'
              : 'Instant access with your email and a one-time verification code.'}
          </p>
        </div>
      </div>

      {/* ---------------- main card ---------------- */}
      <div className="rounded-card border border-line bg-white p-5 shadow-card sm:p-6 transition-all duration-200">
        <div className="flex items-center justify-between border-b border-line pb-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary-700 text-white shadow-xs">
              <Zap className="h-4 w-4" />
            </span>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-wider text-primary-900">
                {step === 'password' ? 'Security Setup' : 'Fast-Track Sign Up'}
              </p>
              <p className="text-[11px] text-muted">
                {step === 'password'
                  ? 'Step 3 of 3 · Final step'
                  : 'Fast-track verification · No lengthy forms'}
              </p>
            </div>
          </div>
          <Link
            to="/login?role=customer"
            className="rounded-lg border border-line bg-slate-50 px-2.5 py-1 text-xs font-semibold text-ink-soft hover:bg-slate-100 transition"
          >
            Sign In Instead
          </Link>
        </div>

        {statusNotice && (
          <div
            role="alert"
            className="mb-4 rounded-2xl border border-primary-200 bg-mint-50/90 p-4 shadow-sm animate-in fade-in slide-in-from-top-1"
          >
            <div className="flex items-start gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary-100 text-primary-800">
                <CheckCircle2 className="h-4.5 w-4.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-wider text-primary-950">
                  Account Already Exists
                </p>
                <p className="mt-1 text-sm font-medium leading-relaxed text-primary-900">
                  {statusNotice}
                </p>
                <div className="mt-2.5 flex items-center gap-3">
                  <Link
                    to="/login?role=customer"
                    className="inline-flex items-center gap-1 text-xs font-bold text-primary-800 hover:text-primary-950 hover:underline"
                  >
                    Go to Sign In &rarr;
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 'email' && (
          <form onSubmit={handleRequestOtp} className="space-y-4">
            <FormField
              label="Email address"
              htmlFor="customer-reg-email"
              required
              hint="We will send a 6-digit verification code to this email"
            >
              <Input
                id="customer-reg-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email address"
                autoFocus
                required
                className="h-11"
              />
            </FormField>

            <div className="flex items-center justify-between gap-3">
              <label
                htmlFor="customer-reg-remember"
                className="flex cursor-pointer items-center gap-2 text-sm text-ink-soft"
              >
                <input
                  id="customer-reg-remember"
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
              loading={loading}
              iconRight={ArrowRight}
            >
              Send Verification Code (OTP)
            </Button>

            <div className="rounded-xl border border-primary-100 bg-mint-50/70 p-3.5 text-xs text-primary-900 flex items-start gap-2.5">
              <Sparkles className="h-4 w-4 shrink-0 text-primary-700 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">Book caretakers immediately</p>
                <p className="text-primary-900/80 leading-relaxed">
                  Your address and patient details will automatically save to your profile when you make your first booking.
                </p>
              </div>
            </div>
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="rounded-xl border border-primary-200 bg-primary-50/70 p-3.5 text-xs text-primary-950 flex items-center justify-between">
              <div className="min-w-0 pr-2">
                <p className="text-[11px] text-primary-800">Verification code sent to:</p>
                <p className="font-bold truncate text-primary-950">{email}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setStep('email')
                  setOtp('')
                }}
                className="shrink-0 font-bold text-primary-800 hover:underline text-xs"
              >
                Change email
              </button>
            </div>

            <FormField
              label="Enter 6-digit verification code"
              htmlFor="customer-reg-otp"
              required
              hint="Check your inbox or spam folder for your 6-digit code"
            >
              <Input
                id="customer-reg-otp"
                type="text"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
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
              loading={loading}
              iconRight={ArrowRight}
            >
              Verify Code &amp; Continue
            </Button>

            <div className="flex items-center justify-between pt-1 text-xs text-muted">
              <button
                type="button"
                onClick={handleRequestOtp}
                disabled={loading}
                className="font-semibold text-primary-700 hover:underline"
              >
                Resend OTP Code
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep('email')
                  setOtp('')
                }}
                className="font-semibold hover:text-ink hover:underline"
              >
                Change Email Address
              </button>
            </div>
          </form>
        )}

        {step === 'password' && (
          <form onSubmit={handleCreatePassword} className="space-y-4">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3.5 text-xs text-emerald-950 flex items-center gap-2.5">
              <CheckCircle2 className="h-4.5 w-4.5 shrink-0 text-emerald-600" />
              <div>
                <span className="font-bold">Email verified:</span> {email}
              </div>
            </div>

            <FormField
              label="Create a password"
              htmlFor="customer-password-input"
              required
              hint="Must be at least 6 characters long"
            >
              <div className="relative">
                <Input
                  id="customer-password-input"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a strong password"
                  autoFocus
                  required
                  minLength={6}
                  className="pr-11 h-11"
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

            <FormField
              label="Confirm password"
              htmlFor="customer-confirm-password-input"
              required
            >
              <div className="relative">
                <Input
                  id="customer-confirm-password-input"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  required
                  minLength={6}
                  className="pr-11 h-11"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-1 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-muted transition hover:bg-slate-100 hover:text-ink"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </FormField>

            <Button
              type="submit"
              size="lg"
              className="w-full bg-primary-700 hover:bg-primary-800 text-white font-bold"
              loading={loading}
              iconRight={ArrowRight}
            >
              Create Account &amp; Go to Dashboard
            </Button>

            <div className="flex items-center justify-between pt-1 text-xs text-muted">
              <button
                type="button"
                onClick={() => {
                  setStep('otp')
                  setPassword('')
                  setConfirmPassword('')
                }}
                disabled={loading}
                className="font-semibold text-primary-700 hover:underline"
              >
                &larr; Back to verification code
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep('email')
                  setOtp('')
                  setPassword('')
                  setConfirmPassword('')
                }}
                disabled={loading}
                className="font-semibold hover:text-ink hover:underline"
              >
                Start Over
              </button>
            </div>
          </form>
        )}
      </div>

      {/* ---------------- footer links ---------------- */}
      <div className="rounded-card border border-dashed border-line-strong bg-slate-50/60 px-4 py-4 text-center text-sm">
        <p className="text-muted">
          Already registered?{' '}
          <Link to="/login?role=customer" className="font-semibold text-primary-700 hover:text-primary-800">
            Sign in to your account &rarr;
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
      </div>
    </div>
  )
}

export default RegisterCustomerPage
