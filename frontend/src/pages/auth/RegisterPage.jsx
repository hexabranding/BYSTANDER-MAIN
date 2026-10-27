import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowRight, HeartHandshake, ShieldCheck, ShieldUser, Siren, Stethoscope } from 'lucide-react'
import { useDocumentTitle } from '@/hooks/useUi'
import { Button } from '@/components/common/Button'

const OPTIONS = [
  {
    id: 'customer',
    icon: HeartHandshake,
    eyebrow: 'For families',
    title: 'Book a caretaker',
    description: 'Find verified caretakers and nurses for your loved one at home.',
    bullets: [
      'Browse verified caretakers near you',
      'Escrow-protected payments',
      'Live booking tracking and SOS support',
    ],
    to: '/register/customer',
    cta: 'Register as customer',
  },
  {
    id: 'caregiver',
    icon: Stethoscope,
    eyebrow: 'For caretakers & nurses',
    title: 'Join as a caretaker',
    description: 'Earn flexible income with shifts that match your skills and city.',
    bullets: [
      'Get matched with nearby jobs',
      'Weekly payouts to your bank',
      'Documents verified by our team',
    ],
    to: '/register/caregiver',
    cta: 'Apply as caretaker',
  },
  {
    id: 'ambulance',
    icon: Siren,
    eyebrow: 'For emergency responders',
    title: 'Register as an Ambulance Driver',
    description: 'Connect your vehicle to local families and caretakers for instant emergency dispatch.',
    bullets: [
      'Direct 1-tap dialer for families and bedside caretakers',
      'Toggle live availability (Available / Off-Duty)',
      'Free community emergency network — zero commission',
    ],
    to: '/register/ambulance',
    cta: 'Register your ambulance',
  },
]

const WHY_POINTS = [
  'Every caretaker submits government ID, qualification and police-clearance documents.',
  'A human reviews each file before a profile goes live — never auto-approved.',
  'Families only see caretakers whose verification status is Approved.',
]

export function RegisterPage() {
  useDocumentTitle('Create your account')
  const navigate = useNavigate()

  const handleSelect = (option) => {
    if (option.id === 'admin') toast.info('Signing in with the seeded admin demo account')
    navigate(option.to)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-ink">Create your account</h1>
        <p className="mt-1.5 text-sm text-muted">Choose how you want to use CareMate — it only takes a minute.</p>
      </div>

      <div className="space-y-3">
        {OPTIONS.map((option) => {
          const Icon = option.icon
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => handleSelect(option)}
              className="group w-full rounded-card border border-line bg-white p-5 text-left shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-primary-300 hover:shadow-raised focus:outline-none focus-visible:ring-4 focus-visible:ring-primary-100"
            >
              <div className="flex items-start gap-3.5">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-mint-100 text-primary-700 transition group-hover:bg-primary-700 group-hover:text-white">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-primary-700">{option.eyebrow}</p>
                  <h2 className="mt-0.5 font-display text-base font-bold text-ink">{option.title}</h2>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{option.description}</p>
                  <ul className="mt-3 space-y-1.5">
                    {option.bullets.map((point) => (
                      <li key={point} className="flex items-start gap-2 text-xs text-ink-soft">
                        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary-600" />
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
                <ArrowRight className="mt-1 h-4.5 w-4.5 shrink-0 text-faint transition group-hover:translate-x-0.5 group-hover:text-primary-700" />
              </div>
            </button>
          )
        })}
      </div>

      <div className="rounded-card border border-primary-100 bg-mint-50 p-4">
        <p className="flex items-center gap-2 text-sm font-bold text-primary-900">
          <ShieldCheck className="h-4 w-4 text-primary-700" /> Why verification matters
        </p>
        <ul className="mt-2.5 space-y-2">
          {WHY_POINTS.map((point) => (
            <li key={point} className="flex items-start gap-2 text-xs leading-relaxed text-primary-900/80">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary-700" aria-hidden="true" />
              {point}
            </li>
          ))}
        </ul>
      </div>

      <p className="text-center text-sm text-muted">
        Already have an account?{' '}
        <Button variant="link" size="sm" to="/login" className="p-0">
          Sign in
        </Button>
      </p>
    </div>
  )
}

export default RegisterPage
