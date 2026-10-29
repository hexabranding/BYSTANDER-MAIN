import { Star, StarHalf } from 'lucide-react'
import { cn } from '@/utils/cn'

export function RatingStars({ value = 0, size = 14, showValue = false, count, className }) {
  const numericValue = typeof value === 'object' && value !== null
    ? Number(value.average ?? value.rating ?? 0)
    : Number(value || 0)
  const safeValue = isNaN(numericValue) ? 0 : numericValue
  const rounded = Math.round(safeValue * 2) / 2
  const numericCount = count !== undefined
    ? count
    : (typeof value === 'object' && value !== null ? value.count : undefined)

  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <span className="inline-flex items-center gap-0.5" aria-label={`${safeValue} out of 5 stars`}>
        {Array.from({ length: 5 }, (_, i) => {
          const starValue = i + 1
          if (rounded >= starValue) {
            return <Star key={starValue} size={size} className="fill-warning-400 text-warning-400" />
          }
          if (rounded === starValue - 0.5) {
            return <StarHalf key={starValue} size={size} className="fill-warning-400 text-warning-400" />
          }
          return <Star key={starValue} size={size} className="text-slate-300" />
        })}
      </span>
      {showValue ? <span className="text-sm font-semibold text-ink">{safeValue.toFixed(1)}</span> : null}
      {numericCount !== undefined ? <span className="text-xs text-muted">({numericCount})</span> : null}
    </span>
  )
}

export default RatingStars
