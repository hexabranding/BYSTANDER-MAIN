import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { CalendarCheck, ClipboardList, Clock, PlayCircle, Search, Wallet } from 'lucide-react'

import { useAuth } from '@/context/AuthContext'
import { useData } from '@/context/DataContext'
import { useDocumentTitle } from '@/hooks/useUi'
import { usePagination } from '@/hooks/usePagination'
import { bookingsForCaregiver, getCustomerById } from '@/data/bookings'
import { formatCurrency, formatDate, formatTime } from '@/utils/format'
import { Button } from '@/components/common/Button'
import { Card } from '@/components/common/Card'
import { StatCard } from '@/components/common/StatCard'
import { StatusBadge } from '@/components/common/StatusBadge'
import { PageHeader } from '@/components/common/PageHeader'
import { Tabs } from '@/components/common/Tabs'
import { SearchBar } from '@/components/common/SearchBar'
import { DataTable } from '@/components/common/DataTable'
import { Pagination } from '@/components/common/Pagination'
import { Modal } from '@/components/common/Modal'
import { EmptyState } from '@/components/common/States'
import { BookingCard } from '@/components/booking/BookingCard'
import { BookingTimeline, PriceBreakdown } from '@/components/common/TimelinePrice'

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'Pending', label: 'Pending' },
  { id: 'Confirmed', label: 'Confirmed' },
  { id: 'In Progress', label: 'In Progress' },
  { id: 'Completed', label: 'Completed' },
  { id: 'Cancelled', label: 'Cancelled' },
]

