import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import {
  AlertTriangle,
  Ban,
  Check,
  CheckCircle2,
  ExternalLink,
  Eye,
  MessageSquareWarning,
  PhoneCall,
  SearchX,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { useData } from '@/context/DataContext'
import { useDebouncedValue, useDocumentTitle } from '@/hooks/useUi'
import { usePagination } from '@/hooks/usePagination'
import { formatDate } from '@/utils/format'
import { adminService } from '@/services/adminService'
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
import { EmptyState, ErrorState, TableSkeleton } from '@/components/common/States'
import { Select } from '@/components/forms/FormField'

const ACTIVE_VIEW_TABS = [
  { id: 'flagged_messages', label: 'Flagged Messages (Off-Platform Signals)' },
  { id: 'risk_alerts', label: 'Risk Engine Alerts' },
]

const RISK_TABS = ['All', 'High', 'Medium', 'Low']
const STATUSES = ['All', 'Open', 'Under Review', 'Escalated', 'Dismissed', 'Resolved']
const FLAGGED_REASON_FILTERS = ['All', 'Phone Number', 'UPI Handle']

const RISK_SCORE = { High: 82, Medium: 55, Low: 28 }
const RISK_TONE = { High: 'danger', Medium: 'warning', Low: 'accent' }

export function FraudAlertsPage() {
  useDocumentTitle('Fraud alerts & moderation')

  const { frauds, caregivers, updateFraud } = useData()

  const [activeView, setActiveView] = useState('flagged_messages')

  // Live Flagged Messages state
  const [flaggedMessages, setFlaggedMessages] = useState([])
  const [flaggedStats, setFlaggedStats] = useState({ totalFlagged: 0, phoneSignals: 0, upiSignals: 0 })
  const [isLoadingMessages, setIsLoadingMessages] = useState(true)
  const [messageError, setMessageError] = useState(null)
  const [reasonFilter, setReasonFilter] = useState('All')
  const [selectedMessage, setSelectedMessage] = useState(null)

  // Seed Fraud Alerts state
  const [search, setSearch] = useState('')
  const [risk, setRisk] = useState('All')
  const [status, setStatus] = useState('All')
  const [selectedId, setSelectedId] = useState(null)
  const [action, setAction] = useState(null)

  const debouncedSearch = useDebouncedValue(search)

  // 1. Fetch live flagged messages from administrative moderation endpoint
  const fetchFlaggedMessages = useCallback(async () => {
    setIsLoadingMessages(true)
    setMessageError(null)
    try {
      let filterReason = undefined
      if (reasonFilter === 'Phone Number') filterReason = 'phone'
      else if (reasonFilter === 'UPI Handle') filterReason = 'upi'

      const result = await adminService.getFlaggedMessages({
        search: debouncedSearch.trim() || undefined,
        reason: filterReason,
      })

      setFlaggedMessages(result.messages || [])
      setFlaggedStats({
        totalFlagged: result.stats?.totalFlagged ?? result.messages.length,
        phoneSignals: result.stats?.phoneSignals ?? result.messages.filter((m) => m.flaggedReasons.some((r) => /phone/i.test(r))).length,
        upiSignals: result.stats?.upiSignals ?? result.messages.filter((m) => m.flaggedReasons.some((r) => /upi/i.test(r))).length,
      })
    } catch (err) {
      setMessageError(err.message || 'Failed to retrieve flagged messages.')
    } finally {
      setIsLoadingMessages(false)
    }
  }, [debouncedSearch, reasonFilter])

  useEffect(() => {
    if (activeView === 'flagged_messages') {
      fetchFlaggedMessages()
    }
  }, [activeView, fetchFlaggedMessages])

  // Flagged messages pagination
  const {
    page: msgPage,
    totalPages: msgTotalPages,
    totalItems: msgTotalItems,
    pageItems: msgPageItems,
    goto: gotoMsgPage,
  } = usePagination(flaggedMessages, 8)

  // Seed fraud alerts filtering & pagination
  const selectedFraud = frauds.find((f) => f.id === selectedId) || null

  const fraudStats = useMemo(
    () => ({
      open: frauds.filter((f) => f.status === 'Open').length,
      high: frauds.filter((f) => f.risk === 'High' && f.status !== 'Resolved' && f.status !== 'Dismissed').length,
      review: frauds.filter((f) => f.status === 'Under Review').length,
      resolved: frauds.filter((f) => f.status === 'Resolved').length,
    }),
    [frauds],
  )

  const filteredFrauds = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    return frauds.filter((f) => {
      const matchesRisk = risk === 'All' || f.risk === risk
      const matchesStatus = status === 'All' || f.status === status
      const matchesSearch =
        !q || [f.id, f.subject, f.subjectType, f.signal, f.risk, f.status].join(' ').toLowerCase().includes(q)
      return matchesRisk && matchesStatus && matchesSearch
    })
  }, [frauds, debouncedSearch, risk, status])

  const {
    page: fraudPage,
    totalPages: fraudTotalPages,
    totalItems: fraudTotalItems,
    pageItems: fraudPageItems,
    goto: gotoFraudPage,
  } = usePagination(filteredFrauds, 8)

  useEffect(() => {
    gotoFraudPage(1)
    gotoMsgPage(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, risk, status, reasonFilter, activeView])

  const runAction = () => {
    if (!action || !action.alert) return
    updateFraud(action.alert.id, action.next)
    toast.success(`Fraud alert ${action.alert.id} ${action.message}`, {
      description: `Status is now "${action.next}".`,
    })
    setAction(null)
  }

  // Columns for Live Flagged Messages Table
  const flaggedColumns = [
    {
      key: 'id',
      header: 'Message ID',
      render: (m) => (
        <div>
          <span className="font-mono text-xs font-bold text-ink">{m.id.slice(-6).toUpperCase()}</span>
          <p className="text-[11px] text-faint tabular-nums">{formatDate(m.flaggedAt, { long: true })}</p>
        </div>
      ),
    },
    {
      key: 'signals',
      header: 'Detected Signals',
      render: (m) => (
        <div className="flex flex-wrap gap-1">
          {m.flaggedReasons && m.flaggedReasons.length > 0 ? (
            m.flaggedReasons.map((r, i) => {
              const isPhone = /phone/i.test(r)
              const isUpi = /upi/i.test(r)
              return (
                <span
                  key={i}
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    isUpi
                      ? 'bg-purple-100 text-purple-700'
                      : isPhone
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-danger-50 text-danger-700'
                  }`}
                >
                  {isPhone ? <PhoneCall className="h-3 w-3" /> : isUpi ? <Wallet className="h-3 w-3" /> : null}
                  {isPhone ? 'Phone Detected' : isUpi ? 'UPI Handle' : 'Off-Platform'}
                </span>
              )
            })
          ) : (
            <span className="text-xs text-muted">Flagged for review</span>
          )}
        </div>
      ),
    },
    {
      key: 'booking',
      header: 'Booking',
      render: (m) => (
        <div>
          <Link
            to="/admin/bookings"
            className="font-medium text-primary-700 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {m.bookingNumber}
          </Link>
          <p className="text-xs text-muted capitalize">{m.bookingStatus}</p>
        </div>
      ),
    },
    {
      key: 'participants',
      header: 'Participants',
      render: (m) => (
        <div className="text-xs">
          <p className="font-semibold text-ink">
            From: {m.senderName} <span className="font-normal text-muted">({m.senderRole})</span>
          </p>
          <p className="text-muted">
            To: {m.recipientName} <span className="font-normal text-faint">({m.recipientRole})</span>
          </p>
        </div>
      ),
    },
    {
      key: 'content',
      header: 'Message Excerpt',
      render: (m) => (
        <p className="max-w-[18rem] truncate font-mono text-xs text-ink-soft bg-slate-50 px-2 py-1 rounded border border-line">
          {m.content}
        </p>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      align: 'right',
      sortable: false,
      render: (m) => (
        <Button
          size="xs"
          variant="outline"
          icon={Eye}
          onClick={(e) => {
            e.stopPropagation()
            setSelectedMessage(m)
          }}
        >
          Review
        </Button>
      ),
    },
  ]

  // Columns for Seed Fraud Alerts Table
  const fraudColumns = [
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
        title="Fraud alerts & message moderation"
        subtitle="Review risk engine signals and monitor messages flagged for off-platform contact or payment circumvention."
        meta={<span className="text-sm text-muted">Strict privacy protections: only triggered messages are listed</span>}
      />

      {/* Main Mode View Selector */}
      <div className="flex border-b border-line">
        {ACTIVE_VIEW_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveView(tab.id)}
            className={`border-b-2 px-5 py-3 text-sm font-semibold transition ${
              activeView === tab.id
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeView === 'flagged_messages' ? (
        <>
          {/* Live Flagged Messages Stats */}
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <StatCard
              label="Flagged Messages"
              value={flaggedStats.totalFlagged}
              icon={MessageSquareWarning}
              tone="warning"
              hint="Awaiting admin review"
              delay={0}
            />
            <StatCard
              label="Phone Number Signals"
              value={flaggedStats.phoneSignals}
              icon={PhoneCall}
              tone="danger"
              hint="Potential contact circumvention"
              delay={0.05}
            />
            <StatCard
              label="UPI / Payment Signals"
              value={flaggedStats.upiSignals}
              icon={Wallet}
              tone="accent"
              hint="Potential off-platform payment"
              delay={0.1}
            />
            <StatCard
              label="Privacy Boundary"
              value="Scoped"
              icon={ShieldCheck}
              tone="primary"
              hint="Unflagged chats strictly hidden"
              delay={0.15}
            />
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Search flagged message text…"
              className="lg:max-w-md"
            />
            <div className="w-48">
              <Select
                value={reasonFilter}
                onChange={(e) => setReasonFilter(e.target.value)}
                aria-label="Filter by signal"
              >
                {FLAGGED_REASON_FILTERS.map((r) => (
                  <option key={r} value={r}>
                    {r === 'All' ? 'All signals' : r}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {isLoadingMessages ? (
            <div className="rounded-card border border-line bg-white p-6 shadow-card">
              <TableSkeleton rows={6} cols={6} />
            </div>
          ) : messageError ? (
            <div className="rounded-card border border-line bg-white shadow-card">
              <ErrorState
                title="Unable to load flagged messages queue"
                description={messageError}
                onRetry={fetchFlaggedMessages}
              />
            </div>
          ) : flaggedMessages.length === 0 ? (
            <div className="rounded-card border border-line bg-white shadow-card">
              <EmptyState
                icon={ShieldCheck}
                title="No flagged messages"
                description="The risk engine has not detected off-platform phone numbers or UPI handles in active conversations."
              />
            </div>
          ) : (
            <>
              <DataTable
                columns={flaggedColumns}
                data={msgPageItems}
                keyExtractor={(row) => row.id}
                onRowClick={(row) => setSelectedMessage(row)}
                emptyTitle="No flagged messages"
                emptyIcon={MessageSquareWarning}
              />
              <Pagination page={msgPage} totalPages={msgTotalPages} onPageChange={gotoMsgPage} totalItems={msgTotalItems} />
            </>
          )}

          {/* Flagged Message Review Modal */}
          <Modal
            open={Boolean(selectedMessage)}
            onClose={() => setSelectedMessage(null)}
            title="Flagged Message Moderation"
            subtitle={selectedMessage ? `Booking ${selectedMessage.bookingNumber} · Detected ${formatDate(selectedMessage.flaggedAt, { long: true })}` : ''}
            size="lg"
            footer={
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between w-full">
                <div className="flex gap-2">
                  {selectedMessage?.senderRole === 'customer' ? (
                    <Button variant="outline" size="sm" to="/admin/customers">
                      View Customer in Governance
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" to="/admin/caregivers">
                      View Caretaker in Governance
                    </Button>
                  )}
                </div>
                <Button onClick={() => setSelectedMessage(null)}>Done</Button>
              </div>
            }
          >
            {selectedMessage ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-amber-800">Review Signals Detected</p>
                      <ul className="mt-1 list-disc list-inside text-xs text-amber-900 space-y-0.5">
                        {selectedMessage.flaggedReasons.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-faint">Full Message Content</p>
                  <div className="mt-1.5 rounded-card border border-line bg-slate-50 p-4 font-mono text-sm leading-relaxed text-ink break-words">
                    {selectedMessage.content}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-line p-3 text-xs">
                    <p className="font-semibold text-faint uppercase tracking-wider text-[10px]">Sender</p>
                    <p className="mt-1 font-bold text-ink">{selectedMessage.senderName}</p>
                    <p className="text-muted capitalize">Role: {selectedMessage.senderRole} · Status: {selectedMessage.senderStatus}</p>
                  </div>
                  <div className="rounded-xl border border-line p-3 text-xs">
                    <p className="font-semibold text-faint uppercase tracking-wider text-[10px]">Recipient</p>
                    <p className="mt-1 font-bold text-ink">{selectedMessage.recipientName}</p>
                    <p className="text-muted capitalize">Role: {selectedMessage.recipientRole} · Status: {selectedMessage.recipientStatus}</p>
                  </div>
                </div>

                <div className="rounded-xl border border-line bg-slate-50 p-3.5 text-xs text-muted">
                  <p className="font-semibold text-ink">Administrative Policy Notice</p>
                  <p className="mt-1 leading-relaxed">
                    Under project safeguards, users are not automatically suspended or blocked solely based on a detection heuristic.
                    If this communication represents deliberate circumvention or fraud, navigate to the User Directory to record an auditable suspension or block.
                  </p>
                </div>
              </div>
            ) : null}
          </Modal>
        </>
      ) : (
        <>
          {/* Seed Risk Engine Alerts View */}
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <StatCard label="Open" value={fraudStats.open} icon={ShieldAlert} tone="primary" hint="Awaiting review" delay={0} />
            <StatCard label="High risk" value={fraudStats.high} icon={AlertTriangle} tone="danger" hint="Act first" delay={0.05} />
            <StatCard label="Under review" value={fraudStats.review} icon={Eye} tone="warning" hint="Investigating" delay={0.1} />
            <StatCard label="Resolved" value={fraudStats.resolved} icon={CheckCircle2} tone="success" hint="Closed alerts" delay={0.15} />
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

          {filteredFrauds.length === 0 ? (
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
                columns={fraudColumns}
                data={fraudPageItems}
                keyExtractor={(row) => row.id}
                onRowClick={(row) => setSelectedId(row.id)}
                initialSort={{ key: 'raisedOn', dir: 'desc' }}
                emptyTitle="No fraud alerts found"
                emptyIcon={ShieldAlert}
              />
              <Pagination page={fraudPage} totalPages={fraudTotalPages} onPageChange={gotoFraudPage} totalItems={fraudTotalItems} />
            </>
          )}

          <Modal
            open={Boolean(selectedFraud)}
            onClose={() => setSelectedId(null)}
            title={selectedFraud ? `Fraud alert ${selectedFraud.id}` : 'Fraud alert'}
            subtitle={selectedFraud ? `${selectedFraud.subjectType} · raised ${formatDate(selectedFraud.raisedOn, { long: true })}` : ''}
            size="lg"
            footer={
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variant="ghost" onClick={() => setSelectedId(null)}>
                  Close
                </Button>
                {selectedFraud && selectedFraud.status !== 'Dismissed' ? (
                  <Button
                    variant="outline"
                    icon={Ban}
                    onClick={() =>
                      setAction({ alert: selectedFraud, next: 'Dismissed', message: 'dismissed', tone: 'primary' })
                    }
                  >
                    Dismiss
                  </Button>
                ) : null}
                {selectedFraud && selectedFraud.status !== 'Escalated' ? (
                  <Button
                    variant="dangerGhost"
                    icon={TrendingUp}
                    onClick={() =>
                      setAction({ alert: selectedFraud, next: 'Escalated', message: 'escalated', tone: 'primary' })
                    }
                  >
                    Escalate
                  </Button>
                ) : null}
                {selectedFraud && selectedFraud.status !== 'Resolved' ? (
                  <Button
                    icon={Check}
                    onClick={() =>
                      setAction({ alert: selectedFraud, next: 'Resolved', message: 'marked resolved', tone: 'success' })
                    }
                  >
                    Mark resolved
                  </Button>
                ) : null}
              </div>
            }
          >
            {selectedFraud ? (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={selectedFraud.risk} />
                  <StatusBadge status={selectedFraud.status} />
                  <span className="rounded-full border border-line-strong bg-slate-50 px-3 py-1 text-xs font-semibold text-muted">
                    {selectedFraud.subject}
                  </span>
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-faint">Detected signal</p>
                  <p className="mt-2 text-sm leading-relaxed text-ink-soft">{selectedFraud.signal}</p>
                </div>

                <div className="rounded-card border border-line bg-slate-50/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold text-ink-soft">Risk score</p>
                    <p
                      className={`font-display text-sm font-extrabold tabular-nums ${
                        selectedFraud.risk === 'High' ? 'text-danger-600' : 'text-ink'
                      }`}
                    >
                      {RISK_SCORE[selectedFraud.risk] || 0} / 100
                    </p>
                  </div>
                  <ProgressBar
                    className="mt-2.5"
                    value={RISK_SCORE[selectedFraud.risk] || 0}
                    tone={RISK_TONE[selectedFraud.risk] || 'primary'}
                    showLabel
                  />
                  <p className="mt-2 text-xs text-muted">
                    Score is a demo heuristic combining signal frequency, account age and payment history.
                  </p>
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-faint">Linked records</p>
                  <ul className="mt-2 divide-y divide-line overflow-hidden rounded-card border border-line">
                    {linkedRecords(selectedFraud).map((r) => (
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
                    {selectedFraud.risk === 'High'
                      ? 'Escalate to the trust & safety lead, hold any related payouts and request fresh identity documents before the account is unlocked.'
                      : selectedFraud.risk === 'Medium'
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
        </>
      )}
    </div>
  )
}

export default FraudAlertsPage
