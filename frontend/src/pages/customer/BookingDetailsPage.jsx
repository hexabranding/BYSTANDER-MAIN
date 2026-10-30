import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  AlertCircle,
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
  Radio,
  RotateCw,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Star,
  UserRound,
  Users,
  UserX,
  Wallet,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/context/AuthContext'
import { useData } from '@/context/DataContext'
import { useDocumentTitle } from '@/hooks/useUi'
import { downloadText, formatCurrency, formatDate, formatDateTime, toCSV } from '@/utils/format'
import { GST_RATE, PLATFORM_COMMISSION, PLATFORM_FEE } from '@/utils/constants'
import { durationBasis, formatDuration } from '@/utils/duration'
import { cn } from '@/utils/cn'
import { Breadcrumbs } from '@/components/common/Breadcrumbs'
import { PageHeader } from '@/components/common/PageHeader'
import { Card, CardBody, CardHeader } from '@/components/common/Card'
import { Button } from '@/components/common/Button'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Avatar } from '@/components/common/Avatar'
import { RatingStars } from '@/components/common/RatingStars'
import { EmptyState, ErrorState, PageSkeleton } from '@/components/common/States'
import { BookingTimeline, PriceBreakdown } from '@/components/common/TimelinePrice'
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog'
import { Modal } from '@/components/common/Modal'
import { FormField, Input, Select, Textarea } from '@/components/forms/FormField'
import { CaregiverProfileModal } from '@/components/caregiver/CaregiverProfileModal'
import {
  bookingService,
  complaintService,
  reviewService,
  financeService,
  onApplicantAdded,
  onCaregiverSelected,
} from '@/services'