export function BookingsPage() {
  useDocumentTitle('My Bookings')

  const { user } = useAuth()
  const { bookings, advanceBooking } = useData()

  const myId = user?.caregiverId || 'cg-101'
  const [tab, setTab] = useState('all')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)

  const myBookings = useMemo(() => {
    const list = bookings.filter((b) => b.caregiverId === myId)
    return list.length ? list : bookingsForCaregiver(myId)
  }, [bookings, myId])

  const counts = useMemo(() => {
    const c = { all: myBookings.length }
    for (const b of myBookings) c[b.status] = (c[b.status] || 0) + 1
    return c
  }, [myBookings])

  const filtered = useMemo(() => {
    const list = tab === 'all' ? myBookings : myBookings.filter((b) => b.status === tab)
    const q = query.trim().toLowerCase()
    if (!q) return list
    return list.filter((b) =>
      [b.id, b.ref, b.service, getCustomerById(b.customerId)?.name, b.patient?.name].join(' ').toLowerCase().includes(q),
    )
  }, [myBookings, tab, query])

  const { page, totalPages, totalItems, pageItems, goto } = usePagination(filtered, 6)

  const handleCheckIn = () => {
    if (!selected || selected.status !== 'Confirmed') return
    advanceBooking(selected.id, 'start')
    toast.success('Checked in — the service is now in progress')
    setSelected(null)
  }

  const columns = [
    {
      key: 'id',
      header: 'Booking ID',
      render: (row) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setSelected(row)
          }}
          className="font-display text-xs font-bold uppercase tracking-wide text-primary-700 hover:underline"
        >
          {row.id}
        </button>
      ),
    },
    { key: 'customer', header: 'Customer', sortKey: 'customerId', render: (row) => getCustomerById(row.customerId)?.name || '—' },
    { key: 'patient', header: 'Patient', sortable: false, render: (row) => row.patient?.name || '—' },
    { key: 'service', header: 'Service' },
    {
      key: 'date',
      header: 'Date & time',
      render: (row) => (
        <div className="text-sm">
          <p className="font-semibold text-ink">{formatDate(row.date, { long: true })}</p>
          <p className="text-xs text-muted">{row.startTime}</p>
        </div>
      ),
    },
    { key: 'hours', header: 'Duration', align: 'right', render: (row) => `${row.hours} hrs` },
    {
      key: 'net',
      header: 'Earnings',
      align: 'right',
      sortable: false,
      render: (row) => (
        <span className="font-semibold tabular-nums text-ink">{formatCurrency(row.subtotal - row.commission)}</span>
      ),
    },
    { key: 'status', header: 'Status', sortable: false, render: (row) => <StatusBadge status={row.status} size="sm" /> },
    {
      key: 'action',
      header: 'Action',
      sortable: false,
      align: 'right',
      render: (row) => (
        <Button
          variant="ghost"
          size="xs"
          onClick={(e) => {
            e.stopPropagation()
            setSelected(row)
          }}
        >
          View Details
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="My bookings"
        subtitle="Every shift assigned to you — track status, check in for confirmed visits and review your net earning after commission."
        meta={<span className="text-sm text-muted">{counts.all} total · {counts.Confirmed || 0} confirmed · {counts['In Progress'] || 0} in progress</span>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total bookings" value={counts.all} icon={ClipboardList} tone="primary" hint="All time on CareMate" delay={0} />
        <StatCard label="Confirmed" value={counts.Confirmed || 0} icon={CalendarCheck} tone="accent" hint="Ready to check in" delay={0.05} />
        <StatCard label="In progress" value={counts['In Progress'] || 0} icon={Clock} tone="info" hint="Active right now" delay={0.1} />
        <StatCard label="Completed" value={counts.Completed || 0} icon={Wallet} tone="success" hint="Paid & settled" delay={0.15} />
      </div>

      <Tabs
        tabs={TABS.map((t) => ({ ...t, count: t.id === 'all' ? counts.all : counts[t.id] || 0 }))}
        active={tab}
        onChange={setTab}
      />

      <SearchBar value={query} onChange={setQuery} placeholder="Search by booking ID, service or customer…" />

      {filtered.length ? (
        <>
          <div className="hidden lg:block">
            <DataTable columns={columns} data={pageItems} keyExtractor={(row) => row.id} emptyIcon={Search} />
          </div>

          <div className="grid gap-4 lg:hidden">
            {pageItems.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                customerName={getCustomerById(booking.customerId)?.name}
                to={`/caregiver/bookings/${booking.id}`}
                actions={
                  <Button variant="primary" size="sm" className="flex-1" onClick={() => setSelected(booking)}>
                    View details
                  </Button>
                }
              />
            ))}
          </div>

          <Pagination page={page} totalPages={totalPages} onPageChange={goto} totalItems={totalItems} />
        </>
      ) : (
        <Card>
          <EmptyState
            icon={ClipboardList}
            title={tab === 'all' ? 'No bookings yet' : `No ${tab.toLowerCase()} bookings`}
            description={
              query
                ? 'No booking matches your search. Try a different ID, service or customer name.'
                : 'Accepted jobs appear here as bookings. Browse open jobs to fill your schedule.'
            }
            action={
              query ? (
                <Button variant="outline" onClick={() => setQuery('')}>
                  Clear search
                </Button>
              ) : (
                <Button variant="primary" to="/caregiver/jobs">
                  Browse jobs
                </Button>
              )
            }
          />
        </Card>
      )}

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected ? `Booking ${selected.id}` : ''}
        subtitle={selected ? `${selected.service} · Ref ${selected.ref}` : ''}
        size="lg"
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button variant="ghost" onClick={() => setSelected(null)}>
              Close
            </Button>
            {selected?.status === 'Confirmed' ? (
              <Button variant="primary" icon={PlayCircle} onClick={handleCheckIn}>
                Check in for shift
              </Button>
            ) : null}
          </div>
        }
      >
        {selected ? (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={selected.status} />
              <StatusBadge status={selected.paymentStatus} />
              <span className="text-xs text-muted">Invoice {selected.invoiceNo}</span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-line bg-slate-50/70 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-faint">Patient</p>
                <p className="mt-1.5 text-sm font-semibold text-ink">{selected.patient?.name}</p>
                <p className="text-xs text-muted">
                  {selected.patient?.age} yrs · {selected.patient?.relation}
                </p>
              </div>
              <div className="rounded-xl border border-line bg-slate-50/70 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-faint">Schedule</p>
                <p className="mt-1.5 text-sm font-semibold text-ink">{formatDate(selected.date, { long: true })}</p>
                <p className="text-xs text-muted">
                  {selected.startTime} · {selected.hours} hrs
                </p>
              </div>
              <div className="rounded-xl border border-line bg-slate-50/70 p-4 sm:col-span-2">
                <p className="text-xs font-bold uppercase tracking-wider text-faint">Address</p>
                <p className="mt-1.5 text-sm text-ink-soft">{selected.address}</p>
              </div>
            </div>

            <div>
              <h3 className="font-display text-sm font-bold text-ink">Booking timeline</h3>
              <div className="mt-4">
                <BookingTimeline steps={selected.timeline} />
              </div>
            </div>

            <PriceBreakdown
              subtotal={selected.subtotal}
              platformFee={selected.platformFee}
              tax={selected.tax}
              commission={selected.commission}
              total={selected.total}
              currencyNote={`Your net earning for this shift: ${formatCurrency(selected.subtotal - selected.commission)} (gross ${formatCurrency(selected.subtotal)} minus ${formatCurrency(selected.commission)} platform commission). Shift started at ${formatTime(`${selected.date}T${selected.startTime}:00`)}.`}
            />
          </div>
        ) : null}
      </Modal>
    </div>
  )
}

export default BookingsPage
