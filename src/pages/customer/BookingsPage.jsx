import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, ClipboardList, CreditCard, MessageSquare, Plus, SearchX, Star } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/context/AuthContext'
import { useData } from '@/context/DataContext'
import { useDebouncedValue, useDocumentTitle } from '@/hooks/useUi'
import { usePagination } from '@/hooks/usePagination'
import { formatCurrency, formatDate } from '@/utils/format'
import { formatDuration } from '@/utils/duration'
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
import { RatingModal } from '@/components/booking/RatingModal'

const STATUS_TABS = ['All', 'Pending', 'Confirmed', 'In Progress', 'Completed', 'Cancelled']
const PHASES = ['All', 'Current', 'Upcoming', 'Previous']

const startOfToday = () => {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return now
}

/** Time-based grouping: what is happening now, what is still to come, what is done. */
const phaseOf = (b) => {
  if (b.status === 'In Progress') return 'Current'
  if (b.status === 'Completed' || b.status === 'Cancelled') return 'Previous'
  const when = new Date(`${b.date}T00:00:00`)
  if (Number.isNaN(when.getTime())) return 'Upcoming'
  return when >= startOfToday() ? 'Upcoming' : 'Previous'
}

export function BookingsPage() {
  useDocumentTitle('My bookings')
  const navigate = useNavigate()
  const { user } = useAuth()
  const { bookings, caregivers, updateBooking, addTransaction, addReview, ensureConversation } = useData()

  const [search, setSearch] = useState('')
  const [phase, setPhase] = useState('All')
  const [status, setStatus] = useState('All')
  const [rateTarget, setRateTarget] = useState(null)
  const debouncedSearch = useDebouncedValue(search)

  const customerId = user?.id || 'cu-201'

  const myBookings = useMemo(
    () => bookings.filter((b) => b.customerId === customerId),
    [bookings, customerId],
  )

  const caregiverName = (id) => caregivers.find((c) => c.id === id)?.name || 'Assigning…'

  const counts = useMemo(() => {
    const c = { All: myBookings.length, Current: 0, Upcoming: 0, Previous: 0 }
    myBookings.forEach((b) => {
      c[phaseOf(b)] += 1
    })
    return c
  }, [myBookings])

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    return myBookings.filter((b) => {
      const matchesPhase = phase === 'All' || phaseOf(b) === phase
      const matchesStatus = status === 'All' || b.status === status
      const matchesSearch =
        !q ||
        b.id.toLowerCase().includes(q) ||
        b.ref?.toLowerCase().includes(q) ||
        b.service.toLowerCase().includes(q) ||
        b.patient?.name?.toLowerCase().includes(q)
      return matchesPhase && matchesStatus && matchesSearch
    })
  }, [myBookings, debouncedSearch, phase, status])

  const { page, totalPages, totalItems, pageItems, goto } = usePagination(filtered, 6)
  useEffect(() => {
    goto(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, phase, status])

  const canPay = (b) => b.paymentStatus === 'Pending' && b.status !== 'Cancelled'
  const canRate = (b) => b.status === 'Completed' && !b.customerRating && Boolean(b.caregiverId)

  const handlePay = (b) => {
    updateBooking(b.id, { paymentStatus: 'Escrow Held' })
    const tx = addTransaction({
      bookingId: b.id,
      ref: b.ref,
      customerId,
      caregiverId: b.caregiverId,
      amount: b.total,
      status: 'Escrow Held',
      method: 'UPI (demo)',
    })
    toast.success('Payment secured in escrow', {
      description: `${formatCurrency(b.total)} held for ${b.id}. Tx ${tx.id}.`,
    })
  }

  const handleSubmitRating = (b, { criteria, average, comment }) => {
    addReview({
      bookingId: b.id,
      caregiverId: b.caregiverId,
      customerId: b.customerId,
      customerName: user?.name || 'Customer',
      rating: average,
      criteria,
      comment: comment || 'Great service, thank you!',
    })
    updateBooking(b.id, { customerRating: { ...criteria, average, at: new Date().toISOString() } })
    toast.success('Thank you for your review!', {
      description: `${caregiverName(b.caregiverId)} received your ${average}-star rating.`,
    })
  }

  const handleMessage = (b) => {
    const cg = caregivers.find((c) => c.id === b.caregiverId)
    const threadId = ensureConversation({
      bookingRef: b.ref,
      audienceRole: 'customer',
      name: cg?.name || 'Care Coordinator',
      roleLabel: cg?.qualification || 'CareMate support',
      avatar: cg?.photo || '',
      firstMessage: `Hi, I'm reaching out regarding booking ${b.id} (${b.service} on ${formatDate(b.date)}).`,
    })
    navigate(`/customer/messages?thread=${threadId}`)
  }

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
    { key: 'caregiver', header: 'Caretaker', sortKey: 'caregiverName', render: (b) => caregiverName(b.caregiverId) },
    {
      key: 'date',
      header: 'Date & duration',
      render: (b) => (
        <div>
          <p className="font-medium text-ink">{formatDate(b.date, { long: true })}</p>
          <p className="text-xs text-faint">
            {b.startTime} · {formatDuration(b.hours, { short: true })}
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
      key: 'actions',
      header: 'Actions',
      align: 'right',
      sortable: false,
      render: (b) => (
        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          {canPay(b) ? (
            <Button size="xs" icon={CreditCard} onClick={() => handlePay(b)}>
              Pay
            </Button>
          ) : null}
          {canRate(b) ? (
            <Button size="xs" variant="outline" icon={Star} onClick={() => setRateTarget(b)}>
              Rate
            </Button>
          ) : null}
          {b.status !== 'Cancelled' ? (
            <Button size="xs" variant="outline" icon={MessageSquare} onClick={() => handleMessage(b)}>
              Message
            </Button>
          ) : null}
          <Button size="xs" variant="outline" onClick={() => navigate(`/customer/bookings/${b.id}`)}>
            View
          </Button>
        </div>
      ),
    },
  ]

  const rows = pageItems.map((b) => ({ ...b, caregiverName: caregiverName(b.caregiverId) }))

  const hasFilters = Boolean(search) || phase !== 'All' || status !== 'All'

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

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by time period">
        {PHASES.map((p) => (
          <Chip key={p} selected={phase === p} onClick={() => setPhase(p)}>
            {`${p} · ${counts[p]}`}
          </Chip>
        ))}
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
              hasFilters
                ? 'Try clearing the search or switching the period and status filters.'
                : 'You have not booked a caretaker yet.'
            }
            action={
              hasFilters ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearch('')
                    setPhase('All')
                    setStatus('All')
                  }}
                >
                  Clear filters
                </Button>
              ) : (
                <Button to="/customer/book-caregiver" icon={CalendarDays}>
                  Book a caretaker
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

      <RatingModal
        open={Boolean(rateTarget)}
        onClose={() => setRateTarget(null)}
        subjectName={rateTarget ? caregiverName(rateTarget.caregiverId) : ''}
        onSubmit={(rating) => rateTarget && handleSubmitRating(rateTarget, rating)}
      />
    </div>
  )
}

export default BookingsPage
