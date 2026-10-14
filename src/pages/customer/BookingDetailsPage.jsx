import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  Home,
  MapPin,
  MessageSquare,
  QrCode,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Star,
  UserRound,
  Wallet,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/context/AuthContext'
import { useData } from '@/context/DataContext'
import { useDocumentTitle } from '@/hooks/useUi'
import { getBookingById, CUSTOMERS } from '@/data/bookings'
import { downloadText, formatCurrency, formatDate, formatDateTime, toCSV } from '@/utils/format'
import { GST_RATE, PLATFORM_COMMISSION, PLATFORM_FEE } from '@/utils/constants'
import { durationBasis, DURATION_GROUPS, formatDuration } from '@/utils/duration'
import { cn } from '@/utils/cn'
import { Breadcrumbs } from '@/components/common/Breadcrumbs'
import { PageHeader } from '@/components/common/PageHeader'
import { Card, CardBody, CardHeader } from '@/components/common/Card'
import { Button } from '@/components/common/Button'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Avatar } from '@/components/common/Avatar'
import { RatingStars } from '@/components/common/RatingStars'
import { EmptyState } from '@/components/common/States'
import { BookingTimeline, PriceBreakdown } from '@/components/common/TimelinePrice'
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog'
import { Modal } from '@/components/common/Modal'
import { FormField, Input, Select, Textarea } from '@/components/forms/FormField'

const COMPLAINT_CATEGORIES = ['Misbehavior', 'Theft', 'Abuse', 'Harassment', 'Medical negligence', 'Other']

const PAYMENT_METHODS = [
  { id: 'upi', label: 'UPI', icon: Smartphone, hint: 'GPay, PhonePe, Paytm' },
  { id: 'card', label: 'Card', icon: CreditCard, hint: 'Visa, Mastercard, RuPay' },
  { id: 'netbanking', label: 'Net banking', icon: Wallet, hint: 'All major banks' },
]

const RATING_CRITERIA = [
  { key: 'serviceQuality', label: 'Service quality' },
  { key: 'behaviour', label: 'Behaviour' },
  { key: 'punctuality', label: 'Punctuality' },
  { key: 'overall', label: 'Overall experience' },
]

