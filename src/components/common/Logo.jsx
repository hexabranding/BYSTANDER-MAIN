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
  sm: 'h-10',
  md: 'h-14',
  lg: 'h-20',
  xl: 'h-20 sm:h-24',
}

export function Logo({ to = '/', light = false, compact = false, size = 'md', className }) {
  return (
    <Link to={to} className={cn('group inline-flex items-center', className)} aria-label="Bystander home">
      {compact ? (
        <LogoMark />
      ) : (
        <img
          src={LOGO_SRC}
          alt="Bystander — Never alone"
          width={180}
          height={144}
          className={cn('w-auto object-contain', LOGO_SIZES[size] ?? LOGO_SIZES.md, light && 'rounded-xl bg-white/95 p-1.5 shadow-card')}
        />
      )}
    </Link>
  )
}

export default Logo
