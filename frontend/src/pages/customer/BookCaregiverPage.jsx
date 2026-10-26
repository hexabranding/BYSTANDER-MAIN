import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Accessibility,
  ArrowLeft,
  ArrowRight,
  Bandage,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  Home,
  MapPin,
  Moon,
  Pill,
  Plus,
  ShieldCheck,
  Sparkles,
  UserRound,
  Utensils,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/context/AuthContext'
import { useData } from '@/context/DataContext'
import { useDocumentTitle } from '@/hooks/useUi'
import { SERVICES } from '@/data/services'
import { CITIES, GST_RATE, PLATFORM_FEE } from '@/utils/constants'
import { formatCurrency, formatDate } from '@/utils/format'
import { DURATION_GROUPS, durationBasis, formatDuration } from '@/utils/duration'
import { cn } from '@/utils/cn'
import { PageHeader } from '@/components/common/PageHeader'
import { Card, CardBody, CardHeader } from '@/components/common/Card'
import { Button } from '@/components/common/Button'
import { FormField, Input, Select, Textarea } from '@/components/forms/FormField'
import { PriceBreakdown } from '@/components/common/TimelinePrice'
import { RatingStars } from '@/components/common/RatingStars'
import { CardSkeleton } from '@/components/common/States'
import { bookingService, servicesService, caregiversService, isMongoObjectId } from '@/services'

const CARE_REQUIREMENTS = [
  {
    id: 'night-supervision',
    name: 'Night supervision',
    icon: Moon,
    description: 'Continuous overnight bedside alertness, vitals logging, and fall prevention.',
    tag: 'Bedside Protocol',
  },
  {
    id: 'wound-dressing',
    name: 'Wound dressing',
    icon: Bandage,
    description: 'Sterile dressing change, surgical site cleaning, and antiseptic application.',
    tag: 'Clinical Care',
  },
  {
    id: 'mobility-support',
    name: 'Mobility support',
    icon: Accessibility,
    description: 'Bed-to-wheelchair transfers, assisted walking, and physical rehabilitation routines.',
    tag: 'Physical Assistance',
  },
  {
    id: 'vegetarian-meal-prep',
    name: 'Vegetarian meal prep',
    icon: Utensils,
    description: 'Preparation of hygienic vegetarian meals, hydration support & assisted feeding.',
    tag: 'Nutrition & Diet',
  },
  {
    id: 'medication-tracking',
    name: 'Medication reminders',
    icon: Pill,
    description: 'Timely prescription dose tracking, blood pressure checks, and schedule logging.',
    tag: 'Vitals & Dosing',
  },
  {
    id: 'personal-hygiene',
    name: 'Bathing & personal care',
    icon: Sparkles,
    description: 'Bed-sponge baths, assisted washroom visits, oral care, and linen changes.',
    tag: 'Hygiene & Comfort',
  },
]

const RELATIONS = ['Mother', 'Father', 'Grandmother', 'Grandfather', 'Wife', 'Husband', 'Sibling', 'Self', 'Other']

