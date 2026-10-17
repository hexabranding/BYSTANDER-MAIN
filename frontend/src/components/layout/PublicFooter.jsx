import { ArrowRight, Info, Lock, Mail, MapPin, Phone, ShieldCheck, Siren } from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/common/Button'
import { Container } from '@/components/common/Container'
import { Logo } from '@/components/common/Logo'

const socials = [
  {
    label: 'Facebook',
    path: 'M13.5 9H16V6h-2.5C11.6 6 10 7.6 10 9.5V11H8v3h2v7h3v-7h2.2l.5-3H13v-1.2c0-.5.2-.8.5-.8Z',
  },
  {
    label: 'Instagram',
    path: 'M12 8.8A3.2 3.2 0 1 0 12 15.2 3.2 3.2 0 0 0 12 8.8Zm0 5.2a2 2 0 1 1 0-4 2 2 0 0 1 0 4Zm4.4-5.4a.9.9 0 1 1-1.8 0 .9.9 0 0 1 1.8 0ZM8 3.5h8A4.5 4.5 0 0 1 20.5 8v8a4.5 4.5 0 0 1-4.5 4.5H8A4.5 4.5 0 0 1 3.5 16V8A4.5 4.5 0 0 1 8 3.5Zm0 1.5A3 3 0 0 0 5 8v8a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3V8a3 3 0 0 0-3-3H8Z',
  },
  {
    label: 'LinkedIn',
    path: 'M6.5 9.5H4V20h2.5V9.5ZM5.2 8.4a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM20 14c0-2.4-1.4-3.6-3.2-3.6-1 0-1.8.4-2.3 1.2V10.5H12V20h2.5v-5c0-1.2.6-2 1.7-2s1.7.8 1.7 2V20H20v-6Z',
  },
  {
    label: 'X',
    path: 'M17.7 4h2.6l-5.7 6.5L21.5 20h-5.3l-4.1-5.4L7.3 20H4.7l6.1-7L4 4h5.4l3.7 4.9L17.7 4Zm-.9 14.4h1.4L8.2 5.5H6.7l10.1 12.9Z',
  },
]

/** Top assurance bar — the three promises the rest of the site repeats. */
const assurances = [
  {
    icon: ShieldCheck,
    label: '4-step human verification',
    hint: 'ID · council registration · address · police',
  },
  {
    icon: Lock,
    label: 'Escrow-protected payments',
    hint: 'Held until the shift is complete',
  },
  {
    icon: Siren,
    label: '24×7 on-call SOS desk',
    hint: 'A named human on every booking',
  },
]

const contact = [
  { icon: MapPin, text: '4th Floor, One BKC, Bandra Kurla Complex, Mumbai 400051' },
  { icon: Phone, text: '+91 22 4890 1100' },
  { icon: Mail, text: 'support@caremate.in' },
]

