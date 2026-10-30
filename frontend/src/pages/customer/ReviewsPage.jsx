import { useCallback, useEffect, useMemo, useState } from 'react'
import { Award, MessageSquare, Star, ThumbsUp } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useData } from '@/context/DataContext'
import { useDocumentTitle } from '@/hooks/useUi'
import { formatDate } from '@/utils/format'
import { Button } from '@/components/common/Button'
import { Card, CardBody } from '@/components/common/Card'
import { StatCard } from '@/components/common/StatCard'
import { PageHeader } from '@/components/common/PageHeader'
import { SearchBar } from '@/components/common/SearchBar'
import { Avatar } from '@/components/common/Avatar'
import { RatingStars } from '@/components/common/RatingStars'
import { Tabs } from '@/components/common/Tabs'
import { EmptyState, ErrorState, CardSkeleton } from '@/components/common/States'
import { reviewService } from '@/services/reviewService'

const REVIEW_TABS = [
  { id: 'written', label: "Reviews I've written" },
  { id: 'received', label: 'Feedback from caretakers' },
]

export function ReviewsPage() {
  useDocumentTitle('My reviews')

  const { user } = useAuth()
  const { caregivers, bookings } = useData()
  const [activeTab, setActiveTab] = useState('written')
  const [realReviews, setRealReviews] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')
  const [ratingFilter, setRatingFilter] = useState('All')

  const fetchReviews = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await reviewService.getMyReviews({ type: activeTab })
      setRealReviews(res.reviews || [])
    } catch (err) {
      setError(err?.message || 'Unable to load reviews from server')
      setRealReviews([])
    } finally {
      setLoading(false)
    }
  }, [activeTab])

  useEffect(() => {
    fetchReviews()
  }, [fetchReviews])

  const mine = useMemo(() => realReviews || [], [realReviews])

  const avg = mine.length ? mine.reduce((sum, r) => sum + r.rating, 0) / mine.length : 0

  const recommendPct = mine.length
    ? Math.round((mine.filter((r) => r.rating >= 4).length / mine.length) * 100)
    : 0

  const completedBookingsCount = useMemo(() => {
    const currentUserId = user?.id || user?._id
    if (!currentUserId || !bookings?.length) return mine.length
    const count = bookings.filter(
      (b) =>
        (b.customerId === currentUserId ||
          b.customer === currentUserId ||
          b.customer?._id === currentUserId) &&
        (b.status === 'Completed' || b.status === 'completed'),
    ).length
    return Math.max(count, mine.length)
  }, [bookings, user, mine.length])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return mine.filter((r) => {
      const caregiverName =
        r.caregiverUser?.fullName ||
        r.caregiver?.fullName ||
        caregivers?.find((c) => c.id === (r.caregiverId || r.caregiver?._id || r.caregiver))?.name ||
        ''
      const bookingLabel =
        r.booking?.serviceName || r.booking?._id || r.bookingId || ''
      const matchesQuery =
        !q || [caregiverName, r.comment, bookingLabel].join(' ').toLowerCase().includes(q)
      const matchesRating = ratingFilter === 'All' || r.rating === Number(ratingFilter)
      return matchesQuery && matchesRating
    })
  }, [mine, caregivers, query, ratingFilter])

  return (
    <div className="space-y-6">
      <PageHeader
        title="My reviews"
        subtitle={
          activeTab === 'written'
            ? 'Every rating you have left after a care visit, and what happened next.'
            : 'Ratings and feedback caretakers left about you after completing shifts.'
        }
        meta={
          <span className="text-sm text-muted">
            {mine.length} {activeTab === 'written' ? 'review' : 'caretaker review'}{mine.length === 1 ? '' : 's'}
          </span>
        }
      />

      <Tabs
        tabs={REVIEW_TABS.map((t) => ({ ...t, count: t.id === activeTab ? mine.length : undefined }))}
        active={activeTab}
        onChange={(tabId) => {
          setActiveTab(tabId)
          setQuery('')
          setRatingFilter('All')
        }}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label={activeTab === 'written' ? 'Average rating given' : 'Average rating from caretakers'}
          value={mine.length ? avg.toFixed(1) : '—'}
          icon={Star}
          tone="accent"
          hint={activeTab === 'written' ? 'Across all your reviews' : 'Rated by verified caretakers'}
          delay={0}
        />
        <StatCard
          label={activeTab === 'written' ? 'Would recommend' : 'Positive experiences'}
          value={mine.length ? `${recommendPct}%` : '—'}
          icon={ThumbsUp}
          tone="success"
          hint="4★ and above"
          delay={0.05}
        />
        <StatCard
          label={activeTab === 'written' ? 'Bookings reviewed' : 'Visits rated'}
          value={activeTab === 'written' ? `${mine.length} / ${completedBookingsCount}` : `${mine.length} / ${completedBookingsCount}`}
          icon={activeTab === 'written' ? MessageSquare : Award}
          tone="primary"
          hint={activeTab === 'written' ? 'Completed visits rated' : 'Visits with caretaker review'}
          delay={0.1}
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchBar
          value={query}
          onChange={setQuery}
          placeholder="Search caretaker or comment…"
          className="sm:max-w-sm sm:flex-1"
        />
        <select
          aria-label="Filter by rating"
          value={ratingFilter}
          onChange={(e) => setRatingFilter(e.target.value)}
          className="h-11 w-full cursor-pointer appearance-none rounded-xl border border-line-strong bg-white px-3.5 text-sm text-ink transition focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100 sm:w-auto"
        >
          <option value="All">All ratings</option>
          <option value="5">5 stars</option>
          <option value="4">4 stars</option>
          <option value="3">3 stars</option>
          <option value="2">2 stars</option>
          <option value="1">1 star</option>
        </select>
      </div>

      {loading ? (
        <CardSkeleton count={3} />
      ) : error ? (
        <Card>
          <ErrorState
            title="Failed to load your reviews"
            description={error}
            onRetry={fetchReviews}
          />
        </Card>
      ) : filtered.length ? (
        <div className="space-y-4">
          {filtered.map((review) => {
            const caregiver = caregivers?.find(
              (c) => c.id === (review.caregiverId || review.caregiver?._id || review.caregiver),
            )
            const caregiverName =
              review.caregiverUser?.fullName ||
              review.caregiver?.user?.fullName ||
              caregiver?.name ||
              'Bystander caretaker'
            const caregiverPhoto =
              review.caregiverUser?.avatar ||
              review.caregiver?.avatar ||
              caregiver?.photo

            const booking = bookings?.find(
              (b) => b.id === (review.booking?._id || review.bookingId || review.booking),
            )
            const targetBookingId =
              review.booking?._id || review.booking?.id || review.bookingId || review.booking
            const bookingTitle =
              review.booking?.serviceName ||
              booking?.serviceName ||
              (targetBookingId ? `Booking #${String(targetBookingId).slice(-6)}` : 'Booking')

            const targetCaregiverId =
              review.caregiver?._id || review.caregiver?.id || review.caregiverId

            return (
              <Card key={review._id || review.id}>
                <CardBody className="space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Avatar src={caregiverPhoto} name={caregiverName} size="md" />
                      <div>
                        <p className="font-display text-sm font-bold text-ink">
                          {caregiverName}
                        </p>
                        <p className="text-xs text-muted">
                          {bookingTitle} ·{' '}
                          {formatDate(review.createdAt || review.date || review.at, { long: true })}
                        </p>
                      </div>
                    </div>
                    <RatingStars value={review.rating} size={16} showValue />
                  </div>

                  <p className="rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-ink-soft">
                    {review.comment}
                  </p>

                  {review.criteria && typeof review.criteria === 'object' && Object.keys(review.criteria).length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(review.criteria).map(([k, v]) => (
                        <span key={k} className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-ink-soft">
                          <span className="capitalize">{k.replace(/([A-Z])/g, ' $1')}</span>:
                          <span className="font-bold text-amber-600">{v}★</span>
                        </span>
                      ))}
                    </div>
                  ) : null}

                  {review.reply ? (
                    <div className="rounded-xl border border-primary-200 bg-mint-50 p-4">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-primary-700">
                        {caregiverName} replied
                      </p>
                      <p className="mt-1.5 text-sm leading-relaxed text-primary-900/90">{review.reply}</p>
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-2 border-t border-line pt-3">
                    {targetBookingId ? (
                      <Button
                        variant="outline"
                        size="sm"
                        to={`/customer/bookings/${targetBookingId}`}
                      >
                        View booking
                      </Button>
                    ) : null}
                    {targetCaregiverId ? (
                      <Button variant="ghost" size="sm" to={`/caregivers/${targetCaregiverId}`}>
                        View caretaker profile
                      </Button>
                    ) : null}
                  </div>
                </CardBody>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon={Star}
            title={
              mine.length
                ? 'No reviews match'
                : activeTab === 'received'
                  ? 'No reviews from caretakers yet'
                  : 'You have not reviewed a visit yet'
            }
            description={
              mine.length
                ? 'Try a different search term or rating filter.'
                : activeTab === 'received'
                  ? 'Once a caretaker completes a shift, their feedback and ratings about their visit experience will appear here.'
                  : 'Once a booking is marked Completed you can rate your caretaker from the booking page. Reviews help other families choose with confidence.'
            }
            action={
              mine.length ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setQuery('')
                    setRatingFilter('All')
                  }}
                >
                  Clear filters
                </Button>
              ) : (
                <Button to="/customer/bookings" icon={MessageSquare}>
                  Go to my bookings
                </Button>
              )
            }
          />
        </Card>
      )}
    </div>
  )
}

export default ReviewsPage
