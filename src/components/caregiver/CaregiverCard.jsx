import { BadgeCheck, Briefcase, Building2, Clock, Heart, MapPin } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '@/utils/cn'
import { formatCurrency } from '@/utils/format'
import { Avatar } from '@/components/common/Avatar'
import { RatingStars } from '@/components/common/RatingStars'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Button } from '@/components/common/Button'

export function CaregiverCard({ caregiver, view = 'grid', onBook, actionLabel = 'View Profile', className }) {
  const {
    id,
    name,
    photo,
    qualification,
    experienceYears,
    rating,
    reviewCount,
    hourlyRate,
    city,
    area,
    verified,
    availability,
    services,
    badges = [],
    distanceKm,
  } = caregiver

  if (view === 'list') {
    return (
      <article
        className={cn(
          'group flex flex-col gap-4 rounded-card border border-line bg-white p-4 shadow-card transition hover:border-primary-200 hover:shadow-raised sm:flex-row sm:items-center sm:p-5',
          className,
        )}
      >
        <Avatar src={photo} name={name} size="lg" verified={verified} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-base font-bold text-ink">
              <Link to={`/caregivers/${id}`} className="transition hover:text-primary-700">
                {name}
              </Link>
            </h3>
            {verified ? <StatusBadge status="Verified" size="sm" /> : <StatusBadge status="Pending" size="sm" />}
          </div>
          <p className="mt-0.5 text-sm font-medium text-primary-700">{qualification}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted">
            <span className="inline-flex items-center gap-1.5">
              <Briefcase className="h-3.5 w-3.5" /> {experienceYears} yrs experience
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" /> {area}, {city}
              {distanceKm ? ` · ${distanceKm} km` : ''}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> {availability}
            </span>
            <RatingStars value={rating} count={reviewCount} showValue />
          </div>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {services.slice(0, 3).map((s) => (
              <span key={s} className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-muted">
                {s}
              </span>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-start gap-3 border-t border-line pt-4 sm:items-end sm:border-t-0 sm:pt-0 sm:pl-4">
          <div className="text-left sm:text-right">
            <p className="font-display text-xl font-extrabold text-ink">{formatCurrency(hourlyRate)}</p>
            <p className="text-[11px] uppercase tracking-wide text-faint">per hour</p>
          </div>
          <div className="flex w-full gap-2 sm:w-auto">
            <Button to={`/caregivers/${id}`} variant="outline" size="sm" className="flex-1 sm:flex-none">
              {actionLabel}
            </Button>
            {onBook ? (
              <Button size="sm" onClick={() => onBook(caregiver)} className="flex-1 sm:flex-none">
                Book Now
              </Button>
            ) : null}
          </div>
        </div>
      </article>
    )
  }

  return (
    <article
      className={cn(
        'group flex flex-col overflow-hidden rounded-card border border-line bg-white shadow-card transition hover:-translate-y-1 hover:border-primary-200 hover:shadow-raised',
        className,
      )}
    >
      <div className="relative flex items-start gap-3.5 p-5 pb-3">
        <Avatar src={photo} name={name} size="xl" verified={verified} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate font-display text-base font-bold text-ink">
                <Link to={`/caregivers/${id}`} className="transition hover:text-primary-700">
                  {name}
                </Link>
              </h3>
              <p className="truncate text-sm font-medium text-primary-700">{qualification}</p>
            </div>
            <button
              type="button"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-faint transition hover:bg-danger-50 hover:text-danger-500"
              aria-label={`Save ${name}`}
            >
              <Heart className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-1.5">
            <RatingStars value={rating} count={reviewCount} showValue size={13} />
          </div>
        </div>
      </div>

      <div className="space-y-2 px-5 text-sm text-muted">
        <div className="flex items-center gap-2">
          <Briefcase className="h-4 w-4 shrink-0 text-faint" />
          <span>{experienceYears} years experience</span>
        </div>
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 shrink-0 text-faint" />
          <span className="truncate">
            {area}, {city}
            {distanceKm ? ` · ${distanceKm} km away` : ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 shrink-0 text-faint" />
          <span className="truncate">{caregiver.careSettings?.join(' · ')}</span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5 px-5">
        {badges.slice(0, 3).map((b) => (
          <span
            key={b}
            className="inline-flex items-center gap-1 rounded-md bg-mint-100 px-2 py-1 text-[11px] font-semibold text-primary-800"
          >
            <BadgeCheck className="h-3 w-3" />
            {b}
          </span>
        ))}
      </div>

      <div className="mt-auto border-t border-line px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-display text-lg font-extrabold text-ink">{formatCurrency(hourlyRate)}</p>
            <p className="text-[11px] uppercase tracking-wide text-faint">per hour</p>
          </div>
          <StatusBadge status={availability} size="sm" dot={false} />
        </div>
        <div className="mt-3 flex gap-2">
          <Button to={`/caregivers/${id}`} variant="outline" size="sm" className="flex-1">
            {actionLabel}
          </Button>
          {onBook ? (
            <Button size="sm" className="flex-1" onClick={() => onBook(caregiver)}>
              Book Now
            </Button>
          ) : (
            <Button to={`/caregivers/${id}`} size="sm" className="flex-1">
              Book Now
            </Button>
          )}
        </div>
      </div>
    </article>
  )
}

export default CaregiverCard
