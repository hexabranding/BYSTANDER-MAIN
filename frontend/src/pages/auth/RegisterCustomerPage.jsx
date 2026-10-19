import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  Info,
  MapPin,
  Pencil,
  Smartphone,
  UserRound,
  UsersRound,
} from 'lucide-react'
import { useDocumentTitle } from '@/hooks/useUi'
import { useAuth } from '@/context/AuthContext'
import { useData } from '@/context/DataContext'
import { FormField, Input, Textarea, Select } from '@/components/forms/FormField'
import { Button } from '@/components/common/Button'
import { Card, CardBody } from '@/components/common/Card'
import { ProgressBar } from '@/components/common/Tabs'
import { CITIES, CARE_TYPES } from '@/utils/constants'
import { cn } from '@/utils/cn'

const STEPS = [
  { key: 'personal', label: 'Personal', icon: UserRound },
  { key: 'address', label: 'Address', icon: MapPin },
  { key: 'patient', label: 'Patient', icon: UsersRound },
  { key: 'review', label: 'Review', icon: CheckCircle2 },
]

const STEP_FIELDS = [
  ['fullName', 'mobile', 'email', 'password', 'confirmPassword'],
  ['address', 'city', 'area', 'pincode'],
  ['patientName', 'patientAge', 'patientRelation', 'patientCondition', 'preferredCareType'],
  [],
]

const validateMobile = (value) => {
  const digits = String(value || '').replace(/\D/g, '')
  if (!digits) return 'Mobile number is required'
  if (!/^([6-9]\d{9}|91[6-9]\d{9})$/.test(digits)) return 'Enter a valid 10-digit Indian mobile number'
  return true
}

const passwordScore = (password = '') => {
  let score = 0
  if (password.length >= 8) score += 1
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1
  if (/\d/.test(password)) score += 1
  if (/[^A-Za-z0-9]/.test(password)) score += 1
  return password ? Math.min(score, 4) : 0
}

const STRENGTH_LABELS = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong']
const STRENGTH_TONES = ['bg-danger-500', 'bg-warning-400', 'bg-accent-400', 'bg-success-500', 'bg-success-600']
const STRENGTH_TEXT = ['text-danger-600', 'text-warning-600', 'text-accent-600', 'text-success-600', 'text-success-700']

function PasswordStrength({ value }) {
  const score = passwordScore(value)
  return (
    <div className="space-y-1.5">
      <div className="flex gap-1.5" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={cn('h-1.5 flex-1 rounded-full transition-colors', i < score ? STRENGTH_TONES[score] : 'bg-slate-100')}
          />
        ))}
      </div>
      <p className={cn('text-xs font-semibold', value ? STRENGTH_TEXT[score] : 'text-muted')}>
        {value ? `Password strength: ${STRENGTH_LABELS[score]}` : 'Use 8+ characters with letters, numbers & a symbol'}
      </p>
    </div>
  )
}

function StepIndicator({ step }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[11px] font-semibold">
        {STEPS.map((s, i) => (
          <span
            key={s.key}
            className={cn(
              'flex items-center gap-1.5 transition-colors',
              i === step ? 'text-primary-700' : i < step ? 'text-ink-soft' : 'text-faint',
            )}
          >
            {i < step ? (
              <span className="grid h-5 w-5 place-items-center rounded-full bg-primary-700 text-white">
                <Check className="h-3 w-3" />
              </span>
            ) : (
              <span
                className={cn(
                  'grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold',
                  i === step ? 'bg-primary-700 text-white' : 'bg-slate-100 text-muted',
                )}
              >
                {i + 1}
              </span>
            )}
            <span className="hidden sm:inline">{s.label}</span>
          </span>
        ))}
      </div>
      <ProgressBar value={step} max={STEPS.length - 1} />
    </div>
  )
}

function ReviewRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="max-w-[60%] text-right text-sm font-semibold text-ink">{value || '—'}</dd>
    </div>
  )
}

