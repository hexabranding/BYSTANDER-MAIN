import { motion } from 'framer-motion'
import { EASE, VIEWPORT } from '@/utils/motion'

const offsets = {
  bottom: (d) => ({ y: d }),
  top: (d) => ({ y: -d }),
  left: (d) => ({ x: -d }),
  right: (d) => ({ x: d }),
  none: () => ({}),
}

/**
 * Drop-in scroll reveal for content that has no animation of its own.
 * Wraps any element, fades it up (or in from a side) the first time it
 * enters the viewport, and leaves it alone from then on.
 *
 *   <Reveal delay={0.08}>…</Reveal>
 *   <Reveal as="li" from="left">…</Reveal>
 */
export function Reveal({
  as,
  from = 'bottom',
  distance = 24,
  delay = 0,
  viewport,
  className,
  children,
  ...props
}) {
  const Comp = as ? motion[as] : motion.div

  return (
    <Comp
      initial={{ opacity: 0, ...offsets[from](distance) }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={viewport || VIEWPORT}
      transition={{ duration: 0.6, ease: EASE, delay }}
      className={className}
      {...props}
    >
      {children}
    </Comp>
  )
}

export default Reveal
