import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  BadgeCheck,
  Briefcase,
  Building2,
  CalendarDays,
  Clock,
  Flag,
  Globe,
  Languages,
  MapPin,
  MessageSquare,
  PenLine,
  Quote,
  ShieldCheck,
  Sparkles,
  Star,
  ThumbsUp,
} from 'lucide-react'
import { useDocumentTitle } from '@/hooks/useUi'
import { cn } from '@/utils/cn'
import { formatCurrency, formatDate, initials } from '@/utils/format'
import { durationBasis } from '@/utils/duration'
import { reveal } from '@/utils/motion'
import { getCaregiverById } from '@/data/caregivers'
import { useAuth } from '@/context/AuthContext'
import { useData } from '@/context/DataContext'
import { Button } from '@/components/common/Button'
import { Card, CardBody, CardHeader } from '@/components/common/Card'
import { Reveal } from '@/components/common/Reveal'
import { Avatar } from '@/components/common/Avatar'
import { StatusBadge } from '@/components/common/StatusBadge'
import { RatingStars } from '@/components/common/RatingStars'
import { EmptyState } from '@/components/common/States'
import { Modal } from '@/components/common/Modal'
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog'
import { Breadcrumbs } from '@/components/common/Breadcrumbs'
import { PriceBreakdown } from '@/components/common/TimelinePrice'
import { FormField, Textarea } from '@/components/forms/FormField'

const DAY_STYLE = {
  available: 'border-success-200 bg-success-50',
  booked: 'border-warning-200 bg-warning-50',
  blocked: 'border-line bg-slate-50',
}
const DAY_LABEL = { available: 'Available', booked: 'Partly booked', blocked: 'Blocked' }
const DAY_TEXT = {
  available: 'text-success-700',
  booked: 'text-warning-700',
  blocked: 'text-faint',
}

const ESTIMATED_HOURS = 4

