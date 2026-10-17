import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, Ban, Check, CheckCircle2, Eye, ShieldAlert, TrendingUp, SearchX } from 'lucide-react'
import { useData } from '@/context/DataContext'
import { useDebouncedValue, useDocumentTitle } from '@/hooks/useUi'
import { usePagination } from '@/hooks/usePagination'
import { formatDate } from '@/utils/format'
import { PageHeader } from '@/components/common/PageHeader'
import { StatCard } from '@/components/common/StatCard'
import { Button } from '@/components/common/Button'
import { SearchBar } from '@/components/common/SearchBar'
import { Tabs, ProgressBar } from '@/components/common/Tabs'
import { DataTable } from '@/components/common/DataTable'
import { Pagination } from '@/components/common/Pagination'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Modal } from '@/components/common/Modal'
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog'
import { EmptyState } from '@/components/common/States'
import { FormField, Select } from '@/components/forms/FormField'

const RISK_TABS = ['All', 'High', 'Medium', 'Low']
const STATUSES = ['All', 'Open', 'Under Review', 'Escalated', 'Dismissed', 'Resolved']

const RISK_SCORE = { High: 82, Medium: 55, Low: 28 }
const RISK_TONE = { High: 'danger', Medium: 'warning', Low: 'accent' }

export function FraudAlertsPage() {
  useDocumentTitle('Fraud alerts')

  const { frauds, caregivers, updateFraud } = useData()

  const [search, setSearch] = useState('')
  const [risk, setRisk] = useState('All')
  const [status, setStatus] = useState('All')
  const [selectedId, setSelectedId] = useState(null)
  const [action, setAction] = useState(null)
  const debouncedSearch = useDebouncedValue(search)

  const selected = frauds.find((f) => f.id === selectedId) || null

  const stats = useMemo(
    () => ({
      open: frauds.filter((f) => f.status === 'Open').length,
      high: frauds.filter((f) => f.risk === 'High' && f.status !== 'Resolved' && f.status !== 'Dismissed').length,
      review: frauds.filter((f) => f.status === 'Under Review').length,
      resolved: frauds.filter((f) => f.status === 'Resolved').length,
    }),
    [frauds],
  )

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    return frauds.filter((f) => {
      const matchesRisk = risk === 'All' || f.risk === risk
      const matchesStatus = status === 'All' || f.status === status
      const matchesSearch =
        !q || [f.id, f.subject, f.subjectType, f.signal, f.risk, f.status].join(' ').toLowerCase().includes(q)
      return matchesRisk && matchesStatus && matchesSearch
    })
  }, [frauds, debouncedSearch, risk, status])

  const { page, totalPages, totalItems, pageItems, goto } = usePagination(filtered, 8)
  useEffect(() => {
    goto(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, risk, status])

  const runAction = () => {
    if (!action || !action.alert) return
    updateFraud(action.alert.id, action.next)
    toast.success(`Fraud alert ${action.alert.id} ${action.message}`, {
      description: `Status is now "${action.next}".`,
    })
    setAction(null)
  }

  const columns = [
    {
      key: 'id',
      header: 'Alert ID',
      render: (f) => (
        <span className={`font-display text-sm font-bold ${f.risk === 'High' ? 'text-danger-600' : 'text-ink'}`}>
          {f.id}
        </span>
      ),
    },
    {
      key: 'subject',
      header: 'Subject',
      render: (f) => (
        <div>
          <p className="font-medium text-ink">{f.subject}</p>
          <p className="text-xs text-faint">{f.subjectType}</p>
        </div>
      ),
    },
    { key: 'subjectType', header: 'Type' },
    {
      key: 'signal',
      header: 'Signal',
      render: (f) => <p className="max-w-[22rem] truncate text-ink-soft">{f.signal}</p>,
    },
    {
      key: 'risk',
      header: 'Risk',
      render: (f) => <StatusBadge status={f.risk} size="sm" />,
    },
    {
      key: 'raisedOn',
      header: 'Raised',
      render: (f) => <span className="whitespace-nowrap tabular-nums">{formatDate(f.raisedOn, { long: true })}</span>,
    },
    { key: 'status', header: 'Status', render: (f) => <StatusBadge status={f.status} size="sm" /> },
    {
      key: 'action',
      header: 'Action',
      align: 'right',
      sortable: false,
      render: (f) => (
        <Button
          size="xs"
          variant="outline"
          onClick={(e) => {
            e.stopPropagation()
            setSelectedId(f.id)
          }}
        >
          Review
        </Button>
      ),
    },
  ]

  const linkedRecords = (f) => {
    if (!f) return []
    const records = []
    if (f.subjectType === 'Booking') {
      const ref = f.subject.replace(/^Booking\s+/, '')
      records.push({ label: 'Booking reference', value: ref, to: '/admin/bookings' })
    }
    if (f.subjectType === 'Caretaker') {
      const caregiver = caregivers.find((c) => c.name === f.subject)
      records.push({ label: 'Caretaker profile', value: caregiver ? caregiver.id : f.subject, to: '/admin/caregivers' })
      if (caregiver) records.push({ label: 'City', value: caregiver.city || '—' })
    }
    if (f.subjectType === 'Customer') {
      records.push({ label: 'Customer account', value: f.subject, to: '/admin/customers' })
    }
    records.push({ label: 'Alert raised on', value: formatDate(f.raisedOn, { long: true }) })
    records.push({ label: 'Risk score', value: `${RISK_SCORE[f.risk] || 0} / 100` })
    return records
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fraud alerts"
        subtitle="Signals raised by the risk engine — review, escalate or dismiss each one."
        meta={<span className="text-sm text-muted">High-risk alerts are highlighted in red across this page</span>}
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Open" value={stats.open} icon={ShieldAlert} tone="primary" hint="Awaiting review" delay={0} />
        <StatCard label="High risk" value={stats.high} icon={AlertTriangle} tone="danger" hint="Act first" delay={0.05} />
        <StatCard label="Under review" value={stats.review} icon={Eye} tone="warning" hint="Investigating" delay={0.1} />
        <StatCard label="Resolved" value={stats.resolved} icon={CheckCircle2} tone="success" hint="Closed alerts" delay={0.15} />
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search alert ID, subject or signal…"
          className="lg:max-w-md"
        />
        <Tabs
          tabs={RISK_TABS.map((r) => ({
            id: r,
            label: r,
            count: r === 'All' ? frauds.length : frauds.filter((f) => f.risk === r).length,
          }))}
          active={risk}
          onChange={setRisk}
          size="sm"
        />
      </div>

      <div className="max-w-xs">
        <FormField label="Status" htmlFor="fraud-status">
          <Select id="fraud-status" value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s === 'All' ? 'All statuses' : s}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-card border border-line bg-white shadow-card">
          <EmptyState
            icon={SearchX}
            title="No fraud alerts match"
            description="Adjust the risk tab, status filter or search term."
            action={
              <Button
                variant="outline"
                onClick={() => {
                  setSearch('')
                  setRisk('All')
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
            onRowClick={(row) => setSelectedId(row.id)}
            initialSort={{ key: 'raisedOn', dir: 'desc' }}
            emptyTitle="No fraud alerts found"
            emptyIcon={ShieldAlert}
          />
          <Pagination page={page} totalPages={totalPages} onPageChange={goto} totalItems={totalItems} />
        </>
      )}

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelectedId(null)}
        title={selected ? `Fraud alert ${selected.id}` : 'Fraud alert'}
        subtitle={selected ? `${selected.subjectType} · raised ${formatDate(selected.raisedOn, { long: true })}` : ''}
        size="lg"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setSelectedId(null)}>
              Close
            </Button>
            {selected && selected.status !== 'Dismissed' ? (
              <Button
                variant="outline"
                icon={Ban}
                onClick={() =>
                  setAction({ alert: selected, next: 'Dismissed', message: 'dismissed', tone: 'primary' })
                }
              >
                Dismiss
              </Button>
            ) : null}
            {selected && selected.status !== 'Escalated' ? (
              <Button
                variant="dangerGhost"
                icon={TrendingUp}
                onClick={() =>
                  setAction({ alert: selected, next: 'Escalated', message: 'escalated', tone: 'primary' })
                }
              >
                Escalate
              </Button>
            ) : null}
            {selected && selected.status !== 'Resolved' ? (
              <Button
                icon={Check}
                onClick={() =>
                  setAction({ alert: selected, next: 'Resolved', message: 'marked resolved', tone: 'success' })
                }
              >
                Mark resolved
              </Button>
            ) : null}
          </div>
        }
      >
        {selected ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={selected.risk} />
              <StatusBadge status={selected.status} />
              <span className="rounded-full border border-line-strong bg-slate-50 px-3 py-1 text-xs font-semibold text-muted">
                {selected.subject}
              </span>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-faint">Detected signal</p>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{selected.signal}</p>
            </div>

            <div className="rounded-card border border-line bg-slate-50/70 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold text-ink-soft">Risk score</p>
                <p
                  className={`font-display text-sm font-extrabold tabular-nums ${
                    selected.risk === 'High' ? 'text-danger-600' : 'text-ink'
                  }`}
                >
                  {RISK_SCORE[selected.risk] || 0} / 100
                </p>
              </div>
              <ProgressBar
                className="mt-2.5"
                value={RISK_SCORE[selected.risk] || 0}
                tone={RISK_TONE[selected.risk] || 'primary'}
                showLabel
              />
              <p className="mt-2 text-xs text-muted">
                Score is a demo heuristic combining signal frequency, account age and payment history.
              </p>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-faint">Linked records</p>
              <ul className="mt-2 divide-y divide-line overflow-hidden rounded-card border border-line">
                {linkedRecords(selected).map((r) => (
                  <li key={r.label} className="flex items-center justify-between gap-4 px-4 py-3 transition hover:bg-mint-50/60">
                    <span className="text-xs font-semibold uppercase tracking-wider text-faint">{r.label}</span>
                    {r.to ? (
                      <Button size="xs" variant="link" to={r.to}>
                        {r.value}
                      </Button>
                    ) : (
                      <span className="text-sm font-semibold text-ink">{r.value}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-line bg-white p-4">
              <p className="text-xs font-semibold text-ink">Recommended handling</p>
              <p className="mt-1.5 text-xs leading-relaxed text-muted">
                {selected.risk === 'High'
                  ? 'Escalate to the trust & safety lead, hold any related payouts and request fresh identity documents before the account is unlocked.'
                  : selected.risk === 'Medium'
                    ? 'Review the linked booking and payment history, then either dismiss the alert or escalate if a pattern appears.'
                    : 'Low severity — monitor for repetition and dismiss if no further signals arrive in the next 14 days.'}
              </p>
            </div>
          </div>
        ) : null}
      </Modal>

      <ConfirmationDialog
        open={Boolean(action)}
        onClose={() => setAction(null)}
        onConfirm={runAction}
        tone={action?.next === 'Escalated' ? 'danger' : action?.next === 'Resolved' ? 'success' : 'primary'}
        title={action ? `${action.message.replace(/^./, (c) => c.toUpperCase())} alert ${action.alert.id}?` : 'Confirm'}
        message={
          action
            ? `The alert status will change to "${action.next}". This is recorded in the demo risk ledger for audit.`
            : ''
        }
        confirmLabel={action ? `Set to ${action.next}` : 'Confirm'}
      />
    </div>
  )
}

export default FraudAlertsPage
