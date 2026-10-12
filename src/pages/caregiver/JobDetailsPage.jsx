import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  Clock,
  MapPin,
  PlayCircle,
  User,
  Wallet,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useData } from '@/context/DataContext'
import { useDocumentTitle } from '@/hooks/useUi'
import { PLATFORM_COMMISSION } from '@/utils/constants'
import { formatCurrency, formatDate } from '@/utils/format'
import { Button } from '@/components/common/Button'
import { Card, CardBody, CardHeader } from '@/components/common/Card'
import { StatusBadge } from '@/components/common/StatusBadge'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/States'
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog'
import { BookingTimeline } from '@/components/common/TimelinePrice'

export function JobDetailsPage() {
  const { id } = useParams()

  const { user } = useAuth()
  const { jobs, bookings, caregivers, acceptJob, rejectJob, advanceBooking } = useData()

  const myId = user?.caregiverId || 'cg-101'
  const caregiver = caregivers.find((c) => c.id === myId) || caregivers[0]

  const job = useMemo(() => jobs.find((j) => j.id === id || j.bookingId === id), [jobs, id])
  const booking = useMemo(() => bookings.find((b) => b.id === id), [bookings, id])

  useDocumentTitle(job ? `Job ${job.id}` : booking ? `Booking ${booking.id}` : 'Job details')

  const [dialog, setDialog] = useState(null)

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

  const handleConfirm = () => {
    if (!dialog || !job) return
    if (dialog === 'accept') {
      acceptJob(job.id, caregiver)
      toast.success('Job accepted — added to your schedule')
    } else {
      rejectJob(job.id)
      toast.info('Job declined')
    }
    setDialog(null)
  }

  const handleCheckIn = () => {
    advanceBooking(booking.id, 'start')
    toast.success('Checked in — the service is now in progress')
  }

  const handleComplete = () => {
    advanceBooking(booking.id, 'complete')
    toast.success('Shift marked complete — payment releases after customer confirmation')
  }

  if (job) {
    const net = job.payment - Math.round(job.payment * PLATFORM_COMMISSION)

    return (
      <div className="space-y-6">
        <PageHeader
          title={`Job ${job.id}`}
          subtitle={job.service}
          meta={
            <>
              <StatusBadge status={job.urgency} />
              <StatusBadge status={job.status} />
              <span className="text-sm text-muted">Posted {formatDate(job.postedAt)} · for {job.customerName}</span>
            </>
          }
          action={
            <Button variant="ghost" to="/caregiver/jobs" icon={ArrowLeft}>
              Back to jobs
            </Button>
          }
        />

        {job.status === 'Accepted' ? (
          <div className="flex flex-col gap-3 rounded-card border border-success-500/30 bg-success-50 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-success-100 text-success-700">
                <CheckCircle2 className="h-5 w-5" />
              </span>
              <div>
                <p className="font-display text-sm font-bold text-success-700">You accepted this job</p>
                <p className="mt-0.5 text-sm text-success-700/80">
                  The shift is on your schedule. Check in from the bookings page when you arrive.
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
            <p className="mt-1 text-sm text-muted">The shift has been released to other verified caregivers.</p>
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
              <div className="rounded-xl border border-line bg-slate-50/70 p-4">
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
              <Row icon={Briefcase} label="Duration" value={`${job.hours} hours`} />
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
              <span className="font-semibold text-ink">{formatCurrency(job.payment)}</span> for {job.hours} hrs ·{' '}
              {formatDate(job.date)} · {job.shift}
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="outline" onClick={() => setDialog('reject')}>
                Decline job
              </Button>
              <Button variant="primary" icon={CheckCircle2} onClick={() => setDialog('accept')}>
                Accept job
              </Button>
            </div>
          </div>
        ) : null}

        <ConfirmationDialog
          open={Boolean(dialog)}
          onClose={() => setDialog(null)}
          onConfirm={handleConfirm}
          tone={dialog === 'accept' ? 'success' : 'danger'}
          title={dialog === 'accept' ? 'Accept this job?' : 'Decline this job?'}
          message={
            dialog === 'accept'
              ? `${job.service} on ${formatDate(job.date, { long: true })} at ${job.shift}. The shift is added to your schedule immediately.`
              : 'This shift will be released to other verified caregivers. This cannot be undone.'
          }
          confirmLabel={dialog === 'accept' ? 'Accept job' : 'Decline job'}
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
            <StatusBadge status={booking.status} />
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
        <div className="flex flex-col gap-3 rounded-card border border-primary-200 bg-mint-50 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-mint-100 text-primary-700">
              <CheckCircle2 className="h-5 w-5" />
            </span>
            <div>
              <p className="font-display text-sm font-bold text-primary-900">This shift is on your schedule</p>
              <p className="mt-0.5 text-sm text-primary-800/80">
                Check in when you arrive at {booking.address.split(',')[0]} to start the service clock.
              </p>
            </div>
          </div>
          <Button variant="primary" size="sm" icon={PlayCircle} onClick={handleCheckIn}>
            Service check-in
          </Button>
        </div>
      ) : null}

      {booking.status === 'In Progress' ? (
        <div className="flex flex-col gap-3 rounded-card border border-accent-200 bg-accent-50 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-100 text-accent-600">
              <PlayCircle className="h-5 w-5" />
            </span>
            <div>
              <p className="font-display text-sm font-bold text-accent-600">Service in progress</p>
              <p className="mt-0.5 text-sm text-accent-600/90">Mark the shift complete once the handover is done.</p>
            </div>
          </div>
          <Button variant="primary" size="sm" icon={CheckCircle2} onClick={handleComplete}>
            Mark complete
          </Button>
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
              <div className="rounded-xl border border-line bg-slate-50/70 p-4">
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
            <Row icon={Clock} label="Shift" value={`${booking.startTime} · ${booking.hours} hrs`} />
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
