import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  Home,
  MapPin,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/context/AuthContext'
import { useData } from '@/context/DataContext'
import { useDocumentTitle } from '@/hooks/useUi'
import { SERVICES } from '@/data/services'
import { CITIES, GST_RATE, PLATFORM_FEE } from '@/utils/constants'
import { formatCurrency, formatDate } from '@/utils/format'
import { cn } from '@/utils/cn'
import { PageHeader } from '@/components/common/PageHeader'
import { Card, CardBody, CardHeader } from '@/components/common/Card'
import { Button } from '@/components/common/Button'
import { FormField, Input, Select, Textarea } from '@/components/forms/FormField'
import { PriceBreakdown } from '@/components/common/TimelinePrice'
import { CaregiverCard } from '@/components/caregiver/CaregiverCard'
import { RatingStars } from '@/components/common/RatingStars'

const STEP_LABELS = [
  'Care service',
  'Patient',
  'Care setting',
  'Schedule',
  'Instructions',
  'Caregivers',
  'Price',
  'Confirm',
]

const DURATIONS = [2, 4, 6, 8, 12]

const EXTRAS = ['Night supervision', 'Wound dressing', 'Mobility support', 'Vegetarian meal prep']

const RELATIONS = ['Mother', 'Father', 'Grandmother', 'Grandfather', 'Wife', 'Husband', 'Sibling', 'Self', 'Other']

