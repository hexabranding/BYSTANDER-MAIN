/**
 * Booking duration model.
 *
 * A booking's duration is always stored canonically as `hours` (a number),
 * so the seeded data, pricing maths (`hourlyRate * hours`), invoices and
 * escrow ledgers are untouched. These helpers are the single place where
 * that number is turned into something a human reads, plus the presets a
 * customer can pick from — hours, whole days or whole weeks.
 */

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

/** Groups used to render the duration picker (with <optgroup> labels). */
export const DURATION_GROUPS = [
  { id: 'hours', label: 'Hours', options: [2, 4, 6, 8, 12] },
  { id: 'days', label: 'Days', options: [24, 48, 72] },
  { id: 'weeks', label: 'Weeks', options: [168, 336] },
]

/** Flat list of every pickable duration, in hours. */
export const DURATION_OPTIONS = DURATION_GROUPS.flatMap((group) => group.options)

/** Break a duration down into its largest whole unit. */
export function durationParts(hours) {
  const h = Math.round(Number(hours) || 0)
  if (h <= 0) return null
  if (h % 168 === 0) return { unit: 'week', count: h / 168, hours: h }
  if (h % 24 === 0) return { unit: 'day', count: h / 24, hours: h }
  return { unit: 'hour', count: h, hours: h }
}

/**
 * Human duration — `6 hours`, `2 days`, `1 week`.
 * `short` abbreviates only the hour form (`6 hrs`) so table columns stay narrow.
 */
export function formatDuration(hours, { short = false } = {}) {
  const part = durationParts(hours)
  if (!part) return '—'
  const word = part.unit === 'hour' && short ? 'hr' : part.unit
  return plural(part.count, word)
}

/**
 * Quantity for a line priced at an hourly rate — `6 hrs`, `48 hrs (2 days)`.
 * Keeps the maths explicit (rate is per hour) while still naming the unit
 * the customer actually booked.
 */
export function durationBasis(hours) {
  const part = durationParts(hours)
  if (!part) return '—'
  if (part.unit === 'hour') return plural(part.count, 'hr')
  return `${part.hours} hrs (${plural(part.count, part.unit)})`
}
