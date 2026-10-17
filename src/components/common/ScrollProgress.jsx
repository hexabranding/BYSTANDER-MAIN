import { motion, useScroll, useSpring } from 'framer-motion'
import { cn } from '@/utils/cn'

/**
 * Thin reading-progress bar pinned to the top of the viewport.
 * Tracks whole-page scroll and eases behind the finger rather than
 * snapping, so the page feels like it is responding continuously.
 */
export function ScrollProgress({ className }) {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 160,
    damping: 30,
    mass: 0.4,
    restDelta: 0.001,
  })

  return (
    <motion.div
      aria-hidden="true"
      style={{ scaleX }}
      className={cn(
        'pointer-events-none fixed inset-x-0 top-0 z-[45] h-[3px] origin-left',
        'bg-gradient-to-r from-primary-700 via-primary-400 to-accent-500',
        'shadow-[0_1px_8px_rgba(15,118,110,0.45)]',
        className,
      )}
    />
  )
}

export default ScrollProgress
