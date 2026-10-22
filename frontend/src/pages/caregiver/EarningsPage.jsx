import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Banknote, Download, HandCoins, Wallet } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useData } from '@/context/DataContext'
import { useDocumentTitle } from '@/hooks/useUi'
import { MONTHLY_EARNINGS, WEEKLY_EARNINGS } from '@/data/charts'
import { PLATFORM_COMMISSION } from '@/utils/constants'
import { formatCurrency, formatDate, toCSV, downloadText } from '@/utils/format'
import { Button } from '@/components/common/Button'
import { Card, CardBody, CardHeader } from '@/components/common/Card'
import { StatCard } from '@/components/common/StatCard'
import { SectionLabel } from '@/components/common/SectionLabel'
import { StatusBadge } from '@/components/common/StatusBadge'
import { PageHeader } from '@/components/common/PageHeader'
import { Tabs, ProgressBar } from '@/components/common/Tabs'
import { SearchBar } from '@/components/common/SearchBar'
import { DataTable } from '@/components/common/DataTable'
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog'
import { FallbackNotice } from '@/components/common/FallbackNotice'
import { financeService } from '@/services/financeService'

const tooltipStyle = {
  borderRadius: 12,
  border: '1px solid #E6ECF2',
  boxShadow: '0 10px 28px -18px rgba(16,42,67,0.35)',
  fontSize: 12,
  color: '#172B3A',
}

const rupeeTick = (v) => `₹${(v / 1000).toFixed(1)}k`

