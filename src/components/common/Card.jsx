import { cn } from '@/utils/cn'

export function Card({ className, children, hover = false, as: As = 'div', ...props }) {
  return (
    <As
      className={cn(
        'rounded-card border border-line bg-white shadow-card',
        hover && 'transition-all duration-200 hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-raised',
        className,
      )}
      {...props}
    >
      {children}
    </As>
  )
}

export function CardHeader({ title, subtitle, action, icon: Icon, className }) {
  return (
    <div className={cn('flex items-start justify-between gap-4 border-b border-line px-5 py-4', className)}>
      <div className="flex items-start gap-3">
        {Icon ? (
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-mint-100 text-primary-700">
            <Icon className="h-4.5 w-4.5" size={18} />
          </span>
        ) : null}
        <div>
          <h3 className="font-display text-base font-bold text-ink">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-sm text-muted">{subtitle}</p> : null}
        </div>
      </div>
      {action}
    </div>
  )
}

export function CardBody({ className, children, ...props }) {
  return (
    <div className={cn('p-5', className)} {...props}>
      {children}
    </div>
  )
}

export function CardFooter({ className, children }) {
  return <div className={cn('border-t border-line bg-slate-50/70 px-5 py-3.5', className)}>{children}</div>
}

export default Card
