import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronDown,
  Clock,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Send,
  Siren,
} from 'lucide-react'
import { useDocumentTitle } from '@/hooks/useUi'
import { cn } from '@/utils/cn'
import { uid } from '@/utils/format'
import { FAQS } from '@/data/content'
import { Button } from '@/components/common/Button'
import { Container } from '@/components/common/Container'
import { PageHero } from '@/components/common/PageHero'
import { FormField, Input, Select, Textarea } from '@/components/forms/FormField'

const CONTACT_CARDS = [
  {
    icon: MapPin,
    label: 'Head office',
    value: '4th Floor, One BKC, Bandra Kurla Complex, Mumbai 400051',
    hint: 'Visits by appointment only',
  },
  {
    icon: Phone,
    label: 'Care helpline',
    value: '+91 22 4890 1100',
    hint: 'Also on WhatsApp at +91 98200 11223',
  },
  {
    icon: Mail,
    label: 'Email',
    value: 'support@caremate.in',
    hint: 'Replies within one working day',
  },
  {
    icon: Clock,
    label: 'Support hours',
    value: 'Every day, 7:00 AM – 11:00 PM IST',
    hint: 'SOS desk answers 24×7',
  },
]

const OFFICES = [
  {
    city: 'Mumbai',
    tag: 'Headquarters',
    address: '4th Floor, One BKC, Bandra Kurla Complex, Mumbai 400051',
    phone: '+91 22 4890 1100',
    team: 'Care operations, verification desk, on-call team',
  },
  {
    city: 'Bengaluru',
    tag: 'South India operations',
    address: 'Level 3, Prestige Trade Tower, Palace Road, Bengaluru 560001',
    phone: '+91 80 4711 2200',
    team: 'Caregiver onboarding, hospital partnerships',
  },
  {
    city: 'Delhi NCR',
    tag: 'North India operations',
    address: 'Unit 210, DLF Cyber Hub, Sector 24, Gurugram 122002',
    phone: '+91 124 4890 118',
    team: 'Family support, partner relations',
  },
]

const SUBJECTS = [
  'Booking a caregiver',
  'Hospital care requirement',
  'Caregiver registration',
  'Payment or invoice query',
  'Complaint or feedback',
  'Partnership enquiry',
]

