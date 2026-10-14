/**
 * Shared scroll-animation primitives.
 *
 * One source of truth for how content enters the viewport across the
 * marketing pages, so every section eases in with the same feel instead of
 * each file inventing its own timing.
 */

/** Expo-out: quick start, long settle. Calmer than a stock `easeOut`. */
export const EASE = [0.16, 1, 0.3, 1]

/** Fire once, as soon as roughly 15% of the element is on screen. */
export const VIEWPORT = { once: true, amount: 0.15 }

/** Fade up into place — spread onto any `motion.*` element. */
export const reveal = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: VIEWPORT,
  transition: { duration: 0.6, ease: EASE },
}

/** Same entrance, sliding in from the left — for two-column layouts. */
export const revealFromLeft = {
  ...reveal,
  initial: { opacity: 0, x: -28 },
  whileInView: { opacity: 1, x: 0 },
}

/** Same entrance, sliding in from the right. */
export const revealFromRight = {
  ...reveal,
  initial: { opacity: 0, x: 28 },
  whileInView: { opacity: 1, x: 0 },
}

/**
 * Keeps a scroll-linked progress value inside 0–1. Element-based
 * `useScroll` targets start slightly negative (the hero sits below the
 * sticky bar) and can overshoot past 1 — both would extrapolate.
 */
export function clamp01(value) {
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}