export function EarningsPage() {
  useDocumentTitle('Earnings')

  const { user } = useAuth()
  const { bookings, earnings } = useData()

  const myId = user?.caregiverId || 'cg-101'

  const [tab, setTab] = useState('all')
  const [query, setQuery] = useState('')
  const [payoutDialogOpen, setPayoutDialogOpen] = useState(false)
  const [isSubmittingPayout, setIsSubmittingPayout] = useState(false)
  const [liveEarnings, setLiveEarnings] = useState(null)
  const [liveStats, setLiveStats] = useState(null)
  const [isFallback, setIsFallback] = useState(false)

  const myEarnings = useMemo(() => {
    const myBookingIds = new Set(bookings.filter((b) => b.caregiverId === myId).map((b) => b.id))
    return earnings.filter((e) => e.caregiverId === myId || (e.caregiverId == null && myBookingIds.has(e.bookingId)))
  }, [earnings, bookings, myId])

  const loadEarnings = async () => {
    try {
      const res = await financeService.getCaregiverEarnings()
      if (res?.earnings && res.earnings.length > 0) {
        setLiveEarnings(res.earnings)
        if (res.stats) setLiveStats(res.stats)
        setIsFallback(false)
      } else {
        setIsFallback(true)
      }
    } catch {
      setIsFallback(true)
    }
  }

  useEffect(() => {
    loadEarnings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myId])

  const effectiveEarnings = liveEarnings && !isFallback ? liveEarnings : myEarnings

  const totalNet = myEarnings.reduce((sum, e) => sum + e.net, 0)
  const totalGross = myEarnings.reduce((sum, e) => sum + e.gross, 0)
  const totalCommission = myEarnings.reduce((sum, e) => sum + e.commission, 0)
  const pendingPayout = myEarnings.filter((e) => e.status === 'Pending').reduce((sum, e) => sum + e.net, 0)
  const currentMonth = new Date().toISOString().slice(0, 7)
  const thisMonth = myEarnings.filter((e) => e.date.startsWith(currentMonth)).reduce((sum, e) => sum + e.net, 0)
  const commissionPct = totalGross > 0 ? Math.round((totalCommission / totalGross) * 100) : 0

  const effectiveStats = useMemo(() => {
    if (liveStats && !isFallback) return liveStats
    return {
      totalNet,
      totalGross,
      totalCommission,
      pendingPayout,
      thisMonth,
      commissionPct,
    }
  }, [liveStats, isFallback, totalNet, totalGross, totalCommission, pendingPayout, thisMonth, commissionPct])

  const availableToWithdraw = useMemo(() => {
    if (liveStats?.availableBalance != null && !isFallback) {
      return liveStats.availableBalance
    }
    return effectiveEarnings
      .filter((e) => e.status === 'Released' && !e.payoutId)
      .reduce((sum, e) => sum + (e.net || 0), 0)
  }, [liveStats, isFallback, effectiveEarnings])

  const counts = useMemo(
    () => ({
      all: effectiveEarnings.length,
      pending: effectiveEarnings.filter((e) => e.status === 'Pending').length,
      released: effectiveEarnings.filter((e) => e.status === 'Released').length,
      paid: effectiveEarnings.filter((e) => e.status === 'Paid').length,
    }),
    [effectiveEarnings],
  )

  const filtered = useMemo(() => {
    const list = tab === 'all' ? effectiveEarnings : effectiveEarnings.filter((e) => e.status.toLowerCase() === tab)
    const q = query.trim().toLowerCase()
    if (!q) return list
    return list.filter((e) => [e.id, e.bookingId, e.service, e.status].join(' ').toLowerCase().includes(q))
  }, [effectiveEarnings, tab, query])

  const handleExport = () => {
    const rows = filtered.map((e) => ({
      id: e.id,
      date: e.date,
      bookingId: e.bookingId,
      service: e.service,
      gross: e.gross,
      commission: e.commission,
      net: e.net,
      status: e.status,
    }))
    downloadText(`caremate-earnings-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(rows))
    toast.success(`Exported ${rows.length} transaction${rows.length === 1 ? '' : 's'} to CSV`)
  }

  const handlePayout = async () => {
    if (isSubmittingPayout) return
    setIsSubmittingPayout(true)
    try {
      await financeService.requestCaregiverPayout({
        disbursalMethod: 'Bank Transfer',
      })
      toast.success('Payout request submitted (simulated)', {
        description: 'Your payout request has been queued for administrative processing.',
      })
      setPayoutDialogOpen(false)
      await loadEarnings()
    } catch (err) {
      toast.error('Payout request failed', {
        description: err?.message || 'Unable to submit payout request. Please try again later.',
      })
      setPayoutDialogOpen(false)
    } finally {
      setIsSubmittingPayout(false)
    }
  }

  const columns = [
    {
      key: 'date',
      header: 'Date',
      render: (row) => <span className="tabular-nums">{formatDate(row.date, { long: true })}</span>,
    },
    { key: 'bookingId', header: 'Booking' },
    { key: 'service', header: 'Service' },
    { key: 'gross', header: 'Gross', align: 'right', render: (row) => <span className="tabular-nums">{formatCurrency(row.gross)}</span> },
    {
      key: 'commission',
      header: 'Commission',
      align: 'right',
      render: (row) => <span className="tabular-nums text-muted">− {formatCurrency(row.commission)}</span>,
    },
    {
      key: 'net',
      header: 'Net',
      align: 'right',
      render: (row) => <span className="font-semibold tabular-nums text-ink">{formatCurrency(row.net)}</span>,
    },
    { key: 'status', header: 'Status', sortable: false, render: (row) => <StatusBadge status={row.status} size="sm" /> },
  ]

  return (
    <div className="space-y-6">
      {isFallback && (
        <FallbackNotice message="Displaying caregiver earnings from offline cache while live finance service is connecting." />
      )}

      <PageHeader
        title="Earnings"
        subtitle="Track every rupee — gross service value, platform commission and the net amount that lands in your bank."
        meta={<span className="text-sm text-muted">{Math.round(PLATFORM_COMMISSION * 100)}% platform commission · payouts settle in 2 working days</span>}
        action={
          <Button variant="outline" icon={Download} onClick={handleExport}>
            Export CSV
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total earnings" value={formatCurrency(effectiveStats.totalNet)} icon={Banknote} tone="primary" hint="Lifetime net of commission" delay={0} />
        <StatCard label="Pending payout" value={formatCurrency(effectiveStats.pendingPayout)} icon={Wallet} tone="warning" hint="Releasing soon" delay={0.05} />
        <StatCard label="This month" value={formatCurrency(effectiveStats.thisMonth)} icon={HandCoins} tone="accent" hint="Current calendar month" delay={0.1} />
        <StatCard label="Jobs completed" value={effectiveEarnings.length} icon={Wallet} tone="success" hint="Paid transactions" delay={0.15} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Weekly earnings" subtitle="Net amount earned each day this week" icon={Banknote} />
          <CardBody>
            <div dir="ltr" className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={WEEKLY_EARNINGS} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="cgEarningsWeekly" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2DD4BF" />
                      <stop offset="100%" stopColor="#0F766E" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E6ECF2" vertical={false} />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#94A3B8' }} />
                  <YAxis tickLine={false} axisLine={false} width={48} tick={{ fontSize: 11, fill: '#94A3B8' }} tickFormatter={rupeeTick} />
                  <Tooltip cursor={{ fill: 'rgba(15,118,110,0.06)' }} contentStyle={tooltipStyle} formatter={(v) => formatCurrency(v)} />
                  <Bar dataKey="earnings" fill="url(#cgEarningsWeekly)" radius={[6, 6, 0, 0]} maxBarSize={38} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Monthly earnings" subtitle="Net earning trend over the last 6 months" icon={Wallet} />
          <CardBody>
            <div dir="ltr" className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={MONTHLY_EARNINGS} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="earningsFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0F766E" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#0F766E" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E6ECF2" vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#94A3B8' }} />
                  <YAxis tickLine={false} axisLine={false} width={48} tick={{ fontSize: 11, fill: '#94A3B8' }} tickFormatter={rupeeTick} />
                  <Tooltip cursor={{ stroke: '#0F766E', strokeWidth: 1 }} contentStyle={tooltipStyle} formatter={(v) => formatCurrency(v)} />
                  <Area type="monotone" dataKey="earnings" stroke="#0F766E" strokeWidth={2.5} fill="url(#earningsFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Commission breakdown" subtitle="How 12% platform commission adds up" icon={Banknote} />
          <CardBody className="space-y-4">
            <div className="flex items-center justify-between gap-4 rounded-xl border border-line px-4 py-3 text-sm">
              <span className="text-muted">Gross earnings (all services)</span>
              <span className="font-semibold tabular-nums text-ink">{formatCurrency(effectiveStats.totalGross)}</span>
            </div>
            <div className="flex items-center justify-between gap-4 rounded-xl border border-dashed border-line px-4 py-3 text-sm">
              <span className="text-muted">Platform commission ({Math.round(PLATFORM_COMMISSION * 100)}%)</span>
              <span className="font-semibold tabular-nums text-muted">− {formatCurrency(effectiveStats.totalCommission)}</span>
            </div>
            <div className="flex items-center justify-between gap-4 rounded-xl bg-gradient-to-br from-mint-100 to-mint-200 px-4 py-3">
              <span className="text-sm font-bold text-primary-900">Net payable to you</span>
              <span className="font-display text-lg font-extrabold tabular-nums text-primary-800">{formatCurrency(effectiveStats.totalNet)}</span>
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="font-semibold text-ink-soft">Commission as % of gross</span>
                <span className="font-bold text-primary-700">{effectiveStats.commissionPct}%</span>
              </div>
              <ProgressBar value={effectiveStats.commissionPct} tone="primary" />
            </div>
            <p className="text-xs leading-relaxed text-muted">
              Commission is deducted per completed booking and already reflected in every net figure on this page.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Payout request" subtitle="Withdraw your released balance to the bank" icon={HandCoins} />
          <CardBody className="space-y-4">
            <div className="rounded-xl border border-primary-100 bg-gradient-to-br from-mint-50 to-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-faint">Available balance</p>
              <p className="mt-1.5 font-display text-3xl font-extrabold tabular-nums text-ink">{formatCurrency(availableToWithdraw)}</p>
              <p className="mt-1 text-xs text-muted">Settles to your registered bank in 2 working days</p>
            </div>
            <div className="rounded-xl border border-line px-4 py-3 text-sm">
              <p className="text-muted">Linked bank account</p>
              <p className="mt-0.5 font-semibold text-ink">HDFC •••• 4412</p>
            </div>
            <Button variant="primary" icon={HandCoins} className="w-full" disabled={availableToWithdraw <= 0} onClick={() => setPayoutDialogOpen(true)}>
              Request payout
            </Button>
            {availableToWithdraw <= 0 ? <p className="text-center text-xs text-muted">No released balance available right now.</p> : null}
          </CardBody>
        </Card>
      </div>

      <section className="space-y-4">
        <SectionLabel
          hint="Every completed booking and its commission deduction."
          action={
            <Button variant="outline" size="sm" icon={Download} onClick={handleExport}>
              Export CSV
            </Button>
          }
        >
          Earnings transactions
        </SectionLabel>

        <Tabs
          tabs={[
            { id: 'all', label: 'All', count: counts.all },
            { id: 'pending', label: 'Pending', count: counts.pending },
            { id: 'released', label: 'Released', count: counts.released },
            ...(counts.paid > 0 ? [{ id: 'paid', label: 'Paid', count: counts.paid }] : []),
          ]}
          active={tab}
          onChange={setTab}
        />

        <SearchBar value={query} onChange={setQuery} placeholder="Search booking ID or service…" />

        <DataTable
          columns={columns}
          data={filtered}
          keyExtractor={(row) => row.id}
          emptyTitle="No transactions found"
          emptyDescription="Try a different tab or search term."
        />
      </section>

      <ConfirmationDialog
        open={payoutDialogOpen}
        onClose={() => {
          if (!isSubmittingPayout) setPayoutDialogOpen(false)
        }}
        onConfirm={handlePayout}
        loading={isSubmittingPayout}
        tone="success"
        title="Request this payout?"
        message={`${formatCurrency(availableToWithdraw)} will be queued for disbursal to your registered bank account. Financial transactions remain simulated in this environment.`}
        confirmLabel="Request payout"
      />
    </div>
  )
}

export default EarningsPage