export function BookingDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const {
    bookings,
    caregivers,
    updateBooking,
    cancelBooking,
    createComplaint,
    advanceBooking,
    addReview,
    addTransaction,
    addEarning,
    ensureConversation,
  } = useData()

  useDocumentTitle(`Booking ${id || ''}`)

  const booking = useMemo(() => {
    const listHit = bookings.find((b) => b.id === id)
    return listHit || getBookingById(id) || null
  }, [bookings, id])

  const caregiver = caregivers.find((c) => c.id === booking?.caregiverId) || null

  const [cancelOpen, setCancelOpen] = useState(false)
  const [complaintOpen, setComplaintOpen] = useState(false)
  const [complaint, setComplaint] = useState({ category: 'Misbehavior', subject: '', description: '' })
  const [payOpen, setPayOpen] = useState(false)
  const [payMethod, setPayMethod] = useState('upi')
  const [paying, setPaying] = useState(false)
  const [rateOpen, setRateOpen] = useState(false)
  const [rateForm, setRateForm] = useState({ serviceQuality: 5, behaviour: 5, punctuality: 5, overall: 5, comment: '' })
  const [settleOpen, setSettleOpen] = useState(false)
  const [rescheduleOpen, setRescheduleOpen] = useState(false)
  const [reschedule, setReschedule] = useState(() => ({ date: '', startTime: '', hours: 0 }))

  if (!booking) {
    return (
      <div className="space-y-6">
        <PageHeader title="Booking not found" subtitle={`We couldn't find a booking with ID ${id}.`} />
        <div className="rounded-card border border-line bg-white shadow-card">
          <EmptyState
            icon={XCircle}
            title="Booking unavailable"
            description="This booking may have been removed, or the link is incorrect."
            action={
              <Button to="/customer/bookings" icon={ArrowLeft}>
                Back to my bookings
              </Button>
            }
          />
        </div>
      </div>
    )
  }

  const customer =
    CUSTOMERS.find((c) => c.id === booking.customerId) ||
    (user?.id === booking.customerId
      ? { name: user.name, email: user.email, phone: user.phone, address: user.address, city: user.city }
      : null)

  const canCancel = booking.status === 'Pending' || booking.status === 'Confirmed'
  const canPay = booking.paymentStatus === 'Pending'
  const canSettle = booking.status === 'Completed' && booking.paymentStatus === 'Escrow Held'
  const canRate = booking.status === 'Completed' && !booking.customerRating
  const hasCheckedIn = Boolean(booking.checkIn)
  const hasCheckedOut = Boolean(booking.checkOut)
  const canReschedule = canCancel && !hasCheckedIn

  const handleDownloadInvoice = () => {
    const rows = [
      {
        'Invoice No': booking.invoiceNo,
        'Booking ID': booking.id,
        Reference: booking.ref,
        Service: booking.service,
        Patient: booking.patient?.name,
        Date: booking.date,
        Duration: formatDuration(booking.hours),
        'Hourly Rate': booking.hourlyRate,
        Subtotal: booking.subtotal,
        'Platform Fee': booking.platformFee,
        GST: booking.tax,
        Total: booking.total,
        'Payment Status': booking.paymentStatus,
      },
    ]
    downloadText(`${booking.invoiceNo || booking.id}.csv`, toCSV(rows))
    toast.success('Invoice downloaded', { description: `${booking.invoiceNo} saved as a demo CSV file.` })
  }

  const handleRaiseComplaint = () => {
    if (!complaint.subject.trim() || !complaint.description.trim()) {
      toast.error('Please add a subject and description')
      return
    }
    createComplaint({
      bookingId: booking.id,
      complainant: customer?.name || user?.name || 'Priya Sharma',
      complainantType: 'Customer',
      against: caregiver?.name || 'CareMate Platform',
      againstType: caregiver ? 'Caretaker' : 'Platform',
      category: complaint.category,
      priority: 'Medium',
      subject: complaint.subject.trim(),
      description: complaint.description.trim(),
      evidence: [],
    })
    toast.success('Complaint submitted', {
      description: 'Our support desk will review it within 24 hours.',
    })
    setComplaint({ category: 'Misbehavior', subject: '', description: '' })
    setComplaintOpen(false)
  }

  const handlePayNow = () => {
    setPaying(true)
    setTimeout(() => {
      const methodLabel = PAYMENT_METHODS.find((m) => m.id === payMethod)?.label || 'UPI'
      updateBooking(booking.id, { paymentStatus: 'Escrow Held' })
      addTransaction({
        bookingId: booking.id,
        customerId: booking.customerId,
        caregiverId: booking.caregiverId,
        names: `${customer?.name || 'Customer'} → ${caregiver?.name || 'Caretaker'}`,
        service: booking.service,
        amount: booking.total,
        commission: booking.commission || Math.round(booking.subtotal * 0.12),
        payout: booking.subtotal,
        method: methodLabel,
        status: 'Escrow Held',
        type: 'Booking payment',
      })
      setPaying(false)
      setPayOpen(false)
      toast.success('Payment secured in escrow', {
        description: `Paid via ${methodLabel}. Funds release after the service completes.`,
      })
    }, 900)
  }

  const handleSettle = () => {
    advanceBooking(booking.id, 'settle')
    const tx = addTransaction({
      bookingId: booking.id,
      customerId: booking.customerId,
      caregiverId: booking.caregiverId,
      names: `${customer?.name || 'Customer'} → ${caregiver?.name || 'Caretaker'}`,
      service: booking.service,
      amount: booking.total,
      commission: booking.commission || Math.round(booking.subtotal * 0.12),
      payout: booking.subtotal,
      method: 'Escrow',
      status: 'Released',
      type: 'Booking payment',
    })
    if (booking.caregiverId) {
      addEarning({
        bookingId: booking.id,
        caregiverId: booking.caregiverId,
        service: booking.service,
        gross: booking.subtotal,
        commission: booking.commission || Math.round(booking.subtotal * 0.12),
        net: booking.subtotal - (booking.commission || Math.round(booking.subtotal * 0.12)),
        status: 'Pending',
      })
    }
    setSettleOpen(false)
    toast.success('Service confirmed & payment released', {
      description: `Payout of ${formatCurrency(booking.subtotal)} is on its way to ${caregiver?.name || 'your caretaker'}. Tx ${tx.id}.`,
    })
  }

  const handleRate = () => {
    const avg = (
      (rateForm.serviceQuality + rateForm.behaviour + rateForm.punctuality + rateForm.overall) / 4
    ).toFixed(1)
    addReview({
      bookingId: booking.id,
      caregiverId: booking.caregiverId,
      customerId: booking.customerId,
      customerName: customer?.name || user?.name || 'Customer',
      rating: Number(avg),
      criteria: { ...rateForm, comment: undefined },
      comment: rateForm.comment.trim() || 'Great service, thank you!',
    })
    updateBooking(booking.id, {
      customerRating: { ...rateForm, average: Number(avg), at: new Date().toISOString() },
    })
    setRateOpen(false)
    toast.success('Thank you for your review!', {
      description: `${caregiver?.name || 'Your caretaker'} received your ${avg}-star rating.`,
    })
  }

  const handleSendMessage = () => {
    const threadId = ensureConversation({
      bookingRef: booking.ref,
      audienceRole: 'customer',
      name: caregiver?.name || 'Care Coordinator',
      roleLabel: caregiver?.qualification || 'CareMate support',
      avatar: caregiver?.photo || '',
      firstMessage: `Hi, I'm reaching out regarding booking ${booking.id} (${booking.service} on ${formatDate(booking.date)}).`,
    })
    navigate(`/customer/messages?thread=${threadId}`)
  }

  const openReschedule = () => {
    setReschedule({ date: booking.date, startTime: booking.startTime, hours: booking.hours })
    setRescheduleOpen(true)
  }

  const handleReschedule = () => {
    if (!reschedule.date || !reschedule.startTime) {
      toast.error('Pick a new date and start time')
      return
    }
    const hours = Number(reschedule.hours) || booking.hours
    const hourlyRate = Number(booking.hourlyRate) || 0
    const subtotal = hourlyRate * hours
    const platformFee = Number(booking.platformFee) || PLATFORM_FEE
    const tax = Math.round((subtotal + platformFee) * GST_RATE)
    updateBooking(booking.id, {
      date: reschedule.date,
      startTime: reschedule.startTime,
      hours,
      subtotal,
      tax,
      total: subtotal + platformFee + tax,
      ...(booking.commission != null ? { commission: Math.round(subtotal * PLATFORM_COMMISSION) } : {}),
      timeline: [
        ...(booking.timeline || []),
        {
          at: new Date().toISOString(),
          label: `Rescheduled to ${formatDate(reschedule.date, { long: true })} at ${reschedule.startTime}`,
          status: 'completed',
        },
      ],
    })
    setRescheduleOpen(false)
    toast.success('Booking rescheduled', {
      description: `${booking.id} moved to ${formatDate(reschedule.date, { long: true })}, ${reschedule.startTime}.`,
    })
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Bookings', to: '/customer/bookings' }, { label: booking.id }]} />

      <PageHeader
        title={`Booking ${booking.id}`}
        subtitle={`${booking.service} · Ref ${booking.ref}`}
        meta={
          <>
            <StatusBadge status={booking.status} />
            <StatusBadge status={booking.paymentStatus} />
            <span className="inline-flex items-center gap-1.5 text-xs text-muted">
              <CalendarDays className="h-3.5 w-3.5" /> {formatDate(booking.date, { long: true })}
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs text-muted">
              <Clock className="h-3.5 w-3.5" /> {booking.startTime} · {formatDuration(booking.hours, { short: true })}
            </span>
          </>
        }
        action={
          <>
            <Button variant="outline" size="sm" icon={MessageSquare} onClick={handleSendMessage}>
              Message caretaker
            </Button>
            <Button variant="outline" size="sm" icon={Download} onClick={handleDownloadInvoice}>
              Download invoice
            </Button>
            <Button variant="dangerGhost" size="sm" icon={ShieldAlert} onClick={() => setComplaintOpen(true)}>
              Raise complaint
            </Button>
            {canReschedule ? (
              <Button variant="outline" size="sm" icon={CalendarDays} onClick={openReschedule}>
                Reschedule
              </Button>
            ) : null}
            {canCancel ? (
              <Button variant="danger" size="sm" icon={XCircle} onClick={() => setCancelOpen(true)}>
                Cancel booking
              </Button>
            ) : null}
          </>
        }
      />

      {(hasCheckedIn || canRate || canSettle) && (
        <Card className={cn(canSettle ? 'border-success-200 bg-success-50' : 'border-primary-200 bg-mint-50')}>
          <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  'grid h-10 w-10 shrink-0 place-items-center rounded-xl',
                  canSettle ? 'bg-success-500 text-white' : 'bg-primary-700 text-white',
                )}
              >
                {canSettle ? <CheckCircle2 className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
              </span>
              <div>
                <p className="text-sm font-bold text-ink">
                  {canSettle
                    ? 'Service completed — confirm to release payment'
                    : canRate
                      ? 'How was your experience with ' + (caregiver?.name || 'your caretaker') + '?'
                      : 'Your caretaker has checked in'}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {canSettle
                    ? 'Once you confirm, escrow funds are released and a payout is initiated.'
                    : canRate
                      ? 'Your rating helps other families and improves our matching.'
                      : `Checked in at ${booking.checkIn ? formatDateTime(booking.checkIn.at || booking.checkIn) : '—'}`}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {canSettle ? (
                <Button icon={CheckCircle2} onClick={() => setSettleOpen(true)}>
                  Confirm & release payment
                </Button>
              ) : null}
              {canRate ? (
                <Button icon={Star} onClick={() => setRateOpen(true)}>
                  Rate caretaker
                </Button>
              ) : null}
            </div>
          </CardBody>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Booking timeline" subtitle="Live progress of this care visit" />
            <CardBody>
              <BookingTimeline steps={booking.timeline || []} />
            </CardBody>
          </Card>

          {!hasCheckedOut && (
            <Card className="overflow-hidden">
              <CardHeader
                title="Your visit pass"
                icon={QrCode}
                subtitle="Show this code to your caretaker at check-in"
              />
              <CardBody className="space-y-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="grid shrink-0 place-items-center rounded-2xl border border-line bg-white p-3 shadow-card">
                    <div
                      className="grid h-28 w-28 gap-[3px] p-1"
                      style={{ gridTemplateColumns: 'repeat(11, 1fr)' }}
                      role="img"
                      aria-label={`Booking QR code ${booking.qrCode || `CM-QR-${booking.id}`}`}
                    >
                      {Array.from({ length: 121 }).map((_, i) => {
                        const code = booking.qrCode || `CM-QR-${booking.id}`
                        const dark =
                          (i * 7 + code.charCodeAt(i % code.length)) % 3 === 0 ||
                          i % 11 === 0 ||
                          Math.floor(i / 11) % 5 === 0
                        return (
                          <span
                            key={i}
                            className="rounded-[1px]"
                            style={{ background: dark ? '#0F172A' : 'transparent' }}
                          />
                        )
                      })}
                    </div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold uppercase tracking-wider text-faint">Booking code</p>
                    <p className="font-display mt-1 text-lg font-extrabold tracking-wide text-ink tabular-nums">
                      {booking.qrCode || `CM-QR-${booking.id}`}
                    </p>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted">
                      Your caretaker will ask for this at arrival and again at check-out. It proves the visit
                      started at your address, at the recorded time.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        icon={QrCode}
                        onClick={() => {
                          navigator.clipboard
                            ?.writeText(booking.qrCode || `CM-QR-${booking.id}`)
                            .then(() => toast.success('Booking code copied'))
                            .catch(() => toast.error('Could not copy the code'))
                        }}
                      >
                        Copy code
                      </Button>
                      {hasCheckedIn ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-success-50 px-3 py-1.5 text-xs font-bold text-success-700 ring-1 ring-inset ring-success-400/50">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Checked in
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-mint-100 px-3 py-1.5 text-xs font-bold text-primary-800">
                          <Clock className="h-3.5 w-3.5" /> Awaiting check-in
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <ol className="grid gap-2 border-t border-line pt-4 text-xs text-muted sm:grid-cols-3">
                  {[
                    '1. Caretaker arrives and opens check-in',
                    '2. They scan or enter your booking code',
                    '3. Both of you confirm — timestamps recorded',
                  ].map((step) => (
                    <li key={step} className="rounded-xl bg-slate-50 px-3 py-2.5 leading-relaxed">
                      {step}
                    </li>
                  ))}
                </ol>
              </CardBody>
            </Card>
          )}

          {(hasCheckedIn || hasCheckedOut) && (
            <Card>
              <CardHeader title="Service verification" icon={QrCode} subtitle="Check-in / check-out records" />
              <CardBody className="grid gap-3 sm:grid-cols-2">
                <VerifyRow
                  label="Check-in"
                  at={booking.checkIn?.at}
                  qr={booking.checkIn?.qrCode}
                />
                <VerifyRow
                  label="Check-out"
                  at={booking.checkOut?.at}
                  qr={booking.checkOut?.qrCode}
                />
              </CardBody>
            </Card>
          )}

          <div className="grid gap-6 sm:grid-cols-2">
            <Card>
              <CardHeader title="Service & patient" icon={UserRound} />
              <CardBody className="space-y-3 text-sm">
                <InfoRow label="Service" value={booking.service} />
                <InfoRow label="Care setting" value={booking.careType} />
                <InfoRow label="Patient" value={`${booking.patient?.name} (${booking.patient?.age} yrs)`} />
                <InfoRow label="Relation" value={booking.patient?.relation} />
                <InfoRow label="Requested on" value={formatDate(booking.createdAt, { long: true })} />
                <InfoRow label="Invoice no" value={booking.invoiceNo || '—'} />
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Location" icon={MapPin} />
              <CardBody className="space-y-3 text-sm">
                <InfoRow
                  label={booking.careType === 'Hospital Care' ? 'Hospital' : 'Address'}
                  value={booking.address}
                />
                <InfoRow label="City" value={booking.city} />
                <InfoRow label="Start time" value={booking.startTime} />
                <InfoRow label="Duration" value={formatDuration(booking.hours)} />
                <div className="flex items-center gap-2 rounded-xl bg-mint-50 px-3 py-2.5 text-xs font-semibold text-primary-800">
                  {booking.careType === 'Hospital Care' ? <Building2 className="h-4 w-4 shrink-0" /> : <Home className="h-4 w-4 shrink-0" />}
                  {booking.careType === 'Hospital Care' ? 'Hospital attendant care' : 'Home visit care'}
                </div>
              </CardBody>
            </Card>
          </div>

          <Card>
            <CardHeader title="Instructions & notes" />
            <CardBody className="space-y-4 text-sm leading-relaxed text-muted">
              {booking.specialInstructions ? (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-faint">Special instructions</p>
                  <p className="mt-1.5 text-ink-soft">{booking.specialInstructions}</p>
                </div>
              ) : null}
              {booking.notes ? (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-faint">Care requirements</p>
                  <p className="mt-1.5 text-ink-soft">{booking.notes}</p>
                </div>
              ) : null}
              {!booking.specialInstructions && !booking.notes ? (
                <p>No special instructions were added for this booking.</p>
              ) : null}
              {booking.cancelReason ? (
                <div className="rounded-xl border border-danger-200 bg-danger-50 px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-danger-600">Cancellation reason</p>
                  <p className="mt-1 text-sm text-danger-700">{booking.cancelReason}</p>
                </div>
              ) : null}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Your caretaker" />
            <CardBody className="space-y-4">
              {caregiver ? (
                <>
                  <div className="flex items-center gap-3.5">
                    <Avatar src={caregiver.photo} name={caregiver.name} size="lg" verified={caregiver.verified} />
                    <div className="min-w-0">
                      <p className="truncate font-display text-base font-bold text-ink">{caregiver.name}</p>
                      <p className="truncate text-sm font-medium text-primary-700">{caregiver.qualification}</p>
                      <div className="mt-1">
                        <RatingStars value={caregiver.rating} count={caregiver.reviewCount} showValue size={13} />
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <MiniStat label="Experience" value={`${caregiver.experienceYears} yrs`} />
                    <MiniStat label="Rate" value={`${formatCurrency(booking.hourlyRate)}/hr`} />
                    <MiniStat label="Trust score" value={`${caregiver.trustScore}%`} />
                    <MiniStat label="Response rate" value={`${caregiver.responseRate}%`} />
                  </div>
                  <Button to={`/caregivers/${caregiver.id}`} variant="outline" size="sm" className="w-full">
                    View profile
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted">A verified caretaker will be assigned shortly.</p>
              )}
            </CardBody>
          </Card>

          <PriceBreakdown
            items={[
              {
                label: booking.service,
                meta: `${formatCurrency(booking.hourlyRate)}/hr × ${durationBasis(booking.hours)}`,
                amount: booking.subtotal,
              },
            ]}
            subtotal={booking.subtotal}
            platformFee={booking.platformFee}
            tax={booking.tax}
            total={booking.total}
          />

          <Card>
            <CardHeader title="Payment" icon={Wallet} />
            <CardBody className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-muted">Status</span>
                <StatusBadge status={booking.paymentStatus} />
              </div>
              <p className="text-xs leading-relaxed text-muted">
                {booking.paymentStatus === 'Escrow Held'
                  ? 'Your payment is safely held in escrow and will be released after the service is completed.'
                  : booking.paymentStatus === 'Paid'
                    ? 'This booking has been fully paid and settled.'
                    : booking.paymentStatus === 'Refunded'
                      ? 'A refund was processed for this booking to your original payment method.'
                      : 'Complete the payment to confirm your caretaker in escrow.'}
              </p>
              {canPay ? (
                <Button className="w-full" icon={ShieldCheck} onClick={() => setPayOpen(true)}>
                  Pay {formatCurrency(booking.total)} now
                </Button>
              ) : null}
            </CardBody>
          </Card>

          <Button to="/customer/bookings" variant="ghost" size="sm" className="w-full" icon={ArrowLeft}>
            Back to bookings
          </Button>
        </div>
      </div>

      <Modal
        open={rescheduleOpen}
        onClose={() => setRescheduleOpen(false)}
        title="Reschedule booking"
        subtitle={`${booking.id} · ${booking.service}`}
        size="sm"
        footer={
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setRescheduleOpen(false)}>
              Keep original time
            </Button>
            <Button type="submit" form="reschedule-form" icon={CalendarDays}>
              Confirm new time
            </Button>
          </div>
        }
      >
        <form
          id="reschedule-form"
          onSubmit={(event) => {
            event.preventDefault()
            handleReschedule()
          }}
          className="space-y-4"
        >
          <FormField label="New date" htmlFor="rs-date" required>
            <Input
              id="rs-date"
              type="date"
              value={reschedule.date}
              onChange={(e) => setReschedule((r) => ({ ...r, date: e.target.value }))}
            />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Start time" htmlFor="rs-time" required>
              <Input
                id="rs-time"
                type="time"
                value={reschedule.startTime}
                onChange={(e) => setReschedule((r) => ({ ...r, startTime: e.target.value }))}
              />
            </FormField>
            <FormField
              label="Duration"
              htmlFor="rs-hours"
              required
              hint="Same presets as booking — hours, whole days or weeks"
            >
              <Select
                id="rs-hours"
                value={reschedule.hours}
                onChange={(e) => setReschedule((r) => ({ ...r, hours: Number(e.target.value) }))}
              >
                {DURATION_GROUPS.map((group) => (
                  <optgroup key={group.id} label={group.label}>
                    {group.options.map((h) => (
                      <option key={h} value={h}>
                        {formatDuration(h)}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </Select>
            </FormField>
          </div>

          <p className="rounded-xl bg-mint-50 px-3.5 py-3 text-xs leading-relaxed text-primary-900">
            Your caretaker is notified of the change immediately. Rescheduling more than 24 hours ahead is free;
            inside 24 hours the caretaker must agree before the slot moves.
            {Number(reschedule.hours) !== booking.hours ? (
              <>
                {' '}
                The price is recalculated at {formatCurrency(booking.hourlyRate)}/hr for{' '}
                {durationBasis(reschedule.hours)}.
              </>
            ) : null}
          </p>
        </form>
      </Modal>

      <ConfirmationDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={() => {
          cancelBooking(booking.id, 'Cancelled by customer from booking details')
          setCancelOpen(false)
          toast.success('Booking cancelled', {
            description:
              booking.paymentStatus === 'Escrow Held'
                ? 'Your escrow amount will be refunded within 3–5 working days.'
                : 'The booking has been cancelled.',
          })
        }}
        title="Cancel this booking?"
        message={`You are about to cancel ${booking.id} (${booking.service}) on ${formatDate(booking.date, { long: true })}. Cancellations within 4 hours of the start time may attract a fee.`}
        confirmLabel="Yes, cancel booking"
        cancelLabel="Keep booking"
      />

      <ConfirmationDialog
        open={settleOpen}
        onClose={() => setSettleOpen(false)}
        onConfirm={handleSettle}
        tone="success"
        title="Confirm service completed?"
        message="By confirming, you verify the service was delivered as scheduled and authorise release of escrow funds to your caretaker. This cannot be undone."
        confirmLabel="Yes, release payment"
        cancelLabel="Not yet"
      />

      <Modal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        title="Complete payment"
        subtitle={`${booking.service} · ${formatDate(booking.date, { long: true })}`}
        size="sm"
        footer={
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setPayOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="bd-pay-form" loading={paying} icon={ShieldCheck}>
              Pay {formatCurrency(booking.total)}
            </Button>
          </div>
        }
      >
        <form
          id="bd-pay-form"
          onSubmit={(event) => {
            event.preventDefault()
            handlePayNow()
          }}
          className="space-y-4"
        >
          <div className="rounded-xl border border-line bg-canvas px-4 py-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">Amount</span>
              <span className="font-display text-lg font-extrabold text-ink">{formatCurrency(booking.total)}</span>
            </div>
            <p className="mt-1 text-xs text-muted">Held in escrow until the service is completed.</p>
          </div>
          <div className="space-y-2">
            {PAYMENT_METHODS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setPayMethod(m.id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition',
                  payMethod === m.id
                    ? 'border-primary-600 bg-mint-50 ring-2 ring-primary-200'
                    : 'border-line bg-white hover:border-primary-200',
                )}
              >
                <span
                  className={cn(
                    'grid h-9 w-9 shrink-0 place-items-center rounded-lg',
                    payMethod === m.id ? 'bg-primary-700 text-white' : 'bg-slate-100 text-muted',
                  )}
                >
                  <m.icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-ink">{m.label}</span>
                  <span className="block text-xs text-muted">{m.hint}</span>
                </span>
                <span
                  className={cn(
                    'grid h-5 w-5 shrink-0 place-items-center rounded-full border-2',
                    payMethod === m.id ? 'border-primary-700 bg-primary-700' : 'border-line-strong',
                  )}
                >
                  {payMethod === m.id ? <CheckCircle2 className="h-3 w-3 text-white" /> : null}
                </span>
              </button>
            ))}
          </div>
          <p className="text-[11px] leading-relaxed text-faint">
            Payments are simulated in this demo — no real money is charged. In production this step runs through the
            PCI-compliant gateway with escrow protection.
          </p>
        </form>
      </Modal>

      <Modal
        open={rateOpen}
        onClose={() => setRateOpen(false)}
        title="Rate your caretaker"
        subtitle={`${caregiver?.name || 'Your caretaker'} · ${booking.service}`}
        size="md"
        footer={
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setRateOpen(false)}>
              Skip for now
            </Button>
            <Button type="submit" form="bd-rate-form" icon={Star}>
              Submit rating
            </Button>
          </div>
        }
      >
        <form
          id="bd-rate-form"
          onSubmit={(event) => {
            event.preventDefault()
            handleRate()
          }}
          className="space-y-4"
        >
          {RATING_CRITERIA.map((c) => (
            <div key={c.key} className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-ink">{c.label}</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setRateForm((f) => ({ ...f, [c.key]: v }))}
                    aria-label={`${c.label}: ${v} stars`}
                    className="transition hover:scale-110"
                  >
                    <Star
                      className={cn(
                        'h-6 w-6',
                        v <= rateForm[c.key] ? 'fill-warning-400 text-warning-400' : 'text-slate-300',
                      )}
                    />
                  </button>
                ))}
              </div>
            </div>
          ))}
          <FormField label="Comment (optional)" htmlFor="rate-comment">
            <Textarea
              id="rate-comment"
              rows={3}
              value={rateForm.comment}
              onChange={(e) => setRateForm((f) => ({ ...f, comment: e.target.value }))}
              placeholder="Share what went well, or what we can improve…"
            />
          </FormField>
        </form>
      </Modal>

      <Modal
        open={complaintOpen}
        onClose={() => setComplaintOpen(false)}
        title="Raise a complaint"
        subtitle={`Related to booking ${booking.id}`}
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setComplaintOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="bd-complaint-form" icon={ShieldAlert}>
              Submit complaint
            </Button>
          </div>
        }
      >
        <form
          id="bd-complaint-form"
          onSubmit={(event) => {
            event.preventDefault()
            handleRaiseComplaint()
          }}
          className="space-y-4"
        >
          <FormField label="Category" htmlFor="cp-category" required>
            <Select
              id="cp-category"
              value={complaint.category}
              onChange={(e) => setComplaint((c) => ({ ...c, category: e.target.value }))}
            >
              {COMPLAINT_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Subject" htmlFor="cp-subject" required>
            <Input
              id="cp-subject"
              value={complaint.subject}
              onChange={(e) => setComplaint((c) => ({ ...c, subject: e.target.value }))}
              placeholder="Short one-line summary"
            />
          </FormField>
          <FormField label="Description" htmlFor="cp-description" required hint="What happened? Include dates and times.">
            <Textarea
              id="cp-description"
              rows={4}
              value={complaint.description}
              onChange={(e) => setComplaint((c) => ({ ...c, description: e.target.value }))}
              placeholder="Describe the issue in detail…"
            />
          </FormField>
        </form>
      </Modal>
    </div>
  )
}

