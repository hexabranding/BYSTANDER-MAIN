import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Heart, LayoutGrid, List, SearchX, SlidersHorizontal, UserRound } from 'lucide-react'
import { useData } from '@/context/DataContext'
import { useDocumentTitle } from '@/hooks/useUi'
import { usePagination } from '@/hooks/usePagination'
import { serviceNames } from '@/data/services'
import { cn } from '@/utils/cn'
import { PageHeader } from '@/components/common/PageHeader'
import { SearchBar } from '@/components/common/SearchBar'
import { Select } from '@/components/forms/FormField'
import { CaregiverCard } from '@/components/caregiver/CaregiverCard'
import { Pagination } from '@/components/common/Pagination'
import { Chip } from '@/components/common/Tabs'
import { Button } from '@/components/common/Button'
import { EmptyState } from '@/components/common/States'

const AVAILABILITY_OPTIONS = [
  'Any availability',
  'Available Now',
  'Available Today',
  'Available Tonight',
  'Available Tomorrow',
  'Unavailable',
]

const RATING_OPTIONS = [
  { label: 'Any rating', value: 0 },
  { label: '4.5+ stars', value: 4.5 },
  { label: '4.0+ stars', value: 4 },
  { label: '3.5+ stars', value: 3.5 },
]

const SORT_OPTIONS = [
  { label: 'Sort · Recommended', value: 'recommended' },
  { label: 'Rating (high to low)', value: 'rating' },
  { label: 'Price (low to high)', value: 'priceAsc' },
  { label: 'Price (high to low)', value: 'priceDesc' },
  { label: 'Nearest first', value: 'distance' },
  { label: 'Most experienced', value: 'experience' },
]

export function CaregiversPage() {
  useDocumentTitle('Caretakers')
  const navigate = useNavigate()
  const { caregivers, shortlist } = useData()

  const [search, setSearch] = useState('')
  const [service, setService] = useState('All services')
  const [availability, setAvailability] = useState(AVAILABILITY_OPTIONS[0])
  const [minRating, setMinRating] = useState(0)
  const [sort, setSort] = useState('recommended')
  const [view, setView] = useState('grid')
  const [shortlistOnly, setShortlistOnly] = useState(false)
  const shortlisted = useMemo(() => new Set(shortlist), [shortlist])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = caregivers.filter((c) => {
      const matchesSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.area?.toLowerCase().includes(q) ||
        c.city?.toLowerCase().includes(q) ||
        c.qualification?.toLowerCase().includes(q) ||
        c.services?.some((s) => s.toLowerCase().includes(q))
      const matchesService = service === 'All services' || c.services?.includes(service)
      const matchesAvailability = availability === AVAILABILITY_OPTIONS[0] || c.availability === availability
      const matchesRating = (c.rating || 0) >= minRating
      const matchesShortlist = !shortlistOnly || shortlisted.has(c.id)
      return matchesSearch && matchesService && matchesAvailability && matchesRating && matchesShortlist
    })

    list = [...list]
    if (sort === 'rating') list.sort((a, b) => b.rating - a.rating)
    else if (sort === 'priceAsc') list.sort((a, b) => a.hourlyRate - b.hourlyRate)
    else if (sort === 'priceDesc') list.sort((a, b) => b.hourlyRate - a.hourlyRate)
    else if (sort === 'distance') list.sort((a, b) => (a.distanceKm || 99) - (b.distanceKm || 99))
    else if (sort === 'experience') list.sort((a, b) => b.experienceYears - a.experienceYears)
    else list.sort((a, b) => Number(b.verified) - Number(a.verified) || b.rating - a.rating)

    return list
  }, [caregivers, search, service, availability, minRating, sort, shortlistOnly, shortlisted])

  const { page, totalPages, totalItems, pageItems, goto } = usePagination(filtered, 8)
  useEffect(() => {
    goto(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, service, availability, minRating, sort, shortlistOnly])

  const activeFilters =
    (service !== 'All services' ? 1 : 0) +
    (availability !== AVAILABILITY_OPTIONS[0] ? 1 : 0) +
    (minRating > 0 ? 1 : 0) +
    (shortlistOnly ? 1 : 0)

  const resetFilters = () => {
    setService('All services')
    setAvailability(AVAILABILITY_OPTIONS[0])
    setMinRating(0)
    setShortlistOnly(false)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Caretakers"
        subtitle="Browse verified caretakers, shortlist your favourites and book in minutes."
        action={
          <Button to="/customer/book-caregiver" icon={UserRound}>
            Book a caretaker
          </Button>
        }
        meta={
          <>
            <Chip>{`Shortlisted · ${shortlisted.size}`}</Chip>
            <Chip>{`Showing · ${filtered.length}`}</Chip>
          </>
        }
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search by name, area, qualification or service…"
          className="lg:max-w-sm lg:flex-1"
        />
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <Select
            aria-label="Filter by service"
            value={service}
            onChange={(e) => setService(e.target.value)}
            className="h-11 sm:w-48"
          >
            <option>All services</option>
            {serviceNames.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Filter by availability"
            value={availability}
            onChange={(e) => setAvailability(e.target.value)}
            className="h-11 sm:w-44"
          >
            {AVAILABILITY_OPTIONS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Filter by rating"
            value={minRating}
            onChange={(e) => setMinRating(Number(e.target.value))}
            className="h-11 sm:w-36"
          >
            {RATING_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
          <Select aria-label="Sort caretakers" value={sort} onChange={(e) => setSort(e.target.value)} className="h-11 sm:w-52">
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <div className="col-span-2 flex items-center gap-2 sm:col-span-1">
            <Chip selected={shortlistOnly} onClick={() => setShortlistOnly((v) => !v)}>
              <Heart className={cn('h-3.5 w-3.5', shortlistOnly && 'fill-danger-500 text-danger-500')} />
              Shortlisted only
            </Chip>
            <div className="flex overflow-hidden rounded-xl border border-line-strong bg-white">
              <button
                type="button"
                onClick={() => setView('grid')}
                aria-label="Grid view"
                className={cn('grid h-11 w-11 place-items-center transition', view === 'grid' ? 'bg-mint-100 text-primary-700' : 'text-muted hover:text-ink')}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setView('list')}
                aria-label="List view"
                className={cn('grid h-11 w-11 place-items-center transition border-l border-line-strong', view === 'list' ? 'bg-mint-100 text-primary-700' : 'text-muted hover:text-ink')}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
            {activeFilters > 0 ? (
              <Button variant="ghost" size="sm" onClick={resetFilters} icon={SlidersHorizontal}>
                Reset
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-card border border-line bg-white shadow-card">
          <EmptyState
            icon={SearchX}
            title="No caretakers match"
            description="Try broadening your search or clearing the filters."
            action={
              <Button variant="outline" onClick={resetFilters}>
                Clear filters
              </Button>
            }
          />
        </div>
      ) : (
        <>
          {view === 'grid' ? (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {pageItems.map((cg) => (
                <CaregiverCard
                  key={cg.id}
                  caregiver={cg}
                  view="grid"
                  onBook={() => navigate(`/customer/book-caregiver?caregiver=${cg.id}`)}
                  actionLabel="View profile"
                />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {pageItems.map((cg) => (
                <CaregiverCard
                  key={cg.id}
                  caregiver={cg}
                  view="list"
                  onBook={() => navigate(`/customer/book-caregiver?caregiver=${cg.id}`)}
                  actionLabel="View profile"
                />
              ))}
            </div>
          )}
          <Pagination page={page} totalPages={totalPages} onPageChange={goto} totalItems={totalItems} />
        </>
      )}
    </div>
  )
}

export default CaregiversPage
