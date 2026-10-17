import { useRef } from 'react'
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import { cn } from '@/utils/cn'
import { EASE, clamp01 } from '@/utils/motion'
import { Container } from '@/components/common/Container'
import { Breadcrumbs } from '@/components/common/Breadcrumbs'

/**
 * Dark gradient header band used at the top of the public marketing pages.
 * Owns the breadcrumb, eyebrow chip, headline (with optional gradient
 * highlight) and lede — plus room for trailing content such as trust chips.
 *
 * The band itself eases in on mount and its two decorative shapes drift at
 * different speeds while the page scrolls, so the header reads as depth
 * rather than a flat plate.
 */
export function PageHero({ eyebrow, icon: Icon, title, highlight, description, items, actions, className }) {
  const ref = useRef(null)
  const reduceMotion = useReducedMotion()
  const { scrollYProgress: rawProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const scrollProgress = useTransform(rawProgress, clamp01)
  const orbY = useTransform(scrollProgress, [0, 1], [0, 96])
  const ringY = useTransform(scrollProgress, [0, 1], [0, -56])

  return (
    <div
      ref={ref}
      className={cn(
        'relative overflow-hidden border-b border-line bg-gradient-to-br from-primary-950 via-primary-900 to-primary-800',
        className,
      )}
    >
      <div aria-hidden="true" className="grid-pattern pointer-events-none absolute inset-0 opacity-[0.14]" />
      <motion.div
        aria-hidden="true"
        style={reduceMotion ? undefined : { y: orbY }}
        className="pointer-events-none absolute -top-24 -right-16 h-80 w-80 rounded-full bg-[radial-gradient(closest-side,rgba(56,189,248,0.22),transparent)] blur-3xl"
      />
      <motion.div
        aria-hidden="true"
        style={reduceMotion ? undefined : { y: ringY }}
        className="pointer-events-none absolute -bottom-32 -left-20 h-72 w-72 rounded-full border-[24px] border-white/5"
      />

      <motion.div
        initial={{ opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65, ease: EASE }}
      >
        <Container className="py-8 sm:py-12">
          {items ? <Breadcrumbs items={items} tone="dark" /> : null}

          <div className={cn(items && 'mt-4', 'flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between')}>
            <div className="max-w-2xl">
              {eyebrow ? (
                <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-accent-300 backdrop-blur-sm">
                  {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
                  {eyebrow}
                </span>
              ) : null}

              <h1
                className={cn(
                  'font-display text-3xl font-extrabold leading-[1.1] text-white sm:text-4xl',
                  eyebrow && 'mt-3.5',
                )}
              >
                {title}
                {highlight ? (
                  <>
                    {' '}
                    <span className="bg-gradient-to-r from-accent-300 via-accent-400 to-mint-300 bg-clip-text text-transparent">
                      {highlight}
                    </span>
                  </>
                ) : null}
              </h1>

              {description ? (
                <p className="mt-3 text-sm leading-relaxed text-white/60 sm:text-base">{description}</p>
              ) : null}
            </div>

            {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2.5">{actions}</div> : null}
          </div>
        </Container>
      </motion.div>
    </div>
  )
}

export default PageHero
