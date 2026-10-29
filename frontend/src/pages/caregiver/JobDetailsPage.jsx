import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  Clock,
  LogIn,
  LogOut,
  MapPin,
  PlayCircle,
  Star,
  User,
  Wallet,
  Zap,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useData } from '@/context/DataContext'
import { useDocumentTitle } from '@/hooks/useUi'
import { PLATFORM_COMMISSION } from '@/utils/constants'
import { formatCurrency, formatDate, formatDateTime } from '@/utils/format'
import { formatDuration } from '@/utils/duration'
import { cn } from '@/utils/cn'
import { Button } from '@/components/common/Button'
import { Card, CardBody, CardHeader } from '@/components/common/Card'
import { StatusBadge } from '@/components/common/StatusBadge'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState, ErrorState } from '@/components/common/States'
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog'
import { BookingTimeline } from '@/components/common/TimelinePrice'
import { CheckInOutModal } from '@/components/booking/CheckInOutModal'
import { RatingModal, CUSTOMER_CRITERIA } from '@/components/booking/RatingModal'
import { bookingService, reviewService, adaptBookingToJob, isMongoObjectId } from '@/services'

export function JobDetailsPage() {
  const { id } = useParams()

  const { user } = useAuth()
  const { jobs, bookings, caregivers, acceptJob, rejectJob, advanceBooking, updateBooking } = useData()

  const myId = user?.caregiverId || 'cg-101'
  const caregiver = caregivers?.find((c) => c.id === myId) || caregivers?.[0]

  const [realBooking, setRealBooking] = useState(null)
  const [loading, setLoading] = useState(Boolean(id && isMongoObjectId(id)))
  const [error, setError] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)

  const fetchRealBooking = useCallback(async () => {
    if (!id || !isMongoObjectId(id)) return
    setLoading(true)
    setError(null)
    try {
      const data = await bookingService.getBookingById(id)
      setRealBooking(data)
    } catch (err) {
      setError(err.message || 'Unable to load shift details')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchRealBooking()
  }, [fetchRealBooking])

  const myUserId = String(user?._id || user?.id || '')

  const job = useMemo(() => {
    if (realBooking) return adaptBookingToJob(realBooking, myUserId)
    return jobs?.find((j) => j.id === id || j.bookingId === id)
  }, [realBooking, jobs, id, myUserId])

  const booking = useMemo(() => {
    if (realBooking) return realBooking
    return bookings?.find((b) => b.id === id)
  }, [realBooking, bookings, id])

  useDocumentTitle(job ? `Job ${job.displayId || job.id}` : booking ? `Booking ${booking.ref || booking.id}` : 'Job details')

  const [dialog, setDialog] = useState(null)
  const [checkFlow, setCheckFlow] = useState(null)
  const [rateOpen, setRateOpen] = useState(false)

  if (loading && !job && !booking) {
    return (
      <div className="space-y-6">
        <PageHeader title="Job details" subtitle="Loading shift information from server…" />
        <div className="grid gap-6 lg:grid-cols-2">
          {[1, 2, 3, 4].map((n) => (
            <Card key={n} className="animate-pulse">
              <CardBody className="space-y-4">
                <div className="h-6 w-1/3 rounded bg-slate-200" />
                <div className="h-4 w-2/3 rounded bg-slate-100" />
                <div className="h-4 w-1/2 rounded bg-slate-100" />
              </CardBody>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (error && !job && !booking) {
    return (
      <div className="space-y-6">
        <PageHeader title="Job details" subtitle="Unable to load the requested shift." />
        <Card>
          <ErrorState
            title="Failed to load shift"
            description={error}
            onRetry={fetchRealBooking}
          />
        </Card>
      </div>
    )
  }

  if (!job && !booking) {
    return (
      <div className="space-y-6">
        <PageHeader title="Job details" subtitle="The requested shift could not be found." />
        <Card>
          <EmptyState
            icon={Briefcase}
            title="Job not found"
            description="This job may have been filled, declined or removed. Browse open requests to find a new shift."
            action={
              <Button variant="primary" to="/caregiver/jobs">
                Browse jobs
              </Button>
            }
          />
        </Card>
      </div>
    )
  }

  const handleConfirm = async () => {
    if (!dialog || !job) return
    setActionLoading(true)
    try {
      if (dialog === 'accept') {
        let updated = null
        if (isMongoObjectId(job.id)) {
          updated = await bookingService.acceptBooking(job.id)
          setRealBooking(updated)
        }
        if (acceptJob) acceptJob(job.id, caregiver?.id)
        const isBroadcast = !job.caregiverId && !job.rawBooking?.caregiver
        if (isBroadcast) {
          toast.success('Offer submitted to customer!', {
            description: `Your offer for ${job.service} has been sent. The customer will review interested caretakers and select their caregiver.`,
          })
        } else {
          toast.success('Job accepted — added to your schedule', {
            description: `${job.service} on ${formatDate(job.date, { long: true })} is confirmed.`,
          })
        }
      } else {
        if (isMongoObjectId(job.id)) {
          const updated = await bookingService.rejectBooking(job.id, 'Declined by caretaker')
          setRealBooking(updated)
        }
        if (rejectJob) rejectJob(job.id)
        toast.info('Job declined', {
          description: `${job.service} has been declined.`,
        })
      }
    } catch (err) {
      toast.error(dialog === 'accept' ? 'Failed to accept job' : 'Failed to decline job', {
        description: err.message || 'Server rejected the request.',
      })
    } finally {
      setActionLoading(false)
      setDialog(null)
    }
  }

  const handleCheckConfirm = (payload) => {
    if (!checkFlow) return
    const { mode } = checkFlow
    advanceBooking(booking.id, mode === 'checkin' ? 'start' : 'complete', payload)
    toast.success(
      mode === 'checkin'
        ? 'Checked in — the service is now in progress'
        : 'Shift marked complete — payment releases after customer confirmation',
      { description: `QR ${payload.qrCode} verified at ${formatDateTime(payload.capturedAt)}.` },
    )
    setCheckFlow(null)
  }

  const handleRateCustomer = async ({ criteria, average, comment }) => {
    const targetBookingId = booking?.id || booking?._id || id
    if (isMongoObjectId(targetBookingId)) {
      try {
        await reviewService.submitReview({
          bookingId: targetBookingId,
          rating: average,
          criteria,
          comment,
        })
      } catch (err) {
        toast.error('Unable to submit review', {
          description: err.message || 'Please verify the booking status and try again.',
        })
        return
      }
    }

    const ratingData = { ...criteria, average, at: new Date().toISOString(), comment }
    if (updateBooking && booking?.id) {
      updateBooking(booking.id, { caregiverRating: ratingData })
    }
    if (realBooking) {
      setRealBooking((prev) => (prev ? { ...prev, caregiverRating: ratingData } : prev))
    }
    toast.success('Thanks for rating this customer', {
      description: `${booking?.patient?.name || 'The patient'}'s family received ${average} stars.`,
    })
  }

  if (job) {
    const net = job.payment - Math.round(job.payment * PLATFORM_COMMISSION)
    const myCaregiverId = String(user?.caregiverId || caregiver?._id || caregiver?.id || '')
    const myUserId = String(user?._id || user?.id || '')
    const hasApplied = Boolean(
      job.applicants?.some((a) => {
        const cgId = String(
          a.caregiverId ||
          a.caregiver?._id ||
          a.caregiver?.id ||
          (typeof a.caregiver === 'string' ? a.caregiver : '') ||
          a.id ||
          ''
        )
        const uId = String(
          a.caregiverUserId ||
          a.caregiverUser?._id ||
          a.caregiverUser?.id ||
          (typeof a.caregiverUser === 'string' ? a.caregiverUser : '') ||
          ''
        )
        return (myCaregiverId && cgId === myCaregiverId) || (myUserId && uId === myUserId)
      })
    )
    const preferredGender = job.preferredGender || 'Any'
    const caregiverGender = caregiver?.gender || user?.gender || 'Female'
    const isGenderMismatch =
      preferredGender !== 'Any' &&
      caregiverGender &&
      caregiverGender.toLowerCase() !== preferredGender.toLowerCase()

    return (
      <div className="space-y-6">
        <PageHeader
          title={`Job ${job.id}`}
          subtitle={job.service}
          meta={
            <>
              {job.isUrgent ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-red-600 via-orange-500 to-amber-500 px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-white shadow-xs ring-1 ring-orange-300">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-80" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                  </span>
                  <Zap className="h-3 w-3 fill-current" />
                  Urgent Dispatch
                </span>
              ) : null}
              <StatusBadge status={job.status} />
              {preferredGender && preferredGender !== 'Any' && (
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold border',
                    preferredGender === 'Male'
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : 'bg-pink-50 text-pink-700 border-pink-200'
                  )}
                >
                  {preferredGender === 'Female' ? 'Female Preferred' : 'Male Preferred'}
                </span>
              )}
              {hasApplied && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">
                  ⏳ Offer Sent
                </span>
              )}
              <span className="text-sm text-muted">Posted {formatDate(job.postedAt)} · for {job.customerName}</span>
            </>
          }
          action={
            <Button variant="ghost" to="/caregiver/jobs" icon={ArrowLeft}>
              Back to jobs
            </Button>
          }
        />

        {job.isUrgent ? (
          <div className="flex items-start gap-3 rounded-card border border-orange-300 bg-gradient-to-br from-orange-50 via-amber-50/40 to-white p-5 shadow-sm">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-red-500 to-orange-500 text-white shadow-xs">
              <Zap className="h-5 w-5 fill-current" />
            </span>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-display text-sm font-bold text-orange-950 uppercase tracking-wide">Urgent Dispatch Request</p>
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700">Immediate Need</span>
              </div>
              <p className="mt-1 text-xs text-orange-900/90 leading-relaxed font-medium">
                Customer requested urgent on-demand care. Caretakers responding quickly have the highest priority for confirmation.
              </p>
            </div>
          </div>
        ) : null}

        {hasApplied && job.status === 'Open' ? (
          <div className="flex flex-col gap-3 rounded-card border border-amber-300 bg-gradient-to-br from-amber-50 to-white p-5 sm:flex-row sm:items-center sm:justify-between shadow-sm">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-800">
                <Clock className="h-5 w-5" />
              </span>
              <div>
                <p className="font-display text-sm font-bold text-amber-900">Offer Submitted to Customer</p>
                <p className="mt-0.5 text-xs text-amber-800/90">
                  You accepted this broadcast request. The customer is reviewing interested caretakers and their individual rates. You will be notified as soon as they select you.
                </p>
              </div>
            </div>
            <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">
              Awaiting Customer Choice
            </span>
          </div>
        ) : null}

        {job.status === 'Accepted' ? (
          <div className="flex flex-col gap-3 rounded-card border border-success-500/30 bg-gradient-to-br from-success-50 to-white p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-success-50 to-success-100 text-success-700">
                <CheckCircle2 className="h-5 w-5" />
              </span>
              <div>
                <p className="font-display text-sm font-bold text-success-700">You are the confirmed caretaker for this shift</p>
                <p className="mt-0.5 text-sm text-success-700/80">
                  The shift is confirmed on your schedule. Check in from the bookings page when you arrive.
                </p>
              </div>
            </div>
            <Button variant="primary" size="sm" to="/caregiver/bookings">
              Go to bookings
            </Button>
          </div>
        ) : null}

        {job.status === 'Declined' ? (
          <div className="rounded-card border border-line bg-slate-50 p-5">
            <p className="font-display text-sm font-bold text-ink">You declined this job</p>
            <p className="mt-1 text-sm text-muted">The shift has been released to other verified caretakers.</p>
          </div>
        ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="Patient information" subtitle="Who you will be caring for" icon={User} />
            <CardBody className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-mint-100 font-display font-bold text-primary-800">
                  {(job.patient?.name || 'P').split(' ').map((p) => p[0]).slice(0, 2).join('')}
                </span>
                <div>
                  <p className="font-display text-base font-bold text-ink">{job.patient?.name}</p>
                  <p className="text-sm text-muted">
                    {job.patient?.age} years · {job.patient?.relation} of {job.customerName}
                  </p>
                </div>
              </div>
              <div className="rounded-xl border border-line bg-gradient-to-br from-slate-50 to-white p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-faint">Care requirements</p>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{job.requirements}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-mint-100 px-3 py-1 text-xs font-semibold text-primary-800">{job.careType}</span>
                <span className="rounded-full bg-accent-100 px-3 py-1 text-xs font-semibold text-accent-600">{job.service}</span>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Schedule" subtitle="Shift timing and duration" icon={CalendarDays} />
            <CardBody className="space-y-3">
              <Row icon={CalendarDays} label="Date" value={formatDate(job.date, { long: true })} />
              <Row icon={Clock} label="Shift" value={job.shift} />
              <Row icon={Briefcase} label="Duration" value={formatDuration(job.hours)} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Location" subtitle="Where the shift takes place" icon={MapPin} />
            <CardBody className="space-y-3">
              <Row icon={MapPin} label="Area" value={job.area} />
              <Row icon={MapPin} label="City" value={job.city} />
              <Row icon={MapPin} label="Distance from you" value={`${job.distanceKm} km`} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Payment" subtitle="What you earn for this shift" icon={Wallet} />
            <CardBody className="space-y-3">
              <Row icon={Wallet} label="Offered payment" value={formatCurrency(job.payment)} />
              <div className="flex items-center justify-between gap-4 rounded-xl border border-dashed border-line px-4 py-3 text-sm">
                <span className="text-muted">Platform commission ({Math.round(PLATFORM_COMMISSION * 100)}%)</span>
                <span className="font-semibold tabular-nums text-muted">− {formatCurrency(job.payment - net)}</span>
              </div>
              <div className="flex items-center justify-between gap-4 rounded-xl bg-mint-100 px-4 py-3">
                <span className="text-sm font-bold text-primary-900">Estimated net earning</span>
                <span className="font-display text-lg font-extrabold tabular-nums text-primary-800">{formatCurrency(net)}</span>
              </div>
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardHeader title="Customer's special instructions" subtitle="Please read before accepting" icon={Briefcase} />
          <CardBody>
            <p className="rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-ink-soft">{job.requirements}</p>
          </CardBody>
        </Card>

        {job.status === 'Open' ? (
          <div className="sticky bottom-4 z-10 flex flex-col gap-3 rounded-card border border-line bg-white/95 p-4 shadow-raised backdrop-blur sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted">
              <span className="font-semibold text-ink">{formatCurrency(job.payment)}</span> for {formatDuration(job.hours, { short: true })} ·{' '}
              {formatDate(job.date)} · {job.shift}
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              {hasApplied ? (
                <Button variant="outline" disabled className="border-amber-300 bg-amber-50 text-amber-800">
                  Offer Sent · Waiting for Customer Selection
                </Button>
              ) : isGenderMismatch ? (
                <Button variant="outline" disabled className="text-muted">
                  Requires {preferredGender} Caretaker
                </Button>
              ) : (
                <>
                  <Button variant="outline" onClick={() => setDialog('reject')}>
                    Decline job
                  </Button>
                  <Button variant="primary" icon={CheckCircle2} onClick={() => setDialog('accept')}>
                    Accept & Send Offer
                  </Button>
                </>
              )}
            </div>
          </div>
        ) : null}

        <ConfirmationDialog
          open={Boolean(dialog)}
          onClose={() => setDialog(null)}
          onConfirm={handleConfirm}
          tone={dialog === 'accept' ? 'success' : 'danger'}
          title={dialog === 'accept' ? 'Accept job & submit offer?' : 'Decline this job?'}
          message={
            dialog === 'accept'
              ? `${job.service} on ${formatDate(job.date, { long: true })} at ${job.shift}. Your profile and hourly rate will be presented to ${job.customerName}. When selected, the booking confirms immediately.`
              : 'This shift will be released to other verified caretakers. This cannot be undone.'
          }
          confirmLabel={dialog === 'accept' ? (actionLoading ? 'Submitting…' : 'Submit offer') : (actionLoading ? 'Declining…' : 'Decline job')}
        />
      </div>
    )
  }


  const netEarning = booking.subtotal - booking.commission

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Booking ${booking.id}`}
        subtitle={booking.service}
        meta={
          <>
            {(booking.isUrgent || String(booking.specialInstructions || '').includes('URGENT DISPATCH')) && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-red-600 via-orange-500 to-amber-500 px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-white shadow-xs">
                <Zap className="h-3 w-3 fill-current" />
                Urgent Dispatch
              </span>
            )}
            <StatusBadge
              status={
                (booking.status === 'Completed' || booking.status === 'completed') &&
                !['paid', 'released', 'settled'].includes(String(booking.paymentStatus || '').toLowerCase())
                  ? 'Payment Pending'
                  : booking.status
              }
            />
            <StatusBadge status={booking.paymentStatus} />
            <span className="text-sm text-muted">Ref {booking.ref}</span>
          </>
        }
        action={
          <Button variant="ghost" to="/caregiver/bookings" icon={ArrowLeft}>
            Back to bookings
          </Button>
        }
      />

      {booking.status === 'Confirmed' ? (
        <div className="flex flex-col gap-3 rounded-card border border-primary-200 bg-gradient-to-br from-mint-50 to-white p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-mint-100 text-primary-700">
              <CheckCircle2 className="h-5 w-5" />
            </span>
            <div>
              <p className="font-display text-sm font-bold text-primary-900">This shift is on your schedule</p>
              <p className="mt-0.5 text-sm text-primary-800/80">
                Check in when you arrive at {typeof booking.address === 'string' ? booking.address.split(',')[0] : (booking.address?.street || booking.location?.addressLine || 'the patient location')} to start the service clock.
              </p>
            </div>
          </div>
          <Button variant="primary" size="sm" icon={LogIn} onClick={() => setCheckFlow({ mode: 'checkin', booking })}>
            Service check-in
          </Button>
        </div>
      ) : null}

      {booking.status === 'In Progress' ? (
        <div className="flex flex-col gap-3 rounded-card border border-accent-200 bg-gradient-to-br from-accent-50 to-white p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-100 text-accent-600">
              <PlayCircle className="h-5 w-5" />
            </span>
            <div>
              <p className="font-display text-sm font-bold text-accent-600">Service in progress</p>
              <p className="mt-0.5 text-sm text-accent-600/90">Mark the shift complete once the handover is done.</p>
            </div>
          </div>
          <Button variant="primary" size="sm" icon={LogOut} onClick={() => setCheckFlow({ mode: 'checkout', booking })}>
            Check out & complete
          </Button>
        </div>
      ) : null}

      {booking.status === 'Completed' && !booking.caregiverRating ? (
        <div className="flex flex-col gap-3 rounded-card border border-success-500/30 bg-success-50 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-success-100 text-success-700">
              <Star className="h-5 w-5" />
            </span>
            <div>
              <p className="font-display text-sm font-bold text-success-700">Shift completed</p>
              <p className="mt-0.5 text-sm text-success-700/80">
                Rate {booking.patient?.name || 'the customer'} so we can keep the community trustworthy.
              </p>
            </div>
          </div>
          <Button variant="primary" size="sm" icon={Star} onClick={() => setRateOpen(true)}>
            Rate customer
          </Button>
        </div>
      ) : null}

      {booking.checkIn || booking.checkOut ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {booking.checkIn ? (
            <div className="rounded-xl border border-line bg-slate-50 px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-faint">Check-in record</span>
                <StatusBadge status="Verified" size="sm" />
              </div>
              <p className="mt-1.5 text-sm font-semibold text-ink">{formatDateTime(booking.checkIn.at)}</p>
              <p className="mt-1 text-xs text-muted">QR {booking.checkIn.qrCode}</p>
            </div>
          ) : null}
          {booking.checkOut ? (
            <div className="rounded-xl border border-line bg-slate-50 px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-faint">Check-out record</span>
                <StatusBadge status="Verified" size="sm" />
              </div>
              <p className="mt-1.5 text-sm font-semibold text-ink">{formatDateTime(booking.checkOut.at)}</p>
              <p className="mt-1 text-xs text-muted">QR {booking.checkOut.qrCode}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Patient information" subtitle="Who you are caring for" icon={User} />
          <CardBody className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-mint-100 font-display font-bold text-primary-800">
                {(booking.patient?.name || 'P').split(' ').map((p) => p[0]).slice(0, 2).join('')}
              </span>
              <div>
                <p className="font-display text-base font-bold text-ink">{booking.patient?.name}</p>
                <p className="text-sm text-muted">
                  {booking.patient?.age} years · {booking.patient?.relation}
                </p>
              </div>
            </div>
            {booking.notes ? (
              <div className="rounded-xl border border-line bg-gradient-to-br from-slate-50 to-white p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-faint">Care notes</p>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{booking.notes}</p>
              </div>
            ) : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Schedule & location" subtitle="Shift timing and address" icon={CalendarDays} />
          <CardBody className="space-y-3">
            <Row icon={CalendarDays} label="Date" value={formatDate(booking.date, { long: true })} />
            <Row icon={Clock} label="Shift" value={`${booking.startTime} · ${formatDuration(booking.hours, { short: true })}`} />
            <Row icon={MapPin} label="Address" value={booking.address} />
            <Row icon={Briefcase} label="Care type" value={booking.careType} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Payment" subtitle="Net earning after commission" icon={Wallet} />
          <CardBody className="space-y-3">
            <Row icon={Wallet} label="Gross service value" value={formatCurrency(booking.subtotal)} />
            <div className="flex items-center justify-between gap-4 rounded-xl border border-dashed border-line px-4 py-3 text-sm">
              <span className="text-muted">Platform commission ({Math.round(PLATFORM_COMMISSION * 100)}%)</span>
              <span className="font-semibold tabular-nums text-muted">− {formatCurrency(booking.commission)}</span>
            </div>
            <div className="flex items-center justify-between gap-4 rounded-xl bg-mint-100 px-4 py-3">
              <span className="text-sm font-bold text-primary-900">Your earning</span>
              <span className="font-display text-lg font-extrabold tabular-nums text-primary-800">{formatCurrency(netEarning)}</span>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Special instructions" subtitle="From the customer" icon={Briefcase} />
          <CardBody>
            <p className="rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-ink-soft">
              {booking.specialInstructions || booking.notes || 'No special instructions were provided for this shift.'}
            </p>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Booking timeline" subtitle="Progress of this shift" icon={Clock} />
        <CardBody>
          <BookingTimeline steps={booking.timeline} />
        </CardBody>
      </Card>

      <CheckInOutModal
        open={Boolean(checkFlow)}
        onClose={() => setCheckFlow(null)}
        mode={checkFlow?.mode || 'checkin'}
        booking={booking}
        onConfirm={handleCheckConfirm}
      />

      <RatingModal
        open={rateOpen}
        onClose={() => setRateOpen(false)}
        title="Rate this customer"
        subjectName={booking.patient?.name || 'the customer'}
        criteria={CUSTOMER_CRITERIA}
        onSubmit={handleRateCustomer}
      />
    </div>
  )
}

function Row({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-line px-4 py-3">
      <span className="inline-flex items-center gap-2 text-sm text-muted">
        <Icon className="h-4 w-4 shrink-0 text-faint" />
        {label}
      </span>
      <span className="text-right text-sm font-semibold text-ink">{value}</span>
    </div>
  )
}

export default JobDetailsPage
