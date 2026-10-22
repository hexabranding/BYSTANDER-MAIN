import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Banknote, Check, CheckCircle2, Clock, Download, Eye, Hourglass, SearchX, TrendingUp } from 'lucide-react'
import { useData } from '@/context/DataContext'
import { useDebouncedValue, useDocumentTitle } from '@/hooks/useUi'
import { usePagination } from '@/hooks/usePagination'
import { downloadText, formatCurrency, formatDate, formatNumber } from '@/utils/format'
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
import { EmptyState } from '@/components/common/States'
import { FallbackNotice } from '@/components/common/FallbackNotice'
import { adminService } from '@/services/adminService'

const STATUS_TABS = ['All', 'Pending', 'Processing', 'Settled']

const tooltipStyle = {
  borderRadius: 12,
  border: '1px solid #E6ECF2',
  boxShadow: '0 10px 28px -18px rgba(16,42,67,0.35)',
  fontSize: 12,
  color: '#172B3A',
}

const rupeeTick = (v) => (v >= 1000 ? `₹${(v / 1000).toFixed(0)}k` : `₹${v}`)

export function PayoutsPage() {
  useDocumentTitle('Payouts')

  const { payouts } = useData()

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('All')
  const [viewingId, setViewingId] = useState(null)
  const [approvingId, setApprovingId] = useState(null)
  const debouncedSearch = useDebouncedValue(search)

  const [livePayouts, setLivePayouts] = useState(null)
  const [liveStats, setLiveStats] = useState(null)
  const [isFallback, setIsFallback] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSettling, setIsSettling] = useState(false)

  // Demo fallback stats (only used if backend is completely offline)
  const demoStats = useMemo(() => {
    const count = (s) => payouts.filter((p) => p.status === s).length
    return {
      total: payouts.reduce((sum, p) => sum + (p.net || 0), 0),
      processing: count('Processing'),
      pending: count('Pending'),
      settled: count('Settled'),
    }
  }, [payouts])

  const demoFiltered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    return payouts.filter((p) => {
      const matchesStatus = status === 'All' || p.status === status
      const matchesSearch =
        !q ||
        [p.id, p.caregiverName, p.period, p.method, p.status].join(' ').toLowerCase().includes(q)
      return matchesStatus && matchesSearch
    })
  }, [payouts, debouncedSearch, status])

  // Real backend fetch
  const fetchPayouts = async () => {
    setIsLoading(true)
    try {
      const res = await adminService.getAdminPayouts({
        status: status === 'All' ? 'all' : status.toLowerCase(),
        search: debouncedSearch,
      })
      if (res && Array.isArray(res.payouts)) {
        setLivePayouts(res.payouts)
        setLiveStats(
          res.stats || {
            total: res.payouts.reduce((sum, p) => sum + (p.net || 0), 0),
            processing: res.payouts.filter((p) => p.status === 'Processing').length,
            pending: res.payouts.filter((p) => p.status === 'Pending').length,
            settled: res.payouts.filter((p) => p.status === 'Settled').length,
          },
        )
        setIsFallback(false)
      } else {
        setLivePayouts([])
        setLiveStats({ total: 0, processing: 0, pending: 0, settled: 0 })
        setIsFallback(false)
      }
    } catch {
      setIsFallback(true)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchPayouts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, debouncedSearch])

  // Truthful data selection: prefer live API data over demo data
  const displayedPayouts = livePayouts !== null && !isFallback ? livePayouts : demoFiltered
  const displayedStats =
    liveStats !== null && !isFallback
      ? liveStats
      : isFallback
        ? demoStats
        : {
            total: displayedPayouts.reduce((sum, p) => sum + (p.net || 0), 0),
            processing: displayedPayouts.filter((p) => p.status === 'Processing').length,
            pending: displayedPayouts.filter((p) => p.status === 'Pending').length,
            settled: displayedPayouts.filter((p) => p.status === 'Settled').length,
          }

  // Monthly trend chart dynamically computed from real payouts
  const monthlyTrend = useMemo(() => {
    const months = ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct']
    const monthMap = Object.fromEntries(months.map((m) => [m, 0]))
    if (displayedPayouts && displayedPayouts.length > 0) {
      displayedPayouts.forEach((p) => {
        if (p.status === 'Settled' && p.requestedOn) {
          const m = new Date(p.requestedOn).toLocaleString('en-US', { month: 'short' })
          if (monthMap[m] !== undefined) {
            monthMap[m] += p.net || 0
          }
        }
      })
    }
    return months.map((month) => ({ month, payout: monthMap[month] }))
  }, [displayedPayouts])

  const viewing = displayedPayouts.find((p) => p.id === viewingId) || null
  const approving = displayedPayouts.find((p) => p.id === approvingId) || null

  const { page, totalPages, totalItems, pageItems, goto } = usePagination(displayedPayouts, 8)
  useEffect(() => {
    goto(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, status, displayedPayouts.length])

  const handleApprove = async () => {
    if (!approving || isSettling) return
    const targetId = approving.dbId || approving._id || approving.id
    setIsSettling(true)
    try {
      await adminService.updateAdminPayoutStatus(targetId, {
        status: 'settled',
        notes: 'Payout settled and confirmed by operations desk',
      })
      toast.success(`Payout ${approving.id} settled (simulated)`, {
        description: `${formatCurrency(approving.net)} recorded as settled for ${approving.caregiverName} · ${approving.method}.`,
      })
      setApprovingId(null)
      await fetchPayouts()
    } catch (err) {
      toast.error('Failed to settle payout', {
        description: err?.message || 'An unexpected error occurred while updating the payout status.',
      })
      setApprovingId(null)
    } finally {
      setIsSettling(false)
    }
  }

  const handleDownload = (payout) => {
    const line = (label, value) => `${label.padEnd(26, '.')}${value}`
    const text = [
      'BYSTANDER — PAYOUT DISBURSEMENT STATEMENT',
      '==========================================',
      line('Payout ID', payout.id),
      line('Caretaker', payout.caregiverName),
      line('Statement period', payout.period),
      line('Requested on', formatDate(payout.requestedOn, { long: true })),
      line('Status', payout.status),
      line('Disbursal account', payout.method),
      '',
      'EARNINGS SUMMARY',
      '----------------------------------',
      line('Jobs completed', formatNumber(payout.jobs)),
      line('Gross earnings', formatCurrency(payout.gross)),
      line('Platform commission (12%)', `- ${formatCurrency(payout.commission)}`),
      line('Net payable', formatCurrency(payout.net)),
      '',
      'Official Escrow Payout Statement · Bystander Financial Operations.',
    ].join('\n')
    downloadText(`payout-statement-${payout.id}.txt`, text, 'text/plain')
    toast.success(`Statement ${payout.id} downloaded`)
  }

  const columns = [
    {
      key: 'id',
      header: 'Payout ID',
      render: (p) => <span className="font-display text-sm font-bold text-ink">{p.id}</span>,
    },
    { key: 'caregiverName', header: 'Caretaker' },
    { key: 'period', header: 'Period' },
    { key: 'jobs', header: 'Jobs', align: 'right', render: (p) => <span className="tabular-nums">{p.jobs}</span> },
    {
      key: 'gross',
      header: 'Gross',
      align: 'right',
      render: (p) => <span className="tabular-nums">{formatCurrency(p.gross)}</span>,
    },
    {
      key: 'commission',
      header: 'Commission',
      align: 'right',
      render: (p) => <span className="tabular-nums text-muted">− {formatCurrency(p.commission)}</span>,
    },
    {
      key: 'net',
      header: 'Net',
      align: 'right',
      render: (p) => <span className="font-semibold tabular-nums text-ink">{formatCurrency(p.net)}</span>,
    },
    { key: 'method', header: 'Method', sortable: false },
    {
      key: 'requestedOn',
      header: 'Requested',
      render: (p) => <span className="whitespace-nowrap tabular-nums">{formatDate(p.requestedOn)}</span>,
    },
    { key: 'status', header: 'Status', render: (p) => <StatusBadge status={p.status} size="sm" /> },
    {
      key: 'action',
      header: 'Action',
      align: 'right',
      sortable: false,
      render: (p) => (
        <div className="flex items-center justify-end gap-2">
          {p.status !== 'Settled' ? (
            <Button
              size="xs"
              icon={Check}
              onClick={(e) => {
                e.stopPropagation()
                setApprovingId(p.id)
              }}
            >
              Approve
            </Button>
          ) : null}
          <Button
            size="xs"
            variant="outline"
            icon={Eye}
            onClick={(e) => {
              e.stopPropagation()
              setViewingId(p.id)
            }}
          >
            View
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      {isFallback && (
        <FallbackNotice message="Displaying payout records from local cache while administrative disbursal service is connecting." />
      )}

      <PageHeader
        title="Payouts"
        subtitle="Review and settle caretaker payouts — gross earnings less the 12% platform commission."
        meta={<span className="text-sm text-muted">Payouts settle to the registered bank within 2 working days</span>}
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          label="Total payouts"
          value={formatCurrency(displayedStats.total)}
          icon={Banknote}
          tone="primary"
          hint={`${formatNumber(displayedPayouts.length)} payout requests`}
          delay={0}
        />
        <StatCard
          label="Processing"
          value={displayedStats.processing}
          icon={Clock}
          tone="info"
          hint="In the banking pipeline"
          delay={0.05}
        />
        <StatCard
          label="Pending"
          value={displayedStats.pending}
          icon={Hourglass}
          tone="warning"
          hint="Awaiting approval"
          delay={0.1}
        />
        <StatCard
          label="Settled"
          value={displayedStats.settled}
          icon={CheckCircle2}
          tone="success"
          hint="Credited to caretakers"
          delay={0.15}
        />
      </div>

      <Card>
        <CardHeader title="Payout trend" subtitle="Total amount disbursed to caretakers each month" icon={TrendingUp} />
        <CardBody>
          <div dir="ltr" className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyTrend} margin={{ top: 8, right: 8, left: -4, bottom: 0 }}>
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
                  contentStyle={tooltipStyle}
                  formatter={(value) => [formatCurrency(value), 'Payout']}
                  labelFormatter={(label) => `${label} 2026`}
                />
                <Line
                  type="monotone"
                  dataKey="payout"
                  stroke="#0F766E"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#0F766E', strokeWidth: 0 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardBody>
      </Card>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search payout ID, caretaker or period…"
            className="sm:max-w-sm sm:flex-1"
          />
          <Tabs
            tabs={STATUS_TABS.map((s) => ({
              id: s,
              label: s,
              count: s === 'All' ? displayedPayouts.length : displayedPayouts.filter((p) => p.status === s).length,
            }))}
            active={status}
            onChange={setStatus}
            size="sm"
          />
        </div>

        {displayedPayouts.length === 0 ? (
          <div className="rounded-card border border-line bg-white shadow-card">
            <EmptyState
              icon={debouncedSearch || status !== 'All' ? SearchX : Banknote}
              title={debouncedSearch || status !== 'All' ? 'No payouts found' : 'No payout requests yet'}
              description={
                debouncedSearch || status !== 'All'
                  ? 'Try a different status tab or clear the search term.'
                  : 'Caretaker disbursal requests will appear here once shifts are completed and earnings are withdrawn.'
              }
              action={
                debouncedSearch || status !== 'All' ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearch('')
                      setStatus('All')
                    }}
                  >
                    Clear filters
                  </Button>
                ) : null
              }
            />
          </div>
        ) : (
          <>
            <DataTable
              columns={columns}
              data={pageItems}
              keyExtractor={(row) => row.id}
              initialSort={{ key: 'requestedOn', dir: 'desc' }}
              emptyTitle="No payouts found"
              emptyIcon={Banknote}
            />
            <Pagination page={page} totalPages={totalPages} onPageChange={goto} totalItems={totalItems} />
          </>
        )}
      </section>

      <Modal
        open={Boolean(viewing)}
        onClose={() => setViewingId(null)}
        title={viewing ? `Payout statement ${viewing.id}` : 'Payout statement'}
        subtitle={viewing ? `${viewing.caregiverName} · ${viewing.period}` : ''}
        size="lg"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setViewingId(null)}>
              Close
            </Button>
            <Button variant="outline" icon={Download} onClick={() => viewing && handleDownload(viewing)}>
              Download statement
            </Button>
            {viewing && viewing.status !== 'Settled' ? (
              <Button icon={Check} onClick={() => setApprovingId(viewing.id)}>
                Approve payout
              </Button>
            ) : null}
          </div>
        }
      >
        {viewing ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={viewing.status} />
              <span className="rounded-full border border-line-strong bg-slate-50 px-3 py-1 text-xs font-semibold text-muted">
                {viewing.method}
              </span>
              <span className="rounded-full border border-line-strong bg-slate-50 px-3 py-1 text-xs font-semibold text-muted">
                Requested {formatDate(viewing.requestedOn, { long: true })}
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <SummaryTile label="Jobs completed" value={formatNumber(viewing.jobs)} />
              <SummaryTile label="Gross earnings" value={formatCurrency(viewing.gross)} />
              <SummaryTile label="Net payable" value={formatCurrency(viewing.net)} highlight />
            </div>

            <div className="overflow-hidden rounded-card border border-line">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-line bg-slate-50/80">
                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-faint">Line</th>
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-faint">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line text-sm">
                  <tr>
                    <td className="px-4 py-3 text-ink-soft">Gross earnings · {viewing.jobs} jobs</td>
                    <td className="px-4 py-3 text-right tabular-nums text-ink">{formatCurrency(viewing.gross)}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-muted">Platform commission (12%)</td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted">
                      − {formatCurrency(viewing.commission)}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-semibold text-ink">Net payable</td>
                    <td className="px-4 py-3 text-right font-display font-extrabold tabular-nums text-primary-700">
                      {formatCurrency(viewing.net)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="rounded-xl border border-line bg-gradient-to-br from-slate-50 to-white p-4 text-xs leading-relaxed text-muted">
              <p className="font-semibold text-ink">Disbursal details</p>
              <p className="mt-1.5">
                Credited to {viewing.method} for period {viewing.period}. Disbursal is processed via platform banking gateway within 2 business days of approval.
              </p>
            </div>
          </div>
        ) : null}
      </Modal>

      <ConfirmationDialog
        open={Boolean(approving)}
        onClose={() => {
          if (!isSettling) setApprovingId(null)
        }}
        onConfirm={handleApprove}
        loading={isSettling}
        tone="success"
        title="Approve this payout?"
        message={
          approving
            ? `${formatCurrency(approving.net)} will be marked as settled for ${approving.caregiverName} (${approving.method}) for ${approving.period}. This simulated action records settlement in the operations ledger.`
            : ''
        }
        confirmLabel="Approve payout"
      />
    </div>
  )
}

function SummaryTile({ label, value, highlight }) {
  return (
    <div className={`rounded-xl border px-4 py-3 ${highlight ? 'border-primary-200 bg-mint-100' : 'border-line bg-slate-50/70'}`}>
      <p className={`text-[10px] font-bold uppercase tracking-wider ${highlight ? 'text-primary-900' : 'text-faint'}`}>
        {label}
      </p>
      <p
        className={`mt-1 font-display text-lg font-extrabold tabular-nums ${
          highlight ? 'text-primary-800' : 'text-ink'
        }`}
      >
        {value}
      </p>
    </div>
  )
}

export default PayoutsPage
