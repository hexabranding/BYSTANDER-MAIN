import { cn } from '@/utils/cn'

export function Tabs({ tabs, active, onChange, className, size = 'md' }) {
  return (
    <div className={cn('flex gap-1 overflow-x-auto no-scrollbar rounded-xl bg-slate-100 p-1', className)}>
      {tabs.map((tab) => {
        const key = tab.id ?? tab
        const label = tab.label ?? tab
        const isActive = key === active
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-lg font-semibold whitespace-nowrap transition',
              size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-3.5 py-2 text-sm',
              isActive ? 'bg-white text-primary-800 shadow-card' : 'text-muted hover:text-ink',
            )}
          >
            {label}
            {tab.count !== undefined ? (
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                  isActive ? 'bg-mint-100 text-primary-700' : 'bg-slate-200 text-muted',
                )}
              >
                {tab.count}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

export function Chip({ children, selected, onClick, className }) {
  const Comp = onClick ? 'button' : 'span'
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition',
        selected
          ? 'border-primary-300 bg-mint-100 text-primary-800'
          : 'border-line-strong bg-white text-muted hover:border-primary-200 hover:text-primary-700',
        className,
      )}
    >
      {children}
    </Comp>
  )
}

export function ProgressBar({ value = 0, max = 100, tone = 'primary', className, showLabel = false }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  const tones = {
    primary: 'bg-primary-700',
    accent: 'bg-accent-400',
    success: 'bg-success-500',
    warning: 'bg-warning-400',
    danger: 'bg-danger-500',
  }
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div
          className={cn('h-full rounded-full transition-all duration-500', tones[tone])}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel ? <span className="text-xs font-semibold text-muted">{Math.round(pct)}%</span> : null}
    </div>
  )
}

export default Tabs