const TIME_OPTIONS = Array.from({ length: 31 }, (_, i) => {
  const mins = 6 * 60 + i * 30
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`
})

const todayISO = () => new Date().toISOString().slice(0, 10)

export function BookCaregiverPage() {
  useDocumentTitle('Book a caretaker')
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const { caregivers, createBooking } = useData()

  const [availableServices, setAvailableServices] = useState(SERVICES)
  const [availableCaregivers, setAvailableCaregivers] = useState([])
  const [loadingCaregivers, setLoadingCaregivers] = useState(true)

  useEffect(() => {
    let isMounted = true
    servicesService
      .getServices()
      .then((res) => {
        const list = Array.isArray(res?.data?.services)
          ? res.data.services
          : Array.isArray(res?.services)
            ? res.services
            : []
        if (isMounted && list.length > 0) {
          setAvailableServices(list)
        }
      })
      .catch(() => {})

    caregiversService
      .getCaregivers()
      .then((res) => {
        const list = Array.isArray(res?.data?.caregivers)
          ? res.data.caregivers
          : Array.isArray(res?.caregivers)
            ? res.caregivers
            : []
        if (isMounted) {
          setAvailableCaregivers(list)
        }
      })
      .catch(() => {
        if (isMounted) {
          setAvailableCaregivers([])
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoadingCaregivers(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  const patientInfo = user?.patientInfo
  const preselectedId = searchParams.get('caregiver') || ''

  const [step, setStep] = useState(0)
  const [maxStep, setMaxStep] = useState(0)
  const [terms, setTerms] = useState(false)
  const [created, setCreated] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [selectedCaregiverId, setSelectedCaregiverId] = useState(
    () => preselectedId || '',
  )

  useEffect(() => {
    if (preselectedId && preselectedId !== selectedCaregiverId) {
      setSelectedCaregiverId(preselectedId)
    }
  }, [preselectedId, selectedCaregiverId])

  const [form, setForm] = useState(() => ({
    service: null,
    patientName: patientInfo?.name || '',
    patientAge: patientInfo?.age ? String(patientInfo.age) : '',
    relation: patientInfo?.relation || 'Mother',
    requirements: patientInfo?.condition || '',
    careType: '',
    address: user?.address || '',
    city: user?.city || CITIES[0],
    area: user?.area || '',
    date: '',
    startTime: '08:00',
    hours: 6,
    instructions: '',
    extras: [],
  }))

  const set = (patchOrFn) =>
    setForm((f) => ({
      ...f,
      ...(typeof patchOrFn === 'function' ? patchOrFn(f) : patchOrFn),
    }))

  const matchedCaregiver = useMemo(() => {
    const targetId = selectedCaregiverId || preselectedId
    if (targetId) {
      const picked = availableCaregivers.find(
        (c) =>
          c.id === targetId ||
          c._id === targetId ||
          String(c.id) === String(targetId) ||
          String(c._id) === String(targetId),
      )
      if (picked) return picked
    }
    return null
  }, [availableCaregivers, selectedCaregiverId, preselectedId])

  // Direct On-Demand Broadcast Flow:
  // Customer enters requirements, and request is broadcast to all active caretakers
  const steps = useMemo(
    () => [
      { id: 'service', label: 'Care service' },
      { id: 'patient', label: 'Patient' },
      { id: 'setting', label: 'Care setting' },
      { id: 'schedule', label: 'Schedule' },
      { id: 'instructions', label: 'Directives' },
      { id: 'price', label: 'Pricing' },
      { id: 'confirm', label: 'Confirm & Broadcast' },
    ],
    [],
  )

  const currentStep = steps[step] || steps[0]
  const currentStepId = currentStep?.id || 'service'

  const rate =
    form.service?.baseHourlyRate ||
    form.service?.startingPrice ||
    matchedCaregiver?.hourlyRate ||
    499
  const hours = Number(form.hours) || 0
  const subtotal = rate * hours
  const platformFee = PLATFORM_FEE
  const tax = Math.round((subtotal + platformFee) * GST_RATE)
  const total = subtotal + platformFee + tax

  const isStepValid = (stepId) => {
    switch (stepId) {
      case 'service':
        return Boolean(form.service)
      case 'patient':
        return Boolean(form.patientName.trim()) && Number(form.patientAge) > 0
      case 'setting':
        return Boolean(form.careType) && Boolean(form.address.trim()) && Boolean(form.city) && Boolean(form.area.trim())
      case 'schedule':
        return Boolean(form.date) && Boolean(form.startTime) && Number(form.hours) > 0
      case 'instructions':
        return true
      case 'price':
        return true
      case 'confirm':
        return terms
      default:
        return false
    }
  }

  const isCurrentStepValid = isStepValid(currentStepId)

  const goNext = () => {
    if (!isCurrentStepValid) return
    const next = Math.min(step + 1, steps.length - 1)
    setStep(next)
    setMaxStep((m) => Math.max(m, next))
  }

  const goBack = () => setStep((s) => Math.max(0, s - 1))

  const jumpTo = (i) => {
    if (i <= maxStep && i < steps.length) setStep(i)
  }

  const [customExtra, setCustomExtra] = useState('')

  const toggleExtra = (extra) => {
    setForm((f) => {
      const current = Array.isArray(f.extras) ? f.extras : []
      const exists = current.includes(extra)
      const nextExtras = exists ? current.filter((e) => e !== extra) : [...current, extra]
      return { ...f, extras: nextExtras }
    })
  }

  const addCustomExtra = () => {
    const trimmed = customExtra.trim()
    if (!trimmed) return
    setForm((f) => {
      const current = Array.isArray(f.extras) ? f.extras : []
      if (current.includes(trimmed)) return f
      return { ...f, extras: [...current, trimmed] }
    })
    setCustomExtra('')
  }

  const removeExtra = (extra) => {
    setForm((f) => {
      const current = Array.isArray(f.extras) ? f.extras : []
      return { ...f, extras: current.filter((e) => e !== extra) }
    })
  }

  const handleConfirm = async () => {
    if (!form.service || submitting) return
    setSubmitting(true)

    try {
      // 1. Resolve Service ObjectId
      let serviceId = form.service?._id || form.service?.id
      if (!isMongoObjectId(serviceId)) {
        const found =
          availableServices.find(
            (s) =>
              isMongoObjectId(s._id || s.id) &&
              (s.name === form.service?.name ||
                s.slug === form.service?.slug ||
                s.name?.toLowerCase() === form.service?.name?.toLowerCase()),
          ) || availableServices.find((s) => isMongoObjectId(s._id || s.id))
        if (found) {
          serviceId = found._id || found.id
        }
      }

      if (!isMongoObjectId(serviceId)) {
        throw new Error(
          'Please ensure a valid service from the system catalog is selected.',
        )
      }

      // 2. Temporal bounds
      if (!form.date || !form.startTime) {
        throw new Error('Please select both a service date and start time.')
      }

      const [startHour, startMin] = (form.startTime || '08:00').split(':').map(Number)
      const [year, month, day] = form.date.split('-').map(Number)
      const localStartDate = new Date(year, month - 1, day, startHour, startMin, 0)

      if (isNaN(localStartDate.getTime())) {
        throw new Error('Invalid start date or time format.')
      }

      if (localStartDate.getTime() <= Date.now()) {
        throw new Error(
          'Scheduled start time must be in the future. Please pick an upcoming date or time.',
        )
      }

      const hoursNum = Math.max(0.5, Math.min(24, Number(form.hours) || 1))
      const localEndDate = new Date(localStartDate.getTime() + hoursNum * 60 * 60 * 1000)

      // Broadcast payload: No caregiverId required. The request broadcasts to all active caretakers!
      const payload = {
        serviceId,
        startDateTime: localStartDate.toISOString(),
        endDateTime: localEndDate.toISOString(),
        timezone: 'Asia/Kolkata',
        location: {
          addressLine: form.address.trim(),
          city: form.city.trim(),
          area: form.area.trim(),
          careSetting: form.careType === 'Hospital Care' ? 'Hospital Care' : 'Home Care',
        },
        patientDetails: {
          name: form.patientName.trim(),
          age: Number(form.patientAge) || 0,
          gender: 'Other',
          specialInstructions: [
            form.instructions.trim() ? `Instructions: ${form.instructions.trim()}` : '',
            form.extras.length > 0 ? `Care Directives: ${form.extras.join(', ')}` : '',
          ]
            .filter(Boolean)
            .join(' · ') || 'Standard shift protocol',
        },
      }

      if (isMongoObjectId(preselectedId)) {
        payload.caregiverId = preselectedId
      }

      const booking = await bookingService.createBooking(payload)

      if (createBooking) {
        createBooking({
          ...booking,
          customerId: user?.id || booking.customerId,
          notes: form.requirements.trim(),
        })
      }

      setCreated(booking)
      toast.success('Booking broadcasted successfully', {
        description: `Reference ${booking.ref} — all active caretakers in ${form.city} have been notified.`,
      })
    } catch (err) {
      toast.error('Booking creation failed', {
        description: err.message || 'Unable to submit booking request to the server.',
      })
    } finally {
      setSubmitting(false)
    }
  }


  /* ---------------- success screen ---------------- */

  if (created) {
    return (
      <div className="space-y-6">
        <PageHeader title="Booking requested" subtitle="Your request has reached our care coordination desk." />
        <Card className="mx-auto max-w-2xl">
          <CardBody className="flex flex-col items-center px-6 py-12 text-center">
            <motion.span
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 18 }}
              className="grid h-20 w-20 place-items-center rounded-full bg-mint-100 text-primary-700"
            >
              <CheckCircle2 className="h-10 w-10" />
            </motion.span>
            <h2 className="mt-5 font-display text-2xl font-extrabold text-ink">You're all set, {(user?.name || 'Priya').split(' ')[0]}!</h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">
              We are matching you with a verified caretaker for {created.service}. You will get a confirmation
              notification once they accept.
            </p>
            <div className="mt-6 grid w-full max-w-sm grid-cols-2 gap-3">
              <div className="rounded-xl border border-line bg-slate-50 px-4 py-3 text-left">
                <p className="text-[11px] font-bold uppercase tracking-wider text-faint">Reference</p>
                <p className="mt-1 font-display text-sm font-extrabold text-primary-800">{created.ref}</p>
              </div>
              <div className="rounded-xl border border-line bg-slate-50 px-4 py-3 text-left">
                <p className="text-[11px] font-bold uppercase tracking-wider text-faint">Booking ID</p>
                <p className="mt-1 font-display text-sm font-extrabold text-ink">{created.id}</p>
              </div>
            </div>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <Button size="lg" onClick={() => navigate(`/customer/bookings/${created.id}`)} iconRight={ArrowRight}>
                View live status
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate('/customer/dashboard')}>
                Back to dashboard
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    )
  }

  /* ---------------- wizard ---------------- */

  return (
    <div className="space-y-6">
      <PageHeader
        title="Book a caretaker"
        subtitle="Submit your care details. Your booking will be instantly broadcasted to all active caretakers."
        action={
          <Button to="/customer/bookings" variant="ghost" size="sm">
            My bookings
          </Button>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-card border border-primary-200 bg-mint-50/70 p-4 shadow-sm sm:p-5">
        <div className="flex items-center gap-3.5">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary-700 font-display text-base font-extrabold text-white shadow-sm">
            <Sparkles className="h-6 w-6 text-white" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-display text-base font-bold text-ink">On-Demand Caretaker Dispatch</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2 py-0.5 text-[11px] font-bold text-success-700 border border-success-200">
                <ShieldCheck className="h-3 w-3" /> Live Broadcast
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted">
              Your request will be sent to all qualified caretakers across the app. The first available caretaker will accept and be assigned immediately.
            </p>
          </div>
        </div>
        <div className="text-left sm:text-right">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-faint">Hourly Rate</span>
          <span className="font-display text-base font-extrabold text-primary-800">
            {formatCurrency(rate)}/hr
          </span>
        </div>
      </div>

      <Card>
        <CardBody className="py-4">
          <ol className="flex items-center gap-1 overflow-x-auto no-scrollbar sm:gap-2" aria-label="Booking steps">
            {steps.map((st, i) => {
              const done = i < step
              const current = i === step
              const reachable = i <= maxStep
              return (
                <li key={st.id} className="flex shrink-0 items-center gap-1 sm:gap-2">
                  <button
                    type="button"
                    onClick={() => jumpTo(i)}
                    disabled={!reachable}
                    aria-current={current ? 'step' : undefined}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-full px-2 py-1.5 text-xs font-semibold transition sm:px-3',
                      current ? 'bg-mint-100 text-primary-800' : done && reachable ? 'text-ink hover:bg-slate-100' : 'text-faint',
                      reachable ? 'cursor-pointer' : 'cursor-not-allowed opacity-60',
                    )}
                  >
                    <span
                      className={cn(
                        'grid h-7 w-7 shrink-0 place-items-center rounded-full border text-[11px] font-bold',
                        current
                          ? 'border-primary-700 bg-primary-700 text-white'
                          : done && reachable
                            ? 'border-primary-300 bg-mint-100 text-primary-700'
                            : 'border-line-strong bg-white text-faint',
                      )}
                    >
                      {done && reachable ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}
                    </span>
                    <span className="hidden md:inline">{st.label}</span>
                  </button>
                  {i < steps.length - 1 ? <span className="h-px w-4 shrink-0 bg-line sm:w-6" aria-hidden="true" /> : null}
                </li>
              )
            })}
          </ol>
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
            >
              {currentStepId === 'service' ? (
                <Card>
                  <CardHeader title="What care does your loved one need?" subtitle="Pick the service that fits best — you can add notes later." />
                  <CardBody className="grid gap-3 sm:grid-cols-2">
                    {availableServices.map((svc) => {
                      const selected = form.service?.id === svc.id || form.service?._id === svc._id
                      const Icon = svc.icon
                      return (
                        <button
                          key={svc.id}
                          type="button"
                          onClick={() => set({ service: svc })}
                          className={cn(
                            'flex flex-col gap-2 rounded-card border p-4 text-left transition',
                            selected
                              ? 'border-primary-600 bg-mint-50 ring-2 ring-primary-200'
                              : 'border-line bg-white hover:border-primary-200 hover:shadow-card',
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span
                              className={cn(
                                'grid h-10 w-10 shrink-0 place-items-center rounded-xl',
                                selected ? 'bg-primary-700 text-white' : 'bg-mint-100 text-primary-700',
                              )}
                            >
                              <Icon className="h-5 w-5" />
                            </span>
                            {selected ? <CheckCircle2 className="h-5 w-5 shrink-0 text-primary-700" /> : null}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-ink">{svc.name}</p>
                            <p className="mt-1 text-xs leading-relaxed text-muted">{svc.short}</p>
                          </div>
                          <p className="text-xs font-semibold text-primary-700">
                            From {formatCurrency(svc.startingPrice)} / {svc.unit}
                          </p>
                        </button>
                      )
                    })}
                  </CardBody>
                </Card>
              ) : null}

              {currentStepId === 'patient' ? (
                <Card>
                  <CardHeader title="Patient information" subtitle="Tell us who will be receiving care." />
                  <CardBody className="grid gap-4 sm:grid-cols-2">
                    <FormField label="Patient full name" htmlFor="patient-name" required>
                      <Input
                        id="patient-name"
                        value={form.patientName}
                        onChange={(e) => set({ patientName: e.target.value })}
                        placeholder="e.g. Radhika Sharma"
                      />
                    </FormField>
                    <FormField label="Age" htmlFor="patient-age" required>
                      <Input
                        id="patient-age"
                        type="number"
                        min="1"
                        max="120"
                        value={form.patientAge}
                        onChange={(e) => set({ patientAge: e.target.value })}
                        placeholder="e.g. 74"
                      />
                    </FormField>
                    <FormField label="Relation to you" htmlFor="patient-relation">
                      <Select id="patient-relation" value={form.relation} onChange={(e) => set({ relation: e.target.value })}>
                        {RELATIONS.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </Select>
                    </FormField>
                    <FormField
                      label="Care requirements"
                      htmlFor="patient-requirements"
                      className="sm:col-span-2"
                      hint="Surgeries, conditions, medication or mobility notes help us match better."
                    >
                      <Textarea
                        id="patient-requirements"
                        rows={4}
                        value={form.requirements}
                        onChange={(e) => set({ requirements: e.target.value })}
                        placeholder="e.g. Post hip-replacement recovery, needs assisted walking and dressing support."
                      />
                    </FormField>
                  </CardBody>
                </Card>
              ) : null}

              {currentStepId === 'setting' ? (
                <Card>
                  <CardHeader title="Where will care be delivered?" subtitle="Choose home or hospital care and share the location." />
                  <CardBody className="space-y-5">
                    <div className="grid gap-3 sm:grid-cols-2">
                      {[
                        { value: 'Home Care', icon: Home, desc: 'Care at the patient’s residence with full family access.' },
                        { value: 'Hospital Care', icon: Building2, desc: 'Attendant support during hospital stay or day visits.' },
                      ].map((opt) => {
                        const selected = form.careType === opt.value
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => set({ careType: opt.value })}
                            className={cn(
                              'flex items-start gap-3 rounded-card border p-4 text-left transition',
                              selected
                                ? 'border-primary-600 bg-mint-50 ring-2 ring-primary-200'
                                : 'border-line bg-white hover:border-primary-200',
                            )}
                          >
                            <span
                              className={cn(
                                'grid h-10 w-10 shrink-0 place-items-center rounded-xl',
                                selected ? 'bg-primary-700 text-white' : 'bg-mint-100 text-primary-700',
                              )}
                            >
                              <opt.icon className="h-5 w-5" />
                            </span>
                            <span>
                              <span className="block text-sm font-bold text-ink">{opt.value}</span>
                              <span className="mt-1 block text-xs leading-relaxed text-muted">{opt.desc}</span>
                            </span>
                          </button>
                        )
                      })}
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField
                        label={form.careType === 'Hospital Care' ? 'Hospital name & ward' : 'Flat / house no., building'}
                        htmlFor="address"
                        required
                        className="sm:col-span-2"
                      >
                        <Input
                          id="address"
                          value={form.address}
                          onChange={(e) => set({ address: e.target.value })}
                          placeholder={
                            form.careType === 'Hospital Care'
                              ? 'e.g. Lilavati Hospital, Ward 4B, Bandra Reclamation'
                              : 'e.g. B-703, Hiranandani Gardens'
                          }
                        />
                      </FormField>
                      <FormField label="City" htmlFor="city" required>
                        <Select id="city" value={form.city} onChange={(e) => set({ city: e.target.value })}>
                          {CITIES.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </Select>
                      </FormField>
                      <FormField label="Area / locality" htmlFor="area" required>
                        <Input
                          id="area"
                          value={form.area}
                          onChange={(e) => set({ area: e.target.value })}
                          placeholder="e.g. Powai"
                        />
                      </FormField>
                    </div>
                  </CardBody>
                </Card>
              ) : null}

              {currentStepId === 'schedule' ? (
                <Card>
                  <CardHeader title="When do you need care?" subtitle="Pick a date, start time and shift length." />
                  <CardBody className="grid gap-4 sm:grid-cols-3">
                    <FormField label="Date" htmlFor="date" required>
                      <Input
                        id="date"
                        type="date"
                        min={todayISO()}
                        value={form.date}
                        onChange={(e) => set({ date: e.target.value })}
                      />
                    </FormField>
                    <FormField label="Start time" htmlFor="start-time" required>
                      <Select id="start-time" value={form.startTime} onChange={(e) => set({ startTime: e.target.value })}>
                        {TIME_OPTIONS.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </Select>
                    </FormField>
                    <FormField
                      label="Duration"
                      htmlFor="duration"
                      required
                      hint="Book by the hour, by the day, or for a full week of care"
                    >
                      <Select
                        id="duration"
                        value={form.hours}
                        onChange={(e) => set({ hours: Number(e.target.value) })}
                      >
                        {DURATION_GROUPS.map((group) => (
                          <optgroup key={group.id} label={group.label}>
                            {group.options.map((h) => (
                              <option key={h} value={h}>
                                {formatDuration(h)}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </Select>
                    </FormField>
                    {form.date ? (
                      <p className="inline-flex items-center gap-2 rounded-xl bg-mint-50 px-4 py-3 text-sm font-semibold text-primary-800 sm:col-span-3">
                        <CalendarDays className="h-4 w-4" />
                        {formatDate(form.date, { long: true })} · starts {form.startTime} ·{' '}
                        {formatDuration(form.hours)}
                      </p>
                    ) : null}
                  </CardBody>
                </Card>
              ) : null}

              {currentStepId === 'instructions' ? (
                <Card>
                  <CardHeader title="Special instructions" subtitle="Anything the caretaker should know before arriving." />
                  <CardBody className="space-y-5">
                    <FormField
                      label="Instructions for the caretaker"
                      htmlFor="instructions"
                      hint="Dressing timing, doctor's advice, food preferences, emergency contacts…"
                    >
                      <Textarea
                        id="instructions"
                        rows={4}
                        value={form.instructions}
                        onChange={(e) => set({ instructions: e.target.value })}
                        placeholder="e.g. Assist with dressing change at 10 AM as instructed by Dr. Rane."
                      />
                    </FormField>
                    <div className="space-y-3 pt-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-bold text-ink">Additional care requirements</p>
                          <p className="text-xs text-muted">
                            Select specific care directives needed during this shift — fully included at no extra charge.
                          </p>
                        </div>
                        {form.extras.length > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-mint-100 border border-primary-200 px-2.5 py-0.5 text-xs font-bold text-primary-800">
                            <CheckCircle2 className="h-3.5 w-3.5 text-primary-700" />
                            {form.extras.length} selected
                          </span>
                        ) : null}
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        {CARE_REQUIREMENTS.map((req) => {
                          const isSelected = form.extras.includes(req.name)
                          const Icon = req.icon
                          return (
                            <button
                              key={req.id}
                              type="button"
                              onClick={() => toggleExtra(req.name)}
                              aria-pressed={isSelected}
                              className={cn(
                                'group relative flex cursor-pointer select-none items-start gap-3.5 rounded-card border p-4 text-left transition-all',
                                isSelected
                                  ? 'border-primary-600 bg-mint-50/80 shadow-sm ring-2 ring-primary-300/40'
                                  : 'border-line bg-white hover:border-primary-200 hover:shadow-card active:scale-[0.99]',
                              )}
                            >
                              <span
                                className={cn(
                                  'pointer-events-none grid h-10 w-10 shrink-0 place-items-center rounded-xl transition',
                                  isSelected
                                    ? 'bg-primary-700 text-white shadow-xs'
                                    : 'bg-mint-100 text-primary-700 group-hover:bg-mint-200',
                                )}
                              >
                                <Icon className="h-5 w-5" />
                              </span>

                              <div className="pointer-events-none min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-sm font-bold text-ink">{req.name}</span>
                                  <span
                                    className={cn(
                                      'grid h-5 w-5 shrink-0 place-items-center rounded-md border text-white transition',
                                      isSelected
                                        ? 'border-primary-700 bg-primary-700'
                                        : 'border-line-strong bg-white group-hover:border-primary-400',
                                    )}
                                  >
                                    {isSelected ? <Check className="h-3.5 w-3.5 stroke-[3]" /> : null}
                                  </span>
                                </div>
                                <p className="mt-1 text-xs leading-relaxed text-muted">{req.description}</p>
                                <span
                                  className={cn(
                                    'mt-2.5 inline-block rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                                    isSelected ? 'bg-mint-200/80 text-primary-900 font-extrabold' : 'bg-slate-100 text-faint',
                                  )}
                                >
                                  {req.tag} · Included
                                </span>
                              </div>
                            </button>
                          )
                        })}
                      </div>

                      {/* Custom requirement additions */}
                      <div className="rounded-xl border border-dashed border-line-strong bg-slate-50/60 p-3.5 space-y-2.5">
                        <div className="flex items-center gap-2">
                          <Input
                            value={customExtra}
                            onChange={(e) => setCustomExtra(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                addCustomExtra()
                              }
                            }}
                            placeholder="Add another requirement (e.g. Oxygen cylinder support, Diabetic diet)"
                            className="text-xs bg-white"
                          />
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={addCustomExtra}
                            disabled={!customExtra.trim()}
                            icon={Plus}
                          >
                            Add
                          </Button>
                        </div>
                        {form.extras.some((ex) => !CARE_REQUIREMENTS.some((r) => r.name === ex)) ? (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {form.extras
                              .filter((ex) => !CARE_REQUIREMENTS.some((r) => r.name === ex))
                              .map((customReq) => (
                                <span
                                  key={customReq}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-primary-300 bg-mint-50 px-2.5 py-1 text-xs font-semibold text-primary-900 shadow-2xs"
                                >
                                  <span>{customReq}</span>
                                  <button
                                    type="button"
                                    onClick={() => removeExtra(customReq)}
                                    className="text-primary-600 hover:text-danger-600"
                                    aria-label={`Remove ${customReq}`}
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </span>
                              ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </CardBody>
                </Card>
              ) : null}



              {currentStepId === 'price' ? (
                <div className="space-y-6">
                  <PriceBreakdown
                    items={[
                      {
                        label: form.service?.name || 'Care service',
                        meta: `${formatCurrency(rate)}/hr × ${durationBasis(hours)}${matchedCaregiver ? ` · ${matchedCaregiver.name}` : ''}`,
                        amount: subtotal,
                      },
                    ]}
                    subtotal={subtotal}
                    platformFee={platformFee}
                    tax={tax}
                    total={total}
                    currencyNote="Final price is confirmed once a caretaker accepts. You pay into escrow and funds are released after the service completes."
                  />
                  {form.extras.length > 0 ? (
                    <Card>
                      <CardHeader
                        title="Included Care Directives"
                        subtitle="All selected additional requirements are fully covered by your shift rate at no extra cost."
                      />
                      <CardBody className="pt-0">
                        <div className="flex flex-wrap gap-2">
                          {form.extras.map((ex) => (
                            <span
                              key={ex}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-primary-200 bg-mint-50 px-3 py-1.5 text-xs font-semibold text-primary-900"
                            >
                              <CheckCircle2 className="h-4 w-4 text-primary-700" />
                              {ex}
                            </span>
                          ))}
                        </div>
                      </CardBody>
                    </Card>
                  ) : null}
                  <Card>
                    <CardBody className="flex items-start gap-3">
                      <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary-700" />
                      <p className="text-sm leading-relaxed text-muted">
                        All Bystander caretakers are ID-verified, background-checked and credentialed. Platform fee of{' '}
                        {formatCurrency(platformFee)} includes 24×7 support and the Bystander protection plan.
                      </p>
                    </CardBody>
                  </Card>
                </div>
              ) : null}

              {currentStepId === 'confirm' ? (
                <Card>
                  <CardHeader title="Review & confirm" subtitle="Please check the details before sending your request." />
                  <CardBody className="space-y-5">
                    <SummaryGrid
                      items={[
                        { icon: UserRound, label: 'Patient', value: `${form.patientName} (${form.patientAge} yrs, ${form.relation})` },
                        { icon: Home, label: 'Service', value: `${form.service?.name} · ${form.careType}` },
                        { icon: MapPin, label: 'Location', value: `${form.address}, ${form.area}, ${form.city}` },
                        {
                          icon: CalendarDays,
                          label: 'Schedule',
                          value: `${formatDate(form.date, { long: true })} · ${form.startTime} · ${formatDuration(form.hours)}`,
                        },
                        { icon: Sparkles, label: 'Dispatch mechanism', value: 'Instant Platform Broadcast (First-come acceptance)' },
                        {
                          icon: ShieldCheck,
                          label: 'Care requirements',
                          value: form.extras.length > 0 ? form.extras.join(', ') : 'Standard care protocol',
                        },
                        {
                          icon: CheckCircle2,
                          label: 'Special notes',
                          value: form.instructions.trim() || 'None added',
                        },
                      ]}
                    />

                    <div className="flex items-start gap-3 rounded-xl border border-primary-200 bg-mint-50/70 p-4">
                      <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary-700" />
                      <div className="text-xs leading-relaxed text-ink">
                        <p className="font-bold text-primary-900">On-Demand Caretaker Broadcast</p>
                        <p className="mt-0.5 text-muted">
                          When you confirm, your request is broadcasted simultaneously to all verified caretakers in {form.city}. The first available caretaker will accept the request and be assigned immediately.
                        </p>
                      </div>
                    </div>

                    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-slate-50 px-4 py-3.5">
                      <input
                        type="checkbox"
                        checked={terms}
                        onChange={(e) => setTerms(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-line-strong accent-[#0F766E]"
                      />
                      <span className="text-sm leading-relaxed text-muted">
                        I agree to the Bystander{' '}
                        <Link
                          to="/legal/terms"
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold text-primary-700 underline decoration-primary-300 underline-offset-2 hover:text-primary-800"
                        >
                          terms of service
                        </Link>{' '}
                        and understand that payment is held in escrow until the service is completed. Cancellations
                        within 4 hours of the start time may attract a fee.
                      </span>
                    </label>
                  </CardBody>
                </Card>
              ) : null}
            </motion.div>
          </AnimatePresence>

          <div className="mt-6 flex items-center justify-between gap-3">
            <Button variant="ghost" onClick={goBack} disabled={step === 0} icon={ArrowLeft}>
              Back
            </Button>
            {step < steps.length - 1 ? (
              <Button onClick={goNext} disabled={!isCurrentStepValid} iconRight={ArrowRight}>
                Next
              </Button>
            ) : (
              <Button onClick={handleConfirm} disabled={!terms || submitting} loading={submitting} icon={CheckCircle2}>
                Confirm & broadcast request
              </Button>
            )}
          </div>
        </div>

        <aside className="lg:col-span-4">
          <div className="space-y-4 lg:sticky lg:top-6">
            <Card>
              <CardHeader title="Price summary" subtitle="Live estimate" />
              <CardBody className="space-y-3">
                <Row label="Service" value={form.service?.name || 'Not selected'} />
                <Row
                  label="Caretaker rate"
                  value={matchedCaregiver ? `${formatCurrency(rate)} / hr` : form.service ? `From ${formatCurrency(rate)} / hr` : '—'}
                />
                <Row label="Duration" value={formatDuration(hours)} />
                <Row label="Care setting" value={form.careType || '—'} />
                <Row label="Date" value={form.date ? formatDate(form.date) : '—'} />
                {form.extras.length > 0 ? (
                  <div className="space-y-1.5 rounded-xl border border-line bg-slate-50/80 p-3">
                    <div className="flex items-center justify-between text-xs font-bold text-ink">
                      <span>Care requirements</span>
                      <span className="rounded-full bg-mint-100 px-2 py-0.5 text-[10px] font-extrabold text-primary-800">
                        {form.extras.length} selected
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {form.extras.map((ex) => (
                        <span
                          key={ex}
                          className="inline-flex items-center gap-1 rounded-md border border-line bg-white px-2 py-0.5 text-[10px] font-semibold text-primary-800 shadow-2xs"
                        >
                          <Check className="h-2.5 w-2.5 text-primary-600" />
                          {ex}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
                {matchedCaregiver ? (
                  <div className="flex items-center gap-3 rounded-xl bg-mint-50 px-3 py-2.5">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-xs font-bold text-primary-800 shadow-card">
                      {matchedCaregiver.name
                        .split(' ')
                        .map((p) => p[0])
                        .slice(0, 2)
                        .join('')}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-ink">{matchedCaregiver.name}</p>
                      <RatingStars value={matchedCaregiver.rating} size={11} showValue />
                    </div>
                  </div>
                ) : null}
                <div className="flex items-center justify-between gap-3 border-t border-dashed border-line pt-3.5">
                  <span className="text-sm font-bold text-ink">Estimated total</span>
                  <span className="font-display text-xl font-extrabold tabular-nums text-primary-800">
                    {form.service ? formatCurrency(total) : '—'}
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-faint">
                  Includes platform fee {formatCurrency(platformFee)} and GST (18%) {formatCurrency(tax)}.
                </p>
              </CardBody>
            </Card>
          </div>
        </aside>
      </div>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted">{label}</span>
      <span className="truncate text-right font-semibold text-ink">{value}</span>
    </div>
  )
}

function SummaryGrid({ items }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="flex items-start gap-3 rounded-xl border border-line px-4 py-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-mint-100 text-primary-700">
            <item.icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-faint">{item.label}</p>
            <p className="mt-0.5 text-sm font-semibold leading-snug text-ink">{item.value}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

export default BookCaregiverPage