export function RegisterCustomerPage() {
  useDocumentTitle('Register as customer')
  const navigate = useNavigate()
  const { registerCustomer: registerUser } = useAuth()
  const { registerCustomerRecord } = useData()
  const [step, setStep] = useState(0)
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    trigger,
    getValues,
    control,
    formState: { errors, isSubmitting },
  } = useForm({
    mode: 'onTouched',
    defaultValues: {
      fullName: '',
      mobile: '',
      email: '',
      password: '',
      confirmPassword: '',
      address: '',
      city: '',
      area: '',
      pincode: '',
      patientName: '',
      patientAge: '',
      patientRelation: '',
      patientCondition: '',
      preferredCareType: '',
    },
  })

  const password = useWatch({ control, name: 'password' })

  const goNext = async () => {
    const valid = await trigger(STEP_FIELDS[step], { shouldFocus: true })
    if (valid) {
      setStep((s) => Math.min(s + 1, STEPS.length - 1))
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const goBack = () => {
    setStep((s) => Math.max(s - 1, 0))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const onSubmit = async (values) => {
    const payload = {
      fullName: values.fullName.trim(),
      mobile: values.mobile.trim(),
      email: values.email.trim(),
      password: values.password,
      address: values.address.trim(),
      city: values.city,
      area: values.area.trim(),
      pincode: values.pincode.trim(),
      patientInfo: {
        name: values.patientName.trim(),
        age: Number(values.patientAge),
        relation: values.patientRelation.trim(),
        condition: values.patientCondition.trim(),
        preferredCareType: values.preferredCareType || '',
      },
    }
    const result = await registerUser(payload)
    if (!result.ok) {
      toast.error(result.message || 'Could not create your account. Please try again.')
      return
    }
    registerCustomerRecord({
      id: result.user.id,
      name: payload.fullName,
      email: payload.email,
      phone: payload.mobile,
      city: payload.city,
      area: payload.area,
      address: payload.address,
      patientInfo: payload.patientInfo,
    })
    toast.success('Account created successfully.')
    navigate('/customer/dashboard', { replace: true })
  }

  const handleFormSubmit = (event) => {
    event.preventDefault()
    if (step < STEPS.length - 1) {
      goNext()
      return
    }
    handleSubmit(onSubmit)()
  }

  const values = getValues()

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide text-primary-700">Customer registration</p>
        <h1 className="mt-1 font-display text-2xl font-extrabold text-ink">Tell us about your care needs</h1>
        <p className="mt-1.5 text-sm text-muted">A few quick steps — we&apos;ll match caretakers to your requirements.</p>
      </div>

      <StepIndicator step={step} />

      <Card>
        <CardBody>
          <form onSubmit={handleFormSubmit} noValidate className="space-y-5">
            {step === 0 ? (
              <div className="space-y-4">
                <h2 className="font-display text-base font-bold text-ink">Personal details</h2>

                <FormField label="Full name" htmlFor="c-fullName" required error={errors.fullName?.message}>
                  <Input
                    id="c-fullName"
                    placeholder="e.g. Priya Sharma"
                    autoComplete="name"
                    error={errors.fullName?.message}
                    {...register('fullName', {
                      required: 'Full name is required',
                      minLength: { value: 3, message: 'Enter your full name' },
                    })}
                  />
                </FormField>

                <FormField
                  label="Mobile number"
                  htmlFor="c-mobile"
                  required
                  error={errors.mobile?.message}
                  hint="We'll send a one-time password to verify this number"
                >
                  <Input
                    id="c-mobile"
                    type="tel"
                    placeholder="98765 43210"
                    autoComplete="tel-national"
                    error={errors.mobile?.message}
                    {...register('mobile', { validate: validateMobile })}
                  />
                </FormField>

                <FormField label="Email address" htmlFor="c-email" required error={errors.email?.message}>
                  <Input
                    id="c-email"
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

                <FormField label="Password" htmlFor="c-password" required error={errors.password?.message}>
                  <div className="relative">
                    <Input
                      id="c-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Create a strong password"
                      autoComplete="new-password"
                      className="pr-11"
                      error={errors.password?.message}
                      {...register('password', {
                        required: 'Password is required',
                        minLength: { value: 8, message: 'Use at least 8 characters' },
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
                <PasswordStrength value={password} />

                <FormField
                  label="Confirm password"
                  htmlFor="c-confirmPassword"
                  required
                  error={errors.confirmPassword?.message}
                >
                  <Input
                    id="c-confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Re-enter your password"
                    autoComplete="new-password"
                    error={errors.confirmPassword?.message}
                    {...register('confirmPassword', {
                      required: 'Please confirm your password',
                      validate: (value) => value === getValues('password') || 'Passwords do not match',
                    })}
                  />
                </FormField>
              </div>
            ) : null}

            {step === 1 ? (
              <div className="space-y-4">
                <h2 className="font-display text-base font-bold text-ink">Address & location</h2>

                <FormField label="Full address" htmlFor="c-address" required error={errors.address?.message}>
                  <Textarea
                    id="c-address"
                    rows={3}
                    placeholder="Flat / house no., building, street, landmark"
                    error={errors.address?.message}
                    {...register('address', {
                      required: 'Address is required',
                      minLength: { value: 10, message: 'Please enter your complete address' },
                    })}
                  />
                </FormField>

                <FormField label="City" htmlFor="c-city" required error={errors.city?.message}>
                  <Select id="c-city" error={errors.city?.message} {...register('city', { required: 'Select your city' })}>
                    <option value="">Select a city</option>
                    {CITIES.map((city) => (
                      <option key={city} value={city}>
                        {city}
                      </option>
                    ))}
                  </Select>
                </FormField>

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label="Area / locality" htmlFor="c-area" required error={errors.area?.message}>
                    <Input
                      id="c-area"
                      placeholder="e.g. Powai"
                      error={errors.area?.message}
                      {...register('area', { required: 'Area is required' })}
                    />
                  </FormField>

                  <FormField label="Pincode" htmlFor="c-pincode" required error={errors.pincode?.message}>
                    <Input
                      id="c-pincode"
                      inputMode="numeric"
                      placeholder="400076"
                      error={errors.pincode?.message}
                      {...register('pincode', {
                        required: 'Pincode is required',
                        pattern: { value: /^\d{6}$/, message: 'Enter a valid 6-digit pincode' },
                      })}
                    />
                  </FormField>
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="space-y-4">
                <h2 className="font-display text-base font-bold text-ink">Patient information</h2>
                <p className="text-xs text-muted">
                  This helps us recommend the right caretaker skills and experience for your family.
                </p>

                <FormField label="Patient name" htmlFor="c-patientName" required error={errors.patientName?.message}>
                  <Input
                    id="c-patientName"
                    placeholder="Who needs care?"
                    error={errors.patientName?.message}
                    {...register('patientName', { required: 'Patient name is required' })}
                  />
                </FormField>

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label="Patient age" htmlFor="c-patientAge" required error={errors.patientAge?.message}>
                    <Input
                      id="c-patientAge"
                      type="number"
                      min="0"
                      max="120"
                      placeholder="74"
                      error={errors.patientAge?.message}
                      {...register('patientAge', {
                        required: 'Age is required',
                        min: { value: 0, message: 'Enter a valid age' },
                        max: { value: 120, message: 'Enter a valid age' },
                      })}
                    />
                  </FormField>

                  <FormField
                    label="Your relation to patient"
                    htmlFor="c-patientRelation"
                    required
                    error={errors.patientRelation?.message}
                  >
                    <Input
                      id="c-patientRelation"
                      placeholder="e.g. Mother, Father, Self"
                      error={errors.patientRelation?.message}
                      {...register('patientRelation', { required: 'This field is required' })}
                    />
                  </FormField>
                </div>

                <FormField
                  label="Condition & care requirements"
                  htmlFor="c-patientCondition"
                  required
                  error={errors.patientCondition?.message}
                  hint="Surgeries, mobility level, medication schedule, anything a caretaker should know"
                >
                  <Textarea
                    id="c-patientCondition"
                    rows={4}
                    placeholder="e.g. Post hip-replacement recovery, needs help with bathing and walking, mild hypertension"
                    error={errors.patientCondition?.message}
                    {...register('patientCondition', {
                      required: 'Please describe the care requirements',
                      minLength: { value: 10, message: 'Add a little more detail so we can match well' },
                    })}
                  />
                </FormField>

                <FormField
                  label="Preferred care type"
                  htmlFor="c-preferredCareType"
                  hint="Optional — you can decide later while booking"
                >
                  <Select id="c-preferredCareType" {...register('preferredCareType')}>
                    <option value="">No preference yet</option>
                    {CARE_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </Select>
                </FormField>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="space-y-4">
                <h2 className="font-display text-base font-bold text-ink">Review your details</h2>
                <p className="text-xs text-muted">Check everything before we create your account.</p>

                <div className="divide-y divide-line rounded-xl border border-line bg-slate-50/60 px-4 py-2">
                  <div className="flex items-center justify-between pb-2">
                    <p className="flex items-center gap-2 text-sm font-bold text-ink">
                      <UserRound className="h-4 w-4 text-primary-700" /> Personal
                    </p>
                    <Button variant="ghost" size="xs" onClick={() => setStep(0)} icon={Pencil}>
                      Edit
                    </Button>
                  </div>
                  <dl>
                    <ReviewRow label="Full name" value={values.fullName} />
                    <ReviewRow label="Mobile" value={values.mobile} />
                    <ReviewRow label="Email" value={values.email} />
                    <ReviewRow label="Password" value="••••••••" />
                  </dl>
                </div>

                <div className="divide-y divide-line rounded-xl border border-line bg-slate-50/60 px-4 py-2">
                  <div className="flex items-center justify-between pb-2">
                    <p className="flex items-center gap-2 text-sm font-bold text-ink">
                      <MapPin className="h-4 w-4 text-primary-700" /> Address
                    </p>
                    <Button variant="ghost" size="xs" onClick={() => setStep(1)} icon={Pencil}>
                      Edit
                    </Button>
                  </div>
                  <dl>
                    <ReviewRow label="Address" value={values.address} />
                    <ReviewRow label="City" value={values.city} />
                    <ReviewRow label="Area" value={values.area} />
                    <ReviewRow label="Pincode" value={values.pincode} />
                  </dl>
                </div>

                <div className="divide-y divide-line rounded-xl border border-line bg-slate-50/60 px-4 py-2">
                  <div className="flex items-center justify-between pb-2">
                    <p className="flex items-center gap-2 text-sm font-bold text-ink">
                      <UsersRound className="h-4 w-4 text-primary-700" /> Patient
                    </p>
                    <Button variant="ghost" size="xs" onClick={() => setStep(2)} icon={Pencil}>
                      Edit
                    </Button>
                  </div>
                  <dl>
                    <ReviewRow label="Patient" value={values.patientName} />
                    <ReviewRow label="Age" value={values.patientAge} />
                    <ReviewRow label="Relation" value={values.patientRelation} />
                    <ReviewRow label="Requirements" value={values.patientCondition} />
                    <ReviewRow label="Preferred care" value={values.preferredCareType} />
                  </dl>
                </div>

                <p className="flex items-start gap-2 rounded-xl bg-info-50 p-3 text-xs leading-relaxed text-info-700">
                  <Smartphone className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Mobile OTP verification is simulated in this demo — the next screen accepts the sample code{' '}
                  <span className="font-bold">123456</span>. No real SMS is sent.
                </p>
              </div>
            ) : null}

            <div className="flex items-center gap-3 border-t border-line pt-4">
              {step > 0 ? (
                <Button type="button" variant="outline" onClick={goBack} icon={ArrowLeft}>
                  Back
                </Button>
              ) : null}
              {step < STEPS.length - 1 ? (
                <Button type="button" onClick={goNext} iconRight={ArrowRight} className="flex-1">
                  Continue
                </Button>
              ) : (
                <Button type="submit" loading={isSubmitting} iconRight={CheckCircle2} className="flex-1">
                  Create account
                </Button>
              )}
            </div>
          </form>
        </CardBody>
      </Card>

      <p className="flex items-start gap-1.5 text-center text-xs text-muted sm:justify-center">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          Already registered?{' '}
          <Link to="/login" className="font-semibold text-primary-700 hover:underline">
            Sign in
          </Link>{' '}
          · Want to earn with CareMate?{' '}
          <Link to="/register/caregiver" className="font-semibold text-primary-700 hover:underline">
            Apply as a caretaker
          </Link>
        </span>
      </p>
    </div>
  )
}

export default RegisterCustomerPage
