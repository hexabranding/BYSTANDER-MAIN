import { motion } from 'framer-motion'
import { ArrowRight, Check, HeartHandshake, MapPin, ShieldCheck, Stethoscope, Target, Users, Zap } from 'lucide-react'
import { useDocumentTitle } from '@/hooks/useUi'
import { Avatar } from '@/components/common/Avatar'
import { Button } from '@/components/common/Button'
import { Container } from '@/components/common/Container'
import { Section } from '@/components/common/Section'
import { SectionHeading } from '@/components/common/SectionHeading'
import { PageHero } from '@/components/common/PageHero'

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
      <PageHero
        eyebrow="CareMate Healthcare Technologies Pvt. Ltd."
        icon={Stethoscope}
        title="We are rebuilding how families"
        highlight="find care at home"
        description="CareMate exists because finding a trustworthy caregiver in India is still a matter of references, luck and phone calls. We built a platform where qualification, verification, pricing and accountability are visible before anyone enters a hospital room or a home."
        items={[{ label: 'About' }]}
        actions={
          <>
            <Button to="/caregivers" size="lg" iconRight={ArrowRight}>
              Browse caregivers
            </Button>
            <Button
              to="/register/caregiver"
              variant="outline"
              size="lg"
              className="border-white/25 bg-white/10 text-white hover:border-white/40 hover:bg-white/15 hover:text-white"
            >
              Join as a caregiver
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
              'Zero unverified caregivers on the platform',
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
            <motion.div {...reveal}>
              <SectionHeading
                eyebrow="Our story"
                title="Started in a hospital corridor"
                description="The problem was never the clinical care. It was the coordination — and the fact that no family could verify who was walking through the door."
              />
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
        </Container>
      </Section>

      {/* verification timeline */}
      <Section tone="white">
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
      <Section tone="canvas" divider="both">
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

      {/* CTA */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary-950 via-primary-900 to-primary-800">
        <div aria-hidden="true" className="grid-pattern pointer-events-none absolute inset-0 opacity-[0.14]" />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -right-16 h-80 w-80 rounded-full bg-[radial-gradient(closest-side,rgba(56,189,248,0.22),transparent)] blur-3xl"
        />
        <Container className="relative flex flex-col items-start gap-6 py-12 sm:py-16 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-accent-300">
              <Users className="h-3.5 w-3.5" /> Join CareMate
            </p>
            <h2 className="mt-2.5 font-display text-2xl font-extrabold text-white sm:text-3xl">
              Whether you need care or give it
            </h2>
            <p className="mt-2.5 text-sm leading-relaxed text-white/60 sm:text-base">
              Families find a verified caretaker in minutes. Caregivers complete verification once and get a
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
              Apply as a caregiver
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
