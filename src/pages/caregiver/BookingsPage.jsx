import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { CalendarCheck, CheckCircle2, ClipboardList, Clock, LogIn, LogOut, QrCode, Search, ShieldCheck, Wallet } from 'lucide-react'

import { useAuth } from '@/context/AuthContext'
import { useData } from '@/context/DataContext'
import { useDocumentTitle } from '@/hooks/useUi'
import { usePagination } from '@/hooks/usePagination'
import { bookingsForCaregiver, getCustomerById } from '@/data/bookings'
import { formatCurrency, formatDate, formatDateTime, formatTime } from '@/utils/format'
import { formatDuration } from '@/utils/duration'
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
import { CheckInOutModal } from '@/components/booking/CheckInOutModal'

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
  const { bookings, advanceBooking, confirmBooking, cancelBooking } = useData()

  const myId = user?.caregiverId || 'cg-101'
  const [tab, setTab] = useState('all')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)
  const [checkFlow, setCheckFlow] = useState(null)

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

  const handleRequest = (action) => {
    if (!selected) return
    if (action === 'accept') {
      confirmBooking(selected.id)
      toast.success('Booking request accepted', {
        description: `${selected.service} on ${formatDate(selected.date, { long: true })} is confirmed.`,
      })
    } else {
      cancelBooking(selected.id, 'Declined by caretaker')
      toast.info('Booking request declined', { description: 'The customer has been notified.' })
    }
    setSelected(null)
  }

  const openCheckFlow = (booking, mode) => {
    setSelected(null)
    setCheckFlow({ booking, mode })
  }

  const handleCheckConfirm = (payload) => {
    if (!checkFlow) return
    const { booking, mode } = checkFlow
    advanceBooking(booking.id, mode === 'checkin' ? 'start' : 'complete', payload)
    toast.success(
      mode === 'checkin'
        ? 'Checked in — the service is now in progress'
        : 'Checked out — the service is marked complete',
      {
        description: `QR ${payload.qrCode} verified at ${formatDateTime(payload.capturedAt)}.`,
      },
    )
    setCheckFlow(null)
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
    { key: 'hours', header: 'Duration', align: 'right', render: (row) => formatDuration(row.hours, { short: true }) },
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
            {selected?.status === 'Pending' ? (
              <>
                <Button variant="outline" onClick={() => handleRequest('decline')}>
                  Decline
                </Button>
                <Button variant="primary" icon={CheckCircle2} onClick={() => handleRequest('accept')}>
                  Accept request
                </Button>
              </>
            ) : null}
            {selected?.status === 'Confirmed' ? (
              <Button variant="primary" icon={LogIn} onClick={() => openCheckFlow(selected, 'checkin')}>
                {selected?.checkIn ? 'Re-verify check-in' : 'Check in for shift'}
              </Button>
            ) : null}
            {selected?.status === 'In Progress' ? (
              <Button variant="primary" icon={LogOut} onClick={() => openCheckFlow(selected, 'checkout')}>
                Check out & complete
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
              <div className="rounded-xl border border-line bg-gradient-to-br from-slate-50 to-white p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-faint">Patient</p>
                <p className="mt-1.5 text-sm font-semibold text-ink">{selected.patient?.name}</p>
                <p className="text-xs text-muted">
                  {selected.patient?.age} yrs · {selected.patient?.relation}
                </p>
              </div>
              <div className="rounded-xl border border-line bg-gradient-to-br from-slate-50 to-white p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-faint">Schedule</p>
                <p className="mt-1.5 text-sm font-semibold text-ink">{formatDate(selected.date, { long: true })}</p>
                <p className="text-xs text-muted">
                  {selected.startTime} · {formatDuration(selected.hours, { short: true })}
                </p>
              </div>
              <div className="rounded-xl border border-line bg-gradient-to-br from-slate-50 to-white p-4 sm:col-span-2">
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

            {selected.checkIn || selected.checkOut ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {selected.checkIn ? (
                  <div className="rounded-xl border border-line bg-slate-50 px-4 py-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-faint">Check-in record</span>
                      <StatusBadge status="Verified" size="sm" />
                    </div>
                    <p className="mt-1.5 text-sm font-semibold text-ink">{formatDateTime(selected.checkIn.at)}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                      <QrCode className="h-3 w-3 text-primary-600" /> {selected.checkIn.qrCode}
                    </p>
                  </div>
                ) : null}
                {selected.checkOut ? (
                  <div className="rounded-xl border border-line bg-slate-50 px-4 py-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-faint">Check-out record</span>
                      <StatusBadge status="Verified" size="sm" />
                    </div>
                    <p className="mt-1.5 text-sm font-semibold text-ink">{formatDateTime(selected.checkOut.at)}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                      <ShieldCheck className="h-3 w-3 text-success-600" /> Selfie captured
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}

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

      <CheckInOutModal
        open={Boolean(checkFlow)}
        onClose={() => setCheckFlow(null)}
        mode={checkFlow?.mode || 'checkin'}
        booking={checkFlow?.booking || null}
        onConfirm={handleCheckConfirm}
      />
    </div>
  )
}

export default BookingsPage
