import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useInView, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  Check,
  ChevronDown,
  Clock,
  EyeOff,
  Lock,
  MapPin,
  Quote,
  Search,
  ShieldCheck,
  Siren,
  Sparkles,
  Star,
  Stethoscope,
  Users,
} from 'lucide-react'
import { useDocumentTitle } from '@/hooks/useUi'
import { cn } from '@/utils/cn'
import { formatCurrency } from '@/utils/format'
import { CARE_TYPES, CITIES } from '@/utils/constants'
import { reveal, clamp01 } from '@/utils/motion'
import { SERVICES } from '@/data/services'
import { featuredCaregivers } from '@/data/caregivers'
import { FAQS, TESTIMONIALS } from '@/data/content'
import { Button } from '@/components/common/Button'
import { Container } from '@/components/common/Container'
import { Section } from '@/components/common/Section'
import { SectionHeading } from '@/components/common/SectionHeading'
import { Avatar, ImageWithFallback } from '@/components/common/Avatar'
import { RatingStars } from '@/components/common/RatingStars'
import { CaregiverCard } from '@/components/caregiver/CaregiverCard'
import { FormField, Input, Select } from '@/components/forms/FormField'

const STATS = [
  { value: '4,200+', label: 'Verified caretakers', icon: Users },
  { value: '61,000+', label: 'Shifts completed', icon: Check },
  { value: '4.9', label: 'Average family rating', icon: Star },
  { value: '18', label: 'Cities served', icon: MapPin },
]

const TRUST_ITEMS = [
  {
    icon: ShieldCheck,
    title: '4-step verification, done by humans',
    body: 'Government ID, nursing registration with the state council, address proof and optional police clearance — every document is read and validated before a profile goes live.',
  },
  {
    icon: Lock,
    title: 'Escrow-protected payments',
    body: 'Your estimate is held securely the moment you confirm. The caretaker is paid only after the shift is marked complete, and every rupee is itemised on the invoice.',
  },
  {
    icon: Siren,
    title: 'SOS on every active booking',
    body: 'One tap alerts our on-call operations desk, notifies your emergency contact and opens a tracked incident that stays open until it is resolved.',
  },
  {
    icon: EyeOff,
    title: 'Masked contact until you book',
    body: 'Messaging and calls run through Bystander, so personal numbers stay private. Your address is shared only with the caretaker assigned to your shift.',
  },
]

const DURATIONS = ['4 hours', '8 hours', '12 hours', 'Live-in (24 hours)', '2 days', '3 days', '1 week']

