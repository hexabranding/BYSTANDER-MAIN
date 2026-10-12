import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  Clock,
  Download,
  Home,
  MapPin,
  MessageSquare,
  ShieldAlert,
  ShieldCheck,
  UserRound,
  Wallet,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/context/AuthContext'
import { useData } from '@/context/DataContext'
import { useDocumentTitle } from '@/hooks/useUi'
import { getBookingById, CUSTOMERS } from '@/data/bookings'
import { downloadText, formatCurrency, formatDate, toCSV } from '@/utils/format'
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

const COMPLAINT_CATEGORIES = ['Service quality', 'No-show', 'Behaviour', 'Billing', 'Safety', 'Other']

export function BookingDetailsPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const {
    bookings,
    caregivers,
    updateBooking,
    cancelBooking,
    createComplaint,
  } = useData()

  useDocumentTitle(`Booking ${id || ''}`)

  const booking = useMemo(() => {
    const listHit = bookings.find((b) => b.id === id)
    return listHit || getBookingById(id) || null
  }, [bookings, id])

  const caregiver = caregivers.find((c) => c.id === booking?.caregiverId) || null

  const [cancelOpen, setCancelOpen] = useState(false)
  const [complaintOpen, setComplaintOpen] = useState(false)
  const [complaint, setComplaint] = useState({ category: 'Service quality', subject: '', description: '' })

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

  const handleDownloadInvoice = () => {
    const rows = [
      {
        'Invoice No': booking.invoiceNo,
        'Booking ID': booking.id,
        Reference: booking.ref,
        Service: booking.service,
        Patient: booking.patient?.name,
        Date: booking.date,
        'Hours': booking.hours,
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
      againstType: caregiver ? 'Caregiver' : 'Platform',
      category: complaint.category,
      priority: 'Medium',
      subject: complaint.subject.trim(),
      description: complaint.description.trim(),
      evidence: [],
    })
    toast.success('Complaint submitted', {
      description: 'Our support desk will review it within 24 hours.',
    })
    setComplaint({ category: 'Service quality', subject: '', description: '' })
    setComplaintOpen(false)
  }

  const handlePayNow = () => {
    updateBooking(booking.id, { paymentStatus: 'Escrow Held' })
    toast.success('Payment secured in escrow', {
      description: 'Funds will be released to the caregiver after the service completes.',
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
              <Clock className="h-3.5 w-3.5" /> {booking.startTime} · {booking.hours} hrs
            </span>
          </>
        }
        action={
          <>
            <Button to="/customer/messages" variant="outline" size="sm" icon={MessageSquare}>
              Message caregiver
            </Button>
            <Button variant="outline" size="sm" icon={Download} onClick={handleDownloadInvoice}>
              Download invoice
            </Button>
            <Button variant="dangerGhost" size="sm" icon={ShieldAlert} onClick={() => setComplaintOpen(true)}>
              Raise complaint
            </Button>
            {canCancel ? (
              <Button variant="danger" size="sm" icon={XCircle} onClick={() => setCancelOpen(true)}>
                Cancel booking
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Booking timeline" subtitle="Live progress of this care visit" />
            <CardBody>
              <BookingTimeline steps={booking.timeline || []} />
            </CardBody>
          </Card>

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
                <InfoRow label="Duration" value={`${booking.hours} hours`} />
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
            <CardHeader title="Your caregiver" />
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
                <p className="text-sm text-muted">A verified caregiver will be assigned shortly.</p>
              )}
            </CardBody>
          </Card>

          <PriceBreakdown
            items={[
              {
                label: booking.service,
                meta: `${formatCurrency(booking.hourlyRate)}/hr × ${booking.hours} hrs`,
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
                      : 'Complete the payment to confirm your caregiver in escrow.'}
              </p>
              {booking.paymentStatus === 'Pending' ? (
                <Button className="w-full" icon={ShieldCheck} onClick={handlePayNow}>
                  Pay now (demo)
                </Button>
              ) : null}
            </CardBody>
          </Card>

          <Button to="/customer/bookings" variant="ghost" size="sm" className="w-full" icon={ArrowLeft}>
            Back to bookings
          </Button>
        </div>
      </div>

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
            <Button onClick={handleRaiseComplaint} icon={ShieldAlert}>
              Submit complaint
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
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
        </div>
      </Modal>
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
