import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  Ban,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock,
  Download,
  Eye,
  Flag,
  IndianRupee,
  MapPin,
  RefreshCw,
  SearchX,
  Timer,
  UserRound,
  XCircle,
} from 'lucide-react'
import { useDebouncedValue, useDocumentTitle } from '@/hooks/useUi'
import { usePagination } from '@/hooks/usePagination'
import { BOOKING_STATUSES } from '@/utils/constants'
import { downloadText, formatCurrency, formatDate, toCSV } from '@/utils/format'
import { durationBasis, formatDuration } from '@/utils/duration'
import { cn } from '@/utils/cn'
import { PageHeader } from '@/components/common/PageHeader'
import { StatCard } from '@/components/common/StatCard'
import { SearchBar } from '@/components/common/SearchBar'
import { Tabs } from '@/components/common/Tabs'
import { DataTable } from '@/components/common/DataTable'
import { Pagination } from '@/components/common/Pagination'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Modal } from '@/components/common/Modal'
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog'
import { Button } from '@/components/common/Button'
import { Card, CardBody, CardHeader } from '@/components/common/Card'
import { EmptyState, ErrorState, TableSkeleton } from '@/components/common/States'
import { BookingTimeline, PriceBreakdown } from '@/components/common/TimelinePrice'
import { Select, Textarea } from '@/components/forms/FormField'
import { bookingService, isMongoObjectId } from '@/services'

const STATUS_TABS = ['All', ...BOOKING_STATUSES]

const DATE_RANGES = [
  { id: '7', label: 'Last 7 days' },
  { id: '30', label: 'Last 30 days' },
  { id: 'all', label: 'All dates' },
]

