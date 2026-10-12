import { useState } from 'react'
import { cn } from '@/utils/cn'
import { initials } from '@/utils/format'

const tones = [
  'bg-primary-100 text-primary-800',
  'bg-accent-100 text-accent-600',
  'bg-mint-200 text-primary-900',
  'bg-warning-100 text-warning-700',
  'bg-info-100 text-info-700',
  'bg-slate-200 text-slate-700',
]

function toneFor(name = '') {
  const code = name.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0)
  return tones[code % tones.length]
}

export function Avatar({ src, name = '', size = 'md', className, verified = false }) {
  const [failed, setFailed] = useState(false)
  const sizes = {
    xs: 'h-7 w-7 text-[10px]',
    sm: 'h-9 w-9 text-xs',
    md: 'h-11 w-11 text-sm',
    lg: 'h-14 w-14 text-base',
    xl: 'h-20 w-20 text-xl',
    '2xl': 'h-28 w-28 text-3xl',
  }

  return (
    <span className={cn('relative inline-block shrink-0', className)}>
      {src && !failed ? (
        <img
          src={src}
          alt={name}
          onError={() => setFailed(true)}
          loading="lazy"
          className={cn('rounded-full object-cover ring-2 ring-white shadow-card', sizes[size])}
        />
      ) : (
        <span
          className={cn(
            'inline-grid place-items-center rounded-full font-display font-bold ring-2 ring-white shadow-card',
            toneFor(name),
            sizes[size],
          )}
          aria-label={name}
        >
          {initials(name) || 'CM'}
        </span>
      )}
      {verified ? (
        <span
          className="absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full border-2 border-white bg-success-500"
          title="Verified"
        >
          <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 text-white" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="M2.5 6.2 4.8 8.5 9.5 3.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      ) : null}
    </span>
  )
}

export function ImageWithFallback({ src, alt = '', className, imgClassName, fallback, children }) {
  const [failed, setFailed] = useState(!src)
  if (failed) {
    return (
      <div className={cn('grid place-items-center bg-gradient-to-br from-primary-700 via-primary-600 to-accent-500 text-white', className)}>
        {fallback ?? children ?? null}
      </div>
    )
  }
  return (
    <div className={cn('overflow-hidden', className)}>
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onError={() => setFailed(true)}
        className={cn('h-full w-full object-cover', imgClassName)}
      />
    </div>
  )
}

export default Avatar
