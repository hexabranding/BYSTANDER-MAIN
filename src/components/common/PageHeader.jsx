import { cn } from '@/utils/cn'

export function PageHeader({ title, subtitle, action, meta, className }) {
  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between', className)}>
      <div className="flex min-w-0 items-start gap-3">
        <span
          aria-hidden="true"
          className="mt-1.5 h-9 w-1 shrink-0 rounded-full bg-gradient-to-b from-primary-500 via-primary-400 to-accent-400"
        />
        <div className="min-w-0">
          <h1 className="font-display text-xl font-extrabold tracking-tight text-ink sm:text-2xl">{title}</h1>
          {subtitle ? <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">{subtitle}</p> : null}
          {meta ? <div className="mt-2.5 flex flex-wrap items-center gap-2">{meta}</div> : null}
        </div>
      </div>
      {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
    </div>
  )
}

export default PageHeader
