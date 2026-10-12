import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Search, Sparkles, X } from 'lucide-react'
import { useDocumentTitle, useDebouncedValue } from '@/hooks/useUi'
import { formatCurrency } from '@/utils/format'
import { SERVICES } from '@/data/services'
import { Button } from '@/components/common/Button'
import { Breadcrumbs } from '@/components/common/Breadcrumbs'
import { Chip } from '@/components/common/Tabs'
import { EmptyState } from '@/components/common/States'
import { SearchBar } from '@/components/common/SearchBar'

const CATEGORIES = [
  { id: 'all', label: 'All services' },
  { id: 'popular', label: 'Most booked' },
  { id: 'vitals', label: 'Monitoring', tag: 'Vitals' },
  { id: 'wound', label: 'Post-surgery', tag: 'Wound care' },
  { id: 'elder', label: 'Elder care', tag: 'Elder care' },
  { id: 'memory', label: 'Memory care', tag: 'Memory care' },
  { id: 'night', label: 'Overnight', tag: '12-hour shift' },
  { id: 'mobility', label: 'Mobility', tag: 'Transfers' },
]

const INCLUDED = [
  'Itemised estimate before you confirm — hourly rate, platform charges and 18% GST shown upfront.',
  'Escrow release only after you mark the shift complete; cancellations 6+ hours ahead are free.',
  'CareMate absorbs the 12% platform commission on the caregiver side, so families never see a hidden fee.',
  'In-app messaging, shift check-in/out and a downloadable invoice for every booking.',
]

const reveal = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.15 },
  transition: { duration: 0.45, ease: 'easeOut' },
}

