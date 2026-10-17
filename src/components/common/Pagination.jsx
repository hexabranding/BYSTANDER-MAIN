import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/utils/cn'

export function Pagination({ page, totalPages, onPageChange, totalItems, className }) {
  if (totalPages <= 1) return null
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)

  return (
    <nav className={cn('flex flex-wrap items-center justify-between gap-3', className)} aria-label="Pagination">
      <p className="text-sm text-muted">
        Page <span className="font-semibold text-ink">{page}</span> of {totalPages}
        {totalItems !== undefined ? ` · ${totalItems} results` : ''}
      </p>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="grid h-9 w-9 place-items-center rounded-lg border border-line-strong bg-white text-muted transition hover:border-primary-300 hover:text-primary-700 disabled:opacity-40 disabled:hover:border-line-strong disabled:hover:text-muted"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {pages.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPageChange(p)}
            aria-current={p === page ? 'page' : undefined}
            className={cn(
              'h-9 min-w-9 rounded-lg px-2.5 text-sm font-semibold transition',
              p === page
                ? 'bg-gradient-to-br from-primary-600 to-primary-800 text-white shadow-[0_8px_18px_-12px_rgba(15,118,110,0.9)]'
                : 'border border-line-strong bg-white text-muted hover:border-primary-300 hover:text-primary-700',
            )}
          >
            {p}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="grid h-9 w-9 place-items-center rounded-lg border border-line-strong bg-white text-muted transition hover:border-primary-300 hover:text-primary-700 disabled:opacity-40"
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </nav>
  )
}

export default Pagination