export function ContactPage() {
  useDocumentTitle('Contact Us')

  const [sent, setSent] = useState(null)
  const [openFaq, setOpenFaq] = useState(0)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: { name: '', email: '', phone: '', subject: SUBJECTS[0], message: '' },
  })

  const onSubmit = (data) => {
    setSent({ ...data, ref: uid('ENQ') })
    reset()
    toast.success('Enquiry sent — a care advisor will get back to you within one working day.')
  }

  return (
    <div className="bg-canvas">
      <PageHero
        eyebrow="Real humans, not ticket bots"
        icon={MessageSquare}
        title="Talk to the"
        highlight="CareMate team"
        description="Booking help, hospital requirements, caregiver onboarding or a billing question — write to us here or call the care helpline. Urgent issues on an active booking are handled through the in-app SOS button."
        items={[{ label: 'Contact' }]}
      />

      {/* contact cards */}
      <Container className="pt-10 sm:pt-12">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CONTACT_CARDS.map((card) => (
            <div
              key={card.label}
              className="group rounded-card border border-line bg-white p-5 shadow-raised transition duration-300 hover:-translate-y-1 hover:border-primary-200"
            >
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-mint-100 text-primary-700 transition-transform duration-300 group-hover:scale-105">
                <card.icon className="h-5 w-5" />
              </span>
              <p className="mt-4 text-xs font-bold uppercase tracking-wider text-faint">{card.label}</p>
              <p className="mt-1.5 break-words text-sm font-semibold text-ink">{card.value}</p>
              <p className="mt-1 text-xs text-muted">{card.hint}</p>
            </div>
          ))}
        </div>
      </Container>

      {/* form + offices */}
      <Container className="py-10 sm:py-14">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <div className="rounded-card border border-line bg-white shadow-raised">
            <div className="border-b border-line px-5 py-4 sm:px-6">
              <h2 className="font-display text-xl font-extrabold text-ink">Send an enquiry</h2>
              <p className="mt-1 text-sm text-muted">
                Fill in the details and our care team will respond within one working day.
              </p>
            </div>

            <div className="px-5 py-5 sm:px-6 sm:py-6">
              <AnimatePresence mode="wait">
                {sent ? (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.3 }}
                    className="flex flex-col items-start gap-4 rounded-card border border-success-200 bg-success-50 p-6"
                  >
                    <span className="grid h-12 w-12 place-items-center rounded-full bg-white text-success-600 shadow-card">
                      <CheckCircle2 className="h-6 w-6" />
                    </span>
                    <div>
                      <h3 className="font-display text-lg font-bold text-ink">Enquiry received, {sent.name}!</h3>
                      <p className="mt-1.5 max-w-md text-sm leading-relaxed text-ink-soft">
                        We have logged your request about “{sent.subject}”. A care advisor will reply to{' '}
                        <span className="font-semibold text-ink">{sent.email}</span>
                        {sent.phone ? ` or call ${sent.phone}` : ''} within one working day.
                      </p>
                      <p className="mt-2 text-xs text-muted">
                        Reference: {sent.ref} · Urgent? Call +91 22 4890 1100.
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setSent(null)}>
                      Send another enquiry
                    </Button>
                  </motion.div>
                ) : (
                  <motion.form
                    key="form"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    onSubmit={handleSubmit(onSubmit)}
                    noValidate
                    aria-label="Contact form"
                  >
                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField label="Full name" htmlFor="ct-name" required error={errors.name?.message}>
                        <Input
                          id="ct-name"
                          placeholder="Priya Sharma"
                          autoComplete="name"
                          error={errors.name}
                          {...register('name', {
                            required: 'Please enter your name',
                            minLength: { value: 2, message: 'Name looks too short' },
                          })}
                        />
                      </FormField>

                      <FormField label="Email" htmlFor="ct-email" required error={errors.email?.message}>
                        <Input
                          id="ct-email"
                          type="email"
                          placeholder="you@example.com"
                          autoComplete="email"
                          error={errors.email}
                          {...register('email', {
                            required: 'Email is required',
                            pattern: {
                              value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                              message: 'Enter a valid email address',
                            },
                          })}
                        />
                      </FormField>

                      <FormField label="Phone" htmlFor="ct-phone" required error={errors.phone?.message}>
                        <Input
                          id="ct-phone"
                          type="tel"
                          placeholder="+91 98200 11223"
                          autoComplete="tel"
                          error={errors.phone}
                          {...register('phone', {
                            required: 'Phone number is required',
                            pattern: {
                              value: /^[+\d][\d\s-]{7,14}$/,
                              message: 'Enter a valid phone number (8–15 digits)',
                            },
                          })}
                        />
                      </FormField>

                      <FormField label="Subject" htmlFor="ct-subject" required error={errors.subject?.message}>
                        <Select id="ct-subject" error={errors.subject} {...register('subject', { required: true })}>
                          {SUBJECTS.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </Select>
                      </FormField>
                    </div>

                    <FormField
                      label="Message"
                      htmlFor="ct-message"
                      required
                      error={errors.message?.message}
                      className="mt-4"
                      hint="Include city, patient’s condition and dates if you are enquiring about care."
                    >
                      <Textarea
                        id="ct-message"
                        rows={6}
                        placeholder="My mother is being discharged in Powai on 14 October and needs 12-hour night support…"
                        error={errors.message}
                        {...register('message', {
                          required: 'Please tell us how we can help',
                          minLength: { value: 15, message: 'Add a little more detail (at least 15 characters)' },
                        })}
                      />
                    </FormField>

                    <div className="mt-5 flex flex-wrap items-center gap-3">
                      <Button type="submit" icon={Send}>
                        Send enquiry
                      </Button>
                      <p className="text-xs text-muted">
                        We never share your details with third parties.
                      </p>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-card border border-line bg-white shadow-card">
              <div className="border-b border-line px-5 py-4">
                <h2 className="font-display text-base font-bold text-ink">Our offices</h2>
                <p className="mt-0.5 text-sm text-muted">Three teams, one on-call rotation</p>
              </div>
              <ul className="divide-y divide-line">
                {OFFICES.map((office) => (
                  <li key={office.city} className="flex gap-3.5 px-5 py-4">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-mint-100 text-primary-700">
                      <Building2 className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-display text-sm font-bold text-ink">{office.city}</h3>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted">
                          {office.tag}
                        </span>
                      </div>
                      <p className="mt-1 text-sm leading-relaxed text-muted">{office.address}</p>
                      <p className="mt-1 text-xs text-faint">{office.team}</p>
                      <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-semibold text-primary-700">
                        <Phone className="h-3.5 w-3.5" /> {office.phone}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="relative overflow-hidden rounded-card bg-gradient-to-br from-primary-950 via-primary-900 to-primary-800 p-5">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -top-12 -right-12 h-40 w-40 rounded-full bg-[radial-gradient(closest-side,rgba(56,189,248,0.3),transparent)] blur-2xl"
              />
              <p className="relative flex items-center gap-2 text-sm font-bold text-white">
                <Phone className="h-4 w-4 text-accent-400" /> Active booking emergency?
              </p>
              <p className="relative mt-2 text-sm leading-relaxed text-white/65">
                Use the SOS button inside your booking. It alerts the on-call desk, your emergency contact and an
                admin who stays on the line until it is resolved.
              </p>
              <span className="relative mt-3 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-bold text-white/85 backdrop-blur-sm">
                <Siren className="h-3.5 w-3.5 text-accent-300" />
                SOS desk answers 24×7
              </span>
            </div>
          </div>
        </div>
      </Container>

      {/* FAQ mini accordion */}
      <section className="border-t border-line bg-canvas">
        <Container className="py-12 sm:py-16">
          <div className="grid gap-8 lg:grid-cols-[0.75fr_1.25fr] lg:items-start lg:gap-14">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary-700">Quick answers</p>
              <h2 className="mt-2 font-display text-2xl font-extrabold text-ink sm:text-3xl">
                Before you write in
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                These are the questions our support desk answers most often. If yours is not here, send the form above
                or call the helpline.
              </p>
              <Button to="/services" variant="outline" size="sm" className="mt-5" iconRight={ArrowRight}>
                Browse care services
              </Button>
            </div>

            <div className="divide-y divide-line overflow-hidden rounded-card border border-line bg-white shadow-card">
              {FAQS.slice(0, 5).map((faq, i) => {
                const open = openFaq === i
                return (
                  <div key={faq.q} className={cn(open && 'bg-mint-50/60')}>
                    <button
                      type="button"
                      id={`contact-faq-btn-${i}`}
                      aria-expanded={open}
                      aria-controls={`contact-faq-panel-${i}`}
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
                          id={`contact-faq-panel-${i}`}
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
            </div>
          </div>
        </Container>
      </section>
    </div>
  )
}

export default ContactPage
