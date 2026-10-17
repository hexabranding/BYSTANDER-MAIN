import { cn } from '@/utils/cn'

/**
 * Hairline section rule used across the dashboards to keep long pages
 * scannable: an uppercase label, a flexible rule, an optional trailing
 * action and an optional one-line hint underneath.
 */
export function SectionLabel({ children, hint, action, className }) {
  return (
    <div className={className}>
      <div className="flex items-center gap-3">
        <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-faint">{children}</h2>
        <span aria-hidden="true" className="h-px flex-1 bg-line" />
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {hint ? <p className="mt-1.5 text-sm leading-relaxed text-muted">{hint}</p> : null}
    </div>
  )
}

export default SectionLabel
