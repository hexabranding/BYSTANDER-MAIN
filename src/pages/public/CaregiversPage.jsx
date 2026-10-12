import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { LayoutGrid, List, RotateCcw, SlidersHorizontal, UserSearch } from 'lucide-react'
import { useDocumentTitle, useDebouncedValue } from '@/hooks/useUi'
import { usePagination } from '@/hooks/usePagination'
import { cn } from '@/utils/cn'
import { CARE_TYPES, CITIES, QUALIFICATIONS } from '@/utils/constants'
import { getServiceById } from '@/data/services'
import { CAREGIVERS } from '@/data/caregivers'
import { Button } from '@/components/common/Button'
import { Breadcrumbs } from '@/components/common/Breadcrumbs'
import { PageHeader } from '@/components/common/PageHeader'
import { SearchBar } from '@/components/common/SearchBar'
import { Pagination } from '@/components/common/Pagination'
import { EmptyState } from '@/components/common/States'
import { FilterPanel, FilterGroup, CheckOption } from '@/components/common/FilterPanel'
import { FormField, Select } from '@/components/forms/FormField'
import { CaregiverCard } from '@/components/caregiver/CaregiverCard'

const AVAILABILITY_OPTIONS = ['Any', 'Available Now', 'Available Today', 'Available Tonight']
const RATING_OPTIONS = [
  { label: 'Any rating', value: '0' },
  { label: '4.0 and above', value: '4' },
  { label: '4.5 and above', value: '4.5' },
  { label: '4.8 and above', value: '4.8' },
]
const SORT_OPTIONS = [
  { label: 'Highest rated', value: 'rating' },
  { label: 'Price: low to high', value: 'price-asc' },
  { label: 'Price: high to low', value: 'price-desc' },
  { label: 'Most experienced', value: 'experience' },
]
const MAX_DISTANCE = 25

