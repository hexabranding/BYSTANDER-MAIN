import { Star, StarHalf, Sparkles } from 'lucide-react'
import { cn } from '@/utils/cn'

export function RatingStars({
  value = 0,
  size = 14,
  showValue = false,
  count,
  className,
  badgeClassName,
}) {
  const numericCount =
    count !== undefined
      ? Number(count)
      : typeof value === 'object' && value !== null && value.count !== undefined
      ? Number(value.count)
      : undefined

  // If a provider has count === 0 explicitly passed, display the industry-standard "✨ New Caretaker" badge
  if (numericCount === 0) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full border border-emerald-200/90 bg-emerald-50/90 px-2 py-0.5 text-[11px] font-bold text-emerald-700 shadow-xs',
          badgeClassName || className
        )}
      >
        <Sparkles size={size - 2 || 11} className="text-emerald-600 fill-emerald-100" />
        <span>New Caretaker</span>
      </span>
    )
  }

  const numericValue =
    typeof value === 'object' && value !== null
      ? Number(value.average ?? value.rating ?? 0)
      : Number(value || 0)
  const safeValue = isNaN(numericValue) ? 0 : numericValue
  const rounded = Math.round(safeValue * 2) / 2

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
      {numericCount !== undefined && numericCount > 0 ? (
        <span className="text-xs text-muted">({numericCount})</span>
      ) : null}
    </span>
  )
}

export default RatingStars
