import { motion } from 'framer-motion'
import { ArrowRight, Check, HeartHandshake, MapPin, ShieldCheck, Stethoscope, Target, Users, Zap } from 'lucide-react'
import { useDocumentTitle } from '@/hooks/useUi'
import { Avatar } from '@/components/common/Avatar'
import { Button } from '@/components/common/Button'
import { Breadcrumbs } from '@/components/common/Breadcrumbs'

const reveal = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.15 },
  transition: { duration: 0.5, ease: 'easeOut' },
}

const VERIFICATION_STEPS = [
  {
    step: '01',
    title: 'Identity & liveness check',
    body: 'A government photo ID is matched against a live selfie capture. Names, date of birth and photographs are compared manually before the profile moves forward.',
    meta: 'Aadhaar / PAN / Passport',
  },
  {
    step: '02',
    title: 'Professional registration',
    body: 'Nursing registration numbers are validated with the state nursing council. Nursing students submit a college ID and a letter of supervised scope of practice.',
    meta: 'State council · College records',
  },
  {
    step: '03',
    title: 'Address & background',
    body: 'Address proof is reviewed against the application. A police clearance certificate is optional, but submitting one lifts the profile into a higher trust badge.',
    meta: 'Utility bill / Rent agreement',
  },
  {
    step: '04',
    title: 'Interview & live demo',
    body: 'A care operations lead runs a 20-minute video interview covering patient handling, infection control and escalation, followed by a practical demonstration.',
    meta: 'Video interview · Skill demo',
  },
]

const TEAM = [
  {
    name: 'Neha Kulkarni',
    role: 'Co-founder & CEO',
    photo: 'https://randomuser.me/api/portraits/women/65.jpg',
    bio: 'Former hospital network operations lead. Built CareMate after managing her grandmother’s home care across four agencies.',
  },
  {
    name: 'Dr. Vikram Raghavan',
    role: 'Chief Medical Officer',
    photo: 'https://randomuser.me/api/portraits/men/41.jpg',
    bio: 'MD, Internal Medicine. Designs CareMate’s care protocols, escalation matrix and caregiver training curriculum.',
  },
  {
    name: 'Aarti Menon',
    role: 'Head of Care Operations',
    photo: 'https://randomuser.me/api/portraits/women/33.jpg',
    bio: 'Ex-ICU nurse who now runs the verification desk and the 24×7 on-call team that answers every SOS.',
  },
  {
    name: 'Sameer Qureshi',
    role: 'Head of Product & Technology',
    photo: 'https://randomuser.me/api/portraits/men/22.jpg',
    bio: 'Spends his days on escrow flows, masked calling and making sure the shift handover note takes under 30 seconds to read.',
  },
]

const VALUES = [
  {
    icon: ShieldCheck,
    title: 'Verify before trust',
    body: 'No profile goes live on the strength of a photograph. Every document is read by a person and checked against the issuing authority.',
  },
  {
    icon: HeartHandshake,
    title: 'Care is personal',
    body: 'Families are handing over someone they love. We treat handovers, updates and privacy with the seriousness that deserves.',
  },
  {
    icon: Target,
    title: 'Price honestly',
    body: 'Itemised estimates, no surge pricing, and the 12% commission carried by the caregiver — never hidden inside a family’s bill.',
  },
  {
    icon: Zap,
    title: 'Respond fast',
    body: 'Median first response under 9 minutes, backup caregivers offered within 15 minutes of a cancellation, and a human on every SOS call.',
  },
]

const STATS = [
  { value: '4,200+', label: 'Verified caregivers' },
  { value: '61,000+', label: 'Shifts completed' },
  { value: '18', label: 'Cities live' },
  { value: '96%', label: 'Families who rebook' },
]

