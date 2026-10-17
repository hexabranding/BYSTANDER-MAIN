import { Check, CircleDashed } from 'lucide-react'
import { cn } from '@/utils/cn'
import { formatCurrency, formatDate, formatTime } from '@/utils/format'

export function BookingTimeline({ steps = [], className }) {
  return (
    <ol className={cn('relative space-y-0', className)}>
      {steps.map((step, i) => {
        const done = step.status === 'completed'
        const active = step.status === 'active'
        const last = i === steps.length - 1
        return (
          <li key={`${step.label}-${i}`} className="relative flex gap-4 pb-6 last:pb-0">
            {!last ? (
              <span
                className={cn(
                  'absolute left-[13px] top-7 h-[calc(100%-16px)] w-px',
                  done ? 'bg-primary-300' : 'bg-line',
                )}
                aria-hidden="true"
              />
            ) : null}
            <span
              className={cn(
                'relative z-10 grid h-[27px] w-[27px] shrink-0 place-items-center rounded-full border-2 bg-white',
                done ? 'border-primary-600 bg-primary-600 text-white' : active ? 'border-accent-400 text-accent-500' : 'border-line-strong text-faint',
              )}
            >
              {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <CircleDashed className="h-3.5 w-3.5" />}
            </span>
            <div className="min-w-0 pt-0.5">
              <p className={cn('text-sm font-semibold', done ? 'text-ink' : 'text-muted')}>{step.label}</p>
              {step.at ? (
                <p className="mt-0.5 text-xs text-faint">
                  {formatDate(step.at)} · {formatTime(step.at)}
                </p>
              ) : (
                <p className="mt-0.5 text-xs text-faint">Pending</p>
              )}
              {step.note ? <p className="mt-1 text-xs leading-relaxed text-muted">{step.note}</p> : null}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

export function PriceBreakdown({
  items = [],
  subtotal,
  platformFee = 0,
  tax = 0,
  commission,
  total,
  currencyNote,
  className,
}) {
  const computedTotal = total ?? subtotal + platformFee + tax
  return (
    <div className={cn('rounded-card border border-line bg-white p-5', className)}>
      <h3 className="font-display text-sm font-bold uppercase tracking-wider text-faint">Price breakdown</h3>

      {items.length ? (
        <ul className="mt-4 space-y-2.5">
          {items.map((item) => (
            <li key={item.label} className="flex items-start justify-between gap-4 text-sm">
              <span className="text-muted">
                {item.label}
                {item.meta ? <span className="block text-xs text-faint">{item.meta}</span> : null}
              </span>
              <span className="shrink-0 font-semibold tabular-nums text-ink">{formatCurrency(item.amount)}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4 space-y-2.5 border-t border-dashed border-line pt-4">
        <Row label="Care charges subtotal" value={formatCurrency(subtotal)} />
        <Row label="Platform charges" value={formatCurrency(platformFee)} />
        <Row label="GST (18%)" value={formatCurrency(tax)} />
        {commission !== undefined ? (
          <Row label="Platform commission (12%)" value={`− ${formatCurrency(commission)}`} muted />
        ) : null}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-mint-100 px-4 py-3">
        <span className="text-sm font-bold text-primary-900">Total payable</span>
        <span className="font-display text-lg font-extrabold tabular-nums text-primary-800">
          {formatCurrency(computedTotal)}
        </span>
      </div>
      {currencyNote ? <p className="mt-3 text-xs leading-relaxed text-muted">{currencyNote}</p> : null}
    </div>
  )
}

function Row({ label, value, muted }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-muted">{label}</span>
      <span className={cn('font-semibold tabular-nums', muted ? 'text-muted' : 'text-ink')}>{value}</span>
    </div>
  )
}

export default BookingTimeline
