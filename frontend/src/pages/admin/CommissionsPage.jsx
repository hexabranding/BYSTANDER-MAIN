import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CheckCircle2, Gauge, Hourglass, Percent, RefreshCw, Scale, SearchX } from 'lucide-react'
import { useDebouncedValue, useDocumentTitle } from '@/hooks/useUi'
import { usePagination } from '@/hooks/usePagination'
import { PLATFORM_COMMISSION } from '@/utils/constants'
import { formatCurrency, formatDate, formatNumber } from '@/utils/format'
import { PageHeader } from '@/components/common/PageHeader'
import { StatCard } from '@/components/common/StatCard'
import { Card, CardBody, CardHeader } from '@/components/common/Card'
import { Button } from '@/components/common/Button'
import { SearchBar } from '@/components/common/SearchBar'
import { Tabs } from '@/components/common/Tabs'
import { DataTable } from '@/components/common/DataTable'
import { Pagination } from '@/components/common/Pagination'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Modal } from '@/components/common/Modal'
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog'
import { EmptyState, TableSkeleton } from '@/components/common/States'
import { adminService } from '@/services/adminService'

const STATUS_TABS = ['All', 'Accrued', 'Settled']

const tooltipStyle = {
  borderRadius: 12,
  border: '1px solid #E6ECF2',
  boxShadow: '0 10px 28px -18px rgba(16,42,67,0.35)',
  fontSize: 12,
  color: '#172B3A',
}

const rupeeTick = (v) => `₹${(v / 1000).toFixed(0)}k`

