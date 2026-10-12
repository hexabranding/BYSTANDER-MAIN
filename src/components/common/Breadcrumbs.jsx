import { ChevronRight, Home } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/utils/cn'

export function Breadcrumbs({ items, className }) {
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
    <nav className={cn('flex flex-wrap items-center gap-1.5 text-xs text-muted', className)} aria-label="Breadcrumb">
      <Link to="/" className="inline-flex items-center gap-1 transition hover:text-primary-700">
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
