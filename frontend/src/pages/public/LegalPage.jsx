import { Link, useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, FileText, Lock, ShieldCheck } from 'lucide-react'
import { useDocumentTitle } from '@/hooks/useUi'
import { cn } from '@/utils/cn'
import { Button } from '@/components/common/Button'
import { Container } from '@/components/common/Container'
import { Section } from '@/components/common/Section'
import { PageHero } from '@/components/common/PageHero'
import { NotFoundPage } from '@/pages/public/NotFoundPage'

const DOCS = {
  terms: {
    eyebrow: 'Legal',
    title: 'Terms of',
    highlight: 'service',
    updated: 'Last updated 1 October 2026',
    intro:
      'These terms govern your use of the Bystander platform, whether you are booking care or providing it. By creating an account you accept them.',
    sections: [
      {
        heading: '1. Using Bystander',
        body: [
          'Bystander is a healthcare marketplace that connects families with verified caretakers, nurses and nursing students. We are not a hospital, clinic or home-health agency, and we do not employ the caretakers listed on the platform.',
          'You must be 18 or older to book a service, and you must provide accurate patient information so that caretakers can deliver care safely.',
        ],
      },
      {
        heading: '2. Bookings and escrow',
        body: [
          'When you confirm a booking, the full amount is held in escrow rather than released to the caretaker immediately. Funds are released after the service is completed and any dispute window has closed.',
          'Prices quoted in the booking summary are final. Any change in scope — extra hours, additional patients, or a different location — will be re-quoted before it is worked.',
        ],
      },
      {
        heading: '3. Cancellations',
        body: [
          'Cancellations made more than 24 hours before the start time are refunded in full. Cancellations within 24 hours are refunded at 50%.',
          'Cancellations within 4 hours of the start time may attract a fee of up to 100% of the first hour, to cover the caretaker’s reserved travel and time.',
        ],
      },
      {
        heading: '4. Conduct and safety',
        body: [
          'Caretakers agree to arrive on time, work within the stated scope, and record check-in, check-out and handover notes for every shift.',
          'Either party may end a session early through the SOS button if there is a genuine safety concern. Abusive or unsafe conduct results in immediate suspension pending review.',
        ],
      },
      {
        heading: '5. Accounts',
        body: [
          'You are responsible for keeping your login credentials and OTP codes confidential. Notify support immediately if you believe your account has been accessed by someone else.',
          'We may suspend an account that is under investigation for fraud, misrepresentation or a serious safety complaint.',
        ],
      },
      {
        heading: '6. Liability',
        body: [
          'To the extent permitted by law, Bystander’s liability is limited to the value of the booking in question. Nothing in these terms limits liability for fraud or for death or injury caused by negligence.',
        ],
      },
      {
        heading: '7. Changes',
        body: [
          'We will notify you in-app at least 14 days before these terms change materially. Continued use after that date constitutes acceptance.',
        ],
      },
    ],
  },
  privacy: {
    eyebrow: 'Legal',
    title: 'Privacy',
    highlight: 'policy',
    updated: 'Last updated 1 October 2026',
    intro:
      'This policy explains what personal and health information we collect, why we collect it, and the choices you have. Health data is treated as sensitive and handled accordingly.',
    sections: [
      {
        heading: '1. Information we collect',
        body: [
          'Account data: name, email address, mobile number, city and password.',
          'Patient data: name, age, relationship to you, stated condition and care requirements. This is collected only to match a suitable caretaker and is never used for marketing.',
          'Caretaker data: qualification, nursing registration number, identity documents, address proof and bank details, used solely for verification and payouts.',
          'Operational data: booking records, check-in and check-out times, handover notes, invoices, messages and support tickets.',
        ],
      },
      {
        heading: '2. How we use it',
        body: [
          'To match you with caretakers, process bookings, hold and release escrow payments, and respond to support and SOS requests.',
          'To run identity and document verification. Verification is reviewed by people, not only by automated systems.',
          'To meet legal and tax obligations, including maintaining invoices for services rendered.',
        ],
      },
      {
        heading: '3. Who can see it',
        body: [
          'The caretaker assigned to your booking sees the patient details required to deliver care — condition, address, timings and emergency contact.',
          'Bystander authorized staff see records only where needed for support, verification or an active complaint, and access is logged.',
          'We do not sell personal data, and we do not share patient health information with advertisers.',
        ],
      },
      {
        heading: '4. Retention',
        body: [
          'Booking and invoice records are retained for 8 years to meet tax and legal requirements. Verification documents are retained for the life of the account plus 3 years.',
          'Support tickets are retained for 3 years from closure.',
        ],
      },
      {
        heading: '5. Your choices',
        body: [
          'You can view and edit your profile details at any time from Profile → Personal details.',
          'You can raise a data access or deletion request through the contact form. Some records must be kept where the law requires it.',
        ],
      },
      {
        heading: '6. Security',
        body: [
          'Data is encrypted in transit and at rest. Access to production systems is restricted and audited. Report any suspected security concern to support@bystander.care.',
        ],
      },
    ],
  },
  refunds: {
    eyebrow: 'Legal',
    title: 'Refund',
    highlight: 'policy',
    updated: 'Last updated 1 October 2026',
    intro:
      'Because payment sits in escrow, refunds are straightforward — the money has not yet been released. This page sets out when a refund is due and how long it takes.',
    sections: [
      {
        heading: '1. When a refund applies',
        body: [
          'The caretaker cancels and no replacement can be assigned in time.',
          'The booking is cancelled by you within the windows described in the terms of service.',
          'The service was not delivered as booked — for example, a caretaker did not arrive and the shift was recorded as missed.',
          'A completed booking is found to have been mis-described after review.',
        ],
      },
      {
        heading: '2. When it does not',
        body: [
          'The caretaker attended and worked the booked hours, and you were unsatisfied with the care — that is a complaint, not an automatic refund, and will be assessed case by case.',
          'Cancellations inside the 4-hour window where the caretaker had already travelled.',
          'Change of mind after a booking has entered In Progress status.',
        ],
      },
      {
        heading: '3. How much',
        body: [
          'Escrow-held funds are returned in full for a qualifying refund.',
          'Where part of the shift was delivered, only the undelivered portion is refunded.',
          'Payment gateway fees are borne by Bystander and are not deducted from your refund.',
        ],
      },
      {
        heading: '4. How long it takes',
        body: [
          'Approved refunds are initiated within 2 working days. UPI and card refunds typically settle in 3–5 working days; net bank transfers take up to 7.',
          'You will see the refund reflected under Payments with a reference number, and it will be marked against the original booking.',
        ],
      },
      {
        heading: '5. How to ask',
        body: [
          'Raise a complaint from the booking detail page, or use the complaint form with the booking reference. Choose the category “Billing or refund”.',
          'Our operations desk responds to billing cases within 1 working day.',
        ],
      },
    ],
  },
}