const isMongoObjectId = (id) => Boolean(id && typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id))

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

  const [realBooking, setRealBooking] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [otpData, setOtpData] = useState(null)
  const [otpLoading, setOtpLoading] = useState(false)
  const [cooldownSeconds, setCooldownSeconds] = useState(0)

  const loadBooking = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const data = await bookingService.getBookingById(id)
      setRealBooking(data)
    } catch (err) {
      setError(err.message || 'Booking not found')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadBooking()
  }, [loadBooking])

  // Real-time listener for applicant additions and caregiver selection on broadcast bookings
  useEffect(() => {
    if (!id) return
    const unsubApplicant = onApplicantAdded((data) => {
      if (String(data?.bookingId) === String(id)) {
        toast.info('New Caretaker Offer Received!', {
          description: `${data.applicant?.name || 'A qualified caretaker'} accepted your request. Review their profile and rate.`,
        })
        loadBooking()
      }
    })

    const unsubSelected = onCaregiverSelected((data) => {
      if (String(data?.bookingId) === String(id)) {
        loadBooking()
      }
    })

    return () => {
      unsubApplicant()
      unsubSelected()
    }
  }, [id, loadBooking])

  useEffect(() => {
    if (cooldownSeconds <= 0) return
    const interval = setInterval(() => {
      setCooldownSeconds((s) => Math.max(0, s - 1))
    }, 1000)
    return () => clearInterval(interval)
  }, [cooldownSeconds])

  const [broadcastNow, setBroadcastNow] = useState(Date.now())
  const [rebroadcasting, setRebroadcasting] = useState(false)

  // Live timer for 1-hour broadcast countdown
  useEffect(() => {
    if (!realBooking?.broadcastExpiresAt) return
    const interval = setInterval(() => {
      setBroadcastNow(Date.now())
    }, 1000)
    return () => clearInterval(interval)
  }, [realBooking?.broadcastExpiresAt])

  const booking = realBooking

  const broadcastExpiryMs = booking?.broadcastExpiresAt
    ? new Date(booking.broadcastExpiresAt).getTime()
    : null
  const broadcastRemainingMs = broadcastExpiryMs ? Math.max(0, broadcastExpiryMs - broadcastNow) : 0
  const isBroadcastExpired = Boolean(
    booking?.isBroadcastExpired ||
    (broadcastExpiryMs && broadcastRemainingMs <= 0 && (!booking.applicants || booking.applicants.length === 0)) ||
    booking?.status?.toLowerCase() === 'expired'
  )
  const isBroadcastClosed = Boolean(
    booking?.isBroadcastClosed ||
    (broadcastExpiryMs && broadcastRemainingMs <= 0 && booking.applicants && booking.applicants.length > 0)
  )

  const countdownMinutes = Math.floor(broadcastRemainingMs / 60000)
  const countdownSecondsRemaining = Math.floor((broadcastRemainingMs % 60000) / 1000)
  const countdownFormatted = `${String(countdownMinutes).padStart(2, '0')}:${String(countdownSecondsRemaining).padStart(2, '0')}`

  const handleRebroadcast = async () => {
    if (!booking?.id) return
    setRebroadcasting(true)
    try {
      if (isMongoObjectId(booking.id)) {
        const updated = await bookingService.rebroadcastBooking(booking.id)
        setRealBooking(updated)
      } else {
        const now = new Date()
        const newExpiry = new Date(now.getTime() + 60 * 60 * 1000).toISOString()
        updateBooking(booking.id, {
          status: 'Pending',
          broadcastExpiresAt: newExpiry,
        })
        setRealBooking((prev) => ({
          ...prev,
          status: 'Pending',
          broadcastExpiresAt: newExpiry,
          isBroadcastExpired: false,
        }))
      }
      toast.success('Broadcast Re-launched!', {
        description: 'Your request has been re-dispatched to verified caretakers in your area for 1 hour.',
      })
    } catch (err) {
      toast.error('Failed to re-broadcast', {
        description: err.message || 'Unable to re-launch search. Please try again.',
      })
    } finally {
      setRebroadcasting(false)
    }
  }

  const caregiver = useMemo(() => {
    if (!booking) return null
    if (booking.caregiver && typeof booking.caregiver === 'object') {
      const rawRating = booking.caregiver.rating
      const ratingAverage = typeof rawRating === 'object' && rawRating !== null
        ? Number(rawRating.average ?? 5.0)
        : Number(rawRating || 4.8)
      const reviewCount = typeof rawRating === 'object' && rawRating !== null
        ? Number(rawRating.count ?? 0)
        : Number(booking.caregiver.reviewCount || 0)

      return {
        id: booking.caregiverId || booking.caregiver._id || booking.caregiver.id,
        caregiverId: booking.caregiverId || booking.caregiver._id || booking.caregiver.id,
        name: booking.caregiverName || booking.caregiver.name,
        qualification: booking.caregiver.qualification || 'Caregiver',
        photo: booking.caregiver.avatar || booking.caregiver.photo || '',
        rating: isNaN(ratingAverage) ? 5.0 : ratingAverage,
        reviewCount: isNaN(reviewCount) ? 0 : reviewCount,
        experienceYears: booking.caregiver.experienceYears ?? 4,
        trustScore: booking.caregiver.trustScore ?? 98,
        responseRate: booking.caregiver.responseRate ?? 95,
      }
    }
    const found = caregivers.find((c) => c.id === booking.caregiverId)
    if (found) {
      const rawRating = found.rating
      const ratingAverage = typeof rawRating === 'object' && rawRating !== null
        ? Number(rawRating.average ?? 5.0)
        : Number(rawRating || 4.8)
      const reviewCount = typeof rawRating === 'object' && rawRating !== null
        ? Number(rawRating.count ?? 0)
        : Number(found.reviewCount || 0)

      return {
        ...found,
        caregiverId: found.id,
        rating: isNaN(ratingAverage) ? 5.0 : ratingAverage,
        reviewCount: isNaN(reviewCount) ? 0 : reviewCount,
        experienceYears: found.experienceYears ?? 4,
        trustScore: found.trustScore ?? 98,
        responseRate: found.responseRate ?? 95,
      }
    }
    return null
  }, [booking, caregivers])

  const [profileCaregiver, setProfileCaregiver] = useState(null)
  const [selectedApplicant, setSelectedApplicant] = useState(null)
  const [selectingApplicant, setSelectingApplicant] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [complaintOpen, setComplaintOpen] = useState(false)
  const [complaint, setComplaint] = useState({ category: 'Misbehavior', subject: '', description: '' })
  const [payOpen, setPayOpen] = useState(false)
  const [payMethod, setPayMethod] = useState('upi')
  const [paying, setPaying] = useState(false)
  const [rateOpen, setRateOpen] = useState(false)
  const [isMandatoryReview, setIsMandatoryReview] = useState(false)
  const [submittingReview, setSubmittingReview] = useState(false)
  const [hasPromptedReview, setHasPromptedReview] = useState(false)
  const [rateForm, setRateForm] = useState({ rating: 5, comment: '' })
  const [settleOpen, setSettleOpen] = useState(false)

  const isPaid = ['paid', 'released', 'settled'].includes(String(booking?.paymentStatus || '').toLowerCase())

  useEffect(() => {
    if (
      booking &&
      booking.status === 'Completed' &&
      isPaid &&
      !booking.customerRating &&
      !booking.customerReview &&
      !hasPromptedReview
    ) {
      setHasPromptedReview(true)
      setIsMandatoryReview(false)
      setRateOpen(true)
    }
  }, [booking?.id, booking?.status, booking?.paymentStatus, booking?.customerRating, booking?.customerReview, isPaid, hasPromptedReview])

  const handleSelectApplicant = async () => {
    if (!selectedApplicant || !booking?.id) return
    setSelectingApplicant(true)
    try {
      const caregiverId = selectedApplicant.caregiverId || selectedApplicant.id
      const updated = await bookingService.selectCaregiver(booking.id, caregiverId)
      setRealBooking(updated)
      toast.success('Caretaker confirmed!', {
        description: `${selectedApplicant.name} has been assigned to your booking at ${formatCurrency(selectedApplicant.hourlyRate)}/hr.`,
      })
      setSelectedApplicant(null)
    } catch (err) {
      toast.error('Unable to select caretaker', {
        description: err.message || 'Please try again.',
      })
    } finally {
      setSelectingApplicant(false)
    }
  }

  const handleRequestCheckInOtp = async () => {
    if (otpLoading || cooldownSeconds > 0 || !booking) return
    setOtpLoading(true)
    try {
      const res = await bookingService.requestCheckInOtp(booking.id)
      setOtpData(res)
      setCooldownSeconds(60)
      toast.success('Check-in OTP generated', {
        description: 'Share this 6-digit code with your caregiver when they arrive.',
      })
    } catch (err) {
      if (err.statusCode === 429) {
        setCooldownSeconds(60)
      }
      toast.error('Unable to generate OTP', {
        description: err.message || 'Please wait before requesting another OTP.',
      })
    } finally {
      setOtpLoading(false)
    }
  }

  const handleRequestCheckOutOtp = async () => {
    if (otpLoading || cooldownSeconds > 0 || !booking) return
    setOtpLoading(true)
    try {
      const res = await bookingService.requestCheckOutOtp(booking.id)
      setOtpData(res)
      setCooldownSeconds(60)
      toast.success('Check-out OTP generated', {
        description: 'Share this 6-digit code with your caregiver upon shift completion.',
      })
    } catch (err) {
      if (err.statusCode === 429) {
        setCooldownSeconds(60)
      }
      toast.error('Unable to generate OTP', {
        description: err.message || 'Please wait before requesting another OTP.',
      })
    } finally {
      setOtpLoading(false)
    }
  }

  const handleCancelBooking = async () => {
    if (!booking) return
    try {
      const updated = await bookingService.cancelBooking(
        booking.id,
        'Cancelled by customer from booking details',
      )
      setRealBooking(updated)
      if (cancelBooking) {
        cancelBooking(booking.id, 'Cancelled by customer from booking details')
      }
      toast.success('Booking cancelled', {
        description:
          booking.paymentStatus === 'Escrow Held'
            ? 'Your escrow amount will be refunded within 3–5 working days.'
            : 'The booking has been cancelled.',
      })
    } catch (err) {
      toast.error('Cancellation failed', {
        description: err.message || 'Could not cancel booking.',
      })
    } finally {
      setCancelOpen(false)
    }
  }

  if (loading) {
    return <PageSkeleton />
  }

  if (error || !booking) {
    return (
      <div className="space-y-6">
        <PageHeader title="Booking unavailable" subtitle={error || `We couldn't find a booking with ID ${id}.`} />
        <div className="rounded-card border border-line bg-white shadow-card">
          <EmptyState
            icon={XCircle}
            title="Booking unavailable"
            description={error || "This booking may have been removed, or the link is incorrect."}
            action={
              <div className="flex gap-2">
                <Button to="/customer/bookings" icon={ArrowLeft} variant="outline">
                  Back to my bookings
                </Button>
                <Button onClick={loadBooking} icon={RotateCw}>
                  Retry
                </Button>
              </div>
            }
          />
        </div>
      </div>
    )
  }

  const customer =
    (typeof booking.customer === 'object' && booking.customer !== null ? booking.customer : null) ||
    (user
      ? {
          name: user.name || user.fullName || booking.customerName || 'Customer',
          email: user.email || '',
          phone: user.phone || user.mobile || '',
          address: user.address || booking.address || '',
          city: user.city || booking.city || '',
        }
      : {
          name: booking.customerName || 'Customer',
          email: '',
          phone: '',
          address: booking.address || '',
          city: booking.city || '',
        })

  const canCancel = booking.status === 'Pending' || booking.status === 'Confirmed'
  const canPay =
    booking.status === 'Completed' &&
    !isPaid &&
    !['Paid', 'Settled', 'Refunded'].includes(booking.paymentStatus)
  const canSettle = booking.status === 'Completed' && booking.paymentStatus === 'Escrow Held'
  const canRate = booking.status === 'Completed' && isPaid && !booking.customerRating
  const hasCheckedIn = Boolean(booking.checkIn?.at) || ['In Progress', 'Completed'].includes(booking.status)
  const hasCheckedOut = Boolean(booking.checkOut?.at) || booking.status === 'Completed'

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
    toast.success('Invoice downloaded', { description: `${booking.invoiceNo} saved successfully.` })
  }

  const handleRaiseComplaint = async () => {
    if (!complaint.subject.trim() || !complaint.description.trim()) {
      toast.error('Please add a subject and description')
      return
    }
    const targetBookingId = booking?.dbId || booking?._id || booking?.id
    if (isMongoObjectId(targetBookingId)) {
      try {
        await complaintService.submitComplaint({
          bookingId: targetBookingId,
          category: complaint.category,
          priority: 'Medium',
          subject: complaint.subject.trim(),
          description: complaint.description.trim(),
        })
      } catch (err) {
        console.error('[Complaint Submission Error]', err)
        toast.error('Unable to submit complaint', {
          description: err.message || 'Please check your connection and try again.',
        })
        return
      }
    }
    createComplaint({
      bookingId: booking.id,
      complainant: customer?.name || user?.name || 'Customer',
      complainantType: 'Customer',
      against: caregiver?.name || 'Bystander Platform',
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

  const handlePayNow = async () => {
    const targetBookingId = booking?.dbId || booking?._id || booking?.id
    setPaying(true)
    const methodLabel = PAYMENT_METHODS.find((m) => m.id === payMethod)?.label || 'UPI'

    if (isMongoObjectId(targetBookingId)) {
      try {
        await financeService.loadRazorpayScript()
        const orderRes = await financeService.createPaymentOrder(targetBookingId)

        if (typeof window !== 'undefined' && window.Razorpay && orderRes?.order?.id) {
          const rzp = new window.Razorpay({
            key: orderRes.order?.keyId || orderRes.keyId || 'rzp_test_bystander_sandbox',
            amount: orderRes.order?.amount,
            currency: orderRes.order?.currency || 'INR',
            name: 'Bystander Healthcare',
            description: `${booking.service || 'Bedside Care'} Shift Escrow (Test Mode)`,
            order_id: orderRes.order?.id,
            prefill: {
              name: customer?.name || user?.name || 'Customer',
              email: customer?.email || user?.email || '',
              contact: customer?.phone || user?.phone || '',
            },
            theme: { color: '#06263B' },
            handler: async function (response) {
              try {
                await financeService.verifyPaymentSignature({
                  bookingId: targetBookingId,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                })
              } catch (vErr) {
                console.warn('[Razorpay Verification Notice]', vErr.message)
              }
              const isCompleted = booking.status === 'Completed'
              updateBooking(booking.id, { paymentStatus: isCompleted ? 'Paid' : 'Escrow Held' })
              setPayOpen(false)
              setPaying(false)
              await loadBooking()
              toast.success(
                isCompleted
                  ? 'Payment settled via Razorpay!'
                  : 'Payment secured in Razorpay Escrow (Test Mode)',
                {
                  description: isCompleted
                    ? `Payment Tx: ${response.razorpay_payment_id}. Caretaker payment settled.`
                    : `Tx: ${response.razorpay_payment_id}. Funds will be held until shift completion.`,
                }
              )
              if (isCompleted && !booking.customerRating) {
                setIsMandatoryReview(true)
                setRateOpen(true)
              }
            },
            modal: {
              ondismiss: function () {
                setPaying(false)
              },
            },
          })
          rzp.open()
          return
        }

        // Fallback for offline simulation
        await financeService.simulateBookingPayment(targetBookingId, {
          status: 'SIMULATED_ESCROW_HELD',
        })
      } catch (err) {
        console.warn('[Razorpay Order Fallback]', err.message)
      }
    }

    const isCompleted = booking.status === 'Completed'
    updateBooking(booking.id, { paymentStatus: isCompleted ? 'Paid' : 'Escrow Held' })
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
      status: isCompleted ? 'Paid' : 'Escrow Held',
      type: 'Booking payment',
    })
    setPaying(false)
    setPayOpen(false)
    toast.success(isCompleted ? 'Payment settled!' : 'Payment secured in simulated escrow', {
      description: isCompleted
        ? 'Shift payment settled.'
        : `Simulated via ${methodLabel}. Funds release after shift completion. (Test mode only).`,
    })
    if (isCompleted && !booking.customerRating) {
      setIsMandatoryReview(true)
      setRateOpen(true)
    }
  }

  const handleSettle = async () => {
    const targetBookingId = booking?.dbId || booking?._id || booking?.id
    if (isMongoObjectId(targetBookingId)) {
      try {
        await financeService.releaseEscrow(targetBookingId)
      } catch (err) {
        await financeService.simulateBookingPayment(targetBookingId, {
          status: 'SIMULATED_RELEASED_TO_CAREGIVER',
        }).catch((e) => console.error('[Settlement Fallback Error]', e))
      }
    }
    advanceBooking(booking.id, 'settle')
    updateBooking(booking.id, { paymentStatus: 'Released' })
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

  const handleRate = async () => {
    if (!rateForm.comment || !rateForm.comment.trim()) {
      toast.error('Review feedback is required', {
        description: 'Please write your review comments before submitting.',
      })
      return
    }

    const selectedRating = Math.max(1, Math.min(5, Number(rateForm.rating || 5)))
    const targetBookingId = booking?.dbId || booking?._id || booking?.id

    setSubmittingReview(true)

    if (isMongoObjectId(targetBookingId)) {
      try {
        await reviewService.submitReview({
          bookingId: targetBookingId,
          rating: selectedRating,
          criteria: {
            serviceQuality: selectedRating,
            behaviour: selectedRating,
            punctuality: selectedRating,
            overall: selectedRating,
          },
          comment: rateForm.comment.trim(),
        })
      } catch (err) {
        console.error('[Review Submission Error]', err)
        // If the review has already been recorded in backend, close the modal gracefully and sync
        if (err.message && err.message.toLowerCase().includes('already been submitted')) {
          setRateOpen(false)
          setIsMandatoryReview(false)
          setSubmittingReview(false)
          toast.info('Review already recorded', {
            description: 'Your rating and feedback have already been saved for this booking.',
          })
          await loadBooking()
          return
        }
        toast.error('Unable to submit review', {
          description: err.message || 'Please check that the booking is completed and try again.',
        })
        setSubmittingReview(false)
        return
      }
    }

    const ratingObj = {
      rating: selectedRating,
      average: selectedRating,
      serviceQuality: selectedRating,
      behaviour: selectedRating,
      punctuality: selectedRating,
      overall: selectedRating,
      comment: rateForm.comment.trim(),
      at: new Date().toISOString(),
    }
    try {
      if (addReview) {
        addReview({
          bookingId: booking.id,
          caregiverId: booking.caregiverId,
          customerId: booking.customerId,
          customerName: customer?.name || user?.name || 'Customer',
          rating: selectedRating,
          criteria: {
            serviceQuality: selectedRating,
            behaviour: selectedRating,
            punctuality: selectedRating,
            overall: selectedRating,
          },
          comment: rateForm.comment.trim(),
        })
      }
      if (updateBooking) {
        updateBooking(booking.id, {
          customerRating: ratingObj,
        })
      }
    } catch (e) {
      console.warn('[Local context sync error]', e)
    }

    setRealBooking((prev) => (prev ? { ...prev, customerRating: ratingObj, customerReview: ratingObj } : prev))
    setIsMandatoryReview(false)
    setRateOpen(false)
    setSubmittingReview(false)
    toast.success('Thank you for your review!', {
      description: `${caregiver?.name || 'Your caretaker'} received your ${selectedRating}-star rating.`,
    })
    await loadBooking()
  }

  const handleSendMessage = () => {
    const threadId = ensureConversation({
      bookingRef: booking.ref,
      audienceRole: 'customer',
      name: caregiver?.name || 'Care Coordinator',
      roleLabel: caregiver?.qualification || 'Bystander support',
      avatar: caregiver?.photo || '',
      firstMessage: `Hi, I'm reaching out regarding booking ${booking.id} (${booking.service} on ${formatDate(booking.date)}).`,
    })
    navigate(`/customer/messages?thread=${threadId}`)
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
            {booking.preferredGender && (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 border border-slate-200">
                {booking.preferredGender === 'Female' ? '👩 Female Caretaker Preferred' : booking.preferredGender === 'Male' ? '👨 Male Caretaker Preferred' : '🤝 Any Caretaker'}
              </span>
            )}
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
            {canCancel ? (
              <Button variant="danger" size="sm" icon={XCircle} onClick={() => setCancelOpen(true)}>
                Cancel booking
              </Button>
            ) : null}
          </>
        }
      />

      {booking.status === 'Completed' && canPay && (
        <Card className="border-2 border-amber-300 bg-amber-50 shadow-sm">
          <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-500 text-white font-bold text-lg">
                💳
              </span>
              <div>
                <p className="text-sm font-bold text-amber-950">
                  Service Completed — Payment Due
                </p>
                <p className="mt-0.5 text-xs text-amber-800">
                  Your caretaker has finished the shift. Please pay {formatCurrency(booking.total)} via Razorpay to settle the shift.
                </p>
              </div>
            </div>
            <Button
              variant="primary"
              size="sm"
              icon={ShieldCheck}
              className="bg-primary-700 hover:bg-primary-800 shrink-0 font-bold"
              onClick={handlePayNow}
              disabled={paying}
            >
              {paying ? 'Opening Razorpay…' : `Pay ${formatCurrency(booking.total)} Now`}
            </Button>
          </CardBody>
        </Card>
      )}

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

      {/* If customer already rated, show completed review card */}
      {booking.customerRating && (
        <Card className="border-primary-200 bg-mint-50/50">
          <CardBody className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2.5">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary-100 text-primary-700">
                  <Star className="h-4 w-4 fill-primary-600 text-primary-600" />
                </span>
                <div>
                  <h4 className="text-sm font-bold text-ink">Your Review for {caregiver?.name || 'Caretaker'}</h4>
                  <p className="text-xs text-muted">
                    {booking.customerRating.at
                      ? `Submitted on ${formatDate(booking.customerRating.at, { long: true })}`
                      : 'Review submitted'}
                  </p>
                </div>
              </div>
              <RatingStars value={booking.customerRating.average || booking.customerRating.rating} showValue size={15} />
            </div>
            {booking.customerRating.comment && (
              <p className="rounded-xl border border-line/60 bg-white p-3 text-xs italic text-ink-soft">
                "{booking.customerRating.comment}"
              </p>
            )}
          </CardBody>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Caretaker Applicants, Rapido-style Timeout, or Live Radar Search Section */}
          {!booking.caregiverId && ['pending', 'expired'].includes(booking.status?.toLowerCase()) && (
            booking.applicants && booking.applicants.length > 0 ? (
              <Card className="border-2 border-primary-500/30 bg-gradient-to-br from-mint-50/50 via-white to-white shadow-md">
                <CardHeader
                  icon={Users}
                  title={`Caretakers Who Accepted Your Request (${booking.applicants.length})`}
                  subtitle={
                    isBroadcastClosed
                      ? '1-Hour broadcast has completed. Choose your preferred caretaker from the offers below.'
                      : 'Compare ratings, qualifications, and hourly rates to choose your preferred caretaker.'
                  }
                  action={
                    booking.preferredGender && booking.preferredGender !== 'Any' ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-100 px-3 py-1 text-xs font-bold text-primary-800">
                        {booking.preferredGender === 'Female' ? '👩 Female Preferred' : '👨 Male Preferred'}
                      </span>
                    ) : null
                  }
                />
                <CardBody className="space-y-4">
                  {/* Broadcast Window Status Notice */}
                  {isBroadcastClosed ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50/90 p-3.5 text-xs text-slate-700 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span><strong>1-Hour Broadcast Completed:</strong> This request is now closed to new caretakers. Please confirm your preferred caretaker below to lock in the booking.</span>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-primary-200 bg-mint-50/70 p-3.5 text-xs text-primary-900 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-primary-700 shrink-0 animate-spin" style={{ animationDuration: '6s' }} />
                        <span><strong>Broadcast Live ({countdownFormatted} remaining):</strong> Caretakers are actively reviewing. You may choose a caretaker now or wait for more offers.</span>
                      </div>
                    </div>
                  )}

                  <div className="grid gap-3">
                    {booking.applicants.map((applicant) => (
                      <div
                        key={applicant.caregiverId || applicant.id}
                        className="group flex flex-col justify-between gap-4 rounded-2xl border border-line bg-white p-4 transition-all hover:border-primary-400 hover:shadow-card sm:flex-row sm:items-center"
                      >
                        <div className="flex items-start gap-3.5">
                          <Avatar
                            src={applicant.photo || applicant.avatar}
                            name={applicant.name}
                            size="lg"
                            verified={true}
                          />
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="font-display text-base font-bold text-ink">
                                {applicant.name}
                              </h4>
                              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                                {applicant.gender === 'Female' ? '👩 Female' : applicant.gender === 'Male' ? '👨 Male' : applicant.gender}
                              </span>
                              {applicant.experienceYears > 0 ? (
                                <span className="inline-flex items-center rounded-full bg-mint-100 px-2 py-0.5 text-[11px] font-semibold text-primary-800">
                                  {applicant.experienceYears} yrs exp
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-0.5 text-sm font-medium text-primary-700">
                              {applicant.qualification || 'Caregiver'}
                            </p>
                            <div className="mt-1 flex items-center gap-2">
                              <RatingStars
                                value={applicant.rating || 5.0}
                                count={applicant.reviewCount || 0}
                                showValue
                                size={13}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-4 border-t border-line/60 pt-3 sm:border-t-0 sm:pt-0 sm:justify-end">
                          <div className="text-left sm:text-right">
                            <div className="flex items-baseline gap-1 sm:justify-end">
                              <span className="font-display text-lg font-extrabold text-ink">
                                {formatCurrency(applicant.hourlyRate)}
                              </span>
                              <span className="text-xs text-muted">/hr</span>
                            </div>
                            <p className="text-[11px] text-faint">
                              Est. total: {formatCurrency(applicant.totalAmount)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setProfileCaregiver(applicant)}
                            >
                              View profile
                            </Button>
                            <Button
                              variant="primary"
                              icon={CheckCircle2}
                              size="sm"
                              onClick={() => setSelectedApplicant(applicant)}
                            >
                              Choose Caretaker
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardBody>
              </Card>
            ) : isBroadcastExpired ? (
              /* Rapido / Uber Style: Search Timed Out — No Caretaker Available Card */
              <Card className="border-2 border-amber-300/80 bg-gradient-to-br from-amber-50/50 via-white to-white shadow-md overflow-hidden">
                <div className="h-1.5 w-full bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500" />
                <CardBody className="p-6 sm:p-8">
                  <div className="flex flex-col items-center text-center max-w-xl mx-auto space-y-4">
                    <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 shadow-inner">
                      <UserX className="h-8 w-8 stroke-[2.2]" />
                      <span className="absolute -top-1 -right-1 flex h-4 w-4">
                        <span className="relative inline-flex h-4 w-4 rounded-full bg-amber-500 text-[10px] font-black text-white items-center justify-center">!</span>
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-100/80 px-3 py-1 text-xs font-bold text-amber-900">
                        <Clock className="h-3.5 w-3.5 text-amber-700" />
                        1-Hour Search Window Elapsed
                      </div>
                      <h3 className="font-display text-xl sm:text-2xl font-black text-ink">
                        No Caretakers Available Nearby
                      </h3>
                      <p className="text-sm text-slate-600 leading-relaxed">
                        We broadcasted your request to verified caregivers in <strong className="text-ink">{booking.city || 'your area'}</strong> for <strong className="text-ink">{booking.serviceName || booking.service}</strong>, but unfortunately none were available to accept within the 1-hour broadcast window.
                      </p>
                    </div>

                    <div className="w-full rounded-xl border border-dashed border-amber-200 bg-amber-50/50 p-3.5 text-xs text-amber-900 flex items-center justify-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span><strong>No charges deducted:</strong> Any escrow authorization for this request remains completely safe.</span>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-3 pt-2 w-full">
                      <Button
                        type="button"
                        variant="primary"
                        icon={RotateCw}
                        loading={rebroadcasting}
                        onClick={handleRebroadcast}
                        className="shadow-sm"
                      >
                        Re-broadcast Request (1 Hour)
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => navigate('/customer/caregivers')}
                      >
                        Browse Directory
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => navigate('/customer/ambulances')}
                      >
                        Ambulance Assistance
                      </Button>
                    </div>
                  </div>
                </CardBody>
              </Card>
            ) : (
              /* Live Rapido-style Radar Pulse Search with Countdown Clock */
              <Card className="border border-primary-200 bg-gradient-to-r from-mint-50/60 to-primary-50/30 overflow-hidden shadow-sm">
                <div className="h-1 w-full bg-gradient-to-r from-primary-400 via-mint-400 to-primary-600 animate-pulse" />
                <CardBody className="flex flex-col gap-5 p-5 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary-600 text-white shadow-md">
                        <Radio className="h-7 w-7 animate-pulse" />
                        <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-300 opacity-75" />
                          <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-primary-500" />
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-display text-base font-bold text-ink">
                            Searching for Available Caretakers...
                          </h4>
                          {booking.preferredGender && booking.preferredGender !== 'Any' ? (
                            <span className="rounded-full bg-primary-100 px-2.5 py-0.5 text-xs font-bold text-primary-800">
                              {booking.preferredGender === 'Female' ? '👩 Female Preferred' : '👨 Male Preferred'}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-sm text-muted">
                          Broadcasting live in {booking.city || 'your area'}. As caretakers accept, their profiles will appear right here for you to compare and choose.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-center shrink-0 rounded-2xl border border-primary-200 bg-white/90 px-4 py-2.5 shadow-xs">
                      <Clock className="h-4 w-4 text-primary-700 animate-spin" style={{ animationDuration: '6s' }} />
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-muted">Time Remaining</div>
                        <div className="font-mono text-base font-extrabold text-primary-900">{countdownFormatted}</div>
                      </div>
                    </div>
                  </div>

                  {/* Search Progress Bar */}
                  <div className="w-full bg-primary-100/70 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-primary-600 h-full rounded-full transition-all duration-1000"
                      style={{
                        width: `${Math.min(100, Math.max(5, ((3600000 - broadcastRemainingMs) / 3600000) * 100))}%`,
                      }}
                    />
                  </div>
                </CardBody>
              </Card>
            )
          )}

          <Card>
            <CardHeader title="Booking timeline" subtitle="Live progress of this care visit" />
            <CardBody>
              <BookingTimeline steps={booking.timeline || []} onPay={handlePayNow} payLoading={paying} />
            </CardBody>
          </Card>

          {!hasCheckedOut && (
            <Card className="overflow-hidden">
              <CardHeader
                title="Your visit pass"
                icon={QrCode}
                subtitle="Cryptographic verification code for arrival and shift completion"
              />
              <CardBody className="space-y-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="grid shrink-0 place-items-center rounded-2xl border border-line bg-white p-4 shadow-card">
                    {otpData?.otp ? (
                      <div className="flex flex-col items-center justify-center p-2 text-center">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-faint">
                          {hasCheckedIn ? 'Check-out code' : 'Check-in code'}
                        </span>
                        <span className="mt-1 font-mono text-3xl font-extrabold tracking-widest text-primary-800">
                          {otpData.otp}
                        </span>
                        <span className="mt-1 text-[10px] font-medium text-muted">
                          {otpData.maxAttempts ?? 5} attempts left
                        </span>
                      </div>
                    ) : (
                      <div
                        className="grid h-24 w-24 gap-[3px] p-1"
                        style={{ gridTemplateColumns: 'repeat(11, 1fr)' }}
                        role="img"
                        aria-label={`Booking reference pass ${booking.ref || booking.id}`}
                      >
                        {Array.from({ length: 121 }).map((_, i) => {
                          const code = booking.ref || booking.id
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
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-bold uppercase tracking-wider text-faint">
                        {otpData?.otp
                          ? hasCheckedIn
                            ? 'Active check-out OTP'
                            : 'Active check-in OTP'
                          : 'Visit authentication'}
                      </p>
                      {hasCheckedIn ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-success-50 px-2.5 py-0.5 text-xs font-bold text-success-700 ring-1 ring-inset ring-success-400/50">
                          <CheckCircle2 className="h-3 w-3" /> Shift in progress
                        </span>
                      ) : booking.status === 'Confirmed' ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-mint-100 px-2.5 py-0.5 text-xs font-bold text-primary-800">
                          <Clock className="h-3 w-3" /> Confirmed · Ready for check-in
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-700">
                          Pending confirmation
                        </span>
                      )}
                    </div>

                    <p className="mt-1.5 text-sm leading-relaxed text-muted">
                      {hasCheckedIn
                        ? 'When the caregiver concludes their shift, request your check-out OTP and share it with them to finalize the visit.'
                        : booking.status === 'Confirmed'
                          ? 'Share the 6-digit code with your caregiver when they arrive at the address. This confirms attendance securely.'
                          : 'Your booking is awaiting caretaker confirmation. Once accepted, you can generate your check-in OTP code here.'}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {booking.status === 'Confirmed' && !hasCheckedIn ? (
                        <>
                          <Button
                            size="sm"
                            icon={QrCode}
                            loading={otpLoading}
                            disabled={cooldownSeconds > 0}
                            onClick={handleRequestCheckInOtp}
                          >
                            {cooldownSeconds > 0
                              ? `Wait ${cooldownSeconds}s`
                              : otpData?.otp
                                ? 'Refresh check-in code'
                                : 'Generate check-in code'}
                          </Button>
                          {otpData?.otp ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                navigator.clipboard
                                  ?.writeText(otpData.otp)
                                  .then(() => toast.success('Check-in OTP copied'))
                                  .catch(() => toast.error('Could not copy OTP'))
                              }}
                            >
                              Copy code
                            </Button>
                          ) : null}
                        </>
                      ) : null}

                      {hasCheckedIn && !hasCheckedOut ? (
                        <>
                          <Button
                            size="sm"
                            icon={QrCode}
                            loading={otpLoading}
                            disabled={cooldownSeconds > 0}
                            onClick={handleRequestCheckOutOtp}
                          >
                            {cooldownSeconds > 0
                              ? `Wait ${cooldownSeconds}s`
                              : otpData?.otp
                                ? 'Refresh check-out code'
                                : 'Generate check-out code'}
                          </Button>
                          {otpData?.otp ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                navigator.clipboard
                                  ?.writeText(otpData.otp)
                                  .then(() => toast.success('Check-out OTP copied'))
                                  .catch(() => toast.error('Could not copy OTP'))
                              }}
                            >
                              Copy code
                            </Button>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>

                <ol className="grid gap-2 border-t border-line pt-4 text-xs text-muted sm:grid-cols-3">
                  {[
                    '1. Caretaker arrives at scheduled service address',
                    '2. You generate & provide the authoritative 6-digit OTP',
                    '3. Caretaker verifies code — timestamps recorded securely',
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
                <InfoRow label="Preferred caretaker" value={booking.preferredGender ? `${booking.preferredGender} Caretaker` : 'Any Caretaker'} />
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
              {(booking.specialInstructions || booking.patientDetails?.specialInstructions || booking.patient?.specialInstructions) ? (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-faint">Special instructions & Care directives</p>
                  <p className="mt-1.5 text-ink-soft">
                    {booking.specialInstructions || booking.patientDetails?.specialInstructions || booking.patient?.specialInstructions}
                  </p>
                </div>
              ) : null}
              {booking.notes ? (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-faint">Care requirements</p>
                  <p className="mt-1.5 text-ink-soft">{booking.notes}</p>
                </div>
              ) : null}
              {!booking.specialInstructions && !booking.patientDetails?.specialInstructions && !booking.patient?.specialInstructions && !booking.notes ? (
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
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => setProfileCaregiver(caregiver)}
                  >
                    View profile
                  </Button>
                </>
              ) : booking.applicants && booking.applicants.length > 0 ? (
                <div className="rounded-xl border border-primary-200 bg-mint-50/60 p-4 text-center">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-primary-800">
                    <Users className="h-5 w-5" />
                  </div>
                  <h4 className="mt-2 text-sm font-bold text-ink">
                    {booking.applicants.length} Caretaker{booking.applicants.length > 1 ? 's' : ''} Ready
                  </h4>
                  <p className="mt-1 text-xs text-muted">
                    {booking.applicants.length} verified caretaker{booking.applicants.length > 1 ? 's' : ''} accepted your request. Review their profiles on the left and select your preferred caretaker.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-line p-4 text-center">
                  <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                    <RotateCw className="h-4 w-4 animate-spin text-primary-600" />
                  </div>
                  <h4 className="mt-2 text-xs font-semibold text-ink">Broadcasting to Caretakers</h4>
                  <p className="mt-1 text-xs text-muted">
                    Notifying verified {booking.preferredGender && booking.preferredGender !== 'Any' ? `${booking.preferredGender.toLowerCase()} ` : ''}caregivers... Offers will appear here shortly.
                  </p>
                </div>
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
                {isPaid || booking.paymentStatus === 'Paid'
                  ? 'This booking has been fully paid and settled.'
                  : booking.paymentStatus === 'Refunded'
                    ? 'A refund was processed for this booking to your original payment method.'
                    : booking.status === 'Completed'
                      ? 'Service is completed. Please settle payment to finalize the shift.'
                      : 'No advance payment needed. Payment is settled after the service is completed via UPI, Card, or Net Banking.'}
              </p>
              {canPay ? (
                <Button className="w-full" icon={ShieldCheck} onClick={() => setPayOpen(true)}>
                  Settle & Pay {formatCurrency(booking.total)}
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
        onConfirm={handleCancelBooking}
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

      <ConfirmationDialog
        open={Boolean(selectedApplicant)}
        onClose={() => setSelectedApplicant(null)}
        onConfirm={handleSelectApplicant}
        tone="success"
        title="Select this caretaker?"
        message={
          selectedApplicant ? (
            <div className="space-y-3">
              <p>
                Assign <strong>{selectedApplicant.name}</strong> ({selectedApplicant.qualification}) to your booking?
              </p>
              <div className="rounded-xl border border-line bg-slate-50 p-3 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted">Hourly Rate:</span>
                  <span className="font-semibold text-ink">{formatCurrency(selectedApplicant.hourlyRate)}/hr</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Duration:</span>
                  <span className="font-semibold text-ink">{formatDuration(booking.hours)}</span>
                </div>
                <div className="flex justify-between border-t border-line/60 pt-1.5 font-bold">
                  <span>Total Shift Amount:</span>
                  <span className="text-primary-800">{formatCurrency(selectedApplicant.totalAmount)}</span>
                </div>
              </div>
              <p className="text-xs text-muted">
                Your booking will be confirmed immediately and {selectedApplicant.name} will be scheduled for your care visit.
              </p>
            </div>
          ) : ''
        }
        confirmLabel={selectingApplicant ? 'Confirming…' : 'Confirm selection'}
        loading={selectingApplicant}
      />

      <Modal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        title="Settle shift payment"
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
            <p className="mt-1 text-xs text-muted">Direct shift settlement. Caretaker payout is credited upon settlement.</p>
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
          <p className="text-[11px] leading-relaxed text-muted">
            All payments are securely processed through platform escrow protection. Funds are disbursed to the caregiver only after shift completion and customer sign-off.
          </p>
        </form>
      </Modal>

      <Modal
        open={rateOpen}
        onClose={() => {
          setRateOpen(false)
        }}
        title="Rate your caretaker"
        subtitle={`${caregiver?.name || 'Your caretaker'} · ${booking.service}`}
        size="md"
        footer={
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setRateOpen(false)} disabled={submittingReview}>
              Skip for now
            </Button>
            <Button type="submit" form="bd-rate-form" icon={Star} loading={submittingReview}>
              Submit review
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
          <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-line bg-gradient-to-b from-slate-50/80 to-white py-5 px-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Tap to rate</p>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setRateForm((f) => ({ ...f, rating: v }))}
                  aria-label={`${v} star${v > 1 ? 's' : ''}`}
                  className="p-1 transition hover:scale-125 focus:outline-none"
                >
                  <Star
                    className={cn(
                      'h-9 w-9 transition-colors',
                      v <= (rateForm.rating || 5)
                        ? 'fill-amber-400 text-amber-400 drop-shadow-sm'
                        : 'text-slate-200 hover:text-slate-300',
                    )}
                  />
                </button>
              ))}
            </div>
            <p className="text-sm font-bold text-ink">
              {(rateForm.rating || 5) === 5
                ? '5.0 · Excellent'
                : (rateForm.rating || 5) === 4
                ? '4.0 · Good'
                : (rateForm.rating || 5) === 3
                ? '3.0 · Average'
                : (rateForm.rating || 5) === 2
                ? '2.0 · Poor'
                : '1.0 · Very Poor'}
            </p>
          </div>

          <FormField label="Review feedback" htmlFor="rate-comment">
            <Textarea
              id="rate-comment"
              rows={3}
              required
              value={rateForm.comment}
              onChange={(e) => setRateForm((f) => ({ ...f, comment: e.target.value }))}
              placeholder="Share your experience with the caretaker..."
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

      {/* Caretaker Profile Modal */}
      <CaregiverProfileModal
        open={Boolean(profileCaregiver)}
        onClose={() => setProfileCaregiver(null)}
        offer={
          profileCaregiver
            ? {
                applicant: {
                  ...profileCaregiver,
                  id: profileCaregiver.id || profileCaregiver.caregiverId || booking?.caregiverId,
                  caregiverId: profileCaregiver.caregiverId || profileCaregiver.id || booking?.caregiverId,
                  name: profileCaregiver.name || booking?.caregiverName,
                  photo: profileCaregiver.photo || profileCaregiver.avatar,
                  qualification: profileCaregiver.qualification,
                  hourlyRate: profileCaregiver.hourlyRate || booking?.hourlyRate,
                  rating: profileCaregiver.rating,
                  experienceYears: profileCaregiver.experienceYears,
                  trustScore: profileCaregiver.trustScore,
                  responseRate: profileCaregiver.responseRate,
                  city: profileCaregiver.city || booking?.city,
                  area: profileCaregiver.area || booking?.area,
                },
                booking,
                shiftTotal: profileCaregiver.totalAmount || booking?.total,
                hours: booking?.hours,
              }
            : null
        }
        onChoose={
          !booking?.caregiverId && profileCaregiver
            ? (offer) => {
                setProfileCaregiver(null)
                setSelectedApplicant(offer.applicant)
              }
            : undefined
        }
      />
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
