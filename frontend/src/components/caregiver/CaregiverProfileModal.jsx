import { useEffect, useState } from 'react'
import {
  BadgeCheck,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Heart,
  Languages,
  MapPin,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Star,
  ThumbsUp,
  User,
  Zap,
} from 'lucide-react'
import { Modal } from '@/components/common/Modal'
import { Avatar } from '@/components/common/Avatar'
import { RatingStars } from '@/components/common/RatingStars'
import { Button } from '@/components/common/Button'
import { EmptyState } from '@/components/common/States'
import { cn } from '@/utils/cn'
import { formatCurrency, formatDate } from '@/utils/format'
import { caregiversService } from '@/services/caregiversService'
import { reviewService } from '@/services/reviewService'

export function CaregiverProfileModal({
  open,
  onClose,
  offer,
  onChoose,
  isShortlisted = false,
  onToggleShortlist,
}) {
  const [activeTab, setActiveTab] = useState('overview')
  const [detailedProfile, setDetailedProfile] = useState(null)
  const [loadingProfile, setLoadingProfile] = useState(false)
  const [reviews, setReviews] = useState([])
  const [loadingReviews, setLoadingReviews] = useState(false)

  const applicant = offer?.applicant
  const booking = offer?.booking
  const shiftTotal = offer?.shiftTotal
  const hours = offer?.hours || 2

  const caregiverId = applicant?.caregiverId || applicant?.id || applicant?._id

  // Synchronize initial tab and fetch live details when opened
  useEffect(() => {
    if (!open || !caregiverId) {
      setDetailedProfile(null)
      setReviews([])
      return
    }

    if (offer?.initialTab) {
      setActiveTab(offer.initialTab)
    } else {
      setActiveTab('overview')
    }

    let isMounted = true

    // 1. Fetch full caregiver profile
    const fetchDetails = async () => {
      setLoadingProfile(true)
      try {
        const res = await caregiversService.fetchPublicCaregiverById(caregiverId)
        if (isMounted && res?.data) {
          setDetailedProfile(res.data)
        }
      } catch (err) {
        console.warn('Could not load extra caregiver details:', err)
      } finally {
        if (isMounted) setLoadingProfile(false)
      }
    }

    // 2. Fetch reviews
    const fetchReviews = async () => {
      setLoadingReviews(true)
      try {
        const res = await reviewService.getCaregiverReviews(caregiverId)
        if (isMounted && res?.reviews) {
          setReviews(res.reviews)
        }
      } catch (err) {
        console.warn('Could not load caregiver reviews:', err)
      } finally {
        if (isMounted) setLoadingReviews(false)
      }
    }

    fetchDetails()
    fetchReviews()

    return () => {
      isMounted = false
    }
  }, [open, caregiverId, offer?.initialTab])

  if (!applicant) return null

  // Merged profile data
  const name = detailedProfile?.name || applicant.name || 'Caretaker'
  const photo = detailedProfile?.photo || detailedProfile?.avatar || applicant.photo || applicant.avatar
  const qualification = detailedProfile?.qualification || applicant.qualification || 'Certified Caretaker'
  const experienceYears = detailedProfile?.experienceYears || applicant.experienceYears || 2
  const ratingValue = Number(detailedProfile?.rating || applicant.rating || 5.0)
  const reviewsCount = Number(
    detailedProfile?.reviewCount ?? (reviews.length || applicant.reviewCount || 0)
  )
  const hourlyRate = Number(applicant.hourlyRate || detailedProfile?.hourlyRate || 399)
  const city = detailedProfile?.city || applicant.city || 'Kozhikode'
  const area = detailedProfile?.area || applicant.area || 'Palayam'
  const distanceKm = detailedProfile?.distanceKm || applicant.distanceKm || 3.2
  const gender = detailedProfile?.gender || applicant.gender || 'Male'
  const bio =
    detailedProfile?.bio ||
    applicant.bio ||
    'Dedicated and compassionate healthcare professional with practical patient monitoring, mobility support, and elder care experience. Trained to follow strict hygiene and safety protocols.'
  const badges = detailedProfile?.badges?.length
    ? detailedProfile.badges
    : applicant.badges?.length
      ? applicant.badges
      : ['ID Verified', 'Background Checked', 'Certified Caretaker']
  const languages = detailedProfile?.languages?.length
    ? detailedProfile.languages
    : ['Malayalam', 'English', 'Hindi']
  const services = detailedProfile?.services?.length
    ? detailedProfile.services
    : ['Patient Monitoring', 'Elder Care Assistance', 'Mobility & Transfer', 'Medication Reminders']
  const careSettings = detailedProfile?.careSettings?.length
    ? detailedProfile.careSettings
    : ['Home Care', 'Hospital Bystander']

  const displayRef = booking?.ref || (booking?.id ? `CM-${booking.id.slice(-6).toUpperCase()}` : null)
  const patientName = booking?.patient?.name || booking?.patientDetails?.name || 'Patient'

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={name}
      subtitle={`${qualification} · ${area}, ${city}`}
      size="xl"
      footer={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between w-full">
          <div>
            <p className="text-xs uppercase tracking-wide text-faint">Accepted Shift Rate</p>
            <div className="flex items-baseline gap-2">
              <span className="font-display text-xl font-black text-primary-700">
                {formatCurrency(shiftTotal || hourlyRate * hours)}
              </span>
              <span className="text-xs text-muted">
                ({formatCurrency(hourlyRate)}/hr × {hours} hrs)
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
            {onChoose ? (
              <Button
                variant="primary"
                size="sm"
                icon={CheckCircle2}
                onClick={() => {
                  onClose()
                  onChoose(offer)
                }}
              >
                Choose This Caretaker
              </Button>
            ) : null}
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Top Caretaker Profile Hero */}
        <div className="relative overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-mint-50/60 via-white to-slate-50 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <Avatar src={photo} name={name} size="2xl" verified={true} />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-display text-xl font-bold text-ink">{name}</h3>
                  {onToggleShortlist ? (
                    <button
                      type="button"
                      onClick={() => onToggleShortlist(caregiverId)}
                      className={cn(
                        'grid h-8 w-8 place-items-center rounded-lg transition cursor-pointer',
                        isShortlisted
                          ? 'bg-danger-50 text-danger-500'
                          : 'text-faint hover:bg-danger-50 hover:text-danger-500'
                      )}
                      title={isShortlisted ? 'Remove from shortlist' : 'Save to shortlist'}
                    >
                      <Heart className={cn('h-4 w-4', isShortlisted && 'fill-current')} />
                    </button>
                  ) : null}
                </div>

                <p className="text-sm font-semibold text-primary-700 mt-0.5">{qualification}</p>

                <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted">
                  <div className="flex items-center gap-1.5">
                    <RatingStars value={ratingValue} size={13} />
                    <span className="font-bold text-ink">{ratingValue.toFixed(1)}</span>
                    <span>({reviewsCount} reviews)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Briefcase className="h-3.5 w-3.5 text-faint" />
                    <span>{experienceYears} yrs experience</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-faint" />
                    <span>
                      {area}, {city} · {distanceKm} km away
                    </span>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold border',
                      gender === 'Male'
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : 'bg-pink-50 text-pink-700 border-pink-200'
                    )}
                  >
                    {gender === 'Male' ? '👨 Male Caretaker' : '👩 Female Caretaker'}
                  </span>
                  {badges.map((badge) => (
                    <span
                      key={badge}
                      className="inline-flex items-center gap-1 rounded-md bg-mint-100 px-2 py-0.5 text-[11px] font-semibold text-primary-800"
                    >
                      <BadgeCheck className="h-3 w-3" />
                      {badge}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center justify-between rounded-xl border border-primary-200/70 bg-white/90 p-3 sm:flex-col sm:items-end sm:justify-center sm:text-right">
              <span className="text-[11px] uppercase tracking-wide text-faint">Hourly Rate</span>
              <span className="font-display text-2xl font-black text-ink">
                {formatCurrency(hourlyRate)}
                <span className="text-xs font-normal text-muted">/hr</span>
              </span>
            </div>
          </div>
        </div>

        {/* Current Booking Request Shift Context Banner */}
        {booking ? (
          <div className="rounded-xl border border-primary-200/80 bg-mint-50/50 p-4">
            <div className="flex items-center justify-between gap-2 border-b border-primary-100 pb-2.5 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold uppercase tracking-wider text-primary-900">
                  Accepted Offer For:
                </span>
                {displayRef ? (
                  <span className="rounded bg-primary-100 px-2 py-0.5 font-bold text-primary-800">
                    {displayRef}
                  </span>
                ) : null}
                <span className="font-semibold text-ink">
                  {booking.serviceName || booking.service}
                </span>
              </div>
              {booking.isUrgent ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-extrabold uppercase text-red-700">
                  <Zap className="h-2.5 w-2.5 fill-current" /> Urgent
                </span>
              ) : null}
            </div>

            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-muted">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 shrink-0 text-primary-700" />
                <div>
                  <p className="font-semibold text-ink">{formatDate(booking.date)}</p>
                  <p className="text-[11px]">Shift Date</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 shrink-0 text-primary-700" />
                <div>
                  <p className="font-semibold text-ink">
                    {booking.shift || `${booking.startTime} (${hours}h)`}
                  </p>
                  <p className="text-[11px]">Shift Timing ({hours} hours)</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 shrink-0 text-primary-700" />
                <div>
                  <p className="font-semibold text-ink">{patientName}</p>
                  <p className="text-[11px]">
                    Patient ({booking.patient?.relation || booking.patientDetails?.relation || 'Family'})
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* Tab Switcher */}
        <div className="flex border-b border-line">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={cn(
              'border-b-2 px-5 py-2.5 text-sm font-semibold transition cursor-pointer',
              activeTab === 'overview'
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-muted hover:text-ink'
            )}
          >
            Overview & Background
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('reviews')}
            className={cn(
              'flex items-center gap-2 border-b-2 px-5 py-2.5 text-sm font-semibold transition cursor-pointer',
              activeTab === 'reviews'
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-muted hover:text-ink'
            )}
          >
            <span>Verified Reviews</span>
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-xs',
                activeTab === 'reviews'
                  ? 'bg-primary-100 text-primary-800'
                  : 'bg-slate-100 text-muted'
              )}
            >
              {reviewsCount}
            </span>
          </button>
        </div>

        {/* Tab 1: Overview & Background */}
        {activeTab === 'overview' ? (
          <div className="space-y-5">
            {/* About / Bio */}
            <div>
              <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-faint">
                <Sparkles className="h-3.5 w-3.5 text-primary-600" />
                About Caretaker
              </h4>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft bg-slate-50 rounded-xl p-3.5 border border-line/60">
                {bio}
              </p>
            </div>

            {/* Trust & Safety Checklist */}
            <div className="rounded-xl border border-primary-100 bg-mint-50/30 p-4">
              <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary-900">
                <ShieldCheck className="h-4 w-4 text-primary-700" />
                Bystander Trust & Verification Standard
              </h4>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-ink-soft">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-primary-600" />
                  <span>Government ID / Aadhaar Verified</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-primary-600" />
                  <span>Police Clearance & Background Verified</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-primary-600" />
                  <span>Practical Skills & Experience Vetted</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-primary-600" />
                  <span>Bystander Escrow & Code of Conduct Bound</span>
                </div>
              </div>
            </div>

            {/* Grid of Details: Languages, Services, Settings */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Languages */}
              <div className="rounded-xl border border-line p-3.5">
                <h5 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-faint">
                  <Languages className="h-3.5 w-3.5 text-primary-600" />
                  Languages
                </h5>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {languages.map((lang) => (
                    <span
                      key={lang}
                      className="rounded-md border border-line bg-white px-2 py-0.5 text-xs font-medium text-ink"
                    >
                      {lang}
                    </span>
                  ))}
                </div>
              </div>

              {/* Care Settings */}
              <div className="rounded-xl border border-line p-3.5">
                <h5 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-faint">
                  <Building2 className="h-3.5 w-3.5 text-primary-600" />
                  Care Settings
                </h5>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {careSettings.map((set) => (
                    <span
                      key={set}
                      className="rounded-md border border-line bg-white px-2 py-0.5 text-xs font-medium text-ink"
                    >
                      {set}
                    </span>
                  ))}
                </div>
              </div>

              {/* Experience */}
              <div className="rounded-xl border border-line p-3.5">
                <h5 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-faint">
                  <Briefcase className="h-3.5 w-3.5 text-primary-600" />
                  Experience
                </h5>
                <p className="mt-2.5 text-sm font-semibold text-ink">
                  {experienceYears} Years
                </p>
                <p className="text-xs text-muted">Specialized in elder and hospital support</p>
              </div>
            </div>

            {/* Skills & Services Offered */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-faint">
                Key Caretaker Services & Skills
              </h4>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {services.map((svc) => (
                  <span
                    key={svc}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-2.5 py-1 text-xs font-medium text-ink-soft shadow-2xs"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-primary-500" />
                    {svc}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {/* Tab 2: Reviews */}
        {activeTab === 'reviews' ? (
          <div className="space-y-4">
            {/* Reviews Summary Header */}
            <div className="flex flex-col gap-3 rounded-xl border border-primary-100 bg-mint-50/50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="font-display text-3xl font-black text-ink">
                  {ratingValue.toFixed(1)}
                </div>
                <div>
                  <RatingStars value={ratingValue} size={16} />
                  <p className="text-xs font-medium text-muted">
                    Based on {reviewsCount} verified patient feedback
                  </p>
                </div>
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-primary-800 border border-primary-200">
                <ShieldCheck className="h-4 w-4 text-primary-600" />
                Verified Bystander Reviews
              </div>
            </div>

            {/* Reviews List */}
            {loadingReviews ? (
              <div className="space-y-2 py-8 text-center text-sm text-muted">
                <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
                <p>Loading verified reviews…</p>
              </div>
            ) : reviews.length > 0 ? (
              <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
                {reviews.map((r) => {
                  const reviewerName =
                    r.customerName || r.customer?.fullName || r.customer?.name || 'Verified Family'
                  return (
                    <div
                      key={r._id || r.id}
                      className="rounded-xl border border-line bg-white p-4 shadow-2xs transition hover:border-primary-200"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Avatar name={reviewerName} size="sm" />
                          <div>
                            <p className="text-xs font-bold text-ink">{reviewerName}</p>
                            <p className="text-[10px] text-faint">
                              {r.createdAt ? formatDate(r.createdAt) : 'Recent Booking'}
                            </p>
                          </div>
                        </div>
                        <RatingStars value={Number(r.rating || 5)} size={13} />
                      </div>
                      <p className="mt-2.5 text-xs leading-relaxed text-ink-soft">
                        "{r.comment || r.review || 'Very prompt, caring, and professional.'}"
                      </p>
                    </div>
                  )
                })}
              </div>
            ) : (
              <EmptyState
                icon={MessageSquare}
                title="No reviews yet"
                description={`${name} is ready for new bookings. Once a shift completes, verified feedback from the family appears here.`}
              />
            )}
          </div>
        ) : null}
      </div>
    </Modal>
  )
}

export default CaregiverProfileModal