export function CaregiverDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const caregiver = getCaregiverById(id)

  useDocumentTitle(caregiver ? caregiver.name : 'Caretaker')

  const { isLoggedIn, user } = useAuth()
  const { reviews, addReview } = useData()

  const [reviewOpen, setReviewOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')

  if (!caregiver) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="rounded-card border border-line bg-white shadow-card">
          <EmptyState
            icon={ShieldCheck}
            title="Caretaker not found"
            description="This profile may have been removed or the link is incorrect. Browse all verified caretakers to find the right match."
            action={<Button to="/caregivers">Browse caretakers</Button>}
          />
        </div>
      </div>
    )
  }

  const {
    id: caregiverId,
    name,
    photo,
    qualification,
    experienceYears,
    rating: profileRating,
    reviewCount,
    hourlyRate,
    services,
    languages,
    city,
    area,
    distanceKm,
    availability,
    verified,
    careSettings,
    bio,
    joinedOn,
    trustScore,
    responseRate,
    completedJobs,
    repeatClients,
    badges,
    specialities,
    weekAvailability,
  } = caregiver

  const caregiverReviews = (reviews ?? []).filter((r) => r.caregiverId === caregiverId)

  const subtotal = hourlyRate * ESTIMATED_HOURS
  const platformFee = 49
  const tax = Math.round((subtotal + platformFee) * 0.18)
  const total = subtotal + platformFee + tax

  const handleBook = () => {
    if (isLoggedIn && user?.role === 'customer') {
      navigate('/customer/book-caregiver')
      return
    }
    if (isLoggedIn) {
      toast.error('Booking is available from a customer account. Please switch accounts to continue.')
      return
    }
    toast.error('Please sign in as a customer to book this caretaker.')
    navigate('/login')
  }

  const submitReview = () => {
    const text = comment.trim()
    if (text.length < 10) {
      toast.error('Please write at least 10 characters about your experience.')
      return
    }
    addReview({
      caregiverId,
      customerId: user?.id || 'guest',
      customerName: user?.name || 'Guest member',
      bookingId: '—',
      rating,
      comment: text,
    })
    toast.success(`Thanks for reviewing ${name.split(' ')[0]} — your feedback is now live.`)
    setComment('')
    setRating(5)
    setReviewOpen(false)
  }

  const miniStats = [
    { label: 'Trust score', value: `${trustScore}%`, icon: ShieldCheck },
    { label: 'Response rate', value: `${responseRate}%`, icon: MessageSquare },
    { label: 'Jobs completed', value: String(completedJobs), icon: ThumbsUp },
    { label: 'Repeat clients', value: String(repeatClients), icon: BadgeCheck },
  ]

  return (
    <div className="bg-canvas">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <Breadcrumbs items={[{ label: 'Caretakers', to: '/caregivers' }, { label: name }]} />

        <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_21rem] lg:items-start">
          {/* ---------------- left column ---------------- */}
          <motion.div {...reveal} className="space-y-5">
            <Card>
              <CardBody className="p-5 sm:p-6">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                  <Avatar src={photo} name={name} size="2xl" verified={verified} />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="font-display text-2xl font-extrabold text-ink sm:text-3xl">{name}</h1>
                      {verified ? (
                        <StatusBadge status="Verified" size="sm" />
                      ) : (
                        <StatusBadge status="Pending" size="sm" />
                      )}
                    </div>

                    <p className="mt-1 text-sm font-semibold text-primary-700">
                      {qualification} · {experienceYears} years experience
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
                      <RatingStars value={profileRating} count={reviewCount} showValue />
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="h-4 w-4 text-faint" />
                        {area}, {city}
                        {distanceKm ? ` · ${distanceKm} km away` : ''}
                      </span>
                      <StatusBadge status={availability} size="sm" />
                    </div>

                    <div className="mt-3.5 flex flex-wrap gap-1.5">
                      {badges.map((badge) => (
                        <span
                          key={badge}
                          className="inline-flex items-center gap-1 rounded-md bg-mint-100 px-2 py-1 text-[11px] font-semibold text-primary-800"
                        >
                          <BadgeCheck className="h-3 w-3" />
                          {badge}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                    <div className="text-left sm:text-right">
                      <p className="font-display text-2xl font-extrabold text-ink">{formatCurrency(hourlyRate)}</p>
                      <p className="text-[11px] uppercase tracking-wide text-faint">per hour</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={Flag}
                      onClick={() => setReportOpen(true)}
                      className="text-muted hover:text-danger-600"
                    >
                      Report profile
                    </Button>
                  </div>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="About" subtitle={`Joined CareMate on ${formatDate(joinedOn, { long: true })}`} icon={Sparkles} />
              <CardBody>
                <p className="text-sm leading-relaxed text-ink-soft">{bio}</p>

                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-faint">Services offered</h3>
                    <ul className="mt-2.5 space-y-2">
                      {services.map((svc) => (
                        <li key={svc} className="flex items-start gap-2 text-sm text-ink-soft">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-500" />
                          {svc}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-faint">Specialities</h3>
                    <ul className="mt-2.5 space-y-2">
                      {specialities.map((spec) => (
                        <li key={spec} className="flex items-start gap-2 text-sm text-ink-soft">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-400" />
                          {spec}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-faint">
                      <Languages className="h-3.5 w-3.5" /> Languages
                    </h3>
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {languages.map((lang) => (
                        <span
                          key={lang}
                          className="rounded-md border border-line bg-white px-2.5 py-1 text-xs font-semibold text-ink-soft"
                        >
                          {lang}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-faint">
                      <Building2 className="h-3.5 w-3.5" /> Care settings
                    </h3>
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {careSettings.map((setting) => (
                        <span
                          key={setting}
                          className="rounded-md bg-mint-100 px-2.5 py-1 text-xs font-semibold text-primary-800"
                        >
                          {setting}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="Weekly availability"
                subtitle="Slots shown in local time — request any slot while booking"
                icon={CalendarDays}
              />
              <CardBody>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-7">
                  {weekAvailability.map((day) => (
                    <div
                      key={day.day}
                      className={cn(
                        'rounded-xl border p-3 transition',
                        DAY_STYLE[day.status] ?? DAY_STYLE.blocked,
                      )}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="font-display text-sm font-bold text-ink">{day.day}</p>
                        <span className={cn('text-[10px] font-bold uppercase', DAY_TEXT[day.status])}>
                          {day.status === 'available' ? 'Open' : day.status === 'booked' ? 'Busy' : 'Off'}
                        </span>
                      </div>
                      <p className={cn('mt-1 text-[11px] font-medium', DAY_TEXT[day.status])}>
                        {DAY_LABEL[day.status]}
                      </p>
                      <ul className="mt-2 space-y-1">
                        {day.slots.length ? (
                          day.slots.map((slot) => (
                            <li key={slot} className="rounded bg-white/70 px-1.5 py-1 text-[10px] text-ink-soft">
                              {slot}
                            </li>
                          ))
                        ) : (
                          <li className="text-[10px] text-faint">No slots</li>
                        )}
                      </ul>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Pricing" subtitle="Transparent hourly rate, no surge pricing" icon={BadgeCheck} />
              <CardBody>
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="font-display text-3xl font-extrabold text-ink">{formatCurrency(hourlyRate)}</p>
                    <p className="mt-1 text-sm text-muted">per hour · book by the hour, day or week</p>
                    <p className="mt-2 text-xs text-faint">
                      Platform charges {formatCurrency(49)} + 18% GST are added at checkout.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button to="/contact" variant="outline" icon={MessageSquare}>
                      Ask a question
                    </Button>
                    <Button onClick={handleBook} icon={PenLine}>
                      Book Caretaker
                    </Button>
                  </div>
                </div>
              </CardBody>
            </Card>
          </motion.div>

          {/* ---------------- right column ---------------- */}
          <Reveal as="aside" from="none" delay={0.12} className="space-y-4 lg:sticky lg:top-20">
            <Card>
              <CardHeader title="Booking summary" subtitle="Estimate for a single day shift" icon={Clock} />
              <CardBody className="space-y-4">
                <div className="grid grid-cols-2 gap-2.5">
                  {miniStats.map((stat) => (
                    <div key={stat.label} className="rounded-xl border border-line bg-canvas p-3">
                      <div className="flex items-center gap-1.5 text-faint">
                        <stat.icon className="h-3.5 w-3.5" />
                        <span className="text-[10px] font-bold uppercase tracking-wide">{stat.label}</span>
                      </div>
                      <p className="mt-1.5 font-display text-xl font-extrabold tabular-nums text-ink">
                        {stat.value}
                      </p>
                    </div>
                  ))}
                </div>

                <PriceBreakdown
                  items={[
                    {
                      label: `${formatCurrency(hourlyRate)} × ${durationBasis(ESTIMATED_HOURS)}`,
                      meta: 'Estimated day shift',
                      amount: subtotal,
                    },
                  ]}
                  subtotal={subtotal}
                  platformFee={platformFee}
                  tax={tax}
                  total={total}
                  currencyNote="Your card is held in escrow and released only after you mark the shift complete. Cancel free up to 6 hours before start time."
                />

                <Button onClick={handleBook} size="lg" className="w-full">
                  Book Caretaker
                </Button>

                <p className="flex items-start gap-2 text-xs leading-relaxed text-muted">
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary-600" />
                  Identity, registration and address documents verified by the CareMate operations team.
                </p>
              </CardBody>
            </Card>

            <div className="rounded-card border border-line bg-white p-4 shadow-card">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-50 font-display text-sm font-bold text-accent-600">
                  {initials(name)}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-ink">Prefer to discuss first?</p>
                  <p className="truncate text-xs text-muted">Message {name.split(' ')[0]} in-app — no numbers shared.</p>
                </div>
              </div>
              <Button to="/register/customer" variant="secondary" size="sm" className="mt-3 w-full">
                Create free account
              </Button>
            </div>
          </Reveal>
        </div>

        {/* ---------------- reviews ---------------- */}
        <motion.section {...reveal} className="mt-8 rounded-card border border-line bg-white shadow-card">
          <div className="flex flex-col gap-4 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="font-display text-3xl font-extrabold tabular-nums text-ink">
                  {profileRating.toFixed(1)}
                </p>
                <RatingStars value={profileRating} size={13} />
                <p className="mt-1 text-[11px] text-muted">{reviewCount} reviews</p>
              </div>
              <div className="hidden h-12 w-px bg-line sm:block" />
              <div>
                <h2 className="font-display text-lg font-bold text-ink">Ratings &amp; reviews</h2>
                <p className="text-sm text-muted">
                  {caregiverReviews.length
                    ? `${caregiverReviews.length} review${caregiverReviews.length === 1 ? '' : 's'} from verified CareMate bookings`
                    : 'Reviews appear after a completed CareMate booking'}
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" icon={PenLine} onClick={() => setReviewOpen(true)}>
              Write a review
            </Button>
          </div>

          {caregiverReviews.length === 0 ? (
            <EmptyState
              icon={Star}
              title="No reviews yet"
              description={`Be the first family to share an experience with ${name.split(' ')[0]} after a completed shift.`}
              action={
                <Button variant="outline" onClick={() => setReviewOpen(true)}>
                  Write a review
                </Button>
              }
            />
          ) : (
            <ul className="divide-y divide-line">
              {caregiverReviews.map((review) => (
                <li key={review.id} className="px-5 py-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <span className="grid h-9 w-9 place-items-center rounded-full bg-mint-100 font-display text-xs font-bold text-primary-800">
                        {initials(review.customerName)}
                      </span>
                      <div>
                        <p className="text-sm font-bold text-ink">{review.customerName}</p>
                        <p className="text-xs text-faint">
                          {formatDate(review.date)} · Booking {review.bookingId}
                        </p>
                      </div>
                    </div>
                    <RatingStars value={review.rating} size={13} showValue />
                  </div>

                  <p className="mt-3 text-sm leading-relaxed text-ink-soft">{review.comment}</p>

                  {review.reply ? (
                    <div className="mt-3 rounded-xl border border-line bg-canvas p-3.5">
                      <p className="flex items-center gap-1.5 text-xs font-bold text-primary-800">
                        <Quote className="h-3.5 w-3.5" />
                        {name} replied
                      </p>
                      <p className="mt-1.5 text-sm leading-relaxed text-muted">{review.reply}</p>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </motion.section>

        {/* ---------------- how verification works ---------------- */}
        <motion.section {...reveal} className="mt-6 grid gap-4 sm:grid-cols-3">
          {[
            {
              icon: Briefcase,
              title: `${completedJobs} shifts completed`,
              body: 'Logged with check-in and check-out times on the platform.',
            },
            {
              icon: Globe,
              title: `${joinYears(joinedOn)} on CareMate`,
              body: `Registered since ${formatDate(joinedOn, { long: true })} with a stable record.`,
            },
            {
              icon: Star,
              title: `${profileRating.toFixed(1)} average rating`,
              body: `Across ${reviewCount} verified bookings from families like yours.`,
            },
          ].map((item) => (
            <div key={item.title} className="rounded-card border border-line bg-white p-4 shadow-card">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-mint-100 text-primary-700">
                <item.icon className="h-4 w-4" />
              </span>
              <p className="mt-3 text-sm font-bold text-ink">{item.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted">{item.body}</p>
            </div>
          ))}
        </motion.section>
      </div>

      {/* ---------------- review modal ---------------- */}
      <Modal
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        title="Write a review"
        subtitle={`Share how ${name.split(' ')[0]} performed during your booking`}
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setReviewOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitReview} icon={PenLine}>
              Submit review
            </Button>
          </div>
        }
      >
        <FormField label="Your rating" htmlFor="review-rating" required>
          <div id="review-rating" className="flex items-center gap-1.5">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setRating(value)}
                aria-label={`Rate ${value} star${value > 1 ? 's' : ''}`}
                aria-pressed={rating === value}
                className={cn(
                  'grid h-10 w-10 place-items-center rounded-xl border transition',
                  value <= rating
                    ? 'border-warning-200 bg-warning-50 text-warning-500'
                    : 'border-line-strong bg-white text-slate-300 hover:border-warning-200',
                )}
              >
                <Star
                  className={cn('h-5 w-5', value <= rating && 'fill-warning-400 text-warning-400')}
                />
              </button>
            ))}
            <span className="ml-2 text-sm font-semibold text-ink">{rating}.0</span>
          </div>
        </FormField>

        <FormField
          label="Your review"
          htmlFor="review-comment"
          required
          className="mt-5"
          hint="Mention punctuality, handling of the patient and communication with the family."
        >
          <Textarea
            id="review-comment"
            rows={5}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Ananya arrived on time, kept a meticulous vitals chart and sent us an evening summary every day…"
          />
        </FormField>
      </Modal>

      {/* ---------------- report dialog ---------------- */}
      <ConfirmationDialog
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        onConfirm={() => {
          setReportOpen(false)
          toast.success('Report received. Our trust & safety team will review this profile within 24 hours.')
        }}
        title="Report this profile?"
        message={`Tell us offline what looked wrong with ${name}’s profile and our trust & safety team will investigate. Reporting does not affect your existing bookings.`}
        confirmLabel="Submit report"
        cancelLabel="Cancel"
        tone="danger"
      />
    </div>
  )
}

function joinYears(joinedOn) {
  const years = Math.max(1, new Date().getFullYear() - new Date(joinedOn).getFullYear())
  return `${years}+ year${years === 1 ? '' : 's'}`
}

export default CaregiverDetailsPage
