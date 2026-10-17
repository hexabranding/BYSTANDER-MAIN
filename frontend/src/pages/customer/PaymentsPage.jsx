import { useEffect, useMemo, useState } from 'react'
import { Download, IndianRupee, Lock, RefreshCcw, Wallet } from 'lucide-react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { toast } from 'sonner'
import { useAuth } from '@/context/AuthContext'
import { useData } from '@/context/DataContext'
import { useDocumentTitle, useDebouncedValue } from '@/hooks/useUi'
import { usePagination } from '@/hooks/usePagination'
import { CUSTOMER_SPEND } from '@/data/charts'
import { downloadText, formatCurrency, formatDate, toCSV } from '@/utils/format'
import { PageHeader } from '@/components/common/PageHeader'
import { StatCard } from '@/components/common/StatCard'
import { Card, CardBody, CardHeader } from '@/components/common/Card'
import { DataTable } from '@/components/common/DataTable'
import { Pagination } from '@/components/common/Pagination'
import { StatusBadge } from '@/components/common/StatusBadge'
import { SearchBar } from '@/components/common/SearchBar'
import { Select } from '@/components/forms/FormField'
import { Button } from '@/components/common/Button'

const STATUS_OPTIONS = ['All statuses', 'Escrow Held', 'Released', 'Refunded', 'Paid', 'Pending']

export function PaymentsPage() {
  useDocumentTitle('Payments')
  const { user } = useAuth()
  const { transactions } = useData()

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState(STATUS_OPTIONS[0])
  const debouncedSearch = useDebouncedValue(search)

  const customerId = user?.id || 'cu-201'

  const mine = useMemo(() => {
    return transactions.filter((t) => t.customerId === customerId)
  }, [transactions, customerId])

  const { totalSpent, escrowHeld, refunded } = useMemo(() => {
    let spent = 0
    let escrow = 0
    let ref = 0
    mine.forEach((t) => {
      if (t.status === 'Refunded') ref += t.amount || 0
      else spent += t.amount || 0
      if (t.status === 'Escrow Held') escrow += t.amount || 0
    })
    return { totalSpent: spent, escrowHeld: escrow, refunded: ref }
  }, [mine])

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    return mine.filter((t) => {
      const matchesStatus = status === STATUS_OPTIONS[0] || t.status === status
      const matchesSearch =
        !q ||
        t.id.toLowerCase().includes(q) ||
        t.bookingId?.toLowerCase().includes(q) ||
        t.caregiverName?.toLowerCase().includes(q) ||
        t.service?.toLowerCase().includes(q) ||
        t.method?.toLowerCase().includes(q)
      return matchesStatus && matchesSearch
    })
  }, [mine, debouncedSearch, status])

  const { page, totalPages, totalItems, pageItems, goto } = usePagination(filtered, 8)
  useEffect(() => {
    goto(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, status])

  const handleExport = () => {
    if (!filtered.length) {
      toast.error('Nothing to export', { description: 'Adjust your filters and try again.' })
      return
    }
    const rows = filtered.map((t) => ({
      Date: t.date,
      'Transaction ID': t.id,
      Booking: t.bookingId,
      Service: t.service,
      'Caretaker': t.caregiverName,
      Method: t.method,
      Amount: t.amount,
      Type: t.type,
      Status: t.status,
    }))
    downloadText(`caremate-payments-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(rows))
    toast.success('Export ready', { description: `${rows.length} transactions downloaded as CSV.` })
  }

  const columns = [
    {
      key: 'date',
      header: 'Date',
      render: (t) => <span className="whitespace-nowrap font-medium text-ink">{formatDate(t.date, { long: true })}</span>,
    },
    { key: 'id', header: 'Transaction ID', render: (t) => <span className="font-semibold text-ink">{t.id}</span> },
    {
      key: 'bookingId',
      header: 'Booking',
      render: (t) => <span className="text-primary-700">{t.bookingId || '—'}</span>,
    },
    { key: 'caregiverName', header: 'Caretaker' },
    { key: 'service', header: 'Service', sortable: false },
    { key: 'method', header: 'Method' },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      render: (t) => <span className="font-semibold tabular-nums text-ink">{formatCurrency(t.amount)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (t) => <StatusBadge status={t.status} size="sm" />,
    },
  ]

  const rows = pageItems.map((t) => ({ ...t }))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        subtitle="Every rupee you have spent on care — escrow, settlements and refunds."
        action={
          <Button variant="outline" icon={Download} onClick={handleExport}>
            Export CSV
          </Button>
        }
        meta={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-info-50 px-3 py-1 text-xs font-semibold text-info-700 ring-1 ring-inset ring-info-500/30">
            <Lock className="h-3.5 w-3.5" /> Demo transactions — no real payments are processed.
          </span>
        }
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Total spent" value={formatCurrency(totalSpent)} icon={IndianRupee} tone="primary" hint="All settled + escrow" delay={0} />
        <StatCard label="Escrow held" value={formatCurrency(escrowHeld)} icon={Lock} tone="warning" hint="Released after service" delay={0.05} />
        <StatCard label="Refunded this year" value={formatCurrency(refunded)} icon={RefreshCcw} tone="success" hint="Back to original method" delay={0.1} />
        <StatCard label="Next payout to caretakers" value="Awaiting settlement" icon={Wallet} tone="info" hint="Handled by CareMate ops" delay={0.15} />
      </div>

      <Card>
        <CardHeader title="Monthly spend" subtitle="Your care spending over the last 6 months" />
        <CardBody>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={CUSTOMER_SPEND} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="paymentsSpendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0F766E" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#0F766E" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#64748B' }} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12, fill: '#64748B' }}
                  tickFormatter={(v) => `₹${v / 1000}k`}
                />
                <Tooltip
                  formatter={(value) => [formatCurrency(value), 'Spend']}
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid #E2E8F0',
                    boxShadow: '0 10px 30px -18px rgba(23,43,58,0.35)',
                    fontSize: 13,
                  }}
                />
                <Area type="monotone" dataKey="spend" stroke="#0F766E" strokeWidth={2.5} fill="url(#paymentsSpendFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardBody>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search transaction, booking or caretaker…"
          className="sm:max-w-sm sm:flex-1"
        />
        <Select
          aria-label="Filter by status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-11 sm:w-48"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        keyExtractor={(row) => row.id}
        initialSort={{ key: 'date', dir: 'desc' }}
        emptyTitle="No transactions found"
        emptyDescription="Try clearing the search or switching the status filter."
      />
      <Pagination page={page} totalPages={totalPages} onPageChange={goto} totalItems={totalItems} />
    </div>
  )
}

export default PaymentsPage
