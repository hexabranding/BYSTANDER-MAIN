import { CalendarDays, Clock, MapPin, User } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '@/utils/cn'
import { formatDate, formatCurrency } from '@/utils/format'
import { StatusBadge } from '@/components/common/StatusBadge'

export function BookingCard({ booking, caregiverName, customerName, to, actions, className }) {
  return (
    <article
      className={cn(
        'flex flex-col gap-4 rounded-card border border-line bg-white p-4 shadow-card transition hover:border-primary-200 hover:shadow-raised sm:p-5',
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link to={to} className="font-display text-sm font-bold uppercase tracking-wide text-primary-700 hover:underline">
              #{booking.id}
            </Link>
            <StatusBadge status={booking.status} size="sm" />
          </div>
          <h3 className="mt-1.5 font-display text-base font-bold text-ink">{booking.service}</h3>
        </div>
        <div className="text-right">
          <p className="font-display text-lg font-extrabold text-ink">{formatCurrency(booking.total)}</p>
          <p className="text-[11px] uppercase tracking-wide text-faint">{booking.paymentStatus}</p>
        </div>
      </div>

      <div className="grid gap-2 text-sm text-muted sm:grid-cols-2">
        {caregiverName ? (
          <span className="inline-flex items-center gap-2">
            <User className="h-4 w-4 shrink-0 text-faint" />
            <span className="truncate">{caregiverName}</span>
          </span>
        ) : null}
        {customerName ? (
          <span className="inline-flex items-center gap-2">
            <User className="h-4 w-4 shrink-0 text-faint" />
            <span className="truncate">{customerName}</span>
          </span>
        ) : null}
        <span className="inline-flex items-center gap-2">
          <CalendarDays className="h-4 w-4 shrink-0 text-faint" />
          {formatDate(booking.date, { long: true })}
        </span>
        <span className="inline-flex items-center gap-2">
          <Clock className="h-4 w-4 shrink-0 text-faint" />
          {booking.startTime} · {booking.hours} hrs
        </span>
        <span className="inline-flex items-center gap-2 sm:col-span-2">
          <MapPin className="h-4 w-4 shrink-0 text-faint" />
          <span className="truncate">
            {booking.address} <span className="text-faint">· {booking.careType}</span>
          </span>
        </span>
      </div>

      {actions ? <div className="flex flex-wrap gap-2 border-t border-line pt-3.5">{actions}</div> : null}
    </article>
  )
}

export default BookingCard