export function AboutPage() {
  useDocumentTitle('About Us')

  return (
    <div className="bg-canvas">
      {/* header */}
      <section className="border-b border-line bg-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
          <Breadcrumbs items={[{ label: 'About' }]} />

          <div className="mt-5 grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-primary-200 bg-mint-100 px-3 py-1.5 text-xs font-bold text-primary-800">
                <Stethoscope className="h-3.5 w-3.5" />
                CareMate Healthcare Technologies Pvt. Ltd.
              </span>
              <h1 className="mt-4 font-display text-3xl font-extrabold leading-tight text-ink sm:text-4xl">
                We are rebuilding how families find care at home
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
                CareMate exists because finding a trustworthy caregiver in India is still a matter of references,
                luck and phone calls. We built a platform where qualification, verification, pricing and
                accountability are visible before anyone enters a hospital room or a home.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Button to="/caregivers" size="lg" iconRight={ArrowRight}>
                  Browse caregivers
                </Button>
                <Button to="/register/caregiver" variant="outline" size="lg">
                  Join as a caregiver
                </Button>
              </div>
            </div>

            <div className="rounded-card border border-line bg-canvas p-6 shadow-card">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary-700">Our mission</p>
              <p className="mt-3 font-display text-xl font-bold leading-snug text-ink">
                Make verified, hospital-grade care at home an ordinary thing to book — not a privilege of
                connections.
              </p>
              <div className="mt-5 space-y-2.5 border-t border-line pt-5">
                {[
                  'Zero unverified caregivers on the platform',
                  'Every rupee itemised before a family confirms',
                  'A human answering every escalation, 24×7',
                ].map((line) => (
                  <p key={line} className="flex gap-2.5 text-sm text-ink-soft">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" />
                    {line}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* stats band */}
      <section className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 sm:pt-14 lg:px-8">
        <div className="grid gap-px overflow-hidden rounded-card border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map((stat, i) => (
            <motion.div
              key={stat.label}
              {...reveal}
              transition={{ duration: 0.4, delay: i * 0.06 }}
              className="bg-white px-5 py-6 text-center"
            >
              <p className="font-display text-3xl font-extrabold tabular-nums text-primary-700">{stat.value}</p>
              <p className="mt-1 text-sm text-muted">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* story */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-18 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
          <motion.div {...reveal}>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary-700">Our story</p>
            <h2 className="mt-2 font-display text-2xl font-extrabold text-ink sm:text-3xl">
              Started in a hospital corridor
            </h2>
          </motion.div>

          <motion.div {...reveal} className="space-y-4 text-sm leading-relaxed text-muted sm:text-base">
            <p>
              In 2022, our co-founder spent eleven weeks coordinating her grandmother’s post-stroke care. Three
              agencies, five caregivers, no shared records and one very expensive invoice that did not match the
              quote. The clinical care was fine — the coordination was the problem.
            </p>
            <p>
              CareMate began as a spreadsheet matching verified nurses to discharge summaries. Nurses registered
              their state council numbers, families paid into a common pool, and every shift ended with a written
              handover note. That note is still the heart of the product.
            </p>
            <p>
              Today CareMate operates in 18 cities with 4,200+ verified caregivers — registered nurses, GNM and ANM
              professionals, physiotherapy assistants, certified elder-care caregivers, MBBS doctors on call and
              nursing students working under supervision. The spreadsheet became an escrow engine, an identity
              verification pipeline and an on-call desk that has never once been unattended.
            </p>
          </motion.div>
        </div>
      </section>

      {/* verification timeline */}
      <section className="border-y border-line bg-white py-14 sm:py-18">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div {...reveal} className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary-700">Verification</p>
            <h2 className="mt-2 font-display text-2xl font-extrabold text-ink sm:text-3xl">
              Four steps before a profile goes live
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted sm:text-base">
              The process takes 3–7 working days. Roughly one in four applicants is rejected or asked to re-submit,
              which is exactly the point.
            </p>
          </motion.div>

          <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {VERIFICATION_STEPS.map((item, i) => (
              <motion.li
                key={item.step}
                {...reveal}
                transition={{ duration: 0.45, delay: i * 0.08 }}
                className="relative rounded-card border border-line bg-canvas p-5"
              >
                <div className="flex items-center justify-between">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-primary-700 font-display text-sm font-bold text-white">
                    {i + 1}
                  </span>
                  <span className="font-display text-2xl font-extrabold text-mint-200">{item.step}</span>
                </div>
                <h3 className="mt-4 font-display text-base font-bold text-ink">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{item.body}</p>
                <p className="mt-3 border-t border-line pt-3 text-[11px] font-bold uppercase tracking-wide text-primary-700">
                  {item.meta}
                </p>
              </motion.li>
            ))}
          </ol>
        </div>
      </section>

      {/* values */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-18 lg:px-8">
        <motion.div {...reveal} className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary-700">What we hold to</p>
          <h2 className="mt-2 font-display text-2xl font-extrabold text-ink sm:text-3xl">Our values</h2>
        </motion.div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {VALUES.map((value, i) => (
            <motion.div
              key={value.title}
              {...reveal}
              transition={{ duration: 0.45, delay: (i % 2) * 0.08 }}
              className="flex gap-4 rounded-card border border-line bg-white p-5 shadow-card"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-mint-100 text-primary-700">
                <value.icon className="h-5 w-5" />
              </span>
              <div>
                <h3 className="font-display text-base font-bold text-ink">{value.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{value.body}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* leadership */}
      <section className="border-t border-line bg-white py-14 sm:py-18">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div {...reveal} className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary-700">Leadership</p>
            <h2 className="mt-2 font-display text-2xl font-extrabold text-ink sm:text-3xl">
              The people accountable for your care
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted sm:text-base">
              A small operating team in Mumbai and Bengaluru, backed by clinical leadership that reviews every
              escalation.
            </p>
          </motion.div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {TEAM.map((person, i) => (
              <motion.article
                key={person.name}
                {...reveal}
                transition={{ duration: 0.45, delay: i * 0.07 }}
                className="rounded-card border border-line bg-canvas p-5 text-center shadow-card transition hover:border-primary-200 hover:shadow-raised"
              >
                <div className="flex justify-center">
                  <Avatar src={person.photo} name={person.name} size="xl" />
                </div>
                <h3 className="mt-4 font-display text-base font-bold text-ink">{person.name}</h3>
                <p className="text-xs font-bold uppercase tracking-wide text-primary-700">{person.role}</p>
                <p className="mt-2.5 text-sm leading-relaxed text-muted">{person.bio}</p>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-18 lg:px-8">
        <div className="flex flex-col items-start gap-5 rounded-card bg-primary-900 p-6 sm:p-9 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-accent-400">
              <Users className="h-3.5 w-3.5" /> Join CareMate
            </p>
            <h2 className="mt-2 font-display text-2xl font-extrabold text-white sm:text-3xl">
              Whether you need care or give it
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-white/70">
              Families find a verified caregiver in minutes. Caregivers complete verification once and get a
              steady stream of shifts with on-time escrow payouts.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button to="/caregivers" size="lg" iconRight={ArrowRight}>
              Find care
            </Button>
            <Button to="/register/caregiver" variant="secondary" size="lg">
              Apply as a caregiver
            </Button>
          </div>
        </div>

        <p className="mt-6 flex items-center justify-center gap-2 text-xs text-muted">
          <MapPin className="h-3.5 w-3.5 text-primary-600" /> One BKC, Bandra Kurla Complex, Mumbai · Serving 18
          cities across India
        </p>
      </section>
    </div>
  )
}

export default AboutPage
