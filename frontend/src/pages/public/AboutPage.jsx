import { motion } from 'framer-motion'
import {
  Accessibility,
  Activity,
  ArrowRight,
  Check,
  Clock,
  FileText,
  HeartHandshake,
  MapPin,
  ShieldCheck,
  Stethoscope,
  Target,
  UserCheck,
  Users,
  Zap,
} from 'lucide-react'
import { useDocumentTitle } from '@/hooks/useUi'
import { reveal, revealFromLeft, revealFromRight } from '@/utils/motion'
import { Avatar } from '@/components/common/Avatar'
import { Button } from '@/components/common/Button'
import { Container } from '@/components/common/Container'
import { Section } from '@/components/common/Section'
import { SectionHeading } from '@/components/common/SectionHeading'
import { PageHero } from '@/components/common/PageHero'

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
    bio: 'MD, Internal Medicine. Designs CareMate’s care protocols, escalation matrix and caretaker training curriculum.',
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
    body: 'Itemised estimates, no surge pricing, and the 12% commission carried by the caretaker — never hidden inside a family’s bill.',
  },
  {
    icon: Zap,
    title: 'Respond fast',
    body: 'Median first response under 9 minutes, backup caretakers offered within 15 minutes of a cancellation, and a human on every SOS call.',
  },
]

const STATS = [
  { value: '4,200+', label: 'Verified caretakers' },
  { value: '61,000+', label: 'Shifts completed' },
  { value: '18', label: 'Cities live' },
  { value: '96%', label: 'Families who rebook' },
]

const MILESTONES = [
  {
    year: '2022',
    tag: 'Where it started',
    title: 'A spreadsheet, eleven caretakers, one hospital ward',
    body: 'Our co-founder matched state-council-verified nurses to discharge summaries for her own grandmother. Families paid into a shared pool, and every shift ended with a written handover note.',
  },
  {
    year: '2023',
    tag: 'Escrow',
    title: 'Payment stopped being a trust problem',
    body: 'Funds moved into a held pool at confirmation and were released only after the handover note was filed. The first thousand shifts ran on that rule, and it has not changed since.',
  },
  {
    year: '2024',
    tag: 'Verification',
    title: 'We started saying no more often',
    body: 'Document-level review replaced self-declaration: council registration validated at source, a liveness check against photo ID, and a live interview before any profile goes live.',
  },
  {
    year: '2025',
    tag: 'Escalation',
    title: 'An on-call desk that never closes',
    body: 'An ex-ICU nurse took over care operations and stood up a 24×7 SOS desk. Every active booking now has a named human behind it instead of a ticket number.',
  },
  {
    year: '2026',
    tag: 'Today',
    title: '4,200+ caretakers across 18 cities',
    body: '61,000+ shifts completed, 96% of families rebooking the same caretaker. The escrow engine, the verification pipeline and the on-call desk all still run in-house.',
  },
]

const CARE_ROLES = [
  {
    icon: Stethoscope,
    title: 'Registered nurses',
    quals: 'B.Sc · GNM Nursing',
    body: 'Vitals and recovery tracking, wound and dressing care, IV and catheter management, medication schedules and post-operative observation.',
  },
  {
    icon: HeartHandshake,
    title: 'Elder-care caretakers',
    quals: 'Certified Elder Care Giver',
    body: 'Dementia and Alzheimer’s support, assisted bathing and dressing, mobility help and the long companionship shifts families book week after week.',
  },
  {
    icon: Accessibility,
    title: 'Physiotherapy assistants',
    quals: 'Physiotherapy Assistant',
    body: 'Post-surgery and post-stroke mobility, assisted walking, and the prescribed exercise routine carried out at home between clinic visits.',
  },
  {
    icon: Users,
    title: 'ANM & nursing students',
    quals: 'ANM · Final-year students',
    body: 'Daily living support — feeding, hygiene, companionship and medication reminders — always scoped under a supervising nurse.',
  },
  {
    icon: Activity,
    title: 'Paramedics',
    quals: 'Paramedic',
    body: 'Emergency response training, vitals escalation and transport coordination the moment a hospital transfer becomes necessary.',
  },
  {
    icon: UserCheck,
    title: 'Doctors on call',
    quals: 'MBBS',
    body: 'Teleconsultation, prescription review and a clinical second opinion whenever a care plan needs to change mid-booking.',
  },
]

