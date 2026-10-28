import { useEffect, useState } from 'react'
import { Star, ShieldCheck, MessageSquare, ThumbsUp } from 'lucide-react'
import { Modal } from '@/components/common/Modal'
import { RatingStars } from '@/components/common/RatingStars'
import { Avatar } from '@/components/common/Avatar'
import { Button } from '@/components/common/Button'
import { EmptyState } from '@/components/common/States'
import { formatDate } from '@/utils/format'
import { reviewService } from '@/services/reviewService'

export function CaregiverReviewsModal({ open, onClose, caregiver }) {
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!open || !caregiver) return

    const fetchReviews = async () => {
      setLoading(true)
      setError(null)
      try {
        const id = caregiver.caregiverId || caregiver.id || caregiver._id
        const res = await reviewService.getCaregiverReviews(id)
        setReviews(res.reviews || [])
      } catch (err) {
        console.warn('Failed to load caregiver reviews:', err)
        setReviews([])
      } finally {
        setLoading(false)
      }
    }

    fetchReviews()
  }, [open, caregiver])

  if (!caregiver) return null

  const averageRating = Number(
    typeof caregiver.rating === 'object'
      ? caregiver.rating.average ?? 5.0
      : caregiver.rating ?? 5.0
  )
  const reviewCount = Number(
    typeof caregiver.rating === 'object'
      ? caregiver.rating.count ?? reviews.length
      : caregiver.reviewCount ?? reviews.length
  )

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${caregiver.name || 'Caretaker'}'s Reviews`}
      subtitle={`${caregiver.qualification || 'Certified Caretaker'} · ${caregiver.city || 'Kozhikode'}`}
      size="lg"
      footer={
        <div className="flex w-full justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Rating Overview Banner */}
        <div className="flex flex-col gap-4 rounded-2xl border border-primary-100 bg-gradient-to-br from-mint-50/70 via-white to-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3.5">
            <Avatar src={caregiver.photo || caregiver.avatar} name={caregiver.name} size="lg" verified={true} />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display text-2xl font-black text-ink">{averageRating.toFixed(1)}</span>
                <RatingStars value={averageRating} size={16} />
              </div>
              <p className="mt-0.5 text-xs font-medium text-muted">
                Based on {reviewCount} verified booking review{reviewCount === 1 ? '' : 's'}
              </p>
            </div>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-xl border border-primary-200/60 bg-white px-3 py-1.5 text-xs font-semibold text-primary-800 shadow-xs">
            <ShieldCheck className="h-4 w-4 text-primary-600" />
            100% Verified Bystander Feedback
          </div>
        </div>

        {/* Reviews List */}
        {loading ? (
          <div className="space-y-3 py-6 text-center text-sm text-muted">
            <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
            <p>Loading verified reviews…</p>
          </div>
        ) : reviews.length > 0 ? (
          <div className="max-h-96 space-y-3 overflow-y-auto pr-1">
            {reviews.map((r) => {
              const customerName = r.customerName || r.customer?.fullName || r.customer?.name || 'Verified Family'
              return (
                <div
                  key={r._id || r.id}
                  className="rounded-xl border border-line bg-white p-4 shadow-xs transition hover:border-primary-200"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="grid h-8 w-8 place-items-center rounded-full bg-primary-100 text-xs font-bold text-primary-800">
                        {customerName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-ink">{customerName}</p>
                        <p className="text-[11px] text-faint">
                          {r.date || r.createdAt ? formatDate(r.date || r.createdAt) : 'Recent patient shift'}
                        </p>
                      </div>
                    </div>
                    <RatingStars value={Number(r.rating || 5)} size={13} showValue />
                  </div>
                  {r.comment ? (
                    <p className="mt-2.5 text-sm leading-relaxed text-ink-soft">
                      “{r.comment}”
                    </p>
                  ) : null}
                  {r.reply ? (
                    <div className="mt-3 rounded-lg border border-mint-200 bg-mint-50/50 p-2.5 text-xs">
                      <p className="font-semibold text-primary-800">Caretaker Response:</p>
                      <p className="mt-0.5 text-muted">{r.reply}</p>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-line bg-slate-50/60 p-6 text-center">
            <ThumbsUp className="mx-auto h-8 w-8 text-primary-500/70" />
            <h4 className="mt-2 font-display text-sm font-bold text-ink">New Verified Caretaker</h4>
            <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted">
              {caregiver.name} is verified with ID and police verification credentials on Bystander. Be the first to leave a review after completing your service shift!
            </p>
          </div>
        )}
      </div>
    </Modal>
  )
}

export default CaregiverReviewsModal
