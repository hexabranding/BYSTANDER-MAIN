import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { KeyRound, Pencil, RefreshCw, ShieldCheck, Timer } from 'lucide-react'
import { useDocumentTitle } from '@/hooks/useUi'
import { useAuth } from '@/context/AuthContext'
import { FormField, Input } from '@/components/forms/FormField'
import { Button } from '@/components/common/Button'
import { findDemoUser } from '@/data/demoUsers'

const OTP_LENGTH = 6
const RESEND_SECONDS = 30
const SAMPLE_OTP = '123456'

const ROLE_HOME = {
  customer: '/customer/dashboard',
  caregiver: '/caregiver/dashboard',
  admin: '/admin/dashboard',
}

const formatTime = (total) => `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`

export function VerifyOtpPage() {
  useDocumentTitle('Verify OTP')
  const navigate = useNavigate()
  const location = useLocation()
  const { user, isLoggedIn, login } = useAuth()

  const state = location.state || {}
  const email = state.email || user?.email || 'your registered email'
  const defaultRole = user?.role || findDemoUser(email)?.role
  const next = state.next || ROLE_HOME[defaultRole] || '/'

  const [digits, setDigits] = useState(() => Array(OTP_LENGTH).fill(''))
  const [error, setError] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [shakeKey, setShakeKey] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS)
  const inputsRef = useRef([])

  const code = digits.join('')
  const complete = code.length === OTP_LENGTH

  useEffect(() => {
    if (isLoggedIn) {
      navigate(next, { replace: true })
    }
  }, [isLoggedIn, navigate, next])

  useEffect(() => {
    if (secondsLeft <= 0) return undefined
    const timer = setTimeout(() => setSecondsLeft((value) => value - 1), 1000)
    return () => clearTimeout(timer)
  }, [secondsLeft])

  useEffect(() => {
    inputsRef.current[0]?.focus()
  }, [])

  const focusAt = (index) => {
    inputsRef.current[index]?.focus()
    inputsRef.current[index]?.select?.()
  }

  const replaceDigit = (index, value) =>
    setDigits((prev) => {
      const updated = [...prev]
      updated[index] = value
      return updated
    })

  const spreadCode = (value, start = 0) => {
    const chars = value.replace(/\D/g, '').slice(0, OTP_LENGTH).split('')
    setDigits((prev) => {
      const updated = [...prev]
      chars.forEach((char, offset) => {
        if (start + offset < OTP_LENGTH) updated[start + offset] = char
      })
      return updated
    })
    setError('')
    focusAt(Math.min(start + chars.length, OTP_LENGTH - 1))
  }

  const handleChange = (index, value) => {
    const cleaned = value.replace(/\D/g, '')
    if (!cleaned) {
      replaceDigit(index, '')
      setError('')
      return
    }
    if (cleaned.length > 1) {
      spreadCode(cleaned, index)
      return
    }
    replaceDigit(index, cleaned)
    setError('')
    if (index < OTP_LENGTH - 1) focusAt(index + 1)
  }

  const handleKeyDown = (index, event) => {
    if (event.key === 'Backspace') {
      event.preventDefault()
      if (digits[index]) {
        replaceDigit(index, '')
      } else if (index > 0) {
        replaceDigit(index - 1, '')
        focusAt(index - 1)
      }
      setError('')
      return
    }
    if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault()
      focusAt(index - 1)
      return
    }
    if (event.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
      event.preventDefault()
      focusAt(index + 1)
    }
  }

  const handlePaste = (event) => {
    const pasted = (event.clipboardData?.getData('text') || '').replace(/\D/g, '')
    if (!pasted) return
    event.preventDefault()
    spreadCode(pasted, 0)
  }

  const handleSubmitCode = async (event) => {
    event.preventDefault()
    if (!complete) {
      setError(`Enter all ${OTP_LENGTH} digits of the OTP`)
      setShakeKey((key) => key + 1)
      toast.error('Enter the complete 6-digit OTP')
      return
    }

    setVerifying(true)
    await new Promise((resolve) => setTimeout(resolve, 700))

    if (isLoggedIn) {
      toast.success('Identity verified')
      navigate(next, { replace: true })
      return
    }

    // Only complete a sign-in when the address actually belongs to a demo account —
    // otherwise we would silently log the visitor in as an unrelated seeded user.
    const matched = findDemoUser(email)
    if (!matched) {
      setVerifying(false)
      setError('No pending registration found for this address. Create an account first.')
      setShakeKey((key) => key + 1)
      toast.error('No account found for this email — register first, then verify.')
      return
    }

    const result = login({ email, password: matched.password, role: matched.role })
    if (!result.ok) {
      setVerifying(false)
      setError(result.message)
      setShakeKey((key) => key + 1)
      toast.error(result.message)
      return
    }
    toast.success('OTP verified — you are signed in')
    navigate(next, { replace: true })
  }

  const handleResend = () => {
    setSecondsLeft(RESEND_SECONDS)
    setDigits(Array(OTP_LENGTH).fill(''))
    setError('')
    focusAt(0)
    toast.success(`A new OTP was sent to ${email}`)
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide text-primary-700">Final step</p>
        <h1 className="mt-1 font-display text-2xl font-extrabold text-ink">Verify your identity</h1>
        <p className="mt-1.5 text-sm text-muted">
          Enter the 6-digit code we sent to <span className="font-semibold text-ink">{email}</span>. It expires in 10
          minutes.
        </p>
      </div>

      <form onSubmit={handleSubmitCode} noValidate className="space-y-5">
        <FormField
          label="Verification code"
          htmlFor="otp-0"
          required
          error={error}
          hint="Type the code, or paste all six digits at once"
        >
          <motion.div
            key={shakeKey}
            initial={{ x: 0 }}
            animate={shakeKey > 0 ? { x: [0, -8, 8, -6, 6, 0] } : { x: 0 }}
            transition={{ duration: 0.4 }}
            role="group"
            aria-label={`${OTP_LENGTH} digit verification code`}
            className="flex justify-between gap-2"
          >
            {digits.map((digit, index) => (
              <Input
                key={index}
                ref={(element) => {
                  inputsRef.current[index] = element
                }}
                id={`otp-${index}`}
                value={digit}
                inputMode="numeric"
                autoComplete={index === 0 ? 'one-time-code' : 'off'}
                maxLength={1}
                disabled={verifying}
                aria-label={`Digit ${index + 1} of ${OTP_LENGTH}`}
                error={error}
                className="h-12 w-full px-0 text-center text-lg font-bold sm:w-12"
                onChange={(event) => handleChange(index, event.target.value)}
                onKeyDown={(event) => handleKeyDown(index, event)}
                onPaste={handlePaste}
              />
            ))}
          </motion.div>
        </FormField>

        <Button
          type="submit"
          size="lg"
          className="w-full"
          loading={verifying}
          disabled={!complete}
          iconRight={ShieldCheck}
        >
          Verify &amp; continue
        </Button>

        <div className="flex flex-col items-center gap-3 border-t border-line pt-4 sm:flex-row sm:justify-between">
          <Button
            variant="outline"
            size="sm"
            icon={secondsLeft > 0 ? Timer : RefreshCw}
            disabled={secondsLeft > 0}
            onClick={handleResend}
          >
            {secondsLeft > 0 ? `Resend in ${formatTime(secondsLeft)}` : 'Resend OTP'}
          </Button>
          <Button variant="ghost" size="sm" to="/register" icon={Pencil}>
            Change email
          </Button>
        </div>
      </form>

      <div className="rounded-card border border-line bg-white p-4 shadow-card">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-bold text-ink">
            <KeyRound className="h-4 w-4 text-primary-700" /> Demo verification
          </p>
          <span className="rounded-full bg-warning-50 px-2 py-0.5 text-[11px] font-bold text-warning-700 ring-1 ring-inset ring-warning-400/50">
            Demo only
          </span>
        </div>
        <p className="mt-2 text-sm text-muted">
          Sample OTP:{' '}
          <span className="font-display ml-1 rounded-lg bg-mint-100 px-2 py-1 text-sm font-extrabold tracking-[0.25em] text-primary-800">
            {SAMPLE_OTP}
          </span>
        </p>
        <p className="mt-2 text-xs text-muted">OTP delivery is simulated — any 6 digits are accepted.</p>
      </div>
    </div>
  )
}

export default VerifyOtpPage
