import { Mail, MapPin, Phone } from 'lucide-react'
import { Link } from 'react-router-dom'
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

const columns = [
  {
    title: 'Platform',
    links: [
      { label: 'Browse services', to: '/services' },
      { label: 'Find a caretaker', to: '/caregivers' },
      { label: 'How it works', to: '/#how-it-works' },
      { label: 'Trust & safety', to: '/#trust' },
    ],
  },
  {
    title: 'For caregivers',
    links: [
      { label: 'Become a caregiver', to: '/register/caregiver' },
      { label: 'Caregiver login', to: '/login' },
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
  { label: 'Privacy policy', to: '/contact' },
  { label: 'Terms of service', to: '/contact' },
  { label: 'Refund policy', to: '/contact' },
]

export function PublicFooter() {
  return (
    <footer className="border-t border-line bg-white">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div className="max-w-sm">
            <Logo size="xl" />
            <p className="mt-4 text-sm leading-relaxed text-muted">
              CareMate connects families and patients with verified caregivers, professional nurses and nursing students
              for home care and hospital care — with escrow payments, documented verification and 24×7 SOS support.
            </p>
            <div className="mt-5 space-y-2 text-sm text-muted">
              <p className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" />
                4th Floor, One BKC, Bandra Kurla Complex, Mumbai 400051
              </p>
              <p className="flex items-center gap-2">
                <Phone className="h-4 w-4 shrink-0 text-primary-600" />
                +91 22 4890 1100
              </p>
              <p className="flex items-center gap-2">
                <Mail className="h-4 w-4 shrink-0 text-primary-600" />
                support@caremate.in
              </p>
            </div>
            <div className="mt-5 flex gap-2">
              {socials.map((social) => (
                <a
                  key={social.label}
                  href="#"
                  onClick={(e) => e.preventDefault()}
                  className="grid h-9 w-9 place-items-center rounded-lg border border-line text-muted transition hover:border-primary-300 hover:bg-mint-50 hover:text-primary-700"
                  aria-label={social.label}
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                    <path d={social.path} />
                  </svg>
                </a>
              ))}
            </div>
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <h4 className="font-display text-sm font-bold uppercase tracking-wider text-ink">{col.title}</h4>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link to={link.to} className="text-sm text-muted transition hover:text-primary-700">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted">
            © {new Date().getFullYear()} CareMate Healthcare Technologies Pvt. Ltd. All rights reserved.
          </p>
          <div className="flex flex-wrap gap-4">
            {legal.map((l) => (
              <Link key={l.label} to={l.to} className="text-xs text-muted transition hover:text-primary-700">
                {l.label}
              </Link>
            ))}
          </div>
        </div>
        <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-[11px] leading-relaxed text-faint">
          Demo notice: CareMate is presented here as a frontend demonstration. OTP delivery, identity verification,
          payments, SOS dispatch, camera and QR checks are simulated with sample data and do not touch real services.
        </p>
      </div>
    </footer>
  )
}

export default PublicFooter
