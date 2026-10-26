import { Link } from 'react-router-dom'
import { cn } from '@/utils/cn'

const LOGO_SRC = '/bystander-logo.png'

export function LogoMark({ className = 'h-9 w-9' }) {
  return (
    <span className={cn('grid shrink-0 place-items-center overflow-hidden rounded-xl bg-white shadow-card', className)}>
      <img
        src={LOGO_SRC}
        alt=""
        aria-hidden="true"
        className="h-[155%] max-w-none object-contain object-top"
      />
    </span>
  )
}

const LOGO_SIZES = {
  sm: { box: 'h-11', pad: 'p-1' },
  md: { box: 'h-16', pad: 'p-1.5' },
  lg: { box: 'h-20 sm:h-22', pad: 'p-2' },
  xl: { box: 'h-24 sm:h-28', pad: 'p-2' },
}

export function Logo({ to = '/', light = false, compact = false, size = 'md', markClass, className }) {
  const spec = LOGO_SIZES[size] ?? LOGO_SIZES.md
  return (
    <Link to={to} className={cn('group inline-flex items-center justify-center', className)} aria-label="Bystander home">
      {compact ? (
        <LogoMark className={markClass} />
      ) : (
        <img
          src={LOGO_SRC}
          alt="Bystander — Never alone"
          width={180}
          height={144}
          className={cn('w-auto object-contain mx-auto', spec.box, light && cn('rounded-xl bg-white/95 shadow-card', spec.pad))}
        />
      )}
    </Link>
  )
}

export default Logo
