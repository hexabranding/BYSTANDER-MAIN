import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Download, IndianRupee, Lock, Percent, RotateCcw, SearchX, TrendingUp } from 'lucide-react'
import { useData } from '@/context/DataContext'
import { useDebouncedValue, useDocumentTitle } from '@/hooks/useUi'
import { usePagination } from '@/hooks/usePagination'
import { REVENUE_SPLIT } from '@/data/charts'
import { downloadText, formatCurrency, formatDate, toCSV } from '@/utils/format'
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
import { EmptyState } from '@/components/common/States'
import { PriceBreakdown } from '@/components/common/TimelinePrice'
import { FallbackNotice } from '@/components/common/FallbackNotice'
import { FormField, Select } from '@/components/forms/FormField'
import { adminService } from '@/services/adminService'

const RANGES = [
  { id: '7', label: 'Last 7 days' },
  { id: '30', label: 'Last 30 days' },
  { id: '90', label: 'Last 90 days' },
]

const STATUS_TABS = ['All', 'Escrow Held', 'Released', 'Refunded']

const TODAY = new Date(2026, 9, 10)

const toISO = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const tooltipStyle = {
  borderRadius: 12,
  border: '1px solid #E6ECF2',
  boxShadow: '0 10px 28px -18px rgba(16,42,67,0.35)',
  fontSize: 12,
  color: '#172B3A',
}

const rupeeTick = (v) => `₹${(v / 1000).toFixed(0)}k`

function splitFor(tx) {
  const subtotal = Math.max(0, Math.round(tx.amount / 1.18) - 49)
  const platformFee = 49
  const tax = Math.max(0, tx.amount - subtotal - platformFee)
  return { subtotal, platformFee, tax }
}