const columns = [
  {
    title: 'Platform',
    links: [
      { label: 'Browse services', to: '/services' },
      { label: 'Find a caretaker', to: '/caregivers' },
      { label: 'Trust & safety', to: '/#trust' },
    ],
  },
  {
    title: 'For caretakers',
    links: [
      { label: 'Become a caretaker', to: '/register/caregiver' },
      { label: 'Caretaker login', to: '/login' },
      { label: 'Verification process', to: '/#trust' },
      { label: 'Payouts & commission', to: '/#faq' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About CareMate', to: '/about' },
      { label: 'Contact & support', to: '/contact' },
      { label: 'FAQs', to: '/#faq' },
      { label: 'Admin login', to: '/login' },
    ],
  },
]

const legal = [
  { label: 'Privacy policy', to: '/legal/privacy' },
  { label: 'Terms of service', to: '/legal/terms' },
  { label: 'Refund policy', to: '/legal/refunds' },
]

export function PublicFooter() {
  return (
    <footer className="relative overflow-hidden border-t border-line bg-white">
      <div aria-hidden="true" className="grid-pattern pointer-events-none absolute inset-0 opacity-[0.05]" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-28 -left-24 h-72 w-72 rounded-full bg-[radial-gradient(closest-side,rgba(163,229,218,0.6),transparent)] blur-2xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-40 -right-32 h-96 w-96 rounded-full bg-[radial-gradient(closest-side,rgba(125,211,252,0.3),transparent)] blur-2xl"
      />

      <Container className="py-14 sm:py-16">
        {/* ------------- assurance bar ------------- */}
        <ul className="flex flex-col gap-4 border-b border-line pb-8 sm:flex-row sm:items-center sm:justify-center sm:gap-x-8 lg:gap-x-14">
          {assurances.map((item) => (
            <li key={item.label} className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-mint-100 text-primary-700">
                <item.icon className="h-4.5 w-4.5" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-ink">{item.label}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-faint">{item.hint}</p>
              </div>
            </li>
          ))}
        </ul>

        {/* ------------- link columns ------------- */}
        <div className="mt-10 grid gap-10 lg:grid-cols-[1.5fr_repeat(3,1fr)] lg:gap-12">
          <div className="max-w-sm">
            <Logo size="xl" />
            <p className="mt-4 text-sm leading-relaxed text-muted">
              CareMate connects families and patients with verified caretakers, professional nurses and nursing students
              for home care and hospital care — with escrow payments, documented verification and 24×7 SOS support.
            </p>

            <div className="mt-6 space-y-3">
              {contact.map((row) => (
                <p key={row.text} className="flex items-start gap-3 text-sm text-muted">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-line bg-canvas text-primary-600">
                    <row.icon className="h-4 w-4" />
                  </span>
                  <span className="pt-1 leading-relaxed">{row.text}</span>
                </p>
              ))}
            </div>

            <div className="mt-6 flex gap-2.5">
              {socials.map((social) => (
                <button
                  key={social.label}
                  type="button"
                  onClick={() =>
                    toast.info(`${social.label} profile is not linked in this demo`, {
                      description: 'Social channels will be connected before launch.',
                    })
                  }
                  className="grid h-10 w-10 place-items-center rounded-full border border-line bg-white text-muted shadow-card transition hover:-translate-y-0.5 hover:border-primary-300 hover:text-primary-700"
                  aria-label={social.label}
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                    <path d={social.path} />
                  </svg>
                </button>
              ))}
            </div>
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <h4 className="font-display text-xs font-bold uppercase tracking-[0.18em] text-primary-700">
                {col.title}
              </h4>
              <span
                aria-hidden="true"
                className="mt-3 block h-1 w-8 rounded-full bg-gradient-to-r from-primary-500 to-accent-400"
              />
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      to={link.to}
                      className="group inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-primary-700"
                    >
                      {link.label}
                      <ArrowRight className="h-3.5 w-3.5 -translate-x-1 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* ------------- quick action ------------- */}
        <div className="mt-12 flex flex-col gap-5 rounded-panel border border-primary-100 bg-gradient-to-r from-mint-50 via-white to-primary-50 p-5 shadow-card sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl">
            <p className="font-display text-base font-extrabold text-ink sm:text-lg">
              Care can’t wait for office hours
            </p>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              Search verified caretakers near you, or call the on-call desk — it answers around the clock, every day
              of the week.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-3">
            <Button to="/caregivers" iconRight={ArrowRight}>
              Find a caretaker
            </Button>
            <Button to="/contact" variant="outline" icon={Phone}>
              Talk to us
            </Button>
          </div>
        </div>

        {/* ------------- demo notice ------------- */}
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-line bg-canvas p-4">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white text-primary-600 ring-1 ring-inset ring-line">
            <Info className="h-3.5 w-3.5" />
          </span>
          <p className="text-[11px] leading-relaxed text-faint">
            Demo notice: CareMate is presented here as a frontend demonstration. OTP delivery, identity verification,
            payments, SOS dispatch, camera and QR checks are simulated with sample data and do not touch real services.
          </p>
        </div>
      </Container>

      {/* ------------- base bar ------------- */}
      <div className="relative border-t border-primary-900/60 bg-primary-950">
        <Container className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-white/55">
            © {new Date().getFullYear()} CareMate Healthcare Technologies Pvt. Ltd. All rights reserved.
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {legal.map((l) => (
              <Link
                key={l.label}
                to={l.to}
                className="text-xs text-white/55 transition hover:text-white hover:underline hover:underline-offset-4"
              >
                {l.label}
              </Link>
            ))}
          </div>
        </Container>
      </div>
    </footer>
  )
}

export default PublicFooter
