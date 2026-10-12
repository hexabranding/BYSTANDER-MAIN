import { forwardRef } from 'react'
import { Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { cn } from '@/utils/cn'

const variants = {
  primary:
    'bg-primary-700 text-white shadow-[0_10px_25px_-14px_rgba(15,118,110,0.9)] hover:bg-primary-800 active:bg-primary-900',
  secondary: 'bg-mint-100 text-primary-800 hover:bg-mint-200 active:bg-mint-300',
  accent: 'bg-accent-400 text-[#06263B] hover:bg-accent-500 hover:text-white',
  outline: 'border border-line-strong bg-white text-ink hover:border-primary-300 hover:text-primary-700',
  ghost: 'text-muted hover:bg-slate-100 hover:text-ink',
  danger: 'bg-danger-600 text-white hover:bg-danger-700',
  dangerGhost: 'border border-danger-200 bg-danger-50 text-danger-700 hover:bg-danger-100',
  link: 'text-primary-700 hover:text-primary-800 underline-offset-4 hover:underline',
}

const sizes = {
  xs: 'h-7 px-2.5 text-xs gap-1.5',
  sm: 'h-9 px-3.5 text-sm gap-2',
  md: 'h-11 px-5 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2.5',
  icon: 'h-10 w-10 justify-center',
}

export const Button = forwardRef(function Button(
  {
    variant = 'primary',
    size = 'md',
    to,
    href,
    loading = false,
    icon: Icon,
    iconRight: IconRight,
    className,
    children,
    disabled,
    ...props
  },
  ref,
) {
  const classes = cn(
    'inline-flex items-center justify-center rounded-xl font-semibold transition-all duration-200 select-none',
    'disabled:pointer-events-none disabled:opacity-50',
    variants[variant],
    sizes[size],
    className,
  )

  const content = (
    <>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : Icon ? <Icon className="h-4 w-4 shrink-0" /> : null}
      {children ? <span className="truncate">{children}</span> : null}
      {IconRight ? <IconRight className="h-4 w-4 shrink-0" /> : null}
    </>
  )

  if (to && !disabled) {
    return (
      <Link ref={ref} to={to} className={classes} {...props}>
        {content}
      </Link>
    )
  }

  if (href && !disabled) {
    return (
      <a ref={ref} href={href} className={classes} {...props}>
        {content}
      </a>
    )
  }

  return (
    <button ref={ref} type="button" className={classes} disabled={disabled || loading} {...props}>
      {content}
    </button>
  )
})

export default Button