export function ServicesPage() {
  useDocumentTitle('Care Services')

  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const debouncedQuery = useDebouncedValue(query, 250)

  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase()
    const chip = CATEGORIES.find((c) => c.id === category)

    return SERVICES.filter((svc) => {
      const matchesText =
        !q ||
        svc.name.toLowerCase().includes(q) ||
        svc.short.toLowerCase().includes(q) ||
        svc.description.toLowerCase().includes(q) ||
        svc.tags.some((t) => t.toLowerCase().includes(q))

      if (!matchesText) return false
      if (category === 'popular') return svc.popular
      if (chip?.tag) return svc.tags.some((t) => t.toLowerCase() === chip.tag.toLowerCase())
      return true
    })
  }, [debouncedQuery, category])

  const activeFilters = (query ? 1 : 0) + (category !== 'all' ? 1 : 0)

  const resetFilters = () => {
    setQuery('')
    setCategory('all')
  }

  return (
    <div className="bg-canvas">
      {/* header */}
      <section className="border-b border-line bg-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
          <Breadcrumbs items={[{ label: 'Services' }]} />
          <div className="mt-5 grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-primary-200 bg-mint-100 px-3 py-1.5 text-xs font-bold text-primary-800">
                <Sparkles className="h-3.5 w-3.5" />
                Nine care services · 18 cities
              </span>
              <h1 className="mt-4 font-display text-3xl font-extrabold leading-tight text-ink sm:text-4xl">
                Care services for every stage of recovery
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
                From hour-long medication reminders to 12-hour night vigil, each service has a defined scope, a
                transparent starting rate and caregivers qualified to deliver it.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <SearchBar
                value={query}
                onChange={setQuery}
                placeholder="Search by service, tag or keyword…"
              />
              <p className="text-xs text-muted">
                Try “night duty”, “wound care” or “dementia”.
              </p>
            </div>
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-2">
            {CATEGORIES.map((chip) => (
              <Chip
                key={chip.id}
                selected={category === chip.id}
                onClick={() => setCategory(chip.id)}
              >
                {chip.label}
              </Chip>
            ))}
            {activeFilters > 0 ? (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1 rounded-full px-2 py-1.5 text-xs font-semibold text-danger-600 transition hover:bg-danger-50"
              >
                <X className="h-3.5 w-3.5" /> Clear filters
              </button>
            ) : null}
          </div>
        </div>
      </section>

      {/* grid */}
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">
            Showing <span className="font-bold text-ink">{filtered.length}</span> of {SERVICES.length} services
          </p>
          <p className="text-xs text-faint">Rates shown are starting prices per hour unless stated otherwise</p>
        </div>

        {filtered.length === 0 ? (
          <div className="mt-4 rounded-card border border-line bg-white shadow-card">
            <EmptyState
              icon={Search}
              title="No services match those filters"
              description="Try a different keyword or clear the category chip to see all nine care services."
              action={
                <Button variant="outline" onClick={resetFilters}>
                  Reset filters
                </Button>
              }
            />
          </div>
        ) : (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((svc, i) => (
              <motion.article
                key={svc.id}
                {...reveal}
                transition={{ duration: 0.4, delay: (i % 3) * 0.06 }}
                className="flex flex-col rounded-card border border-line bg-white p-5 shadow-card transition hover:-translate-y-1 hover:border-primary-200 hover:shadow-raised"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="grid h-12 w-12 place-items-center rounded-xl bg-mint-100 text-primary-700">
                    <svc.icon className="h-6 w-6" />
                  </span>
                  {svc.popular ? (
                    <span className="rounded-full bg-accent-50 px-2.5 py-1 text-[11px] font-bold text-accent-600">
                      Most booked
                    </span>
                  ) : null}
                </div>

                <h2 className="mt-4 font-display text-lg font-bold text-ink">{svc.name}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted">{svc.short}</p>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {svc.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-muted"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="mt-auto flex items-end justify-between gap-3 border-t border-line pt-4 sm:mt-5">
                  <div>
                    <p className="font-display text-xl font-extrabold text-ink">
                      {formatCurrency(svc.startingPrice)}
                    </p>
                    <p className="text-[11px] uppercase tracking-wide text-faint">per {svc.unit}</p>
                  </div>
                  <Button to="/caregivers" size="sm">
                    Book Now
                  </Button>
                </div>
              </motion.article>
            ))}
          </div>
        )}
      </section>

      {/* comparison note */}
      <section className="mx-auto max-w-7xl px-4 pb-6 sm:px-6 lg:px-8">
        <motion.div
          {...reveal}
          className="grid gap-6 rounded-card border border-line bg-white p-5 shadow-card sm:p-7 lg:grid-cols-[0.85fr_1.15fr]"
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary-700">Good to know</p>
            <h2 className="mt-2 font-display text-xl font-extrabold text-ink sm:text-2xl">
              How pricing compares across services
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Clinical services (post-surgery, bedridden, dementia) sit at the higher end because they need
              registered nurses. Companionship and medication reminders are the most affordable entry points, and
              night duty is billed per 12-hour shift instead of per hour.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-lg bg-mint-100 px-3 py-1.5 text-xs font-bold text-primary-800">
                From {formatCurrency(299)} / hour
              </span>
              <span className="rounded-lg bg-mint-100 px-3 py-1.5 text-xs font-bold text-primary-800">
                To {formatCurrency(749)} / shift
              </span>
            </div>
          </div>

          <ul className="space-y-3">
            {INCLUDED.map((line) => (
              <li key={line} className="flex gap-3 text-sm leading-relaxed text-ink-soft">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary-700 text-[10px] font-bold text-white">
                  ✓
                </span>
                {line}
              </li>
            ))}
          </ul>
        </motion.div>
      </section>

      {/* CTA band */}
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <div className="flex flex-col items-start gap-5 rounded-card border border-line bg-primary-900 p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <h2 className="font-display text-xl font-extrabold text-white sm:text-2xl">
              Not sure which service fits the patient?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-white/70">
              Share the diagnosis, discharge date and city — a care advisor will recommend the right service,
              hours and qualification level at no cost.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button to="/caregivers" size="lg" iconRight={ArrowRight}>
              Browse caregivers
            </Button>
            <Button to="/contact" variant="secondary" size="lg">
              Talk to an advisor
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}

export default ServicesPage
