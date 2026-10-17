import { STATUS_STYLES, STATUS_DOT } from '@/utils/constants'
import { cn } from '@/utils/cn'

const slug = (value) => String(value || '').toLowerCase().replace(/\s+/g, '-')

export function StatusBadge({ status, className, dot = true, size = 'md' }) {
  const key = slug(status)
  const tone = STATUS_STYLES[key] || 'bg-slate-100 text-slate-600 ring-slate-400/40'
  const dotTone = STATUS_DOT[key] || 'bg-slate-400'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-semibold ring-1 ring-inset whitespace-nowrap',
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
        tone,
        className,
      )}
    >
      {dot ? <span className={cn('h-1.5 w-1.5 rounded-full', dotTone)} aria-hidden="true" /> : null}
      {status}
    </span>
  )
}

export default StatusBadge