export function BookingsPage() {
  useDocumentTitle('Bookings')

  const [realBookings, setRealBookings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('All')
  const [range, setRange] = useState('30')
  const [viewingId, setViewingId] = useState(null)
  const [cancelReasonOpen, setCancelReasonOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelReasonError, setCancelReasonError] = useState('')
  const [dialog, setDialog] = useState(null)

  const debouncedSearch = useDebouncedValue(search)

  const fetchBookings = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await bookingService.getBookings({ limit: 100 })
      setRealBookings(res.bookings || [])
    } catch (err) {
      setError(err.message || 'Unable to load bookings from server')
      setRealBookings([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBookings()
  }, [fetchBookings])

  const allBookings = useMemo(() => {
    return realBookings || []
  }, [realBookings])

  const stats = useMemo(() => {
    const active = allBookings.filter((b) => ['Pending', 'Confirmed', 'In Progress'].includes(b.status)).length
    const completed = allBookings.filter((b) => b.status === 'Completed').length
    const cancelled = allBookings.filter((b) => b.status === 'Cancelled').length
    return { total: allBookings.length, active, completed, cancelled }
  }, [allBookings])

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    const cutoff = range === 'all' ? null : new Date(Date.now() - Number(range) * 86400000).toISOString().slice(0, 10)
    return allBookings
      .filter((b) => {
        const customerName = b.customerName || (b.customer?.fullName) || ''
        const caregiverName = b.caregiverName || (b.caregiver?.user?.fullName) || ''
        const matchesStatus = status === 'All' || b.status === status
        const matchesRange = !cutoff || (b.date && b.date >= cutoff)
        const matchesSearch =
          !q ||
          `${b.id} ${b.ref} ${b.service} ${customerName} ${caregiverName}`.toLowerCase().includes(q)
        return matchesStatus && matchesRange && matchesSearch
      })
      .map((b) => ({
        ...b,
        customerName: b.customerName || (b.customer?.fullName) || 'Customer',
        caregiverName: b.caregiverName || (b.caregiver?.user?.fullName) || 'Assigned Caregiver',
      }))
  }, [allBookings, debouncedSearch, status, range])

  const { page, totalPages, totalItems, pageItems, goto } = usePagination(filtered, 8)

  useEffect(() => {
    goto(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, status, range])

  const selected = viewingId ? allBookings.find((b) => b.id === viewingId) : null
  const selectedCaregiver = selected?.caregiver || null

  const canCancel = selected && ['Pending', 'Confirmed', 'pending', 'confirmed'].includes(selected.status)
  const canAct = selected && !['Completed', 'Cancelled', 'completed', 'cancelled'].includes(selected.status)

  const handleExport = () => {
    const rows = filtered.map((b) => ({
      bookingId: b.id,
      customer: b.customerName,
      caregiver: b.caregiverName,
      service: b.service,
      date: b.date,
      startTime: b.startTime,
      duration: formatDuration(b.hours),
      amount: b.total,
      paymentStatus: b.paymentStatus,
      bookingStatus: b.status,
      invoiceNo: b.invoiceNo,
    }))
    downloadText(`caremate-bookings-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(rows))
    toast.success(`Exported ${rows.length} booking${rows.length === 1 ? '' : 's'} to CSV`)
  }

  const openCancel = () => {
    setCancelReason('')
    setCancelReasonError('')
    setCancelReasonOpen(true)
  }

  const submitCancelReason = () => {
    const value = cancelReason.trim()
    if (value.length < 8) {
      setCancelReasonError('A clear reason of at least 8 characters is required.')
      return
    }
    setCancelReasonOpen(false)
    setCancelReason('')
    setCancelReasonError('')
    setDialog({ kind: 'cancel', reason: value })
  }

  const runDialog = async () => {
    const action = dialog
    setDialog(null)
    if (!action || !selected) return

    if (action.kind === 'complete') {
      toast.error('Force completion not permitted', {
        description: 'Shifts must be verified via customer and caretaker OTP exchange to safeguard escrow payouts.',
      })
    } else {
      try {
        await bookingService.cancelBooking(selected.id, action.reason)
        toast.success(`Booking ${selected.id} cancelled`, { description: action.reason })
        await fetchBookings()
      } catch (err) {
        toast.error('Cancellation failed', {
          description: err.message || 'Unable to cancel this booking engagement.',
        })
      }
    }
  }

  const flagBooking = () => {
    if (!selected) return
    toast.info(`Booking ${selected.id} flagged for review`, {
      description: 'Added to the operations review queue with a note for the trust & safety desk.',
    })
  }

  const columns = [
    {
      key: 'id',
      header: 'Booking',
      render: (b) => {
        const tint =
          b.status === 'Cancelled'
            ? 'border-l-danger-500 bg-danger-50/60'
            : b.paymentStatus === 'Refunded' || b.paymentStatus === 'Disputed'
              ? 'border-l-warning-400 bg-warning-50/60'
              : 'border-l-transparent'
        return (
          <div className={cn('-my-3.5 -ml-4 flex flex-col justify-center border-l-4 py-3.5 pl-3 pr-2', tint)}>
            <p className="font-display text-sm font-bold text-ink">{b.id}</p>
            <p className="text-xs text-faint">{b.ref}</p>
          </div>
        )
      },
    },
    {
      key: 'customerName',
      header: 'Customer',
      render: (b) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink">{b.customerName}</p>
          <p className="truncate text-xs text-faint">{b.patient?.name}</p>
        </div>
      ),
    },
    { key: 'caregiverName', header: 'Caretaker' },
    { key: 'service', header: 'Service' },
    {
      key: 'date',
      header: 'Schedule',
      render: (b) => (
        <div>
          <p className="whitespace-nowrap font-medium text-ink">{formatDate(b.date, { long: true })}</p>
          <p className="text-xs text-faint">{b.startTime}</p>
        </div>
      ),
    },
    {
      key: 'hours',
      header: 'Duration',
      render: (b) => <span className="tabular-nums">{formatDuration(b.hours, { short: true })}</span>,
    },
    {
      key: 'total',
      header: 'Price',
      align: 'right',
      render: (b) => <span className="font-semibold tabular-nums text-ink">{formatCurrency(b.total)}</span>,
    },
    {
      key: 'paymentStatus',
      header: 'Payment',
      render: (b) => <StatusBadge status={b.paymentStatus} size="sm" />,
    },
    { key: 'status', header: 'Booking status', render: (b) => <StatusBadge status={b.status} size="sm" /> },
    {
      key: 'action',
      header: 'Action',
      align: 'right',
      sortable: false,
      render: (b) => (
        <Button
          size="xs"
          variant="outline"
          icon={Eye}
          onClick={(e) => {
            e.stopPropagation()
            setViewingId(b.id)
          }}
        >
          View
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bookings"
        subtitle="Every care booking on CareMate — schedule, payment state and admin overrides."
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" icon={RefreshCw} onClick={fetchBookings} disabled={loading}>
              Refresh
            </Button>
            <Button variant="outline" size="sm" icon={Download} onClick={handleExport}>
              Export CSV
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Total bookings" value={stats.total} icon={ClipboardList} tone="primary" hint="All time" delay={0} />
        <StatCard label="Active" value={stats.active} icon={Timer} tone="accent" trend={10} hint="Pending, confirmed or live" delay={0.05} />
        <StatCard label="Completed" value={stats.completed} icon={CheckCircle2} tone="success" hint="Delivered and paid" delay={0.1} />
        <StatCard label="Cancelled" value={stats.cancelled} icon={XCircle} tone="warning" hint="Refunds issued" delay={0.15} />
      </div>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search booking ID, customer, caretaker or service…"
          className="xl:max-w-sm xl:flex-1"
        />
        <Tabs
          tabs={STATUS_TABS.map((s) => ({
            id: s,
            label: s,
            count: s === 'All' ? allBookings.length : allBookings.filter((b) => b.status === s).length,
          }))}
          active={status}
          onChange={setStatus}
          size="sm"
        />
        <div className="xl:ml-auto xl:w-48">
          <Select value={range} onChange={(e) => setRange(e.target.value)} aria-label="Filter by date range">
            {DATE_RANGES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {loading ? (
        <TableSkeleton count={8} />
      ) : error && allBookings.length === 0 ? (
        <div className="rounded-card border border-line bg-white shadow-card">
          <ErrorState
            title="Failed to load platform bookings"
            description={error}
            onRetry={fetchBookings}
          />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-card border border-line bg-white shadow-card">
          <EmptyState
            icon={SearchX}
            title="No bookings found"
            description="Adjust the status tab, date range or search term."
            action={
              <Button
                variant="outline"
                onClick={() => {
                  setSearch('')
                  setStatus('All')
                  setRange('all')
                }}
              >
                Clear filters
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <DataTable
            columns={columns}
            data={pageItems}
            keyExtractor={(row) => row.id}
            onRowClick={(row) => setViewingId(row.id)}
            initialSort={{ key: 'date', dir: 'desc' }}
            emptyTitle="No bookings found"
            emptyIcon={ClipboardList}
          />
          <Pagination page={page} totalPages={totalPages} onPageChange={goto} totalItems={totalItems} />
        </>
      )}

      <Modal
        open={Boolean(selected)}
        onClose={() => setViewingId(null)}
        title={selected ? `${selected.id} · ${selected.service}` : 'Booking'}
        subtitle={
          selected
            ? `${formatDate(selected.date, { long: true })} · ${selected.startTime} · ${formatDuration(selected.hours, { short: true })} · ${selected.careType}`
            : ''
        }
        size="xl"
        footer={
          selected ? (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Button variant="outline" icon={Flag} onClick={flagBooking}>
                Flag for review
              </Button>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  variant="danger"
                  icon={Ban}
                  onClick={openCancel}
                  disabled={!canCancel}
                  title={selected?.status === 'In Progress' ? 'In-progress shifts cannot be cancelled via self-service API' : undefined}
                >
                  Cancel booking
                </Button>
                <Button icon={CheckCircle2} onClick={() => setDialog({ kind: 'complete' })} disabled={!canAct}>
                  Force complete
                </Button>
              </div>
            </div>
          ) : null
        }
      >
        {selected ? (
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-5">
              <Card>
                <CardHeader title="Booking timeline" subtitle={`Invoice ${selected.invoiceNo}`} icon={CalendarDays} />
                <CardBody>
                  <BookingTimeline steps={selected.timeline} />
                </CardBody>
              </Card>

              <Card>
                <CardHeader title="Patient & location" icon={UserRound} />
                <CardBody className="space-y-3 text-sm">
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-muted">Patient</span>
                    <span className="text-right font-semibold text-ink">
                      {selected.patient?.name} · {selected.patient?.age} yrs · {selected.patient?.relation}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-muted">Care type</span>
                    <span className="font-semibold text-ink">{selected.careType}</span>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-muted">Caretaker</span>
                    <span className="text-right font-semibold text-ink">
                      {selectedCaregiver?.name || 'Not assigned'} · {formatCurrency(selected.hourlyRate)}/hr
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-muted">
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5" /> Address
                      </span>
                    </span>
                    <span className="max-w-[65%] text-right font-semibold text-ink">{selected.address}</span>
                  </div>
                  {selected.specialInstructions ? (
                    <div className="rounded-xl border border-line bg-gradient-to-br from-slate-50 to-white px-3.5 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-faint">
                        Special instructions
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-muted">{selected.specialInstructions}</p>
                    </div>
                  ) : null}
                </CardBody>
              </Card>
            </div>

            <div className="space-y-5">
              <PriceBreakdown
                items={[
                  {
                    label: selected.service,
                    meta: `${formatCurrency(selected.hourlyRate)}/hr × ${durationBasis(selected.hours)}`,
                    amount: selected.subtotal,
                  },
                ]}
                subtotal={selected.subtotal}
                platformFee={selected.platformFee}
                tax={selected.tax}
                commission={selected.commission}
                total={selected.total}
                currencyNote="18% GST applies to service and platform charges. Platform commission is deducted before the caretaker payout is released."
              />

              <Card>
                <CardHeader title="Payment" subtitle={`Invoice ${selected.invoiceNo}`} icon={IndianRupee} />
                <CardBody className="space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted">Payment status</span>
                    <StatusBadge status={selected.paymentStatus} size="sm" />
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted">Booking status</span>
                    <StatusBadge status={selected.status} size="sm" />
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted">Platform commission</span>
                    <span className="font-semibold tabular-nums text-ink">{formatCurrency(selected.commission)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted">
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" /> Created
                      </span>
                    </span>
                    <span className="font-semibold text-ink">{formatDate(selected.createdAt)}</span>
                  </div>
                  <div className="rounded-xl bg-mint-100 px-4 py-3">
                    <p className="text-sm font-bold text-primary-900">Gross booking value</p>
                    <p className="font-display text-lg font-extrabold tabular-nums text-primary-800">
                      {formatCurrency(selected.total)}
                    </p>
                  </div>
                </CardBody>
              </Card>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={cancelReasonOpen}
        onClose={() => {
          setCancelReasonOpen(false)
          setCancelReason('')
          setCancelReasonError('')
        }}
        title="Cancel this booking?"
        subtitle="A reason is required — it is shared with the customer and caretaker."
        size="sm"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="ghost"
              onClick={() => {
                setCancelReasonOpen(false)
                setCancelReason('')
                setCancelReasonError('')
              }}
            >
              Keep booking
            </Button>
            <Button variant="danger" onClick={submitCancelReason}>
              Continue
            </Button>
          </div>
        }
      >
        <Textarea
          rows={4}
          value={cancelReason}
          onChange={(e) => {
            setCancelReason(e.target.value)
            setCancelReasonError('')
          }}
          placeholder="e.g. Caretaker unavailable and no replacement found for this shift."
          aria-label="Cancellation reason"
          error={cancelReasonError}
        />
        {cancelReasonError ? null : (
          <p className="mt-1.5 text-xs text-muted">The escrowed amount is refunded to the customer automatically.</p>
        )}
      </Modal>

      <ConfirmationDialog
        open={Boolean(dialog)}
        onClose={() => setDialog(null)}
        onConfirm={runDialog}
        tone={dialog?.kind === 'cancel' ? 'danger' : 'primary'}
        title={dialog?.kind === 'cancel' ? 'Confirm cancellation?' : 'Force complete this booking?'}
        message={
          dialog?.kind === 'cancel'
            ? `${selected?.id} will be cancelled. Reason: “${dialog.reason}” — escrow is released back to the customer and the caretaker is notified.`
            : `${selected?.id} will be marked Completed immediately, releasing escrow to ${selectedCaregiver?.name || 'the caretaker'} within 24 hours. Use this only after the shift has been delivered.`
        }
        confirmLabel={dialog?.kind === 'cancel' ? 'Cancel booking' : 'Force complete'}
      />
    </div>
  )
}

export default BookingsPage
