import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  Eye,
  History,
  MapPin,
  RefreshCw,
  SearchX,
  Siren,
  XCircle,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useData } from '@/context/DataContext'
import { useDocumentTitle } from '@/hooks/useUi'
import { cn } from '@/utils/cn'
import { formatDateTime } from '@/utils/format'
import { PageHeader } from '@/components/common/PageHeader'
import { StatCard } from '@/components/common/StatCard'
import { Card, CardBody, CardHeader } from '@/components/common/Card'
import { Button } from '@/components/common/Button'
import { Tabs } from '@/components/common/Tabs'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Modal } from '@/components/common/Modal'
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog'
import { CardSkeleton, EmptyState, ErrorState } from '@/components/common/States'
import { FormField, Select } from '@/components/forms/FormField'
import { sosService, isMongoObjectId } from '@/services'

const TABS = [
  { id: 'Active', match: 'Open' },
  { id: 'Under investigation', match: 'Under Investigation' },
  { id: 'Resolved', match: 'Resolved' },
  { id: 'All', match: null },
]

const ADMINS = ['Kavya Raman', 'Rohit Sharma', 'Sandeep K.']

const cardEdge = { borderLeft: '4px solid #EF4444' }

function MockMap({ location }) {
  return (
    <div className="overflow-hidden rounded-xl border border-line">
      <div
        className="relative h-32 bg-mint-50"
        style={{
          backgroundImage:
            'linear-gradient(#E6ECF2 1px, transparent 1px), linear-gradient(90deg, #E6ECF2 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
        role="img"
        aria-label={`Mock location panel for ${location?.label || 'incident location'}`}
      >
        <span className="absolute left-1/2 top-1/2 grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-danger-600 text-white shadow-raised">
          <MapPin className="h-4.5 w-4.5" size={18} />
        </span>
        <span className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full bg-danger-500/20" />
        <span className="absolute left-3 top-3 rounded-md bg-white/90 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted shadow-card">
          Demo map
        </span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-white px-3 py-2.5">
        <p className="text-xs font-semibold text-ink">{location?.label || 'Location unavailable'}</p>
        <p className="text-[11px] tabular-nums text-muted">
          {location?.lat ?? '—'}, {location?.lng ?? '—'}
        </p>
      </div>
      <p className="border-t border-line bg-slate-50 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-warning-700">
        Mock coordinates — not live tracking
      </p>
    </div>
  )
}

export function SosAlertsPage() {
  useDocumentTitle('SOS alerts')

  const { user } = useAuth()
  const { sos: seedSos, updateSos } = useData()

  const [realIncidents, setRealIncidents] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState('Active')
  const [openId, setOpenId] = useState(null)
  const [confirm, setConfirm] = useState(null)

  const fetchIncidents = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await sosService.getSosIncidents()
      setRealIncidents(res.incidents || [])
    } catch (err) {
      setError(err.message || 'Unable to load SOS incidents from server')
      setRealIncidents(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchIncidents()
  }, [fetchIncidents])

  // Use live incidents when available, otherwise seed fallback
  const allSos = useMemo(() => {
    if (realIncidents !== null) return realIncidents
    return seedSos || []
  }, [realIncidents, seedSos])

  const openIncident = allSos.find((s) => s.id === openId) || null

  const stats = useMemo(() => {
    const active = allSos.filter((s) => s.status !== 'Resolved' && s.status !== 'False Alarm')
    const resolvedThisMonth = allSos.filter((s) => s.status === 'Resolved' && s.reportedAt?.startsWith('2026-10'))
    const lastReported = active
      .map((s) => s.reportedAt)
      .filter(Boolean)
      .sort()
      .slice(-1)[0]
    return {
      active: active.length,
      critical: active.filter((s) => s.priority === 'Critical').length,
      investigating: allSos.filter((s) => s.status === 'Under Investigation').length,
      resolvedMonth: resolvedThisMonth.length,
      lastReported,
    }
  }, [allSos])

  const filtered = useMemo(() => {
    const activeTab = TABS.find((t) => t.id === tab)
    if (!activeTab || !activeTab.match) return allSos
    return allSos.filter((s) => s.status === activeTab.match)
  }, [allSos, tab])

  const resolved = useMemo(() => allSos.filter((s) => s.status === 'Resolved'), [allSos])

  const assignToMe = async (id) => {
    const adminName = user?.fullName || 'Kavya Raman'
    if (isMongoObjectId(id)) {
      try {
        if (user?._id && isMongoObjectId(user._id)) {
          await sosService.assignSos(id, user._id)
        } else {
          await sosService.addTimelineNote(id, {
            action: `Assigned to ${adminName}`,
            notes: 'Administrative assignment updated by operations desk.',
          })
        }
        toast.success(`SOS ${id} assigned to you`, { description: 'The incident timeline records the assignment.' })
        await fetchIncidents()
      } catch (err) {
        toast.error('Failed to assign incident', { description: err.message })
      }
    } else {
      updateSos(id, { assignedTo: adminName }, `Assigned to ${adminName}`)
      toast.success(`SOS ${id} assigned to you`, { description: 'The incident timeline records the assignment.' })
    }
  }

  const changeAssignee = async (id, name) => {
    if (!name) return
    if (isMongoObjectId(id)) {
      try {
        await sosService.addTimelineNote(id, {
          action: `Assigned to ${name}`,
          notes: `Operational assignment updated to ${name}`,
        })
        toast.success(`SOS ${id} assigned to ${name}`)
        await fetchIncidents()
      } catch (err) {
        toast.error('Failed to assign incident', { description: err.message })
      }
    } else {
      updateSos(id, { assignedTo: name }, `Assigned to ${name}`)
      toast.success(`SOS ${id} assigned to ${name}`)
    }
  }

  const handleStatusChange = async () => {
    if (!confirm) return
    const { id, status } = confirm
    setConfirm(null)

    if (isMongoObjectId(id)) {
      try {
        if (status === 'Resolved') {
          await sosService.resolveSos(id, {
            status: 'Resolved',
            resolutionNotes: 'Incident evaluated and resolved after verifying safety of all participants.',
          })
        } else {
          await sosService.addTimelineNote(id, {
            action: `Moved to ${status}`,
            notes: 'Operations desk escalated to active investigation.',
          })
        }
        toast.success(`SOS ${id} — ${status}`, {
          description: `Status changed to ${status} and written to the incident timeline.`,
        })
        await fetchIncidents()
      } catch (err) {
        toast.error(`Failed to update status to ${status}`, { description: err.message })
      }
    } else {
      updateSos(id, { status }, `Status changed to ${status}`)
      toast.success(`SOS ${id} — ${status}`, {
        description: `Status changed to ${status} and written to the incident timeline.`,
      })
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="SOS alerts"
        subtitle="Live emergency incidents raised by customers and caretakers — triage, assign and close them fast."
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" icon={RefreshCw} onClick={fetchIncidents} disabled={loading}>
              Refresh
            </Button>
            <Button to="/admin/bookings" variant="outline" size="sm">
              Open bookings
            </Button>
          </div>
        }
      />

      <div className="flex flex-col gap-3 rounded-card border border-danger-200 bg-gradient-to-br from-danger-50 to-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-pulse rounded-full bg-danger-500 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-danger-600" />
          </span>
          <p className="font-display text-sm font-extrabold text-danger-700 sm:text-base">
            Active SOS incidents: {stats.active}
          </p>
        </div>
        <p className="text-xs font-semibold text-danger-700/90">
          {stats.lastReported ? `Last reported ${formatDateTime(stats.lastReported)}` : 'No active incidents'}
          <span className="ml-2 font-normal text-danger-700/70">· Emergency desk staffed 24×7</span>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Active" value={stats.active} icon={Siren} tone="danger" hint="Open right now" delay={0} />
        <StatCard
          label="Critical"
          value={stats.critical}
          icon={AlertTriangle}
          tone="danger"
          hint="Highest priority first"
          delay={0.05}
        />
        <StatCard
          label="Under investigation"
          value={stats.investigating}
          icon={Eye}
          tone="warning"
          hint="Being worked by ops"
          delay={0.1}
        />
        <StatCard
          label="Resolved this month"
          value={stats.resolvedMonth}
          icon={CheckCircle2}
          tone="success"
          hint="October 2026"
          delay={0.15}
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          tabs={TABS.map((t) => ({
            id: t.id,
            label: t.id,
            count: t.match ? allSos.filter((s) => s.status === t.match).length : allSos.length,
          }))}
          active={tab}
          onChange={setTab}
          size="sm"
        />
        <p className="text-xs text-muted">
          {filtered.length} incident{filtered.length === 1 ? '' : 's'} shown · red indicates an unresolved emergency
        </p>
      </div>

      {loading ? (
        <CardSkeleton count={3} />
      ) : error && allSos.length === 0 ? (
        <div className="rounded-card border border-line bg-white shadow-card">
          <ErrorState
            title="Failed to load live SOS incidents"
            description={error}
            onRetry={fetchIncidents}
          />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-card border border-line bg-white shadow-card">
          <EmptyState
            icon={SearchX}
            title="No SOS incidents in this view"
            description="Switch the tab above to review incidents in another state."
            action={
              <Button variant="outline" onClick={() => setTab('All')}>
                Show all incidents
              </Button>
            }
          />
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((s) => (
            <Card key={s.id} className="overflow-hidden" style={cardEdge}>
              <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-start">
                <span
                  className={cn(
                    'grid h-12 w-12 shrink-0 place-items-center rounded-xl',
                    s.status === 'Resolved' ? 'bg-slate-100 text-muted' : 'bg-danger-50 text-danger-600',
                  )}
                >
                  <Siren className="h-6 w-6" />
                </span>

                <div className="min-w-0 flex-1 space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-display text-base font-extrabold text-ink">{s.id}</p>
                    <StatusBadge status={s.priority} size="sm" />
                    <StatusBadge status={s.status} size="sm" />
                    <span className="rounded-full border border-line-strong bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-muted">
                      Booking {s.bookingId}
                    </span>
                  </div>

                  <div className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                    <p className="text-muted">
                      Raised by <span className="font-semibold text-ink">{s.raisedBy}</span> · {s.userType}
                    </p>
                    <p className="text-muted">
                      Caretaker <span className="font-semibold text-ink">{s.caregiver}</span>
                    </p>
                    <p className="text-muted">
                      Reported <span className="font-semibold tabular-nums text-ink">{formatDateTime(s.reportedAt)}</span>
                    </p>
                    <p className="text-muted">
                      Assigned to{' '}
                      <span className="font-semibold text-ink">{s.assignedTo || 'Unassigned'}</span>
                    </p>
                  </div>

                  <p className="rounded-xl border border-line bg-gradient-to-br from-slate-50 to-white px-4 py-3 text-sm leading-relaxed text-ink-soft">
                    {s.summary}
                  </p>

                  <MockMap location={s.location} />

                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" icon={Siren} onClick={() => setOpenId(s.id)}>
                      Open incident
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={s.assignedTo === 'Kavya Raman'}
                      onClick={() => assignToMe(s.id)}
                    >
                      Assign to me
                    </Button>
                    {s.status === 'Open' ? (
                      <Button size="sm" variant="dangerGhost" onClick={() => setConfirm({ id: s.id, status: 'Under Investigation' })}>
                        Mark under investigation
                      </Button>
                    ) : null}
                    {s.status !== 'Resolved' ? (
                      <Button size="sm" variant="danger" onClick={() => setConfirm({ id: s.id, status: 'Resolved' })}>
                        Mark resolved
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader
          title="History"
          subtitle="Resolved incidents with their recorded timelines"
          icon={History}
        />
        <CardBody className="space-y-4">
          {resolved.length ? (
            resolved.map((s) => (
              <div key={s.id} className="rounded-xl border border-line p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-display text-sm font-bold text-ink">{s.id}</p>
                    <StatusBadge status={s.priority} size="sm" />
                    <StatusBadge status={s.status} size="sm" />
                  </div>
                  <p className="text-xs text-muted">{s.location?.label}</p>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-muted">{s.summary}</p>
                <ul className="mt-3 space-y-2 border-t border-line pt-3">
                  {s.timeline.map((t, i) => (
                    <li key={`${s.id}-${i}`} className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
                      <span className="text-ink-soft">
                        <span className="font-semibold text-ink">{t.action}</span> · {t.by}
                      </span>
                      <span className="tabular-nums text-faint">{formatDateTime(t.at)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          ) : (
            <EmptyState
              icon={CheckCircle2}
              title="No resolved incidents yet"
              description="Incidents you close will be archived here with a full timeline."
              className="py-8"
            />
          )}
        </CardBody>
      </Card>

      <Modal
        open={Boolean(openIncident)}
        onClose={() => setOpenId(null)}
        title={openIncident ? `Incident ${openIncident.id}` : 'Incident'}
        subtitle={openIncident ? `${openIncident.priority} priority · reported ${formatDateTime(openIncident.reportedAt)}` : ''}
        size="lg"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setOpenId(null)}>
              Close
            </Button>
            {openIncident && openIncident.status !== 'Resolved' ? (
              <Button variant="danger" onClick={() => setConfirm({ id: openIncident.id, status: 'Resolved' })}>
                Mark resolved
              </Button>
            ) : null}
          </div>
        }
      >
        {openIncident ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={openIncident.priority} />
              <StatusBadge status={openIncident.status} />
              <span className="rounded-full border border-line-strong bg-slate-50 px-3 py-1 text-xs font-semibold text-muted">
                {openIncident.userType} · {openIncident.raisedBy}
              </span>
            </div>

            <div
              className={`flex items-start gap-3 rounded-xl border p-4 ${
                openIncident.emergencyContactNotified
                  ? 'border-success-100 bg-success-50'
                  : 'border-danger-100 bg-danger-50'
              }`}
            >
              {openIncident.emergencyContactNotified ? (
                <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-success-600" />
              ) : (
                <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-danger-600" />
              )}
              <div>
                <p
                  className={`text-sm font-bold ${
                    openIncident.emergencyContactNotified ? 'text-success-700' : 'text-danger-700'
                  }`}
                >
                  {openIncident.emergencyContactNotified
                    ? 'Emergency contact notified'
                    : 'Emergency contact NOT notified'}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted">
                  {openIncident.emergencyContactNotification?.notes ||
                    (openIncident.emergencyContactNotified
                      ? 'An SMS notification was dispatched automatically.'
                      : 'No automated notification was recorded. Note: external emergency services telephony/SMS is not configured.')}
                </p>
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-faint">Summary</p>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{openIncident.summary}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-line bg-gradient-to-br from-slate-50 to-white p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-faint">Reported at</p>
                <p className="mt-1 text-sm font-semibold tabular-nums text-ink">
                  {formatDateTime(openIncident.reportedAt)}
                </p>
              </div>
              <div className="rounded-xl border border-line bg-gradient-to-br from-slate-50 to-white p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-faint">Caretaker on duty</p>
                <p className="mt-1 text-sm font-semibold text-ink">{openIncident.caregiver}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" to="/admin/bookings">
                Booking {openIncident.bookingId}
              </Button>
              <Button size="sm" variant="outline" to="/admin/customers">
                User record · {openIncident.raisedBy}
              </Button>
            </div>

            <MockMap location={openIncident.location} />

            <FormField label="Assigned operations admin" htmlFor="sos-assignee">
              <Select
                id="sos-assignee"
                value={openIncident.assignedTo || ''}
                onChange={(e) => changeAssignee(openIncident.id, e.target.value)}
              >
                <option value="">Unassigned</option>
                {ADMINS.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </Select>
            </FormField>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-faint">Incident timeline</p>
              <ul className="mt-2 space-y-2 rounded-xl border border-line p-4">
                {openIncident.timeline.map((t, i) => (
                  <li key={`${openIncident.id}-${i}`} className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
                    <span className="text-ink-soft">
                      <span className="font-semibold text-ink">{t.action}</span> · {t.by}
                    </span>
                    <span className="tabular-nums text-faint">{formatDateTime(t.at)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
      </Modal>

      <ConfirmationDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        onConfirm={handleStatusChange}
        tone={confirm?.status === 'Resolved' ? 'success' : 'danger'}
        title={confirm?.status === 'Resolved' ? 'Resolve this SOS incident?' : 'Move incident under investigation?'}
        message={
          confirm
            ? `${confirm.id} will be marked "${confirm.status}". The change is appended to the incident timeline and the emergency desk is notified.`
            : ''
        }
        confirmLabel={confirm ? `Mark ${confirm.status.toLowerCase()}` : 'Confirm'}
      />
    </div>
  )
}

export default SosAlertsPage
