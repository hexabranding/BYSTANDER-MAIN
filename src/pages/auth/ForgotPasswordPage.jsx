import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { ArrowLeft, ArrowRight, MailCheck, RefreshCw, Timer } from 'lucide-react'
import { useDocumentTitle } from '@/hooks/useUi'
import { FormField, Input } from '@/components/forms/FormField'
import { Button } from '@/components/common/Button'
import { Card, CardBody } from '@/components/common/Card'

const RESEND_SECONDS = 60

const formatTime = (total) => `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`

export function ForgotPasswordPage() {
  useDocumentTitle('Forgot Password')

  const [sentTo, setSentTo] = useState('')
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS)

  const sent = Boolean(sentTo)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    mode: 'onTouched',
    defaultValues: { email: '' },
  })

  useEffect(() => {
    if (!sent || secondsLeft <= 0) return undefined
    const timer = setTimeout(() => setSecondsLeft((value) => value - 1), 1000)
    return () => clearTimeout(timer)
  }, [sent, secondsLeft])

  const onSubmit = async ({ email }) => {
    const value = email.trim()
    await new Promise((resolve) => setTimeout(resolve, 650))
    setSentTo(value)
    setSecondsLeft(RESEND_SECONDS)
    toast.success(`Reset link sent to ${value}`)
  }

  const handleResend = () => {
    handleSubmit(onSubmit)()
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide text-primary-700">Account recovery</p>
        <h1 className="mt-1 font-display text-2xl font-extrabold text-ink">Forgot your password?</h1>
        <p className="mt-1.5 text-sm text-muted">
          Enter the email you registered with and we&apos;ll send you a secure link to set a new password.
        </p>
      </div>

      {sent ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
          <Card>
            <CardBody className="space-y-4 text-center">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-success-50 text-success-600">
                <MailCheck className="h-6 w-6" />
              </span>

              <div>
                <h2 className="font-display text-lg font-bold text-ink">Reset link sent to {sentTo}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  Open the email and click the link to choose a new password. The link is valid for{' '}
                  <span className="font-semibold text-ink">15 minutes</span> and can be used only once.
                </p>
              </div>

              <div className="space-y-3 border-t border-line pt-4">
                <Button
                  variant="outline"
                  icon={secondsLeft > 0 ? Timer : RefreshCw}
                  disabled={secondsLeft > 0}
                  loading={isSubmitting}
                  onClick={handleResend}
                  className="w-full"
                >
                  {secondsLeft > 0 ? `Resend in ${formatTime(secondsLeft)}` : 'Resend link'}
                </Button>
                <Button to="/login" size="lg" icon={ArrowLeft} className="w-full">
                  Back to login
                </Button>
              </div>

              <p className="text-xs text-muted">Email delivery is simulated in this frontend demo.</p>
            </CardBody>
          </Card>
        </motion.div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <FormField
            label="Email address"
            htmlFor="forgot-email"
            required
            error={errors.email?.message}
            hint="We only use this address to send your password reset link"
          >
            <Input
              id="forgot-email"
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

          <Button type="submit" size="lg" className="w-full" loading={isSubmitting} iconRight={ArrowRight}>
            Send reset link
          </Button>

          <p className="text-xs text-muted">Email delivery is simulated in this frontend demo.</p>
        </form>
      )}

      <p className="text-center text-sm text-muted">
        Remembered your password?{' '}
        <Link to="/login" className="font-semibold text-primary-700 hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  )
}

export default ForgotPasswordPage
