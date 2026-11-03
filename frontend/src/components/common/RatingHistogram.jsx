import { Star, ShieldCheck, Sparkles } from 'lucide-react'
import { RatingStars } from '@/components/common/RatingStars'
import { cn } from '@/utils/cn'

/**
 * Amazon & Flipkart style Rating Histogram component.
 * Displays overall average score, star distribution percentages (5, 4, 3, 2, 1),
 * and verified booking badges.
 *
 * @param {Object} props
 * @param {Array} [props.reviews=[]] - Array of review items with .rating
 * @param {number} [props.averageRating] - Optional precalculated average score
 * @param {number} [props.totalRatings] - Optional precalculated total review count
 * @param {string} [props.className] - Container CSS classes
 */
export function RatingHistogram({
  reviews = [],
  averageRating,
  totalRatings,
  className,
  subjectLabel = 'Caretaker',
}) {
  const isCustomer = subjectLabel.toLowerCase() === 'customer'
  const reviewerLabel = isCustomer ? 'Caretaker' : 'Customer'

  const list = Array.isArray(reviews) ? reviews : []
  const count =
    totalRatings !== undefined && totalRatings !== null
      ? Number(totalRatings)
      : list.length

  const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
  let sum = 0

  list.forEach((r) => {
    const rawVal = Number(r.rating || 5)
    const star = Math.min(5, Math.max(1, Math.round(rawVal)))
    counts[star] = (counts[star] || 0) + 1
    sum += rawVal
  })

  const avg =
    averageRating !== undefined && averageRating !== null
      ? Number(averageRating)
      : list.length > 0
      ? Number((sum / list.length).toFixed(1))
      : 0

  if (count === 0 && list.length === 0) {
    return (
      <div
        className={cn(
          'rounded-2xl border border-line bg-gradient-to-br from-mint-50/60 via-white to-white p-5 text-center',
          className
        )}
      >
        <div className="mx-auto inline-flex items-center gap-1.5 rounded-full border border-emerald-200/90 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800 shadow-xs">
          <Sparkles className="h-3.5 w-3.5 text-emerald-600 fill-emerald-200" />
          <span>New {subjectLabel} · 0 {reviewerLabel} Reviews</span>
        </div>
        <p className="mx-auto mt-2.5 max-w-md text-xs leading-relaxed text-muted">
          Ratings and Amazon-style star breakdown will calculate here once the first completed shift is reviewed by {isCustomer ? 'an assigned caretaker' : 'a client family'}.
        </p>
      </div>
    )
  }

  const effectiveTotal = list.length > 0 ? list.length : count || 1

  return (
    <div
      className={cn(
        'grid gap-4 rounded-2xl border border-primary-100 bg-gradient-to-br from-mint-50/40 via-white to-white p-4 sm:grid-cols-2 sm:items-center',
        className
      )}
    >
      {/* Left: Big Score & Trust Badge */}
      <div className="flex flex-col items-center justify-center rounded-xl border border-line/60 bg-white/90 p-4 text-center shadow-xs">
        <span className="font-display text-4xl font-black tracking-tight text-ink">
          {avg > 0 ? avg.toFixed(1) : '5.0'}
        </span>
        <div className="mt-1 flex items-center justify-center">
          <RatingStars value={avg > 0 ? avg : 5.0} size={18} />
        </div>
        <p className="mt-1 text-xs font-semibold text-muted">
          Based on {count || list.length} {reviewerLabel.toLowerCase()} { (count || list.length) === 1 ? 'rating' : 'ratings' }
        </p>
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-800">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
          100% Verified Bystander Feedback
        </div>
      </div>

      {/* Right: Amazon / Flipkart 5-Star Distribution Bars */}
      <div className="flex flex-col justify-center gap-1.5 px-1 py-1">
        {[5, 4, 3, 2, 1].map((star) => {
          const starCount = counts[star] || 0
          const pct = Math.round((starCount / effectiveTotal) * 100)
          return (
            <div key={star} className="flex items-center gap-2 text-xs">
              <span className="flex w-11 items-center gap-1 font-semibold text-slate-700">
                {star} <Star className="h-3 w-3 fill-warning-400 text-warning-400 inline" />
              </span>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100 shadow-inner">
                <div
                  className="h-full rounded-full bg-warning-400 transition-all duration-300"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-16 text-right font-mono text-[11px] font-semibold tabular-nums text-slate-600">
                {pct}% ({starCount})
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default RatingHistogram