export function PaymentsPage() {
  useDocumentTitle('Payments')

  const { transactions } = useData()

  const [range, setRange] = useState('30')
  const [status, setStatus] = useState('All')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const debouncedSearch = useDebouncedValue(search)

  const [liveTransactions, setLiveTransactions] = useState(null)
  const [liveStats, setLiveStats] = useState(null)
  const [isFallback, setIsFallback] = useState(false)

  const inRange = useMemo(() => {
    const cutoff = new Date(TODAY)
    cutoff.setDate(cutoff.getDate() - Number(range))
    const cutoffISO = toISO(cutoff)
    return transactions.filter((t) => t.date >= cutoffISO)
  }, [transactions, range])

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    return inRange.filter((t) => {
      const matchesStatus = status === 'All' || t.status === status
      const matchesSearch =
        !q ||
        [t.id, t.bookingId, t.customerName, t.caregiverName, t.service, t.method, t.type]
          .join(' ')
          .toLowerCase()
          .includes(q)
      return matchesStatus && matchesSearch
    })
  }, [inRange, debouncedSearch, status])

  const stats = useMemo(() => {
    const gross = inRange.filter((t) => t.status !== 'Refunded').reduce((s, t) => s + t.amount, 0)
    const commission = inRange.reduce((s, t) => s + t.commission, 0)
    const refunded = inRange.filter((t) => t.status === 'Refunded').reduce((s, t) => s + t.amount, 0)
    const escrow = inRange.filter((t) => t.status === 'Escrow Held').reduce((s, t) => s + t.amount, 0)
    return { gross, commission, refunded, escrow }
  }, [inRange])

  useEffect(() => {
    let mounted = true
    adminService
      .getAdminPayments({
        status: status === 'All' ? 'all' : status,
        range,
        search: debouncedSearch,
      })
      .then((res) => {
        if (!mounted) return
        if (res?.transactions && res.transactions.length > 0) {
          setLiveTransactions(res.transactions)
          if (res.stats) setLiveStats(res.stats)
          setIsFallback(false)
        } else {
          setIsFallback(true)
        }
      })
      .catch(() => {
        if (mounted) setIsFallback(true)
      })

    return () => {
      mounted = false
    }
  }, [status, range, debouncedSearch])

  const displayedTransactions = liveTransactions && !isFallback ? liveTransactions : filtered
  const displayedStats = liveStats && !isFallback ? liveStats : stats

  const { page, totalPages, totalItems, pageItems, goto } = usePagination(displayedTransactions, 8)
  useEffect(() => {
    goto(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, status, range, displayedTransactions.length])

  const handleExport = () => {
    const rows = filtered.map((t) => ({
      transactionId: t.id,
      date: t.date,
      booking: t.bookingId,
      customer: t.customerName,
      caregiver: t.caregiverName,
      service: t.service,
      method: t.method,
      amount: t.amount,
      commission: t.commission,
      payout: t.payout,
      status: t.status,
    }))
    downloadText(`bystander-transactions-${toISO(TODAY)}.csv`, toCSV(rows))
    toast.success(`Exported ${rows.length} transaction${rows.length === 1 ? '' : 's'} to CSV`)
  }

  const columns = [
    {
      key: 'id',
      header: 'Transaction ID',
      render: (t) => (
        <div>
          <p className="font-display text-sm font-bold text-ink">{t.id}</p>
          <p className="text-xs text-faint">{t.type}</p>
        </div>
      ),
    },
    {
      key: 'date',
      header: 'Date',
      render: (t) => <span className="whitespace-nowrap tabular-nums">{formatDate(t.date, { long: true })}</span>,
    },
    { key: 'bookingId', header: 'Booking', render: (t) => <span className="text-primary-700">{t.bookingId}</span> },
    { key: 'customerName', header: 'Customer' },
    { key: 'caregiverName', header: 'Caretaker' },
    { key: 'service', header: 'Service' },
    { key: 'method', header: 'Method', sortable: false },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      render: (t) => <span className="font-semibold tabular-nums text-ink">{formatCurrency(t.amount)}</span>,
    },
    {
      key: 'commission',
      header: 'Commission',
      align: 'right',
      render: (t) => (
        <span className="tabular-nums text-muted">{t.commission ? formatCurrency(t.commission) : '—'}</span>
      ),
    },
    {
      key: 'payout',
      header: 'Payout',
      align: 'right',
      render: (t) => <span className="tabular-nums text-muted">{t.payout ? formatCurrency(t.payout) : '—'}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (t) => <StatusBadge status={t.status} size="sm" />,
    },
  ]

  const split = selected ? splitFor(selected) : null

  return (
    <div className="space-y-6">
      {isFallback && (
        <FallbackNotice message="Displaying financial ledger records from offline cache while administrative transaction service is connecting." />
      )}

      <PageHeader
        title="Payments"
        subtitle="Every rupee moving through CareMate — escrow holdings, releases, refunds and commission."
        action={
          <Button variant="outline" icon={Download} onClick={handleExport} disabled={!displayedTransactions.length}>
            Export CSV
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          label="Gross transaction value"
          value={formatCurrency(displayedStats.gross)}
          icon={IndianRupee}
          tone="primary"
          hint={`${RANGES.find((r) => r.id === range)?.label} · ${displayedTransactions.length} transactions`}
          delay={0}
        />
        <StatCard
          label="Platform commission earned"
          value={formatCurrency(displayedStats.commission)}
          icon={Percent}
          tone="success"
          trend={9}
          hint="12% of gross value"
          delay={0.05}
        />
        <StatCard
          label="Refunded amount"
          value={formatCurrency(displayedStats.refunded)}
          icon={RotateCcw}
          tone="warning"
          hint="Returned to customers"
          delay={0.1}
        />
        <StatCard
          label="Escrow held"
          value={formatCurrency(displayedStats.escrow)}
          icon={Lock}
          tone="info"
          hint="Awaiting service completion"
          delay={0.15}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Revenue & commission"
            subtitle="Monthly gross revenue against platform commission collected"
            icon={TrendingUp}
          />
          <CardBody>
            <div dir="ltr" className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={REVENUE_SPLIT} margin={{ top: 8, right: 8, left: -4, bottom: 0 }}>
                  <defs>
                    <linearGradient id="payRevenueFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0F766E" stopOpacity={0.26} />
                      <stop offset="100%" stopColor="#0F766E" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="payCommissionFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#38BDF8" stopOpacity={0.32} />
                      <stop offset="100%" stopColor="#38BDF8" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E6ECF2" vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#94A3B8' }} />
                  <YAxis
                    yAxisId="left"
                    tickLine={false}
                    axisLine={false}
                    width={54}
                    tick={{ fontSize: 11, fill: '#94A3B8' }}
                    tickFormatter={rupeeTick}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tickLine={false}
                    axisLine={false}
                    width={54}
                    tick={{ fontSize: 11, fill: '#94A3B8' }}
                    tickFormatter={rupeeTick}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value, name) => [
                      formatCurrency(value),
                      name === 'revenue' ? 'Gross revenue' : 'Commission',
                    ]}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, color: '#64748B' }} />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="revenue"
                    name="revenue"
                    stroke="#0F766E"
                    strokeWidth={2.5}
                    fill="url(#payRevenueFill)"
                  />
                  <Area
                    yAxisId="right"
                    type="monotone"
                    dataKey="commission"
                    name="commission"
                    stroke="#38BDF8"
                    strokeWidth={2.5}
                    fill="url(#payCommissionFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Filters" subtitle="Narrow the ledger before exporting" icon={RotateCcw} />
          <CardBody className="space-y-4">
            <FormField label="Date range" htmlFor="pay-range" hint="Measured against 10 Oct 2026">
              <Select id="pay-range" value={range} onChange={(e) => setRange(e.target.value)}>
                {RANGES.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </Select>
            </FormField>
            <div className="rounded-xl border border-line bg-gradient-to-br from-slate-50 to-white p-4 text-xs leading-relaxed text-muted">
              <p className="font-semibold text-ink">Ledger snapshot</p>
              <p className="mt-1.5">
                {inRange.length} transactions in range · {formatCurrency(stats.gross)} gross ·{' '}
                {formatCurrency(stats.commission)} commission retained by the platform.
              </p>
            </div>
            <Button variant="secondary" className="w-full" onClick={handleExport} disabled={!filtered.length} icon={Download}>
              Export filtered rows
            </Button>
          </CardBody>
        </Card>
      </div>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search by transaction ID, booking or caretaker…"
            className="sm:max-w-sm sm:flex-1"
          />
          <Tabs
            tabs={STATUS_TABS.map((s) => ({
              id: s,
              label: s,
              count: s === 'All' ? inRange.length : inRange.filter((t) => t.status === s).length,
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
              title="No transactions found"
              description="Try a wider date range, a different status tab or a new search term."
              action={
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearch('')
                    setStatus('All')
                    setRange('90')
                  }}
                >
                  Reset filters
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
              emptyTitle="No transactions found"
              emptyIcon={SearchX}
            />
            <Pagination page={page} totalPages={totalPages} onPageChange={goto} totalItems={totalItems} />
          </>
        )}

        <p className="text-xs leading-relaxed text-muted">
          Sample financial data — no real payment processing.
        </p>
      </section>

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected ? `Transaction ${selected.id}` : 'Transaction'}
        subtitle={selected ? `${selected.type} · ${formatDate(selected.date, { long: true })}` : ''}
        size="lg"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setSelected(null)}>
              Close
            </Button>
          </div>
        }
      >
        {selected && split ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={selected.status} />
              <span className="rounded-full border border-line-strong bg-slate-50 px-3 py-1 text-xs font-semibold text-muted">
                {selected.method}
              </span>
              <span className="rounded-full border border-line-strong bg-slate-50 px-3 py-1 text-xs font-semibold text-muted">
                Paid on {formatDate(selected.date, { long: true })}
              </span>
            </div>

            <dl className="grid gap-x-6 sm:grid-cols-2">
              <DetailRow label="Booking" value={selected.bookingId} />
              <DetailRow label="Service" value={selected.service} />
              <DetailRow label="Customer" value={selected.customerName} />
              <DetailRow label="Caretaker" value={selected.caregiverName} />
              <DetailRow label="Transaction type" value={selected.type} />
              <DetailRow label="Reference" value={selected.id} />
            </dl>

            <PriceBreakdown
              items={[
                {
                  label: selected.service,
                  meta: `${selected.type} · ${selected.customerName} → ${selected.caregiverName}`,
                  amount: split.subtotal,
                },
              ]}
              subtotal={split.subtotal}
              platformFee={split.platformFee}
              tax={split.tax}
              commission={selected.commission}
              total={selected.amount}
              currencyNote="Sample financial data — no real payment processing. Amounts are illustrative and settle instantly in the demo."
            />
          </div>
        ) : null}
      </Modal>
    </div>
  )
}

function DetailRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line py-2.5">
      <dt className="text-xs font-semibold uppercase tracking-wider text-faint">{label}</dt>
      <dd className="text-right text-sm font-semibold text-ink">{value || '—'}</dd>
    </div>
  )
}

export default PaymentsPage
