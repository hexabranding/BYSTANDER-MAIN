import { forwardRef } from 'react'
import { cn } from '@/utils/cn'

const tones = {
  white: 'bg-white',
  canvas: 'bg-canvas',
  mint: 'bg-mint-100',
  dark: 'bg-gradient-to-br from-primary-950 via-primary-900 to-primary-800',
}

const dividers = {
  none: '',
  top: 'border-t border-line',
  bottom: 'border-b border-line',
  both: 'border-y border-line',
}

const sizes = {
  sm: 'py-12 sm:py-14',
  md: 'py-16 sm:py-20',
  lg: 'py-16 sm:py-20 lg:py-24',
}

/**
 * Vertical rhythm wrapper. Keeps the scroll offset, tint, divider and
 * padding consistent so anchor links never tuck under the fixed navbar.
 */
export const Section = forwardRef(function Section(
  {
    as: Tag = 'section',
    id,
    tone = 'white',
    divider = 'none',
    size = 'md',
    className,
    children,
    ...props
  },
  ref,
) {
  return (
    <Tag
      ref={ref}
      id={id}
      className={cn(
        'relative scroll-mt-24 sm:scroll-mt-28',
        tones[tone],
        dividers[divider],
        sizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </Tag>
  )
})

export default Section
