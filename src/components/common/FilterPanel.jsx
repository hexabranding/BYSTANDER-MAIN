import { SlidersHorizontal, X } from 'lucide-react'
import { cn } from '@/utils/cn'

export function FilterPanel({ title = 'Filters', activeCount = 0, onReset, children, className, collapsible = false, open = true }) {
  return (
    <section className={cn('rounded-card border border-line bg-white shadow-card', className)}>
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <h2 className="inline-flex items-center gap-2 text-sm font-bold text-ink">
          <SlidersHorizontal className="h-4 w-4 text-primary-600" />
          {title}
          {activeCount > 0 ? (
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary-700 px-1.5 text-[10px] font-bold text-white">
              {activeCount}
            </span>
          ) : null}
        </h2>
        {onReset ? (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1 text-xs font-semibold text-muted transition hover:text-danger-600"
          >
            <X className="h-3.5 w-3.5" /> Reset
          </button>
        ) : null}
      </header>
      <div className={cn('space-y-4 px-4 py-4', !open && 'hidden')}>{children}</div>
      {collapsible ? null : null}
    </section>
  )
}

export function FilterGroup({ label, children }) {
  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-faint">{label}</p>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

export function CheckOption({ checked, onChange, label, count }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-sm text-ink-soft transition hover:text-ink">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 rounded border-line-strong text-primary-700 accent-[#0F766E] focus:ring-primary-400"
      />
      <span className="flex-1">{label}</span>
      {count !== undefined ? <span className="text-xs text-faint">{count}</span> : null}
    </label>
  )
}

export default FilterPanel