const TIME_OPTIONS = Array.from({ length: 31 }, (_, i) => {
  const mins = 6 * 60 + i * 30
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`
})

const todayISO = () => new Date().toISOString().slice(0, 10)

export function BookCaregiverPage() {
  useDocumentTitle('Book a caregiver')
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const { caregivers, createBooking } = useData()

  const patientInfo = user?.patientInfo
  const preselectedId = searchParams.get('caregiver') || ''

  const [step, setStep] = useState(0)
  const [maxStep, setMaxStep] = useState(0)
  const [terms, setTerms] = useState(false)
  const [created, setCreated] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [selectedCaregiverId, setSelectedCaregiverId] = useState(() =>
    caregivers.some((c) => c.id === preselectedId) ? preselectedId : '',
  )
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

  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  const matchedCaregiver = useMemo(() => {
    if (selectedCaregiverId) {
      const picked = caregivers.find((c) => c.id === selectedCaregiverId)
      if (picked) return picked
    }
    if (!form.service) return null
    return (
      caregivers.find((c) => c.verified && c.services?.includes(form.service.name)) ||
      caregivers.find((c) => c.services?.includes(form.service.name)) ||
      null
    )
  }, [caregivers, form.service, selectedCaregiverId])

  const rate = matchedCaregiver?.hourlyRate || form.service?.startingPrice || 399
  const hours = Number(form.hours) || 0
  const subtotal = rate * hours
  const platformFee = PLATFORM_FEE
  const tax = Math.round((subtotal + platformFee) * GST_RATE)
  const total = subtotal + platformFee + tax

  const stripCaregivers = useMemo(() => {
    const pool = form.service
      ? caregivers.filter((c) => c.services?.includes(form.service.name) && c.verified)
      : caregivers.filter((c) => c.verified)
    return (pool.length ? pool : caregivers).slice(0, 6)
  }, [caregivers, form.service])

  const stepValid = [
    Boolean(form.service),
    Boolean(form.patientName.trim()) && Number(form.patientAge) > 0,
    Boolean(form.careType) && Boolean(form.address.trim()) && Boolean(form.city) && Boolean(form.area.trim()),
    Boolean(form.date) && Boolean(form.startTime) && Number(form.hours) > 0,
    true,
    Boolean(matchedCaregiver),
    true,
    terms,
  ]

  const goNext = () => {
    if (!stepValid[step]) return
    const next = Math.min(step + 1, STEP_LABELS.length - 1)
    setStep(next)
    setMaxStep((m) => Math.max(m, next))
  }

  const goBack = () => setStep((s) => Math.max(0, s - 1))

  const jumpTo = (i) => {
    if (i <= maxStep) setStep(i)
  }

  const toggleExtra = (extra) =>
    set((f) => ({
      extras: f.extras.includes(extra) ? f.extras.filter((e) => e !== extra) : [...f.extras, extra],
    }))

  const handleConfirm = () => {
    if (!form.service || submitting) return
    setSubmitting(true)
    const locationLabel =
      form.careType === 'Hospital Care'
        ? `${form.address}, ${form.area}, ${form.city}`
        : `${form.address}, ${form.area}, ${form.city}`
    const booking = createBooking({
      customerId: user?.id || 'cu-201',
      caregiverId: matchedCaregiver?.id || '',
      caregiverName: matchedCaregiver?.name || '',
      service: form.service.name,
      patient: {
        name: form.patientName.trim(),
        age: Number(form.patientAge),
        relation: form.relation,
      },
      careType: form.careType,
      address: locationLabel,
      city: form.city,
      date: form.date,
      startTime: form.startTime,
      hours: Number(form.hours),
      hourlyRate: rate,
      subtotal,
      platformFee,
      tax,
      total,
      notes: form.requirements.trim(),
      specialInstructions: [form.instructions.trim(), ...form.extras].filter(Boolean).join(' · '),
    })
    setCreated(booking)
    setSubmitting(false)
    toast.success('Booking request sent', {
      description: `Reference ${booking.ref} — ${matchedCaregiver?.name || 'Your caregiver'} has been notified.`,
    })
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
              We are matching you with a verified caregiver for {created.service}. You will get a confirmation
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
                View booking
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate('/customer/caregivers')}>
                Browse caregivers
              </Button>
            </div>
          </CardBody>
        </Card>

        <div>
          <h3 className="font-display text-base font-bold text-ink">Caregivers we recommend</h3>
          <p className="mt-0.5 text-sm text-muted">Verified professionals matching your care needs.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {stripCaregivers.map((cg) => (
              <CaregiverCard key={cg.id} caregiver={cg} actionLabel="View profile" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  /* ---------------- wizard ---------------- */

  return (
    <div className="space-y-6">
      <PageHeader
        title="Book a caregiver"
        subtitle="Answer a few quick questions and we'll match you with a verified professional."
        action={
          <Button to="/customer/bookings" variant="ghost" size="sm">
            My bookings
          </Button>
        }
      />

      <Card>
        <CardBody className="py-4">
          <ol className="flex items-center gap-1 overflow-x-auto no-scrollbar sm:gap-2" aria-label="Booking steps">
            {STEP_LABELS.map((label, i) => {
              const done = i < step
              const current = i === step
              const reachable = i <= maxStep
              return (
                <li key={label} className="flex shrink-0 items-center gap-1 sm:gap-2">
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
                    <span className="hidden md:inline">{label}</span>
                  </button>
                  {i < STEP_LABELS.length - 1 ? <span className="h-px w-4 shrink-0 bg-line sm:w-6" aria-hidden="true" /> : null}
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
              {step === 0 ? (
                <Card>
                  <CardHeader title="What care does your loved one need?" subtitle="Pick the service that fits best — you can add notes later." />
                  <CardBody className="grid gap-3 sm:grid-cols-2">
                    {SERVICES.map((svc) => {
                      const selected = form.service?.id === svc.id
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

              {step === 1 ? (
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

              {step === 2 ? (
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

              {step === 3 ? (
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
                    <FormField label="Duration" htmlFor="duration" required hint="Hours of continuous care">
                      <Select
                        id="duration"
                        value={form.hours}
                        onChange={(e) => set({ hours: Number(e.target.value) })}
                      >
                        {DURATIONS.map((h) => (
                          <option key={h} value={h}>
                            {h} hours
                          </option>
                        ))}
                      </Select>
                    </FormField>
                    {form.date ? (
                      <p className="inline-flex items-center gap-2 rounded-xl bg-mint-50 px-4 py-3 text-sm font-semibold text-primary-800 sm:col-span-3">
                        <CalendarDays className="h-4 w-4" />
                        {formatDate(form.date, { long: true })} · starts {form.startTime} · {form.hours} hours
                      </p>
                    ) : null}
                  </CardBody>
                </Card>
              ) : null}

              {step === 4 ? (
                <Card>
                  <CardHeader title="Special instructions" subtitle="Anything the caregiver should know before arriving." />
                  <CardBody className="space-y-5">
                    <FormField
                      label="Instructions for the caregiver"
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
                    <div>
                      <p className="text-sm font-semibold text-ink-soft">Additional requirements</p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {EXTRAS.map((extra) => {
                          const checked = form.extras.includes(extra)
                          return (
                            <label
                              key={extra}
                              className={cn(
                                'flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition',
                                checked
                                  ? 'border-primary-600 bg-mint-50 text-primary-900'
                                  : 'border-line bg-white text-ink-soft hover:border-primary-200',
                              )}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleExtra(extra)}
                                className="h-4 w-4 rounded border-line-strong accent-[#0F766E]"
                              />
                              {extra}
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  </CardBody>
                </Card>
              ) : null}

              {step === 5 ? (
                <Card>
                  <CardHeader
                    title="Choose your caregiver"
                    subtitle="Pick a verified professional, or let CareMate assign the best match for your shift."
                  />
                  <CardBody className="space-y-3">
                    {stripCaregivers.length === 0 ? (
                      <p className="text-sm text-muted">No matching caregivers found — a coordinator will assign one after you confirm.</p>
                    ) : null}
                    {stripCaregivers.map((cg) => {
                      const selected = matchedCaregiver?.id === cg.id
                      return (
                        <button
                          key={cg.id}
                          type="button"
                          onClick={() => setSelectedCaregiverId(cg.id)}
                          className={cn(
                            'flex w-full items-center gap-4 rounded-card border p-4 text-left transition',
                            selected
                              ? 'border-primary-600 bg-mint-50 ring-2 ring-primary-200'
                              : 'border-line bg-white hover:border-primary-200 hover:shadow-card',
                          )}
                        >
                          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-mint-100 font-display text-sm font-extrabold text-primary-800">
                            {cg.name
                              .split(' ')
                              .map((p) => p[0])
                              .slice(0, 2)
                              .join('')}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="truncate text-sm font-bold text-ink">{cg.name}</span>
                              {cg.verified ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2 py-0.5 text-[10px] font-bold text-success-700">
                                  <ShieldCheck className="h-3 w-3" /> Verified
                                </span>
                              ) : null}
                            </span>
                            <span className="mt-0.5 block truncate text-xs text-muted">
                              {cg.qualification} · {cg.experienceYears} yrs · {cg.area || cg.city}
                            </span>
                            <span className="mt-1 flex items-center gap-2">
                              <RatingStars value={cg.rating} size={11} showValue />
                              <span className="text-xs font-semibold text-primary-700">{formatCurrency(cg.hourlyRate)}/hr</span>
                            </span>
                          </span>
                          <span
                            className={cn(
                              'grid h-6 w-6 shrink-0 place-items-center rounded-full border-2',
                              selected ? 'border-primary-700 bg-primary-700 text-white' : 'border-line-strong bg-white',
                            )}
                          >
                            {selected ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : null}
                          </span>
                        </button>
                      )
                    })}
                    <button
                      type="button"
                      onClick={() => setSelectedCaregiverId('')}
                      className={cn(
                        'w-full rounded-card border border-dashed p-3.5 text-left text-sm font-semibold transition',
                        selectedCaregiverId === ''
                          ? 'border-primary-400 bg-mint-50 text-primary-800'
                          : 'border-line-strong text-muted hover:border-primary-300',
                      )}
                    >
                      Let CareMate assign the best available match automatically
                    </button>
                  </CardBody>
                </Card>
              ) : null}

              {step === 6 ? (
                <div className="space-y-6">
                  <PriceBreakdown
                    items={[
                      {
                        label: form.service?.name || 'Care service',
                        meta: `${formatCurrency(rate)}/hr × ${hours} hrs${matchedCaregiver ? ` · ${matchedCaregiver.name}` : ''}`,
                        amount: subtotal,
                      },
                    ]}
                    subtotal={subtotal}
                    platformFee={platformFee}
                    tax={tax}
                    total={total}
                    currencyNote="Final price is confirmed once a caregiver accepts. You pay into escrow and funds are released after the service completes."
                  />
                  <Card>
                    <CardBody className="flex items-start gap-3">
                      <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary-700" />
                      <p className="text-sm leading-relaxed text-muted">
                        All CareMate caregivers are ID-verified, background-checked and insured. Platform fee of{' '}
                        {formatCurrency(platformFee)} includes 24×7 support and the CareMate protection plan.
                      </p>
                    </CardBody>
                  </Card>
                </div>
              ) : null}

              {step === 7 ? (
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
                          value: `${formatDate(form.date, { long: true })} · ${form.startTime} · ${form.hours} hrs`,
                        },
                        { icon: Clock, label: 'Estimated caregiver', value: matchedCaregiver?.name || 'To be assigned' },
                        {
                          icon: ShieldCheck,
                          label: 'Instructions',
                          value: [form.instructions, ...form.extras].filter(Boolean).join(' · ') || 'None added',
                        },
                      ]}
                    />
                    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-slate-50 px-4 py-3.5">
                      <input
                        type="checkbox"
                        checked={terms}
                        onChange={(e) => setTerms(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-line-strong accent-[#0F766E]"
                      />
                      <span className="text-sm leading-relaxed text-muted">
                        I agree to the CareMate{' '}
                        <span className="font-semibold text-primary-700">terms of service</span> and understand that
                        payment is held in escrow until the service is completed. Cancellations within 4 hours of the
                        start time may attract a fee.
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
            {step < STEP_LABELS.length - 1 ? (
              <Button onClick={goNext} disabled={!stepValid[step]} iconRight={ArrowRight}>
                Next
              </Button>
            ) : (
              <Button onClick={handleConfirm} disabled={!terms || submitting} loading={submitting} icon={CheckCircle2}>
                Confirm booking request
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
                  label="Caregiver rate"
                  value={matchedCaregiver ? `${formatCurrency(rate)} / hr` : form.service ? `From ${formatCurrency(rate)} / hr` : '—'}
                />
                <Row label="Duration" value={hours ? `${hours} hours` : '—'} />
                <Row label="Care setting" value={form.careType || '—'} />
                <Row label="Date" value={form.date ? formatDate(form.date) : '—'} />
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

      {step === 0 ? (
        <div>
          <h3 className="font-display text-base font-bold text-ink">Matching caregivers</h3>
          <p className="mt-0.5 text-sm text-muted">
            {form.service
              ? `Verified professionals who offer ${form.service.name}.`
              : 'Verified professionals available in your city.'}
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {stripCaregivers.map((cg) => (
              <CaregiverCard key={cg.id} caregiver={cg} actionLabel="View profile" />
            ))}
          </div>
        </div>
      ) : null}
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