function CountUpText({ text, className }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, amount: 0.6 })
  const decimals = text.includes('.') ? text.split('.')[1].replace(/\D/g, '').length : 0
  const target = Number.parseFloat(text.replace(/[^\d.]/g, ''))
  const suffix = text.replace(/[\d.,]/g, '')
  const [value, setValue] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? target : 0,
  )

  useEffect(() => {
    if (!inView || Number.isNaN(target)) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let raf
    const start = performance.now()
    const duration = 1500
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setValue(target * eased)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [inView, target])

  return (
    <span ref={ref} className={className}>
      {value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </span>
  )
}

const TODAY = new Date().toISOString().slice(0, 10)

export function HomePage() {
  useDocumentTitle('Home')
  const navigate = useNavigate()
  const [city, setCity] = useState(CITIES[0])
  const [service, setService] = useState(CARE_TYPES[0])
  const [date, setDate] = useState('')
  const [duration, setDuration] = useState(DURATIONS[0])
  const [openFaq, setOpenFaq] = useState(0)

  // ---- hero parallax -------------------------------------------------
  // One scroll position drives four layers: the photo drifts and settles,
  // the headline lifts away, and the two floating cards travel at
  // different speeds so they read as depth instead of stickers.
  const heroRef = useRef(null)
  const reduceMotion = useReducedMotion()
  const { scrollYProgress: rawProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  })
  const heroProgress = useTransform(rawProgress, clamp01)
  const photoY = useTransform(heroProgress, [0, 1], ['0%', '15%'])
  const photoScale = useTransform(heroProgress, [0, 1], [1, 1.1])
  const copyY = useTransform(heroProgress, [0, 1], [0, 64])
  const copyFade = useTransform(heroProgress, [0, 0.8], [1, 0])
  const cardsY = useTransform(heroProgress, [0, 1], [0, -78])
  const heroLayer = (style) => (reduceMotion ? undefined : style)

  const popularServices = [
    ...SERVICES.filter((s) => s.popular),
    ...SERVICES.filter((s) => !s.popular),
  ].slice(0, 6)

  const onSearch = (event) => {
    event.preventDefault()
    const params = new URLSearchParams()
    if (city) params.set('city', city)
    if (service) params.set('service', service)
    navigate(`/book-caregiver?${params.toString()}`)
  }

  return (
    <div className="bg-white">
      {/* ---------------- hero ---------------- */}
      <section ref={heroRef} className="relative overflow-hidden border-b border-line bg-canvas lg:min-h-[575px]">
        <motion.div
          style={heroLayer({ y: photoY, scale: photoScale })}
          className="absolute inset-0"
        >
          <ImageWithFallback
            src="https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?auto=format&fit=crop&w=1920&q=80"
            alt="Nurse caring for a senior patient at home"
            className="absolute inset-0 h-full w-full"
            imgClassName="object-[center_43%]"
            fallback={
              <div className="flex flex-col items-center gap-3 p-8 text-center text-white">
                <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white/15">
                  <Stethoscope className="h-7 w-7" />
                </span>
                <p className="font-display text-lg font-bold">Verified care, at home</p>
                <p className="text-sm text-white/70">Nursing-led support for recovery and elder care</p>
              </div>
            }
          />
        </motion.div>
        <div className="hero-wash" aria-hidden="true" />

        <motion.div
          style={heroLayer({ y: copyY, opacity: copyFade })}
          className="relative z-[1]"
        >
          <Container className="py-14 sm:py-20 lg:py-24">
            <motion.div
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: 'easeOut' }}
              className="max-w-[520px]"
            >
              <motion.span
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.1 }}
                className="inline-flex items-center gap-2.5 rounded-full border border-primary-200/80 bg-white/75 px-3.5 py-1.5 text-[11px] font-bold text-primary-800 shadow-card backdrop-blur"
              >
                <span className="relative flex h-2 w-2" aria-hidden="true">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success-500 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-success-500" />
                </span>
                Same-day verified caretakers in 18 cities
              </motion.span>

              <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.18em] text-primary-700">
                Bystander · Never alone
              </p>

              <h1 className="mt-2 font-display text-4xl font-extrabold leading-[1.1] tracking-tight text-ink sm:text-5xl lg:text-[3.75rem]">
                Trusted care,
                <br />
                right when you
                <br />
                <span className="bg-gradient-to-r from-primary-700 via-primary-600 to-accent-500 bg-clip-text text-transparent">
                  need it.
                </span>
              </h1>

              <p className="mt-5 max-w-[420px] text-[15px] leading-relaxed text-muted">
                Rigorously verified caretakers for home and hospital care — post-surgery recovery, night-duty vigil
                and daily companionship. Book in minutes, pay into escrow, track every shift.
              </p>

              <div className="hero-actions mt-7 flex flex-wrap gap-3">
                <Button
                  to="/book-caregiver"
                  size="lg"
                  iconRight={ArrowRight}
                  className="shadow-[0_18px_35px_-16px_rgba(15,118,110,0.85)] transition-all hover:-translate-y-0.5"
                >
                  Book a Caretaker
                </Button>
                <Button
                  to="/register/caregiver"
                  variant="outline"
                  size="lg"
                  className="bg-white/80 backdrop-blur transition-all hover:-translate-y-0.5"
                >
                  Become a Caretaker
                </Button>
              </div>

              <div className="hero-social-proof mt-7 flex flex-wrap items-center gap-x-5 gap-y-3">
                <div className="flex -space-x-2.5">
                  {featuredCaregivers.slice(0, 4).map((cg) => (
                    <Avatar key={cg.id} src={cg.photo} name={cg.name} size="sm" verified />
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <RatingStars value={4.9} />
                  <span className="text-xs text-muted">12,400+ family reviews</span>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-mint-100 px-2.5 py-1 text-[11px] font-bold text-primary-800">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Escrow protected
                </span>
              </div>
            </motion.div>
          </Container>
        </motion.div>

        <motion.div
          aria-hidden="true"
          style={heroLayer({ y: cardsY })}
          className="absolute bottom-24 right-[6%] z-10 hidden flex-col items-end gap-3 lg:flex"
        >
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.25, ease: 'easeOut' }}
            className="animate-float flex items-center gap-3 rounded-2xl border border-white/70 bg-white/90 px-5 py-4 shadow-raised backdrop-blur"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-mint-100 text-primary-700">
              <BadgeCheck className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-bold text-ink">4-step verified professionals</p>
              <p className="mt-0.5 text-xs text-muted">ID · Registration · Address · Police check</p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.35, ease: 'easeOut' }}
            className="animate-float-slow mr-8 flex items-center gap-3 rounded-2xl border border-white/70 bg-white/90 px-5 py-4 shadow-raised backdrop-blur"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent-100 text-accent-600">
              <Clock className="h-4.5 w-4.5" />
            </span>
            <div>
              <p className="text-sm font-bold text-ink">Shifts from 4 hours to 1 week</p>
              <p className="mt-0.5 text-xs text-muted">Hourly, daily or weekly — same rate</p>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* ---------------- booking search widget ---------------- */}
      <section className="relative z-10 mx-auto -mt-12 max-w-7xl px-4 sm:px-6 lg:-mt-14 lg:px-8">
        <motion.form
          onSubmit={onSearch}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.15 }}
          aria-label="Search caretakers"
          className="rounded-card border border-line bg-white p-4 shadow-raised sm:p-5 lg:p-6"
        >

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1.1fr_1.2fr_1fr_1fr] xl:grid-cols-[1.1fr_1.2fr_1fr_1fr_auto] xl:items-end">
            <FormField label="Location" htmlFor="home-city">
              <Select id="home-city" value={city} onChange={(e) => setCity(e.target.value)}>
                {CITIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Care type" htmlFor="home-service">
              <Select id="home-service" value={service} onChange={(e) => setService(e.target.value)}>
                {CARE_TYPES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Start date" htmlFor="home-date">
              <Input
                id="home-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                min={TODAY}
              />
            </FormField>

            <FormField label="Duration" htmlFor="home-duration">
              <Select id="home-duration" value={duration} onChange={(e) => setDuration(e.target.value)}>
                {DURATIONS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </Select>
            </FormField>

            <div className="sm:col-span-2 lg:col-span-4 xl:col-span-1">
              <Button type="submit" size="md" icon={Search} className="h-11 w-full xl:w-auto">
                Search
              </Button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-line pt-4 text-xs text-muted">
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 shrink-0 text-primary-600" />
              Available for same-day shifts in 18 cities
            </span>
            <span className="hidden text-faint sm:inline">·</span>
            <span className="flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5 shrink-0 text-primary-600" />
              No booking fee — pay only after the caretaker is confirmed
            </span>
          </div>
        </motion.form>
      </section>

      {/* ---------------- stats strip ---------------- */}
      <Container className="mt-14 sm:mt-16">
        <div className="grid gap-px overflow-hidden rounded-card border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map((stat, i) => (
            <motion.div
              key={stat.label}
              {...reveal}
              transition={{ duration: 0.45, delay: i * 0.06 }}
              className="group flex items-center gap-3.5 bg-white px-5 py-5 transition-colors hover:bg-mint-50"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-mint-100 text-primary-700 transition-transform duration-300 group-hover:scale-105">
                <stat.icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <CountUpText
                  text={stat.value}
                  className="font-display text-2xl font-extrabold tabular-nums text-ink"
                />
                <p className="truncate text-sm text-muted">{stat.label}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </Container>

      {/* ---------------- services ---------------- */}
      <Section id="services">
        <Container>
        <motion.div {...reveal}>
          <SectionHeading
            eyebrow="Popular services"
            title="Care built around the patient, not the package"
            description="Every service is delivered by a caretaker whose qualification matches the task — nurses for clinical work, trained attendants for daily living support."
            action={
              <Button to="/services" variant="outline" size="sm" iconRight={ArrowRight}>
                All services
              </Button>
            }
          />
        </motion.div>

        <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {popularServices.map((svc, i) => (
            <motion.article
              key={svc.id}
              {...reveal}
              transition={{ duration: 0.45, delay: (i % 3) * 0.07 }}
              className="group relative flex flex-col overflow-hidden rounded-card border border-line bg-white p-5 shadow-card transition hover:-translate-y-1 hover:border-primary-200 hover:shadow-raised"
            >
              <span
                aria-hidden="true"
                className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary-400 via-primary-600 to-primary-800 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              />
              <div className="flex items-start justify-between gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-xl bg-mint-100 text-primary-700 transition group-hover:scale-105 group-hover:bg-mint-200">
                  <svc.icon className="h-6 w-6" />
                </span>
                {svc.popular ? (
                  <span className="rounded-full bg-accent-50 px-2.5 py-1 text-[11px] font-bold text-accent-600">
                    Most booked
                  </span>
                ) : null}
              </div>

              <h3 className="mt-4 font-display text-lg font-bold text-ink transition-colors group-hover:text-primary-800">
                {svc.name}
              </h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{svc.short}</p>

              <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-4">
                <div>
                  <p className="font-display text-lg font-extrabold text-ink">{formatCurrency(svc.startingPrice)}</p>
                  <p className="text-[11px] uppercase tracking-wide text-faint">per {svc.unit}</p>
                </div>
                <Button to={`/book-caregiver?service=${svc.id}`} variant="outline" size="sm" iconRight={ArrowRight}>
                  Book now
                </Button>
              </div>
            </motion.article>
          ))}
          </div>
        </Container>
      </Section>

      {/* ---------------- featured caregivers ---------------- */}
      {/* <Section tone="canvas" divider="both">
        <Container>
          <motion.div {...reveal}>
            <SectionHeading
              eyebrow="Featured caretakers"
              title="Verified professionals families book again"
              description="Ranked by rating, response rate and repeat bookings — all identities and registrations confirmed by our operations team."
              action={
                <Button to="/book-caregiver" variant="outline" size="sm" iconRight={ArrowRight}>
                  Book a caretaker
                </Button>
              }
            />
          </motion.div>

          <div className="mt-9 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {featuredCaregivers.map((cg, i) => (
              <motion.div
                key={cg.id}
                {...reveal}
                transition={{ duration: 0.45, delay: (i % 3) * 0.07 }}
              >
                <CaregiverCard caregiver={cg} />
              </motion.div>
            ))}
          </div>
        </Container>
      </Section> */}

      {/* ---------------- trust & safety ---------------- */}
      <Section
        id="trust"
        size="lg"
        className="overflow-hidden bg-gradient-to-b from-white via-canvas to-white"
      >
        <div aria-hidden="true" className="grid-pattern pointer-events-none absolute inset-0 opacity-40" />
        <div
          aria-hidden="true"
          className="animate-float-slow pointer-events-none absolute -top-28 -right-24 h-96 w-96 rounded-full border-[28px] border-warning-100/80"
        />
        <div
          aria-hidden="true"
          className="animate-float pointer-events-none absolute -bottom-40 left-10 h-80 w-80 rounded-full border-[22px] border-mint-100"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-1/3 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(163,229,218,0.25),transparent)] blur-3xl"
        />

        <Container>
          <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-16">
            <motion.div {...reveal}>
              <span className="inline-flex items-center gap-2 rounded-full border border-primary-200 bg-white px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.24em] text-primary-600 shadow-card">
                <ShieldCheck className="h-3.5 w-3.5" />
                ( Trust &amp; safety )
              </span>
              <h2 className="mt-5 font-display text-3xl font-extrabold leading-[1.1] text-primary-900 sm:text-4xl lg:text-5xl">
                Safety is a process,{' '}
                <span className="bg-gradient-to-r from-primary-500 via-primary-400 to-faint bg-clip-text text-transparent">
                  not a badge
                </span>
              </h2>
              <p className="mt-5 max-w-xl text-sm leading-relaxed text-muted sm:text-base">
                Letting a stranger into a hospital room or a home is a serious decision. Bystander documents every
                step — verification, payment, communication and emergency response — so families never have to take
                anyone on trust alone.
              </p>

              <ul className="mt-6 flex flex-wrap gap-2">
                {[
                  { icon: BadgeCheck, label: 'ID + selfie liveness' },
                  { icon: Stethoscope, label: 'Nursing licence' },
                  { icon: MapPin, label: 'Address proof' },
                  { icon: ShieldCheck, label: 'Police clearance' },
                ].map((chip) => (
                  <li
                    key={chip.label}
                    className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink-soft shadow-card transition hover:border-primary-300 hover:text-primary-700"
                  >
                    <chip.icon className="h-3.5 w-3.5 text-primary-600" />
                    {chip.label}
                  </li>
                ))}
              </ul>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button to="/about" size="lg" iconRight={Sparkles}>
                  About us now
                </Button>
                <Button to="/book-caregiver" variant="outline" size="lg" iconRight={ArrowRight}>
                  Book a caretaker
                </Button>
              </div>

            </motion.div>

            <motion.div
              {...reveal}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="relative mx-auto w-full max-w-sm sm:max-w-md lg:max-w-lg"
            >
              <div
                aria-hidden="true"
                className="absolute -inset-6 rotate-6 rounded-[2.75rem] border-2 border-dashed border-primary-200/80"
              />
              <div
                aria-hidden="true"
                className="absolute -top-6 -right-6 h-24 w-24 rounded-full bg-gradient-to-br from-mint-200 to-accent-100 opacity-70 blur-2xl"
              />
              <div className="group relative overflow-hidden rounded-[2rem] border-4 border-white shadow-raised">
                <ImageWithFallback
                  src="https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=1200&q=80"
                  alt="Caretaker supporting a senior at home"
                  className="h-[300px] w-full sm:h-[360px] lg:h-[400px]"
                  imgClassName="object-[center_35%] transition-transform duration-700 ease-out group-hover:scale-105"
                  fallback={
                    <div className="flex flex-col items-center gap-3 p-8 text-center text-white">
                      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white/15">
                        <Stethoscope className="h-7 w-7" />
                      </span>
                      <p className="text-sm font-semibold">Care in progress</p>
                    </div>
                  }
                />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-primary-950/60 to-transparent" />
                <div className="absolute bottom-5 left-5 flex items-center gap-2.5 rounded-2xl border border-white/20 bg-white/15 px-3.5 py-2.5 backdrop-blur-md">
                  <Siren className="h-4 w-4 text-white" />
                  <span className="text-xs font-bold text-white">SOS desk live 24×7</span>
                </div>
              </div>

              <div className="group absolute -bottom-10 -left-2 w-36 overflow-hidden rounded-3xl border-4 border-white shadow-raised transition duration-300 ease-out hover:z-10 hover:-translate-y-2 hover:scale-110 sm:-left-6 sm:w-48 lg:w-52">
                <ImageWithFallback
                  src="https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?auto=format&fit=crop&w=600&q=80"
                  alt="Nurse caring for a senior patient"
                  className="h-44 w-full sm:h-56 lg:h-64"
                  imgClassName="object-[center_30%] transition-transform duration-700 ease-out group-hover:scale-110"
                />
              </div>

              <div className="absolute -top-4 -left-3 hidden items-center gap-2 rounded-2xl border border-line bg-white px-4 py-3 shadow-raised sm:flex">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-success-50 text-success-600">
                  <ShieldCheck className="h-4.5 w-4.5" />
                </span>
                <div className="text-xs leading-tight">
                  <p className="font-display font-extrabold text-ink">100%</p>
                  <p className="text-muted">ID-verified caretakers</p>
                </div>
              </div>

              <div className="absolute -right-2 bottom-16 hidden items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3 shadow-raised lg:flex">
                <RatingStars value={4.9} size={14} />
                <div className="text-xs leading-tight">
                  <p className="font-display font-extrabold text-ink">4.9 / 5</p>
                  <p className="text-muted">family rating</p>
                </div>
              </div>
            </motion.div>
          </div>

          <div className="mt-20 grid gap-4 sm:grid-cols-2 lg:mt-24 lg:grid-cols-4">
            {TRUST_ITEMS.map((item, i) => (
              <motion.div
                key={item.title}
                {...reveal}
                transition={{ duration: 0.45, delay: i * 0.07 }}
                className="group relative overflow-hidden rounded-panel border border-line bg-white p-5 shadow-card transition duration-300 hover:-translate-y-1 hover:border-primary-200 hover:shadow-raised"
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary-400 via-primary-600 to-primary-800 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                />
                <div className="flex items-start justify-between gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-mint-100 text-primary-700 transition-transform duration-300 group-hover:scale-105">
                    <item.icon className="h-5 w-5" />
                  </span>
                  <span className="font-display text-2xl font-extrabold text-line-strong transition-colors duration-300 group-hover:text-primary-100">
                    0{i + 1}
                  </span>
                </div>
                <h3 className="mt-4 font-display text-base font-bold text-ink transition-colors group-hover:text-primary-800">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{item.body}</p>
              </motion.div>
            ))}
          </div>
        </Container>
      </Section>

      {/* ---------------- testimonials ---------------- */}
      <Section tone="dark" size="lg" className="overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-32 -left-24 h-[420px] w-[420px] rounded-full border-[30px] border-white/5"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -bottom-40 h-[480px] w-[480px] rounded-full border-[26px] border-accent-400/10"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-0 left-1/3 h-[380px] w-[620px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(56,189,248,0.18),transparent)] blur-3xl"
        />
        <div aria-hidden="true" className="grid-pattern pointer-events-none absolute inset-0 opacity-[0.15]" />

        <Container>
          <motion.div {...reveal} className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-accent-300 backdrop-blur-sm">
                <Star className="h-3.5 w-3.5 fill-warning-400 text-warning-400" />
                Family stories
              </span>
              <h2 className="mt-4 font-display text-2xl font-extrabold text-white sm:text-3xl lg:text-4xl">
                What families say{' '}
                <span className="bg-gradient-to-r from-accent-300 via-accent-400 to-mint-300 bg-clip-text text-transparent">
                  after the first week
                </span>
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/60 sm:text-base">
                Every review below comes from a completed, paid booking — we never publish anonymous or incentivised
                ratings.
              </p>
            </div>
            <div className="flex items-center gap-4 rounded-panel border border-white/15 bg-white/10 px-5 py-4 shadow-raised backdrop-blur-md">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-warning-400 to-warning-500 text-white shadow-[0_10px_24px_-10px_rgba(245,158,11,0.9)]">
                <Star className="h-6 w-6 fill-white text-white" />
              </span>
              <div className="text-sm leading-tight">
                <p className="font-display text-2xl font-extrabold text-white">
                  4.9<span className="text-base font-bold text-white/50">/5</span>
                </p>
                <p className="mt-0.5 text-xs text-white/60">from 3,100+ verified families</p>
              </div>
            </div>
          </motion.div>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {TESTIMONIALS.map((t, i) => (
              <motion.figure
                key={t.id}
                {...reveal}
                transition={{ duration: 0.45, delay: i * 0.08 }}
                className="group relative flex flex-col overflow-hidden rounded-panel border border-white/10 bg-white/[0.06] p-6 shadow-card backdrop-blur-md transition duration-300 hover:-translate-y-1.5 hover:border-accent-400/40 hover:bg-white/[0.1] hover:shadow-glow"
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-accent-400 via-mint-300 to-accent-400 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                />
                <Quote
                  className="h-9 w-9 text-white/10 transition-colors duration-300 group-hover:text-accent-300/40"
                  aria-hidden="true"
                />
                <blockquote className="mt-3 flex-1 text-sm leading-relaxed text-white/85">{t.quote}</blockquote>
                <div className="mt-4">
                  <RatingStars value={t.rating} size={13} />
                </div>
                <figcaption className="mt-4 flex items-center gap-3 border-t border-white/10 pt-4">
                  <Avatar src={t.avatar} name={t.name} size="md" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-white">{t.name}</p>
                    <p className="truncate text-xs text-white/55">{t.role}</p>
                  </div>
                </figcaption>
              </motion.figure>
            ))}
          </div>
        </Container>
      </Section>

      {/* ---------------- FAQ ---------------- */}
      <Section id="faq" tone="canvas" divider="both">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-start lg:gap-14">
            <motion.div {...reveal}>
              <SectionHeading
                eyebrow="FAQs"
                title="Questions families ask us first"
                description="Still unsure about something? Our care advisors answer on phone and chat, 7am to 11pm."
              />
              <Button to="/contact" variant="outline" size="sm" className="mt-5" iconRight={ArrowRight}>
                Talk to a care advisor
              </Button>
            </motion.div>

            <motion.div
              {...reveal}
              className="divide-y divide-line overflow-hidden rounded-card border border-line bg-white shadow-card"
            >
              {FAQS.map((faq, i) => {
                const open = openFaq === i
                return (
                  <div key={faq.q} className={cn(open && 'bg-mint-50/60')}>
                    <button
                      type="button"
                      id={`faq-btn-${i}`}
                      aria-expanded={open}
                      aria-controls={`faq-panel-${i}`}
                      onClick={() => setOpenFaq(open ? -1 : i)}
                      className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-slate-50"
                    >
                      <span
                        className={cn(
                          'font-display text-sm font-bold transition-colors sm:text-base',
                          open ? 'text-primary-800' : 'text-ink',
                        )}
                      >
                        {faq.q}
                      </span>
                      <ChevronDown
                        className={cn(
                          'h-4 w-4 shrink-0 text-faint transition-transform duration-200',
                          open && 'rotate-180 text-primary-700',
                        )}
                      />
                    </button>
                    <AnimatePresence initial={false}>
                      {open ? (
                        <motion.div
                          id={`faq-panel-${i}`}
                          key="panel"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25, ease: 'easeOut' }}
                          className="overflow-hidden"
                        >
                          <p className="px-5 pb-5 text-sm leading-relaxed text-muted">{faq.a}</p>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </div>
                )
              })}
            </motion.div>
          </div>
        </Container>
      </Section>

      {/* ---------------- closing CTA ---------------- */}
      <section className="relative overflow-hidden border-t border-line bg-gradient-to-br from-mint-100 via-mint-50 to-accent-50">
        <div
          aria-hidden="true"
          className="grid-pattern pointer-events-none absolute inset-0 opacity-50"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -bottom-28 h-80 w-80 rounded-full bg-[radial-gradient(closest-side,rgba(56,189,248,0.28),transparent)] blur-2xl"
        />
        <Container className="flex flex-col items-start gap-6 py-14 sm:py-16 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <h2 className="font-display text-2xl font-extrabold text-primary-900 sm:text-3xl">
              Care starts with one conversation
            </h2>
            <p className="mt-2.5 text-sm leading-relaxed text-primary-800/80 sm:text-base">
              Browse verified caretakers near you, or join Bystander as a caretaker and get paid for work you are
              already qualified to do.
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
            <Button to="/book-caregiver" size="lg" iconRight={ArrowRight}>
              Book a Caretaker
            </Button>
            <Button to="/register/caregiver" variant="secondary" size="lg">
              Become a Caretaker
            </Button>
          </div>
        </Container>
      </section>
    </div>
  )
}

export default HomePage
