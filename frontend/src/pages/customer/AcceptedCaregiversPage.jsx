import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  BadgeCheck,
  Briefcase,
  Building2,
  CalendarCheck,
  CalendarPlus,
  CheckCircle2,
  Clock,
  Heart,
  MapPin,
  MessageSquare,
  RotateCw,
  ShieldCheck,
  Star,
  User,
  Users,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'
import { useDocumentTitle } from '@/hooks/useUi'
import { useData } from '@/context/DataContext'
import { cn } from '@/utils/cn'
import { formatCurrency, formatDate, formatTime } from '@/utils/format'
import { formatDuration } from '@/utils/duration'
import { PageHeader } from '@/components/common/PageHeader'
import { Card } from '@/components/common/Card'
import { Button } from '@/components/common/Button'
import { Avatar } from '@/components/common/Avatar'
import { RatingStars } from '@/components/common/RatingStars'
import { EmptyState, CardSkeleton } from '@/components/common/States'
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog'
import { CaregiverReviewsModal } from '@/components/caregiver/CaregiverReviewsModal'
import { CaregiverProfileModal } from '@/components/caregiver/CaregiverProfileModal'
import { bookingService } from '@/services/bookingService'

export function AcceptedCaregiversPage() {
  useDocumentTitle('Accepted Caretakers')
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeBookingFilter = searchParams.get('bookingId') || 'all'

  const { shortlist, toggleShortlist } = useData()
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)

  // Modals state
  const [profileTarget, setProfileTarget] = useState(null)
  const [reviewsTarget, setReviewsTarget] = useState(null)
  const [confirmSelectTarget, setConfirmSelectTarget] = useState(null)

  const loadBookings = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true)
    setError(null)
    try {
      const res = await bookingService.getBookings({ limit: 50 })
      setBookings(res.bookings || [])
    } catch (err) {
      console.error('Failed to load customer bookings:', err)
      setError(err.message || 'Unable to load accepted caretakers')
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadBookings(true)
  }, [loadBookings])

  // Filter bookings that are pending and have at least one applicant
  const pendingWithApplicants = useMemo(() => {
    return (bookings || []).filter(
      (b) =>
        b.status?.toLowerCase() === 'pending' &&
        !b.caregiverId &&
        Array.isArray(b.applicants) &&
        b.applicants.length > 0
    )
  }, [bookings])

  // Flatten all applicant offers with their parent booking context
  const allApplicantOffers = useMemo(() => {
    const list = []
    pendingWithApplicants.forEach((booking) => {
      const bookingId = String(booking.id || booking._id)
      const hours = Number(booking.hours || booking.totalHours || 2)
      ;(booking.applicants || []).forEach((applicant) => {
        const applicantId = applicant.caregiverId || applicant.id
        const shiftTotal = applicant.totalAmount || Math.round((applicant.hourlyRate || 399) * hours)
        list.push({
          key: `${bookingId}_${applicantId}`,
          booking,
          bookingId,
          applicant,
          applicantId,
          hours,
          shiftTotal,
        })
      })
    })
    return list
  }, [pendingWithApplicants])

  // Filter by active booking pill if chosen
  const filteredOffers = useMemo(() => {
    if (activeBookingFilter === 'all') return allApplicantOffers
    return allApplicantOffers.filter((item) => item.bookingId === activeBookingFilter)
  }, [allApplicantOffers, activeBookingFilter])

  // Handle customer choosing a caretaker
  const handleSelectCaregiver = async () => {
    if (!confirmSelectTarget) return
    const { booking, applicant, shiftTotal } = confirmSelectTarget
    setActionLoading(true)

    try {
      const caregiverId = applicant.caregiverId || applicant.id
      const bookingId = booking.id || booking._id

      await bookingService.selectCaregiver(bookingId, caregiverId)

      toast.success('Caretaker Confirmed!', {
        description: `${applicant.name} has been confirmed for ${booking.serviceName || booking.service} (${formatCurrency(shiftTotal)}).`,
      })

      setConfirmSelectTarget(null)
      // Navigate to confirmed booking details
      navigate(`/customer/bookings/${bookingId}`)
    } catch (err) {
      toast.error('Failed to confirm caretaker', {
        description: err.message || 'Server rejected the selection. Please try again.',
      })
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Accepted Caretakers"
        subtitle="Verified caretakers who accepted your care requests. Compare ratings, qualifications, and rates to confirm your caretaker."
        meta={
          <span className="text-sm font-medium text-muted">
            {pendingWithApplicants.length} active request{pendingWithApplicants.length === 1 ? '' : 's'} ·{' '}
            <span className="font-semibold text-primary-700">{allApplicantOffers.length} caretaker offer{allApplicantOffers.length === 1 ? '' : 's'} available</span>
          </span>
        }
        action={
          <Button
            variant="ghost"
            size="sm"
            icon={RotateCw}
            onClick={() => loadBookings(true)}
            disabled={loading}
            className={loading ? 'animate-spin' : ''}
          >
            Refresh
          </Button>
        }
      />

      {/* Filter Tabs if customer has multiple active requests */}
      {pendingWithApplicants.length > 1 ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-line pb-3">
          <Button
            size="xs"
            variant={activeBookingFilter === 'all' ? 'primary' : 'outline'}
            onClick={() => setSearchParams({})}
          >
            All Caretakers ({allApplicantOffers.length})
          </Button>
          {pendingWithApplicants.map((b) => {
            const bId = String(b.id || b._id)
            const isSelected = activeBookingFilter === bId
            const ref = b.ref || `CM-${bId.slice(-6).toUpperCase()}`
            const patientName = b.patient?.name || b.patientDetails?.name || 'Patient'

            return (
              <Button
                key={bId}
                size="xs"
                variant={isSelected ? 'primary' : 'outline'}
                onClick={() => setSearchParams({ bookingId: bId })}
              >
                {ref} · {patientName} ({b.applicants?.length || 0})
              </Button>
            )
          })}
        </div>
      ) : null}

      {loading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <CardSkeleton count={3} />
        </div>
      ) : filteredOffers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredOffers.map((item) => {
            const { key, booking, bookingId, applicant, applicantId, hours, shiftTotal } = item
            const isShortlisted = (shortlist ?? []).includes(applicantId)
            const ratingValue = Number(applicant.rating || 5.0)
            const reviewsCount = Number(applicant.reviewCount || 0)
            const displayRef = booking.ref || `CM-${bookingId.slice(-6).toUpperCase()}`
            const patientName = booking.patient?.name || booking.patientDetails?.name || 'Patient'

            return (
              <article
                key={key}
                className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-card transition-all duration-200 hover:-translate-y-1 hover:border-primary-300 hover:shadow-raised"
              >
                {/* Top Booking Request Context Bar */}
                <div className="flex items-center justify-between border-b border-line/60 bg-gradient-to-r from-slate-50 via-mint-50/30 to-slate-50 px-4 py-2.5 text-xs">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="shrink-0 rounded-md bg-primary-100 px-2 py-0.5 text-[11px] font-bold text-primary-800">
                      {displayRef}
                    </span>
                    <span className="truncate font-semibold text-ink">
                      {booking.serviceName || booking.service}
                    </span>
                  </div>
                  {booking.isUrgent ? (
                    <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-extrabold uppercase text-red-700">
                      <Zap className="h-2.5 w-2.5 fill-current" />
                      Urgent
                    </span>
                  ) : null}
                </div>

                {/* Caretaker Header */}
                <div className="relative flex items-start gap-3.5 p-5 pb-3">
                  <button
                    type="button"
                    onClick={() => setProfileTarget(item)}
                    className="shrink-0 transition hover:opacity-85 cursor-pointer text-left focus:outline-none"
                    title="Click to view full profile & credentials"
                  >
                    <Avatar
                      src={applicant.photo || applicant.avatar}
                      name={applicant.name}
                      size="xl"
                      verified={true}
                    />
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-1">
                      <div className="min-w-0">
                        <h4 className="truncate font-display text-base font-bold text-ink">
                          <button
                            type="button"
                            onClick={() => setProfileTarget(item)}
                            className="transition hover:text-primary-700 cursor-pointer text-left truncate block w-full focus:outline-none"
                            title="Click to view full profile & credentials"
                          >
                            {applicant.name}
                          </button>
                        </h4>
                        <p className="truncate text-sm font-medium text-primary-700">
                          {applicant.qualification || 'Certified Caretaker'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          toggleShortlist(applicantId)
                          toast.success(
                            isShortlisted
                              ? `${applicant.name} removed from shortlist`
                              : `${applicant.name} saved to shortlist`
                          )
                        }}
                        className={cn(
                          'grid h-8 w-8 shrink-0 place-items-center rounded-lg transition cursor-pointer',
                          isShortlisted
                            ? 'bg-danger-50 text-danger-500'
                            : 'text-faint hover:bg-danger-50 hover:text-danger-500'
                        )}
                        title={isShortlisted ? 'Remove from shortlist' : 'Save to shortlist'}
                      >
                        <Heart className={cn('h-4 w-4', isShortlisted && 'fill-current')} />
                      </button>
                    </div>

                    {/* Rating Stars & Reviews Trigger */}
                    <div className="mt-1.5 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setProfileTarget({ ...item, initialTab: 'reviews' })}
                        className="group/rate inline-flex items-center gap-1.5 transition hover:opacity-80 cursor-pointer"
                        title="Click to view verified reviews"
                      >
                        <RatingStars value={ratingValue} size={13} />
                        <span className="text-xs font-bold text-ink underline decoration-dotted underline-offset-2">
                          {ratingValue.toFixed(1)}
                        </span>
                        <span className="text-xs font-semibold text-primary-700 group-hover/rate:underline">
                          ({reviewsCount} review{reviewsCount === 1 ? '' : 's'})
                        </span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Metadata Details */}
                <div className="space-y-2 px-5 text-sm text-muted">
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 shrink-0 text-faint" />
                    <span>{applicant.experienceYears || 2} years professional experience</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 shrink-0 text-faint" />
                    <span className="truncate">
                      {applicant.area || 'Palayam'}, {applicant.city || 'Kozhikode'} ·{' '}
                      {applicant.distanceKm || 3.2} km away
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 shrink-0 text-faint" />
                    <span className="truncate">
                      {formatDate(booking.date)} · {booking.shift || `${booking.startTime} (${hours}h)`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-faint">
                    <User className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">
                      Patient: <span className="font-medium text-ink">{patientName}</span> ({booking.patient?.relation || booking.patientDetails?.relation || 'Family'})
                    </span>
                  </div>
                </div>

                {/* Badges / Verification Tags */}
                <div className="mt-3 flex flex-wrap gap-1.5 px-5">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold border',
                      applicant.gender === 'Male'
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : 'bg-pink-50 text-pink-700 border-pink-200'
                    )}
                  >
                    {applicant.gender === 'Male' ? '👨 Male' : '👩 Female'}
                  </span>
                  {(applicant.badges || ['ID Verified', 'Background Checked']).slice(0, 2).map((badge) => (
                    <span
                      key={badge}
                      className="inline-flex items-center gap-1 rounded-md bg-mint-100 px-2 py-0.5 text-[11px] font-semibold text-primary-800"
                    >
                      <BadgeCheck className="h-3 w-3" />
                      {badge}
                    </span>
                  ))}
                </div>

                {/* Pricing & Selection Actions */}
                <div className="mt-auto border-t border-line px-5 py-4">
                  <div className="flex items-baseline justify-between gap-2">
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-faint">Caretaker Rate</p>
                      <p className="font-display text-lg font-black text-ink">
                        {formatCurrency(applicant.hourlyRate)}
                        <span className="text-xs font-normal text-muted"> / hr</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] uppercase tracking-wide text-faint">Total for {hours} hrs</p>
                      <p className="font-display text-xl font-black text-primary-700">
                        {formatCurrency(shiftTotal)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3.5 flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      icon={User}
                      onClick={() => setProfileTarget(item)}
                    >
                      View Profile
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      className="flex-1"
                      icon={CheckCircle2}
                      onClick={() =>
                        setConfirmSelectTarget({
                          booking,
                          applicant,
                          shiftTotal,
                          hours,
                        })
                      }
                    >
                      Choose Caretaker
                    </Button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon={Users}
            title="No accepted caretakers found"
            description="When caretakers accept your open broadcast requests, their profiles, qualifications, ratings, and rates will appear here for you to compare and choose."
            action={
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Button to="/customer/book-caregiver" icon={CalendarPlus}>
                  Book a Caretaker
                </Button>
                <Button to="/customer/bookings" variant="outline">
                  View My Bookings
                </Button>
              </div>
            }
          />
        </Card>
      )}

      {/* In-Page Caretaker Profile & Reviews Modal */}
      <CaregiverProfileModal
        open={Boolean(profileTarget)}
        onClose={() => setProfileTarget(null)}
        offer={profileTarget}
        onChoose={(targetOffer) => setConfirmSelectTarget(targetOffer)}
        isShortlisted={(shortlist ?? []).includes(profileTarget?.applicantId)}
        onToggleShortlist={(id) => {
          toggleShortlist(id)
          toast.success(
            (shortlist ?? []).includes(id)
              ? 'Removed from shortlist'
              : 'Saved to shortlist'
          )
        }}
      />

      {/* Reviews Modal */}
      <CaregiverReviewsModal
        open={Boolean(reviewsTarget)}
        onClose={() => setReviewsTarget(null)}
        caregiver={reviewsTarget}
      />

      {/* Confirmation Dialog to Lock in Selection */}
      <ConfirmationDialog
        open={Boolean(confirmSelectTarget)}
        onClose={() => setConfirmSelectTarget(null)}
        onConfirm={handleSelectCaregiver}
        tone="success"
        title="Confirm Caretaker Selection?"
        message={
          confirmSelectTarget
            ? `Confirm ${confirmSelectTarget.applicant.name} for ${confirmSelectTarget.booking.serviceName || confirmSelectTarget.booking.service} on ${formatDate(confirmSelectTarget.booking.date, { long: true })} at ${formatCurrency(confirmSelectTarget.shiftTotal)} total (${confirmSelectTarget.hours} hrs). This will lock in the shift with this caretaker immediately.`
            : ''
        }
        confirmLabel={actionLoading ? 'Confirming…' : 'Confirm Caretaker'}
      />
    </div>
  )
}

export default AcceptedCaregiversPage
