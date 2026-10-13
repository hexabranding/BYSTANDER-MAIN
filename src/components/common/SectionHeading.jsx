import { cn } from '@/utils/cn'

const aligns = {
  left: 'max-w-2xl',
  center: 'mx-auto max-w-2xl text-center',
}

/**
 * Eyebrow + headline + lede + optional action.
 * Pass `tone="dark"` for sections sitting on a dark or gradient background.
 */
export function SectionHeading({ eyebrow, title, description, align = 'left', tone = 'light', action, className }) {
  const dark = tone === 'dark'

  return (
    <div
      className={cn(
        'flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between',
        align === 'center' && 'sm:flex-col sm:items-center',
        className,
      )}
    >
      <div className={cn(aligns[align], align === 'center' && 'flex flex-col items-center')}>
        {eyebrow ? (
          <p
            className={cn(
              'text-xs font-bold uppercase tracking-[0.18em]',
              dark ? 'text-accent-300' : 'text-primary-700',
            )}
          >
            {eyebrow}
          </p>
        ) : null}

        <h2
          className={cn(
            'font-display text-2xl font-extrabold sm:text-3xl',
            eyebrow && 'mt-2',
            dark ? 'text-white' : 'text-ink',
          )}
        >
          {title}
        </h2>

        {description ? (
          <p
            className={cn(
              'mt-3 text-sm leading-relaxed sm:text-base',
              align === 'center' && 'text-balance',
              dark ? 'text-white/60' : 'text-muted',
            )}
          >
            {description}
          </p>
        ) : null}
      </div>

      {action ? (
        <div className={cn('flex shrink-0 flex-wrap items-center gap-3', align === 'center' && 'justify-center')}>
          {action}
        </div>
      ) : null}
    </div>
  )
}

export default SectionHeading
