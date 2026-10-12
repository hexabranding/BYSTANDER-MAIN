import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, ClipboardList, Plus, SearchX } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useData } from '@/context/DataContext'
import { useDebouncedValue, useDocumentTitle } from '@/hooks/useUi'
import { usePagination } from '@/hooks/usePagination'
import { formatCurrency, formatDate } from '@/utils/format'
import { PageHeader } from '@/components/common/PageHeader'
import { SearchBar } from '@/components/common/SearchBar'
import { Tabs } from '@/components/common/Tabs'
import { DataTable } from '@/components/common/DataTable'
import { Pagination } from '@/components/common/Pagination'
import { StatusBadge } from '@/components/common/StatusBadge'
import { BookingCard } from '@/components/booking/BookingCard'
import { Button } from '@/components/common/Button'
import { Chip } from '@/components/common/Tabs'
import { EmptyState } from '@/components/common/States'

const STATUS_TABS = ['All', 'Pending', 'Confirmed', 'In Progress', 'Completed', 'Cancelled']

export function BookingsPage() {
  useDocumentTitle('My bookings')
  const navigate = useNavigate()
  const { user } = useAuth()
  const { bookings, caregivers } = useData()

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('All')
  const debouncedSearch = useDebouncedValue(search)

  const customerId = user?.id || 'cu-201'

  const myBookings = useMemo(
    () => bookings.filter((b) => b.customerId === customerId),
    [bookings, customerId],
  )

  const caregiverName = (id) => caregivers.find((c) => c.id === id)?.name || 'Assigning…'

  const counts = useMemo(() => {
    const c = { Total: myBookings.length, Active: 0, Completed: 0, Cancelled: 0 }
    myBookings.forEach((b) => {
      if (b.status === 'Completed') c.Completed += 1
      else if (b.status === 'Cancelled') c.Cancelled += 1
      else c.Active += 1
    })
    return c
  }, [myBookings])

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    return myBookings.filter((b) => {
      const matchesStatus = status === 'All' || b.status === status
      const matchesSearch =
        !q ||
        b.id.toLowerCase().includes(q) ||
        b.ref?.toLowerCase().includes(q) ||
        b.service.toLowerCase().includes(q) ||
        b.patient?.name?.toLowerCase().includes(q)
      return matchesStatus && matchesSearch
    })
  }, [myBookings, debouncedSearch, status])

  const { page, totalPages, totalItems, pageItems, goto } = usePagination(filtered, 6)
  useEffect(() => {
    goto(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, status])

  const columns = [
    {
      key: 'id',
      header: 'Booking ID',
      render: (b) => (
        <div>
          <p className="font-display text-sm font-bold text-ink">{b.id}</p>
          <p className="text-xs text-faint">{b.ref}</p>
        </div>
      ),
    },
    {
      key: 'patient',
      header: 'Patient',
      sortable: false,
      render: (b) => (
        <div>
          <p className="font-medium text-ink">{b.patient?.name}</p>
          <p className="text-xs text-faint">
            {b.patient?.age} yrs · {b.patient?.relation}
          </p>
        </div>
      ),
    },
    { key: 'service', header: 'Service' },
    { key: 'caregiver', header: 'Caregiver', sortKey: 'caregiverName', render: (b) => caregiverName(b.caregiverId) },
    {
      key: 'date',
      header: 'Date & duration',
      render: (b) => (
        <div>
          <p className="font-medium text-ink">{formatDate(b.date, { long: true })}</p>
          <p className="text-xs text-faint">
            {b.startTime} · {b.hours} hrs
          </p>
        </div>
      ),
    },
    {
      key: 'total',
      header: 'Total price',
      align: 'right',
      render: (b) => <span className="font-semibold tabular-nums text-ink">{formatCurrency(b.total)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (b) => <StatusBadge status={b.status} size="sm" />,
    },
    {
      key: 'view',
      header: 'Details',
      align: 'right',
      sortable: false,
      render: (b) => (
        <Button size="xs" variant="outline" onClick={() => navigate(`/customer/bookings/${b.id}`)}>
          View details
        </Button>
      ),
    },
  ]

  const rows = pageItems.map((b) => ({ ...b, caregiverName: caregiverName(b.caregiverId) }))

  return (
    <div className="space-y-6">
      <PageHeader
        title="My bookings"
        subtitle="Track every care visit — from request to completion."
        action={
          <Button to="/customer/book-caregiver" icon={Plus}>
            New booking
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Chip>{`Total · ${counts.Total}`}</Chip>
        <Chip>{`Active · ${counts.Active}`}</Chip>
        <Chip>{`Completed · ${counts.Completed}`}</Chip>
        <Chip>{`Cancelled · ${counts.Cancelled}`}</Chip>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search by booking ID, patient or service…"
          className="sm:max-w-sm sm:flex-1"
        />
        <Tabs
          tabs={STATUS_TABS.map((s) => ({
            id: s,
            label: s,
            count: s === 'All' ? myBookings.length : myBookings.filter((b) => b.status === s).length,
          }))}
          active={status}
          onChange={setStatus}
          size="sm"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-card border border-line bg-white shadow-card">
          <EmptyState
            icon={SearchX}
            title="No bookings found"
            description={
              search || status !== 'All'
                ? 'Try clearing the search or switching the status filter.'
                : 'You have not booked a caregiver yet.'
            }
            action={
              search || status !== 'All' ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearch('')
                    setStatus('All')
                  }}
                >
                  Clear filters
                </Button>
              ) : (
                <Button to="/customer/book-caregiver" icon={CalendarDays}>
                  Book a caregiver
                </Button>
              )
            }
          />
        </div>
      ) : (
        <>
          <div className="hidden lg:block">
            <DataTable
              columns={columns}
              data={rows}
              keyExtractor={(row) => row.id}
              onRowClick={(row) => navigate(`/customer/bookings/${row.id}`)}
              initialSort={{ key: 'date', dir: 'desc' }}
              emptyTitle="No bookings found"
              emptyIcon={ClipboardList}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:hidden">
            {pageItems.map((b) => (
              <BookingCard
                key={b.id}
                booking={b}
                caregiverName={caregiverName(b.caregiverId)}
                to={`/customer/bookings/${b.id}`}
              />
            ))}
          </div>

          <Pagination page={page} totalPages={totalPages} onPageChange={goto} totalItems={totalItems} />
        </>
      )}
    </div>
  )
}

export default BookingsPage
