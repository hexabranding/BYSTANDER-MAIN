import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound, ShieldCheck } from 'lucide-react'
import { useDocumentTitle } from '@/hooks/useUi'
import { useAuth } from '@/context/AuthContext'
import { FormField, Input } from '@/components/forms/FormField'
import { Button } from '@/components/common/Button'
import { Card, CardBody } from '@/components/common/Card'

const strength = (value = '') => {
  let score = 0
  if (value.length >= 8) score += 1
  if (/[A-Z]/.test(value)) score += 1
  if (/[0-9]/.test(value)) score += 1
  if (/[^A-Za-z0-9]/.test(value)) score += 1
  return score
}

const STRENGTH_LABELS = ['Too short', 'Weak', 'Fair', 'Good', 'Strong']
const STRENGTH_TONES = ['bg-danger-500', 'bg-danger-500', 'bg-warning-400', 'bg-accent-400', 'bg-success-500']

export function ResetPasswordPage() {
  useDocumentTitle('Set a new password')
  const navigate = useNavigate()
  const location = useLocation()
  const { updateProfile } = useAuth()

  const email = location.state?.email || ''
  const [show, setShow] = useState(false)
  const [done, setDone] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({ mode: 'onTouched', defaultValues: { password: '', confirm: '' } })

  const password = watch('password')
  const score = strength(password)

  const onSubmit = async ({ password: next }) => {
    await new Promise((resolve) => setTimeout(resolve, 650))
    // Frontend demo: the new password is kept only in this browser's session.
    updateProfile({ password: next })
    setDone(true)
    toast.success('Password updated', { description: 'Sign in with your new password.' })
    setTimeout(() => navigate('/login', { replace: true }), 1800)
  }

  if (done) {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <Card>
          <CardBody className="space-y-4 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-success-50 text-success-600">
              <CheckCircle2 className="h-6 w-6" />
            </span>
            <div>
              <h1 className="font-display text-lg font-bold text-ink">Password changed</h1>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Taking you to the sign-in page — use your new password to continue.
              </p>
            </div>
          </CardBody>
        </Card>
      </motion.div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide text-primary-700">Account recovery</p>
        <h1 className="mt-1 font-display text-2xl font-extrabold text-ink">Set a new password</h1>
        <p className="mt-1.5 text-sm text-muted">
          {email ? (
            <>
              Resetting the password for <span className="font-semibold text-ink">{email}</span>.
            </>
          ) : (
            'Choose a password you have not used before.'
          )}
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <FormField
          label="New password"
          htmlFor="reset-password"
          required
          error={errors.password?.message}
          hint="At least 8 characters, with a number"
        >
          <div className="relative">
            <Input
              id="reset-password"
              type={show ? 'text' : 'password'}
              placeholder="Enter new password"
              autoComplete="new-password"
              autoFocus
              error={errors.password?.message}
              className="pr-11"
              {...register('password', {
                required: 'Password is required',
                minLength: { value: 8, message: 'Use at least 8 characters' },
              })}
            />
            <button
              type="button"
              onClick={() => setShow((value) => !value)}
              className="absolute top-1/2 right-3 -translate-y-1/2 text-faint transition hover:text-primary-700"
              aria-label={show ? 'Hide password' : 'Show password'}
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </FormField>

        {password ? (
          <div className="flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full transition-all duration-300 ${STRENGTH_TONES[score]}`}
                style={{ width: `${(score / 4) * 100}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-muted">{STRENGTH_LABELS[score]}</span>
          </div>
        ) : null}

        <FormField label="Confirm password" htmlFor="reset-confirm" required error={errors.confirm?.message}>
          <Input
            id="reset-confirm"
            type={show ? 'text' : 'password'}
            placeholder="Re-enter new password"
            autoComplete="new-password"
            error={errors.confirm?.message}
            {...register('confirm', {
              required: 'Please confirm your password',
              validate: (value) => value === password || 'Passwords do not match',
            })}
          />
        </FormField>

        <Button type="submit" size="lg" className="w-full" loading={isSubmitting} iconRight={KeyRound}>
          Save new password
        </Button>

        <p className="flex items-start gap-2 rounded-xl bg-mint-50 px-3.5 py-3 text-xs leading-relaxed text-primary-900">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary-700" />
          Password resets require verified credentials. Check your registered contact for confirmation.
        </p>
      </form>

      <p className="text-center text-sm text-muted">
        Remembered your password?{' '}
        <Link to="/login" className="inline-flex items-center gap-1 font-semibold text-primary-700 hover:underline">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
        </Link>
      </p>
    </div>
  )
}

export default ResetPasswordPage