export function CaregiversPage() {
  useDocumentTitle('Find Caregivers')

  const [searchParams] = useSearchParams()
  const [filtersOpen, setFiltersOpen] = useState(false)

  const [query, setQuery] = useState(() => searchParams.get('q') || '')
  const [city, setCity] = useState(() => {
    const c = searchParams.get('city')
    return c && CITIES.includes(c) ? c : ''
  })
  const [selectedServices, setSelectedServices] = useState(() => {
    const s = searchParams.get('service')
    if (!s) return []
    const byId = getServiceById(s)
    if (byId) return [byId.name]
    return CARE_TYPES.includes(s) ? [s] : []
  })
  const [maxDistance, setMaxDistance] = useState(MAX_DISTANCE)
  const [availability, setAvailability] = useState('Any')
  const [qualification, setQualification] = useState('Any')
  const [minRating, setMinRating] = useState(0)
  const [sort, setSort] = useState('rating')
  const [view, setView] = useState('grid')

  const debouncedQuery = useDebouncedValue(query, 300)
  const servicesKey = selectedServices.join('|')

  const results = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase()
    const filtered = CAREGIVERS.filter((cg) => {
      if (q) {
        const haystack = `${cg.name} ${cg.qualification} ${cg.area} ${cg.city} ${cg.services.join(' ')}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      if (city && cg.city !== city) return false
      if (selectedServices.length && !selectedServices.every((s) => cg.services.includes(s))) return false
      if (availability !== 'Any' && cg.availability !== availability) return false
      if (qualification !== 'Any' && cg.qualification !== qualification) return false
      if (minRating && cg.rating < minRating) return false
      if (cg.distanceKm > maxDistance) return false
      return true
    })

    return [...filtered].sort((a, b) => {
      if (sort === 'price-asc') return a.hourlyRate - b.hourlyRate
      if (sort === 'price-desc') return b.hourlyRate - a.hourlyRate
      if (sort === 'experience') return b.experienceYears - a.experienceYears
      return b.rating - a.rating || b.reviewCount - a.reviewCount
    })
  }, [debouncedQuery, city, selectedServices, availability, qualification, minRating, maxDistance, sort])

  const pagination = usePagination(results, 8)
  const { goto, reset, page, totalPages, totalItems, pageItems } = pagination

  useEffect(() => {
    goto(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery, city, servicesKey, availability, qualification, minRating, maxDistance, sort])

  const activeCount =
    (query ? 1 : 0) +
    (city ? 1 : 0) +
    (selectedServices.length ? 1 : 0) +
    (availability !== 'Any' ? 1 : 0) +
    (qualification !== 'Any' ? 1 : 0) +
    (minRating > 0 ? 1 : 0) +
    (maxDistance < MAX_DISTANCE ? 1 : 0)

  const toggleService = (name) =>
    setSelectedServices((prev) => (prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name]))

  const resetFilters = () => {
    setQuery('')
    setCity('')
    setSelectedServices([])
    setMaxDistance(MAX_DISTANCE)
    setAvailability('Any')
    setQualification('Any')
    setMinRating(0)
    reset()
  }

  const copySearchLink = async () => {
    const params = new URLSearchParams()
    if (city) params.set('city', city)
    if (selectedServices[0]) params.set('service', selectedServices[0])
    if (query.trim()) params.set('q', query.trim())
    const url = `${window.location.origin}/caregivers${params.toString() ? `?${params.toString()}` : ''}`
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Search link copied — share it with your family.')
    } catch {
      toast.error('Your browser blocked clipboard access. Copy the address bar instead.')
    }
  }

  return (
    <div className="bg-canvas">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <Breadcrumbs items={[{ label: 'Caregivers' }]} />

        <div className="mt-4">
          <PageHeader
            title="Find a verified caregiver"
            subtitle="Filter 16 hand-checked profiles by city, qualification, availability and budget. Every result below has passed identity, registration and address verification."
            action={
              <Button variant="outline" size="sm" onClick={copySearchLink}>
                Copy search link
              </Button>
            }
          />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[17.5rem_1fr] lg:items-start">
          {/* ------------- filters ------------- */}
          <aside className="lg:sticky lg:top-20">
            <div className={cn('lg:block', filtersOpen ? 'block' : 'hidden')}>
              <FilterPanel
                title="Filters"
                activeCount={activeCount}
                onReset={resetFilters}
                className="lg:shadow-card"
              >
                <FilterGroup label="Location">
                  <FormField label="City" htmlFor="cg-city">
                    <Select id="cg-city" value={city} onChange={(e) => setCity(e.target.value)}>
                      <option value="">All cities</option>
                      {CITIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                </FilterGroup>

                <FilterGroup label={`Max distance · ${maxDistance} km`}>
                  <input
                    type="range"
                    min={1}
                    max={MAX_DISTANCE}
                    step={1}
                    value={maxDistance}
                    onChange={(e) => setMaxDistance(Number(e.target.value))}
                    aria-label="Maximum distance in kilometres"
                    className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-[#0F766E]"
                  />
                  <div className="flex justify-between text-[11px] text-faint">
                    <span>1 km</span>
                    <span>{MAX_DISTANCE} km</span>
                  </div>
                </FilterGroup>

                <FilterGroup label="Service type">
                  <div className="max-h-56 space-y-2 overflow-y-auto pr-1 thin-scrollbar">
                    {CARE_TYPES.map((svc) => (
                      <CheckOption
                        key={svc}
                        label={svc}
                        checked={selectedServices.includes(svc)}
                        onChange={() => toggleService(svc)}
                        count={CAREGIVERS.filter((cg) => cg.services.includes(svc)).length}
                      />
                    ))}
                  </div>
                </FilterGroup>

                <FilterGroup label="Availability">
                  <FormField label="Shift availability" htmlFor="cg-availability">
                    <Select
                      id="cg-availability"
                      value={availability}
                      onChange={(e) => setAvailability(e.target.value)}
                    >
                      {AVAILABILITY_OPTIONS.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                </FilterGroup>

                <FilterGroup label="Qualification">
                  <FormField label="Qualification" htmlFor="cg-qualification">
                    <Select
                      id="cg-qualification"
                      value={qualification}
                      onChange={(e) => setQualification(e.target.value)}
                    >
                      <option value="Any">Any qualification</option>
                      {QUALIFICATIONS.map((q) => (
                        <option key={q} value={q}>
                          {q}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                </FilterGroup>

                <FilterGroup label="Minimum rating">
                  <FormField label="Rating" htmlFor="cg-rating">
                    <Select
                      id="cg-rating"
                      value={String(minRating)}
                      onChange={(e) => setMinRating(Number(e.target.value))}
                    >
                      {RATING_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                </FilterGroup>
              </FilterPanel>
            </div>
          </aside>

          {/* ------------- results ------------- */}
          <div>
            <div className="flex flex-col gap-3 rounded-card border border-line bg-white p-3.5 shadow-card sm:flex-row sm:items-end">
              <SearchBar
                value={query}
                onChange={setQuery}
                placeholder="Search by name or qualification…"
                className="flex-1"
              />
              <FormField label="Sort by" htmlFor="cg-sort" className="sm:w-48">
                <Select id="cg-sort" value={sort} onChange={(e) => setSort(e.target.value)}>
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </FormField>

              <div className="flex items-center rounded-xl border border-line-strong bg-white p-0.5 sm:mb-0.5">
                <button
                  type="button"
                  onClick={() => setView('grid')}
                  aria-label="Grid view"
                  aria-pressed={view === 'grid'}
                  className={cn(
                    'grid h-9 w-9 place-items-center rounded-lg transition',
                    view === 'grid' ? 'bg-mint-100 text-primary-700' : 'text-muted hover:text-ink',
                  )}
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setView('list')}
                  aria-label="List view"
                  aria-pressed={view === 'list'}
                  className={cn(
                    'grid h-9 w-9 place-items-center rounded-lg transition',
                    view === 'list' ? 'bg-mint-100 text-primary-700' : 'text-muted hover:text-ink',
                  )}
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <Button
                variant="outline"
                size="sm"
                icon={SlidersHorizontal}
                onClick={() => setFiltersOpen((v) => !v)}
                className="lg:hidden"
              >
                Filters{activeCount > 0 ? ` (${activeCount})` : ''}
              </Button>

              <p className="text-sm text-muted">
                <span className="font-bold text-ink">{totalItems}</span> caregiver{totalItems === 1 ? '' : 's'} match
                your filters
                {activeCount > 0 ? (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="ml-2 inline-flex items-center gap-1 text-xs font-semibold text-danger-600 transition hover:text-danger-700"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Reset
                  </button>
                ) : null}
              </p>
            </div>

            {totalItems === 0 ? (
              <div className="mt-4 rounded-card border border-line bg-white shadow-card">
                <EmptyState
                  icon={UserSearch}
                  title="No caregivers match these filters"
                  description="Widen the distance, remove a qualification filter or clear the search to see all available caregivers."
                  action={
                    <Button variant="outline" icon={RotateCcw} onClick={resetFilters}>
                      Reset filters
                    </Button>
                  }
                />
              </div>
            ) : (
              <div
                className={cn(
                  'mt-4 grid gap-4',
                  view === 'grid' ? 'sm:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1',
                )}
              >
                {pageItems.map((cg) => (
                  <CaregiverCard key={cg.id} caregiver={cg} view={view} />
                ))}
              </div>
            )}

            <Pagination
              page={page}
              totalPages={totalPages}
              onPageChange={goto}
              totalItems={totalItems}
              className="mt-6"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default CaregiversPage
