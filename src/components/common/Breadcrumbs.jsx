import { ChevronRight, Home } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/utils/cn'

const tones = {
  light: 'text-muted [&_a:hover]:text-primary-700 [&_span]:text-ink',
  dark: 'text-white/55 [&_a:hover]:text-accent-300 [&_span]:text-white',
}

export function Breadcrumbs({ items, tone = 'light', className }) {
  const { pathname } = useLocation()
  const crumbs =
    items ||
    pathname
      .split('/')
      .filter(Boolean)
      .map((seg, i, arr) => ({
        label: seg.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        to: i === arr.length - 1 ? undefined : `/${arr.slice(0, i + 1).join('/')}`,
      }))

  if (!crumbs.length) return null

  return (
    <nav
      className={cn('flex flex-wrap items-center gap-1.5 text-xs', tones[tone], className)}
      aria-label="Breadcrumb"
    >
      <Link to="/" className="inline-flex items-center gap-1 transition hover:opacity-80">
        <Home className="h-3.5 w-3.5" />
        Home
      </Link>
      {crumbs.map((c) => (
        <span key={`${c.label}-${c.to || 'current'}`} className="inline-flex items-center gap-1.5">
          <ChevronRight className="h-3 w-3 text-faint" />
          {c.to ? (
            <Link to={c.to} className="transition hover:text-primary-700">
              {c.label}
            </Link>
          ) : (
            <span className="font-semibold text-ink">{c.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}

export default Breadcrumbs
