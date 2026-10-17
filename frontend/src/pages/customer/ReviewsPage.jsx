import { useMemo, useState } from 'react'
import { MessageSquare, Star, ThumbsUp } from 'lucide-react'
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
import { EmptyState } from '@/components/common/States'

export function ReviewsPage() {
  useDocumentTitle('My reviews')

  const { user } = useAuth()
  const { reviews, caregivers, bookings } = useData()
  const [query, setQuery] = useState('')
  const [ratingFilter, setRatingFilter] = useState('All')

  const customerId = user?.id || 'cu-201'

  const mine = useMemo(
    () => reviews.filter((r) => r.customerId === customerId),
    [reviews, customerId],
  )

  const avg = mine.length ? mine.reduce((sum, r) => sum + r.rating, 0) / mine.length : 0

  const recommendPct = mine.length
    ? Math.round((mine.filter((r) => r.rating >= 4).length / mine.length) * 100)
    : 0

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return mine.filter((r) => {
      const caregiver = caregivers.find((c) => c.id === r.caregiverId)
      const matchesQuery =
        !q || [caregiver?.name, r.comment, r.bookingId].join(' ').toLowerCase().includes(q)
      const matchesRating = ratingFilter === 'All' || r.rating === Number(ratingFilter)
      return matchesQuery && matchesRating
    })
  }, [mine, caregivers, query, ratingFilter])

  return (
    <div className="space-y-6">
      <PageHeader
        title="My reviews"
        subtitle="Every rating you have left after a care visit, and what happened next."
        meta={
          <span className="text-sm text-muted">
            {mine.length} review{mine.length === 1 ? '' : 's'} written
          </span>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Average rating given"
          value={mine.length ? avg.toFixed(1) : '—'}
          icon={Star}
          tone="accent"
          hint="Across all your reviews"
          delay={0}
        />
        <StatCard
          label="Would recommend"
          value={mine.length ? `${recommendPct}%` : '—'}
          icon={ThumbsUp}
          tone="success"
          hint="4★ and above"
          delay={0.05}
        />
        <StatCard
          label="Bookings reviewed"
          value={`${mine.length} / ${bookings.filter((b) => b.customerId === customerId && b.status === 'Completed').length}`}
          icon={MessageSquare}
          tone="primary"
          hint="Completed visits rated"
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

      {filtered.length ? (
        <div className="space-y-4">
          {filtered.map((review) => {
            const caregiver = caregivers.find((c) => c.id === review.caregiverId)
            const booking = bookings.find((b) => b.id === review.bookingId)
            return (
              <Card key={review.id}>
                <CardBody className="space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Avatar src={caregiver?.photo} name={caregiver?.name || 'Caretaker'} size="md" />
                      <div>
                        <p className="font-display text-sm font-bold text-ink">
                          {caregiver?.name || 'CareMate caretaker'}
                        </p>
                        <p className="text-xs text-muted">
                          {review.bookingId || booking?.id || 'Booking'} ·{' '}
                          {formatDate(review.date || review.at, { long: true })}
                        </p>
                      </div>
                    </div>
                    <RatingStars value={review.rating} size={16} showValue />
                  </div>

                  <p className="rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-ink-soft">
                    {review.comment}
                  </p>

                  {review.reply ? (
                    <div className="rounded-xl border border-primary-200 bg-mint-50 p-4">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-primary-700">
                        {caregiver?.name || 'Caretaker'} replied
                      </p>
                      <p className="mt-1.5 text-sm leading-relaxed text-primary-900/90">{review.reply}</p>
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-2 border-t border-line pt-3">
                    {booking ? (
                      <Button
                        variant="outline"
                        size="sm"
                        to={`/customer/bookings/${booking.id}`}
                      >
                        View booking
                      </Button>
                    ) : null}
                    {caregiver ? (
                      <Button variant="ghost" size="sm" to={`/caregivers/${caregiver.id}`}>
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
            title={mine.length ? 'No reviews match' : 'You have not reviewed a visit yet'}
            description={
              mine.length
                ? 'Try a different search term or rating filter.'
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