export function CommissionsPage() {
  useDocumentTitle('Commissions')

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('All')
  const [selected, setSelected] = useState(null)
  const [reconcileOpen, setReconcileOpen] = useState(false)
  const [liveCommissions, setLiveCommissions] = useState([])
  const [liveStats, setLiveStats] = useState(null)
  const [revenueSplit, setRevenueSplit] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isReconciling, setIsReconciling] = useState(false)
  const debouncedSearch = useDebouncedValue(search)

  // Load real continuous rolling 6-month metrics from MongoDB
  useEffect(() => {
    adminService
      .getAdminMetrics()
      .then((res) => {
        if (res?.revenueSplit && Array.isArray(res.revenueSplit)) {
          setRevenueSplit(res.revenueSplit)
        }
      })
      .catch(() => {})
  }, [])

  const fetchCommissions = async () => {
    setIsLoading(true)
    try {
      const res = await adminService.getAdminCommissions({
        status: status === 'All' ? 'all' : status,
        search: debouncedSearch,
      })
      setLiveCommissions(res?.commissions || [])
      if (res?.stats) setLiveStats(res.stats)
    } catch {
      setLiveCommissions([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchCommissions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, debouncedSearch])

  const displayedCommissions = liveCommissions || []
  const displayedStats = useMemo(() => {
    if (liveStats) {
      return {
        total: liveStats.total || 0,
        accrued: liveStats.accrued || 0,
        settled: liveStats.settled || 0,
        accruedCount: liveStats.accruedCount || 0,
        effective: liveStats.effectiveRate || 12,
      }
    }
    const total = displayedCommissions.reduce((s, c) => s + (c.amount || 0), 0)
    const accrued = displayedCommissions.filter((c) => c.status === 'Accrued').reduce((s, c) => s + (c.amount || 0), 0)
    const settled = displayedCommissions.filter((c) => c.status === 'Settled').reduce((s, c) => s + (c.amount || 0), 0)
    const base = displayedCommissions.reduce((s, c) => s + (c.base || 0), 0)
    return {
      total,
      accrued,
      settled,
      accruedCount: displayedCommissions.filter((c) => c.status === 'Accrued').length,
      effective: base ? Math.round((total / base) * 1000) / 10 : Math.round(PLATFORM_COMMISSION * 100),
    }
  }, [liveStats, displayedCommissions])

  const { page, totalPages, totalItems, pageItems, goto } = usePagination(displayedCommissions, 8)
  useEffect(() => {
    goto(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, status, displayedCommissions.length])

  const handleReconcile = async () => {
    if (isReconciling) return
    setIsReconciling(true)
    try {
      const result = await adminService.reconcileCommissions()
      const count = result?.reconciledCount ?? displayedStats.accruedCount
      toast.success('Commission ledger reconciled (simulated)', {
        description: `${count} accrued entr${count === 1 ? 'y' : 'ies'} queued for the next settlement cycle.`,
      })
      setReconcileOpen(false)
      await fetchCommissions()
    } catch (err) {
      toast.error('Commission reconciliation failed', {
        description: err?.message || 'Unable to reconcile accrued commissions with the server.',
      })
      setReconcileOpen(false)
    } finally {
      setIsReconciling(false)
    }
  }

  const columns = [
    {
      key: 'id',
      header: 'Commission ID',
      render: (c) => <span className="font-display text-sm font-bold text-ink">{c.id}</span>,
    },
    { key: 'bookingId', header: 'Booking', render: (c) => <span className="text-primary-700">{c.bookingId}</span> },
    { key: 'caregiverName', header: 'Caretaker' },
    {
      key: 'base',
      header: 'Base amount',
      align: 'right',
      render: (c) => <span className="tabular-nums">{formatCurrency(c.base)}</span>,
    },
    { key: 'rate', header: 'Rate', align: 'center', render: (c) => <span className="tabular-nums">{c.rate}</span> },
    {
      key: 'amount',
      header: 'Commission',
      align: 'right',
      render: (c) => (
        <span className="font-semibold tabular-nums text-primary-700">{formatCurrency(c.amount)}</span>
      ),
    },
    {
      key: 'date',
      header: 'Date',
      render: (c) => <span className="whitespace-nowrap tabular-nums">{formatDate(c.date, { long: true })}</span>,
    },
    { key: 'status', header: 'Status', render: (c) => <StatusBadge status={c.status} size="sm" /> },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Commissions"
        subtitle="The 12% platform commission earned on every completed care booking."
        action={
          <Button icon={RefreshCw} onClick={() => setReconcileOpen(true)}>
            Reconcile
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          label="Total commission"
          value={formatCurrency(displayedStats.total)}
          icon={Percent}
          tone="primary"
          hint={`${displayedCommissions.length} ledger entries`}
          delay={0}
        />
        <StatCard
          label="Accrued"
          value={formatCurrency(displayedStats.accrued)}
          icon={Hourglass}
          tone="warning"
          hint={`${displayedStats.accruedCount} awaiting settlement`}
          delay={0.05}
        />
        <StatCard
          label="Settled"
          value={formatCurrency(displayedStats.settled)}
          icon={CheckCircle2}
          tone="success"
          hint="Already paid out"
          delay={0.1}
        />
        <StatCard
          label="Effective rate"
          value={`${displayedStats.effective}%`}
          icon={Gauge}
          tone="accent"
          hint="Commission ÷ billed base"
          delay={0.15}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Monthly commission"
            subtitle="Commission collected per month across all services (live continuous time-series)"
            icon={Percent}
          />
          <CardBody>
            <div dir="ltr" className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueSplit} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E6ECF2" vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#94A3B8' }} />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={54}
                    tick={{ fontSize: 11, fill: '#94A3B8' }}
                    tickFormatter={rupeeTick}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(15,118,110,0.06)' }}
                    contentStyle={tooltipStyle}
                    formatter={(value) => [formatCurrency(value), 'Commission']}
                  />
                  <Bar dataKey="commission" fill="#0F766E" radius={[6, 6, 0, 0]} maxBarSize={44} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="How it works" subtitle="Commission mechanics at a glance" icon={Scale} />
          <CardBody className="space-y-3">
            <div className="flex items-center justify-between gap-4 rounded-xl border border-line px-4 py-3 text-sm">
              <span className="text-muted">Commission rate</span>
              <span className="font-semibold tabular-nums text-ink">
                {Math.round(PLATFORM_COMMISSION * 100)}%
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 rounded-xl border border-line px-4 py-3 text-sm">
              <span className="text-muted">Billed base value</span>
              <span className="font-semibold tabular-nums text-ink">
                {formatCurrency(displayedCommissions.reduce((s, c) => s + (c.base || 0), 0))}
              </span>
            </div>
            <div className="rounded-xl bg-mint-100 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary-900">Commission retained</p>
              <p className="mt-1 font-display text-xl font-extrabold tabular-nums text-primary-800">
                {formatCurrency(displayedStats.total)}
              </p>
            </div>
            <p className="text-xs leading-relaxed text-muted">
              Commission is deducted at the moment an escrow payment is released, then reconciled against the
              caretaker payout cycle every fortnight.
            </p>
          </CardBody>
        </Card>
      </div>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search commission ID, booking or caretaker…"
            className="sm:max-w-sm sm:flex-1"
          />
          <Tabs
            tabs={STATUS_TABS.map((s) => ({
              id: s,
              label: s,
              count: s === 'All' ? displayedCommissions.length : displayedCommissions.filter((c) => c.status === s).length,
            }))}
            active={status}
            onChange={setStatus}
            size="sm"
          />
        </div>

        {isLoading ? (
          <TableSkeleton rows={6} cols={6} />
        ) : displayedCommissions.length === 0 ? (
          <div className="rounded-card border border-line bg-white shadow-card">
            <EmptyState
              icon={SearchX}
              title="No commission entries found"
              description="Try switching the status tab or clearing the search term."
              action={
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearch('')
                    setStatus('All')
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
              onRowClick={(row) => setSelected(row)}
              initialSort={{ key: 'date', dir: 'desc' }}
              emptyTitle="No commission entries found"
              emptyIcon={Percent}
            />
            <Pagination page={page} totalPages={totalPages} onPageChange={goto} totalItems={totalItems} />
          </>
        )}

        <p className="text-xs leading-relaxed text-muted">
          Showing {formatNumber(displayedCommissions.length)} commission entries · rates
          applied automatically at release time.
        </p>
      </section>

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected ? `Commission ${selected.id}` : 'Commission entry'}
        subtitle={selected ? `Booking ${selected.bookingId} · ${formatDate(selected.date, { long: true })}` : ''}
        size="md"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setSelected(null)}>
              Close
            </Button>
            <Button
              onClick={() => {
                setSelected(null)
                setReconcileOpen(true)
              }}
              icon={RefreshCw}
            >
              Reconcile now
            </Button>
          </div>
        }
      >
        {selected ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={selected.status} />
              <span className="rounded-full border border-line-strong bg-slate-50 px-3 py-1 text-xs font-semibold text-muted">
                Caretaker · {selected.caregiverName}
              </span>
            </div>

            <div className="overflow-hidden rounded-card border border-line">
              <table className="w-full border-collapse text-left">
                <tbody className="divide-y divide-line">
                  <Row label="Booking reference" value={selected.bookingId} />
                  <Row label="Billed base amount" value={formatCurrency(selected.base)} />
                  <Row label="Applied rate" value={selected.rate} />
                  <Row label="Commission earned" value={formatCurrency(selected.amount)} strong />
                  <Row label="Recognised on" value={formatDate(selected.date, { long: true })} />
                  <Row label="Status" value={selected.status} />
                </tbody>
              </table>
            </div>

            <div className="rounded-xl border border-line bg-gradient-to-br from-slate-50 to-white p-4 text-xs leading-relaxed text-muted">
              <p className="font-semibold text-ink">Reconciliation note</p>
              <p className="mt-1.5">
                {formatCurrency(selected.base)} × {selected.rate} = {formatCurrency(selected.amount)}. Accrued
                entries are matched against the caretaker payout batch before the ledger is closed.
              </p>
            </div>
          </div>
        ) : null}
      </Modal>

      <ConfirmationDialog
        open={reconcileOpen}
        onClose={() => {
          if (!isReconciling) setReconcileOpen(false)
        }}
        onConfirm={handleReconcile}
        loading={isReconciling}
        tone="primary"
        title="Reconcile commission ledger?"
        message={`${displayedStats.accruedCount} accrued entr${displayedStats.accruedCount === 1 ? 'y' : 'ies'} totalling ${formatCurrency(
          displayedStats.accrued,
        )} will be matched against the next payout batch. Reconciliation is recorded in the simulated audit trail.`}
        confirmLabel="Reconcile"
      />
    </div>
  )
}

function Row({ label, value, strong }) {
  return (
    <tr>
      <td className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-faint">{label}</td>
      <td
        className={`px-4 py-3 text-right text-sm tabular-nums ${
          strong ? 'font-display font-extrabold text-primary-700' : 'font-semibold text-ink'
        }`}
      >
        {value}
      </td>
    </tr>
  )
}

export default CommissionsPage
