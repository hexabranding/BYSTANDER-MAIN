import { Search, X } from 'lucide-react'
import { cn } from '@/utils/cn'

export function SearchBar({
  value,
  onChange,
  placeholder = 'Search…',
  className,
  icon: Icon = Search,
  autoFocus = false,
  size = 'md',
}) {
  return (
    <div className={cn('relative', className)}>
      <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
      <input
        type="search"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className={cn(
          'w-full rounded-xl border border-line-strong bg-white pl-10 pr-9 text-sm text-ink placeholder:text-faint transition',
          'focus:border-primary-400 focus:ring-4 focus:ring-primary-100 focus:outline-none',
          size === 'sm' ? 'h-9' : 'h-11',
        )}
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-2.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-md text-faint transition hover:bg-slate-100 hover:text-ink"
          aria-label="Clear search"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  )
}

export default SearchBar
