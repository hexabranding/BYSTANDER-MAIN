import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { MessageSquareReply, Repeat2, Star, ThumbsUp, Zap } from 'lucide-react'
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
import { Modal } from '@/components/common/Modal'
import { EmptyState } from '@/components/common/States'
import { Textarea } from '@/components/forms/FormField'

export function ReviewsPage() {
  useDocumentTitle('Reviews')

  const { user } = useAuth()
  const { reviews, caregivers } = useData()

  const myId = user?.caregiverId || 'cg-101'
  const caregiver = caregivers.find((c) => c.id === myId) || caregivers[0]

  const myReviews = useMemo(() => {
    const mine = reviews.filter((r) => r.caregiverId === myId)
    return mine.length ? mine : reviews
  }, [reviews, myId])

  const [query, setQuery] = useState('')
  const [ratingFilter, setRatingFilter] = useState('All')
  const [replies, setReplies] = useState({})
  const [replyTarget, setReplyTarget] = useState(null)
  const [replyText, setReplyText] = useState('')

  const avg = myReviews.length ? myReviews.reduce((sum, r) => sum + r.rating, 0) / myReviews.length : 0

  const distribution = useMemo(
    () =>
      [5, 4, 3, 2, 1].map((star) => {
        const count = myReviews.filter((r) => r.rating === star).length
        const pct = myReviews.length ? (count / myReviews.length) * 100 : 0
        return { star, count, pct }
      }),
    [myReviews],
  )

  const recommendPct = myReviews.length
    ? Math.round((myReviews.filter((r) => r.rating >= 4).length / myReviews.length) * 100)
    : 0

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return myReviews.filter((r) => {
      const matchesQuery = !q || [r.customerName, r.comment].join(' ').toLowerCase().includes(q)
      const matchesRating = ratingFilter === 'All' || r.rating === Number(ratingFilter)
      return matchesQuery && matchesRating
    })
  }, [myReviews, query, ratingFilter])

  const openReply = (review) => {
    setReplyTarget(review)
    setReplyText(replies[review.id] ?? review.reply ?? '')
  }

  const submitReply = () => {
    if (!replyTarget) return
    setReplies((prev) => ({ ...prev, [replyTarget.id]: replyText.trim() }))
    toast.success('Reply posted')
    setReplyTarget(null)
    setReplyText('')
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reviews & ratings"
        subtitle="What customers say after every shift — and how your rating stacks up across the platform."
        meta={<span className="text-sm text-muted">{myReviews.length} review{myReviews.length === 1 ? '' : 's'} collected</span>}
      />

      <Card>
        <CardBody>
          <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
            <div className="flex flex-col items-center justify-center rounded-card border border-line bg-slate-50/70 p-6 text-center">
              <p className="font-display text-5xl font-extrabold tabular-nums text-ink">{avg.toFixed(1)}</p>
              <RatingStars value={avg} size={20} className="mt-2" />
              <p className="mt-2 text-sm text-muted">Based on {myReviews.length} review{myReviews.length === 1 ? '' : 's'}</p>
            </div>
            <div className="space-y-3">
              {distribution.map((d) => (
                <div key={d.star} className="flex items-center gap-3">
                  <span className="flex w-10 shrink-0 items-center gap-1 text-xs font-semibold text-muted">
                    {d.star}
                    <Star className="h-3.5 w-3.5 fill-warning-400 text-warning-400" />
                  </span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-warning-400 transition-all duration-500" style={{ width: `${d.pct}%` }} />
                  </div>
                  <span className="w-8 shrink-0 text-right text-xs tabular-nums text-faint">{d.count}</span>
                </div>
              ))}
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Recommendation rate" value={`${recommendPct}%`} icon={ThumbsUp} tone="success" hint="4★ and above" delay={0} />
        <StatCard label="Repeat clients" value={caregiver?.repeatClients ?? 0} icon={Repeat2} tone="primary" hint="Customers who rebooked" delay={0.05} />
        <StatCard label="Response rate" value={`${caregiver?.responseRate ?? 0}%`} icon={Zap} tone="accent" hint="Replies within an hour" delay={0.1} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SearchBar value={query} onChange={setQuery} placeholder="Search customer or comment…" className="lg:col-span-3" />
        <div>
          <select
            aria-label="Filter by rating"
            value={ratingFilter}
            onChange={(e) => setRatingFilter(e.target.value)}
            className="h-11 w-full cursor-pointer appearance-none rounded-xl border border-line-strong bg-white px-3.5 text-sm text-ink transition focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100"
          >
            <option value="All">All ratings</option>
            <option value="5">5 stars</option>
            <option value="4">4 stars</option>
            <option value="3">3 stars</option>
            <option value="2">2 stars</option>
            <option value="1">1 star</option>
          </select>
        </div>
      </div>

      {filtered.length ? (
        <div className="space-y-4">
          {filtered.map((review) => {
            const reply = replies[review.id] ?? review.reply
            return (
              <Card key={review.id}>
                <CardBody className="space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={review.customerName} size="md" />
                      <div>
                        <p className="font-display text-sm font-bold text-ink">{review.customerName}</p>
                        <p className="text-xs text-muted">{formatDate(review.date, { long: true })}</p>
                      </div>
                    </div>
                    <RatingStars value={review.rating} size={16} showValue />
                  </div>

                  <p className="rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-ink-soft">{review.comment}</p>

                  {reply ? (
                    <div className="rounded-xl border border-primary-200 bg-mint-50 p-4">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-primary-700">Your reply</p>
                      <p className="mt-1.5 text-sm leading-relaxed text-primary-900/90">{reply}</p>
                    </div>
                  ) : (
                    <Button variant="outline" size="sm" icon={MessageSquareReply} onClick={() => openReply(review)}>
                      Reply to this review
                    </Button>
                  )}
                </CardBody>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon={Star}
            title="No reviews match"
            description="Try a different search term or rating filter to find what you are looking for."
            action={
              <Button
                variant="outline"
                onClick={() => {
                  setQuery('')
                  setRatingFilter('All')
                }}
              >
                Clear filters
              </Button>
            }
          />
        </Card>
      )}

      <Modal
        open={Boolean(replyTarget)}
        onClose={() => setReplyTarget(null)}
        title="Reply to review"
        subtitle={replyTarget ? `From ${replyTarget.customerName} · ${formatDate(replyTarget.date)}` : ''}
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setReplyTarget(null)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={submitReply} disabled={!replyText.trim()}>
              Post reply
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-muted">{replyTarget?.comment}</p>
          <div className="space-y-1.5">
            <label htmlFor="review-reply" className="text-sm font-semibold text-ink-soft">
              Your reply
            </label>
            <Textarea
              id="review-reply"
              rows={4}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Thank the customer, add context, and mention any follow-up…"
            />
            <p className="text-xs text-muted">Replies are public and appear directly under the review.</p>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default ReviewsPage