export function LegalPage() {
  const { doc } = useParams()
  const navigate = useNavigate()
  const content = DOCS[doc]

  useDocumentTitle(content ? `${content.title} ${content.highlight}` : 'Legal')

  if (!content) return <NotFoundPage />

  return (
    <div className="bg-canvas">
      <PageHero
        eyebrow={content.eyebrow}
        icon={FileText}
        title={content.title}
        highlight={content.highlight}
        description={content.intro}
        items={[{ label: content.title + ' ' + content.highlight }]}
        actions={
          <div className="flex flex-wrap gap-2">
            {Object.entries(DOCS).map(([key, value]) => (
              <Link
                key={key}
                to={`/legal/${key}`}
                className={cn(
                  'rounded-full border px-3.5 py-2 text-xs font-bold transition',
                  key === doc
                    ? 'border-accent-400/60 bg-accent-400/15 text-white'
                    : 'border-white/15 bg-white/10 text-white/70 hover:border-white/30 hover:text-white',
                )}
              >
                {value.title} {value.highlight}
              </Link>
            ))}
          </div>
        }
      />

      <Section tone="white">
        <Container>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary-700">{content.updated}</p>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_280px] lg:items-start">
            <div className="space-y-4">
              {content.sections.map((section) => (
                <article
                  key={section.heading}
                  className="rounded-card border border-line bg-canvas p-5 shadow-card sm:p-6"
                >
                  <h2 className="font-display text-lg font-bold text-ink">{section.heading}</h2>
                  <div className="mt-3 space-y-3">
                    {section.body.map((paragraph, index) => (
                      <p key={index} className="text-sm leading-relaxed text-muted">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </article>
              ))}
            </div>

            <aside className="space-y-4 lg:sticky lg:top-32">
              <div className="rounded-card border border-primary-200 bg-mint-50/60 p-5 shadow-card">
                <p className="flex items-center gap-2 text-sm font-bold text-primary-900">
                  <ShieldCheck className="h-4 w-4 text-primary-700" /> Compliance & Verification
                </p>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  Bystander operates a verified healthcare caregiver registry. All listed practitioners undergo credential screening, identity verification, and police record checks prior to approval.
                </p>
              </div>

              <div className="rounded-card border border-line bg-white p-5 shadow-card">
                <p className="flex items-center gap-2 text-sm font-bold text-ink">
                  <ShieldCheck className="h-4 w-4 text-primary-700" /> Questions?
                </p>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  Write to support@bystander.care or use the contact form — we answer within 1 business day.
                </p>
                <Button to="/contact" variant="outline" size="sm" className="mt-4" fullWidth>
                  Contact support
                </Button>
              </div>

              <div className="rounded-card border border-warning-200 bg-warning-50 p-5">
                <p className="flex items-center gap-2 text-sm font-bold text-warning-700">
                  <AlertTriangle className="h-4 w-4" /> Active booking issue?
                </p>
                <p className="mt-2 text-sm leading-relaxed text-warning-800">
                  Do not wait on an email — use the SOS button inside your booking to reach the on-call desk
                  immediately.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 border-warning-300 text-warning-800 hover:bg-warning-100"
                  fullWidth
                  onClick={() => navigate('/customer/dashboard')}
                >
                  Go to my bookings
                </Button>
              </div>
            </aside>
          </div>
        </Container>
      </Section>
    </div>
  )
}

export default LegalPage