function VerifyRow({ label, at, qr }) {
  return (
    <div className="rounded-xl border border-line bg-slate-50 px-4 py-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-faint">{label}</span>
        <StatusBadge status={at ? 'Verified' : 'Pending'} size="sm" />
      </div>
      <p className="mt-1.5 text-sm font-semibold text-ink">{at ? formatDateTime(at) : 'Not yet recorded'}</p>
      {at ? (
        <div className="mt-1.5 space-y-0.5 text-xs text-muted">
          <p className="flex items-center gap-1.5">
            <ShieldCheck className="h-3 w-3 text-success-600" /> Selfie captured
          </p>
          <p className="flex items-center gap-1.5">
            <QrCode className="h-3 w-3 text-primary-600" /> QR {qr || 'verified'}
          </p>
        </div>
      ) : null}
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="shrink-0 text-muted">{label}</span>
      <span className="text-right font-semibold leading-snug text-ink">{value || '—'}</span>
    </div>
  )
}

function MiniStat({ label, value }) {
  return (
    <div className={cn('rounded-xl border border-line bg-slate-50 px-3 py-2')}>
      <p className="text-[10px] font-bold uppercase tracking-wider text-faint">{label}</p>
      <p className="mt-0.5 text-sm font-bold text-ink">{value}</p>
    </div>
  )
}

export default BookingDetailsPage