const NOTE_ROWS = [
  { label: 'Vitals', value: 'BP 132/84 · Pulse 78 · SpO₂ 97%', logged: true },
  { label: 'Medication', value: 'Metformin 500 mg, 08:00 — given with breakfast', logged: true },
  { label: 'Meals', value: 'Breakfast finished · about 60% of lunch taken', logged: true },
  { label: 'Mobility', value: 'Two assisted walks along the hall, no discomfort', logged: true },
  { label: 'Follow-up', value: 'Dressing change due 18:00 — flagged to the family thread', logged: false },
]

export function AboutPage() {
  useDocumentTitle('About Us')

  return (
    <div className="bg-canvas">
      {/* header */}
      <PageHero
        eyebrow="CareMate Healthcare Technologies Pvt. Ltd."
        icon={Stethoscope}
        title="We are rebuilding how families"
        highlight="find care at home"
        description="CareMate exists because finding a trustworthy caretaker in India is still a matter of references, luck and phone calls. We built a platform where qualification, verification, pricing and accountability are visible before anyone enters a hospital room or a home."
        items={[{ label: 'About' }]}
        actions={
          <>
            <Button to="/caregivers" size="lg" iconRight={ArrowRight}>
              Browse caretakers
            </Button>
            <Button
              to="/register/caregiver"
              variant="outline"
              size="lg"
              className="border-white/25 bg-white/10 text-white hover:border-white/40 hover:bg-white/15 hover:text-white"
            >
              Join as a caretaker
            </Button>
          </>
        }
      />

      {/* mission + stats */}
      <Container className="py-10 sm:py-14">
        <motion.div {...reveal} className="rounded-panel border border-line bg-white p-6 shadow-raised sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary-700">Our mission</p>
          <p className="mt-3 max-w-3xl font-display text-xl font-bold leading-snug text-ink sm:text-2xl">
            Make verified, hospital-grade care at home an ordinary thing to book — not a privilege of connections.
          </p>
          <div className="mt-6 grid gap-3 border-t border-line pt-6 sm:grid-cols-3">
            {[
              'Zero unverified caretakers on the platform',
              'Every rupee itemised before a family confirms',
              'A human answering every escalation, 24×7',
            ].map((line) => (
              <p key={line} className="flex gap-2.5 text-sm text-ink-soft">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-mint-100 text-primary-700">
                  <Check className="h-3 w-3" />
                </span>
                {line}
              </p>
            ))}
          </div>
        </motion.div>

        <div className="mt-6 grid gap-px overflow-hidden rounded-card border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map((stat, i) => (
            <motion.div
              key={stat.label}
              {...reveal}
              transition={{ duration: 0.4, delay: i * 0.06 }}
              className="group bg-white px-5 py-6 text-center transition-colors hover:bg-mint-50"
            >
              <p className="font-display text-3xl font-extrabold tabular-nums text-primary-700">{stat.value}</p>
              <p className="mt-1 text-sm text-muted">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </Container>

      {/* story */}
      <Section tone="canvas" divider="both">
        <Container>
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start lg:gap-14">
            <motion.div {...revealFromLeft}>
              <SectionHeading
                eyebrow="Our story"
                title="Started in a hospital corridor"
                description="The problem was never the clinical care. It was the coordination — and the fact that no family could verify who was walking through the door."
              />
            </motion.div>

            <motion.div {...revealFromRight} className="space-y-4 text-sm leading-relaxed text-muted sm:text-base">
              <p>
                In 2022, our co-founder spent eleven weeks coordinating her grandmother’s post-stroke care. Three
                agencies, five caretakers, no shared records and one very expensive invoice that did not match the
                quote. The clinical care was fine — the coordination was the problem.
              </p>
              <p>
                CareMate began as a spreadsheet matching verified nurses to discharge summaries. Nurses registered
                their state council numbers, families paid into a common pool, and every shift ended with a written
                handover note. That note is still the heart of the product.
              </p>
              <p>
                Today CareMate operates in 18 cities with 4,200+ verified caretakers — registered nurses, GNM and ANM
                professionals, physiotherapy assistants, certified elder-care caretakers, MBBS doctors on call and
                nursing students working under supervision. The spreadsheet became an escrow engine, an identity
                verification pipeline and an on-call desk that has never once been unattended.
              </p>
            </motion.div>
          </div>
        </Container>
      </Section>

      {/* journey */}
      <Section tone="white">
        <Container>
          <motion.div {...reveal}>
            <SectionHeading
              eyebrow="The journey"
              title="From one spreadsheet to an operations desk"
              description="Five years of tightening the same three things: who is allowed to work, how money moves, and who answers when something goes wrong."
            />
          </motion.div>

          <ol className="mt-10 max-w-3xl">
            {MILESTONES.map((item, i) => (
              <motion.li
                key={item.year}
                {...reveal}
                transition={{ duration: 0.45, delay: i * 0.06 }}
                className="relative flex gap-4 pb-8 last:pb-0 sm:gap-6"
              >
                <div className="flex w-10 shrink-0 flex-col items-center">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary-700 font-display text-sm font-bold text-white shadow-[0_10px_24px_-12px_rgba(15,118,110,0.85)] ring-4 ring-white">
                    {i + 1}
                  </span>
                  {i < MILESTONES.length - 1 ? (
                    <span
                      aria-hidden="true"
                      className="mt-2 w-px flex-1 bg-[repeating-linear-gradient(180deg,var(--color-primary-300)_0_6px,transparent_6px_12px)]"
                    />
                  ) : null}
                </div>

                <div className="min-w-0 flex-1 pb-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-sm font-extrabold tabular-nums text-primary-700">
                      {item.year}
                    </span>
                    <span className="rounded-full bg-mint-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-800">
                      {item.tag}
                    </span>
                  </p>
                  <h3 className="mt-1.5 font-display text-base font-bold text-ink sm:text-lg">{item.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{item.body}</p>
                </div>
              </motion.li>
            ))}
          </ol>
        </Container>
      </Section>

      {/* verification timeline */}
      <Section tone="canvas" divider="both">
        <Container>
          <motion.div {...reveal}>
            <SectionHeading
              eyebrow="Verification"
              title="Four steps before a profile goes live"
              description="The process takes 3–7 working days. Roughly one in four applicants is rejected or asked to re-submit, which is exactly the point."
            />
          </motion.div>

          <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {VERIFICATION_STEPS.map((item, i) => (
              <motion.li
                key={item.step}
                {...reveal}
                transition={{ duration: 0.45, delay: i * 0.08 }}
                className="group relative overflow-hidden rounded-card border border-line bg-canvas p-5 transition duration-300 hover:-translate-y-1 hover:border-primary-200 hover:bg-white hover:shadow-raised"
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary-400 via-primary-600 to-primary-800 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                />
                <div className="flex items-center justify-between">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-primary-700 font-display text-sm font-bold text-white shadow-[0_10px_22px_-12px_rgba(15,118,110,0.9)]">
                    {i + 1}
                  </span>
                  <span className="font-display text-2xl font-extrabold text-mint-200 transition-colors duration-300 group-hover:text-primary-200">
                    {item.step}
                  </span>
                </div>
                <h3 className="mt-4 font-display text-base font-bold text-ink transition-colors group-hover:text-primary-800">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{item.body}</p>
                <p className="mt-3 border-t border-line pt-3 text-[11px] font-bold uppercase tracking-wide text-primary-700">
                  {item.meta}
                </p>
              </motion.li>
            ))}
          </ol>
        </Container>
      </Section>

      {/* values */}
      <Section tone="white">
        <Container>
          <motion.div {...reveal}>
            <SectionHeading
              eyebrow="What we hold to"
              title="Our values"
              description="Four commitments that shape how we build, price and staff every booking on the platform."
            />
          </motion.div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {VALUES.map((value, i) => (
              <motion.div
                key={value.title}
                {...reveal}
                transition={{ duration: 0.45, delay: (i % 2) * 0.08 }}
                className="group flex gap-4 rounded-card border border-line bg-white p-5 shadow-card transition duration-300 hover:-translate-y-1 hover:border-primary-200 hover:shadow-raised"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-mint-100 text-primary-700 transition-transform duration-300 group-hover:scale-105">
                  <value.icon className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="font-display text-base font-bold text-ink transition-colors group-hover:text-primary-800">
                    {value.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{value.body}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </Container>
      </Section>

      {/* care network */}
      <Section tone="canvas" divider="both">
        <Container>
          <motion.div {...reveal}>
            <SectionHeading
              eyebrow="The care network"
              title="Six kinds of professional, one matching rule"
              description="A booking is only ever offered to someone whose qualification covers the task. Clinical work goes to nurses; daily living support goes to certified caretakers and supervised students."
            />
          </motion.div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CARE_ROLES.map((role, i) => (
              <motion.article
                key={role.title}
                {...reveal}
                transition={{ duration: 0.45, delay: (i % 3) * 0.07 }}
                className="group flex flex-col rounded-card border border-line bg-white p-5 shadow-card transition duration-300 hover:-translate-y-1 hover:border-primary-200 hover:shadow-raised"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-mint-100 text-primary-700 transition-transform duration-300 group-hover:scale-105">
                    <role.icon className="h-5 w-5" />
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-muted">
                    {role.quals}
                  </span>
                </div>
                <h3 className="mt-4 font-display text-base font-bold text-ink transition-colors group-hover:text-primary-800">
                  {role.title}
                </h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{role.body}</p>
              </motion.article>
            ))}
          </div>

          <motion.div {...reveal} className="mt-6 flex flex-wrap items-center gap-3">
            <Button to="/caregivers" iconRight={ArrowRight}>
              Browse the network
            </Button>
            <Button to="/services" variant="outline">
              See every service
            </Button>
          </motion.div>
        </Container>
      </Section>

      {/* leadership */}
      <Section tone="white">
        <Container>
          <motion.div {...reveal}>
            <SectionHeading
              eyebrow="Leadership"
              title="The people accountable for your care"
              description="A small operating team in Mumbai and Bengaluru, backed by clinical leadership that reviews every escalation."
            />
          </motion.div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {TEAM.map((person, i) => (
              <motion.article
                key={person.name}
                {...reveal}
                transition={{ duration: 0.45, delay: i * 0.07 }}
                className="group rounded-card border border-line bg-canvas p-5 text-center shadow-card transition duration-300 hover:-translate-y-1 hover:border-primary-200 hover:bg-white hover:shadow-raised"
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
        </Container>
      </Section>

      {/* how a shift runs */}
      <Section tone="canvas" divider="both">
        <Container>
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
            <motion.div {...revealFromLeft}>
              <SectionHeading
                eyebrow="How a shift runs"
                title="Every shift ends with a written handover"
                description="The note is why families trust a stranger in their hallway. It is filed by the caretaker before escrow releases, so nobody gets paid for a shift nobody can account for."
              />

              <ul className="mt-6 space-y-3.5">
                {[
                  { icon: Check, text: 'Check-in and check-out are timestamped from the caretaker’s phone.' },
                  { icon: Activity, text: 'Vitals, medication, meals and mobility are logged as the shift happens.' },
                  { icon: FileText, text: 'The family thread receives the note the moment the shift closes.' },
                ].map((point) => (
                  <li key={point.text} className="flex items-start gap-3 text-sm text-ink-soft">
                    <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white text-primary-700 ring-1 ring-inset ring-primary-200">
                      <point.icon className="h-3.5 w-3.5" strokeWidth={2.5} />
                    </span>
                    <span className="leading-relaxed">{point.text}</span>
                  </li>
                ))}
              </ul>

              <Button to="/services" className="mt-7" variant="outline" iconRight={ArrowRight}>
                See what a booking includes
              </Button>
            </motion.div>

            <motion.div {...revealFromRight} transition={{ duration: 0.6, delay: 0.1 }}>
              <div className="rounded-panel border border-line bg-white p-5 shadow-raised sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-700 text-white">
                      <FileText className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="font-display text-sm font-bold text-ink">Shift handover</p>
                      <p className="text-xs text-muted">14 Oct · 08:00 → 20:00 · Post-Surgery Care</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-success-50 px-2.5 py-1 text-[11px] font-bold text-success-700 ring-1 ring-inset ring-success-500/40">
                    Filed
                  </span>
                </div>

                <ul className="divide-y divide-line">
                  {NOTE_ROWS.map((row) => (
                    <li key={row.label} className="flex items-start gap-3 py-3.5">
                      <span
                        className={
                          row.logged
                            ? 'mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-success-50 text-success-700 ring-1 ring-inset ring-success-500/40'
                            : 'mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary-50 text-primary-700 ring-1 ring-inset ring-primary-300'
                        }
                        aria-hidden="true"
                      >
                        {row.logged ? (
                          <Check className="h-3 w-3" strokeWidth={3} />
                        ) : (
                          <Clock className="h-3 w-3" strokeWidth={3} />
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-faint">{row.label}</p>
                        <p className="mt-0.5 text-sm leading-relaxed text-ink-soft">{row.value}</p>
                      </div>
                    </li>
                  ))}
                </ul>

                <div className="flex items-center gap-2 border-t border-line pt-4 text-xs text-muted">
                  <Users className="h-4 w-4 shrink-0 text-primary-400" />
                  Shared with the family thread automatically at check-out.
                </div>
              </div>

              <p className="mt-3 text-center text-[11px] leading-relaxed text-faint">
                Illustrative note — the format every caretaker files at the end of a shift.
              </p>
            </motion.div>
          </div>
        </Container>
      </Section>

      {/* CTA */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary-950 via-primary-900 to-primary-800">
        <div aria-hidden="true" className="grid-pattern pointer-events-none absolute inset-0 opacity-[0.14]" />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -right-16 h-80 w-80 rounded-full bg-[radial-gradient(closest-side,rgba(56,189,248,0.22),transparent)] blur-3xl"
        />
        <Container className="flex flex-col items-start gap-6 py-12 sm:py-16 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-accent-300">
              <Users className="h-3.5 w-3.5" /> Join CareMate
            </p>
            <h2 className="mt-2.5 font-display text-2xl font-extrabold text-white sm:text-3xl">
              Whether you need care or give it
            </h2>
            <p className="mt-2.5 text-sm leading-relaxed text-white/60 sm:text-base">
              Families find a verified caretaker in minutes. Caretakers complete verification once and get a
              steady stream of shifts with on-time escrow payouts.
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
            <Button to="/caregivers" size="lg" iconRight={ArrowRight}>
              Find care
            </Button>
            <Button
              to="/register/caregiver"
              variant="outline"
              size="lg"
              className="border-white/25 bg-white/10 text-white hover:border-white/40 hover:bg-white/15 hover:text-white"
            >
              Apply as a caretaker
            </Button>
          </div>
        </Container>
      </section>

      <Container className="py-6">
        <p className="flex items-center justify-center gap-2 text-xs text-muted">
          <MapPin className="h-3.5 w-3.5 text-primary-600" /> One BKC, Bandra Kurla Complex, Mumbai · Serving 18
          cities across India
        </p>
      </Container>
    </div>
  )
}

export default AboutPage
