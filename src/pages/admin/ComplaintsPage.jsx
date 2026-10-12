import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Eye,
  FileText,
  History,
  Inbox,
  Lock,
  Scale,
  SearchX,
  ShieldAlert,
  Users,
} from 'lucide-react'
import { useData } from '@/context/DataContext'
import { useDebouncedValue, useDocumentTitle } from '@/hooks/useUi'
import { usePagination } from '@/hooks/usePagination'
import { cn } from '@/utils/cn'
import { COMPLAINT_STATUSES } from '@/utils/constants'
import { formatDate, formatTime } from '@/utils/format'
import { PageHeader } from '@/components/common/PageHeader'
import { StatCard } from '@/components/common/StatCard'
import { Card, CardBody, CardHeader } from '@/components/common/Card'
import { Button } from '@/components/common/Button'
import { SearchBar } from '@/components/common/SearchBar'
import { Tabs, Chip } from '@/components/common/Tabs'
import { DataTable } from '@/components/common/DataTable'
import { Pagination } from '@/components/common/Pagination'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Breadcrumbs } from '@/components/common/Breadcrumbs'
import { Modal } from '@/components/common/Modal'
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog'
import { EmptyState } from '@/components/common/States'
import { Avatar } from '@/components/common/Avatar'
import { FormField, Select, Textarea } from '@/components/forms/FormField'

const STATUS_TABS = ['All', ...COMPLAINT_STATUSES]
const PRIORITIES = ['High', 'Medium', 'Low']
const ADMIN = 'Admin · Kavya Raman'

function StageStepper({ status }) {
  const current = Math.max(0, COMPLAINT_STATUSES.indexOf(status))
  const last = COMPLAINT_STATUSES.length - 1

  return (
    <div className="relative px-1">
      <span className="absolute left-[12.5%] right-[12.5%] top-[13px] h-0.5 bg-line" aria-hidden="true" />
      <span
        className="absolute left-[12.5%] top-[13px] h-0.5 bg-primary-600 transition-all duration-500"
        style={{ width: `${(current / last) * 75}%` }}
        aria-hidden="true"
      />
      <ol className="relative flex">
        {COMPLAINT_STATUSES.map((s, i) => {
          const done = i < current
          const active = i === current
          return (
            <li key={s} className="flex w-1/4 flex-col items-center gap-2 text-center">
              <span
                className={cn(
                  'grid h-7 w-7 place-items-center rounded-full border-2 bg-white text-[11px] font-bold',
                  done
                    ? 'border-primary-600 bg-primary-600 text-white'
                    : active
                      ? 'border-accent-400 text-accent-600'
                      : 'border-line-strong text-faint',
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}
              </span>
              <span
                className={cn(
                  'text-[10px] font-bold uppercase tracking-wider leading-tight',
                  active ? 'text-primary-700' : done ? 'text-ink-soft' : 'text-faint',
                )}
              >
                {s}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function ComplaintsList() {
  useDocumentTitle('Complaints')
  const navigate = useNavigate()
  const { complaints } = useData()

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('All')
  const [priority, setPriority] = useState('All')
  const [category, setCategory] = useState('All')
  const debouncedSearch = useDebouncedValue(search)

  const categories = useMemo(() => {
    const seen = []
    complaints.forEach((c) => {
      if (!seen.includes(c.category)) seen.push(c.category)
    })
    return ['All', ...seen]
  }, [complaints])

  const counts = useMemo(
    () => ({
      total: complaints.length,
      submitted: complaints.filter((c) => c.status === 'Submitted').length,
      review: complaints.filter((c) => c.status === 'Under Review').length,
      resolved: complaints.filter((c) => c.status === 'Resolved').length,
    }),
    [complaints],
  )

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    return complaints.filter((c) => {
      const matchesStatus = status === 'All' || c.status === status
      const matchesPriority = priority === 'All' || c.priority === priority
      const matchesCategory = category === 'All' || c.category === category
      const matchesSearch =
        !q ||
        [c.id, c.subject, c.complainant, c.against, c.bookingId, c.category].join(' ').toLowerCase().includes(q)
      return matchesStatus && matchesPriority && matchesCategory && matchesSearch
    })
  }, [complaints, debouncedSearch, status, priority, category])

  const { page, totalPages, totalItems, pageItems, goto } = usePagination(filtered, 8)
  useEffect(() => {
    goto(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, status, priority, category])

  const resetFilters = () => {
    setSearch('')
    setStatus('All')
    setPriority('All')
    setCategory('All')
  }

  const hasFilters = search || status !== 'All' || priority !== 'All' || category !== 'All'

  const columns = [
    {
      key: 'id',
      header: 'Complaint ID',
      render: (c) => (
        <div>
          <p className="font-display text-sm font-bold text-ink">{c.id}</p>
          <p className="truncate text-xs text-faint">{c.subject}</p>
        </div>
      ),
    },
    {
      key: 'complainant',
      header: 'Complainant',
      render: (c) => (
        <div>
          <p className="font-medium text-ink">{c.complainant}</p>
          <p className="text-xs text-faint">{c.complainantType}</p>
        </div>
      ),
    },
    {
      key: 'against',
      header: 'Reported party',
      render: (c) => (
        <div>
          <p className="font-medium text-ink">{c.against}</p>
          <p className="text-xs text-faint">{c.againstType}</p>
        </div>
      ),
    },
    {
      key: 'bookingId',
      header: 'Booking ref',
      render: (c) => (c.bookingId ? <span className="text-primary-700">{c.bookingId}</span> : <span className="text-faint">—</span>),
    },
    { key: 'category', header: 'Category' },
    { key: 'priority', header: 'Priority', render: (c) => <StatusBadge status={c.priority} size="sm" dot={false} /> },
    {
      key: 'submittedOn',
      header: 'Submitted',
      render: (c) => <span className="whitespace-nowrap">{formatDate(c.submittedOn, { long: true })}</span>,
    },
    { key: 'status', header: 'Status', render: (c) => <StatusBadge status={c.status} size="sm" /> },
    {
      key: 'action',
      header: 'Action',
      align: 'right',
      sortable: false,
      render: (c) => (
        <Button
          size="xs"
          variant="outline"
          icon={Eye}
          onClick={(e) => {
            e.stopPropagation()
            navigate(`/admin/complaints/${c.id}`)
          }}
        >
          Investigate
        </Button>
      ),
    },
  ]

  if (!complaints.length) {
    return (
      <div className="space-y-6">
        <PageHeader title="Complaints" subtitle="Investigate, resolve and audit every customer or caregiver complaint." />
        <div className="rounded-card border border-line bg-white shadow-card">
          <EmptyState
            icon={ShieldAlert}
            title="No complaints raised"
            description="When a customer or caregiver raises an issue, it will land here for the operations desk."
          />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Complaints"
        subtitle="Investigate, resolve and audit every complaint raised on the platform."
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Total complaints" value={counts.total} icon={ShieldAlert} tone="primary" hint="All time" delay={0} />
        <StatCard label="Submitted" value={counts.submitted} icon={Inbox} tone="info" hint="Not yet reviewed" delay={0.05} />
        <StatCard
          label="Under review"
          value={counts.review}
          icon={Eye}
          tone="warning"
          hint="With the operations desk"
          delay={0.1}
        />
        <StatCard label="Resolved" value={counts.resolved} icon={CheckCircle2} tone="success" hint="Closed cases" delay={0.15} />
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search complaint ID, subject or party…"
          className="lg:max-w-md"
        />
        <Tabs
          tabs={STATUS_TABS.map((s) => ({
            id: s,
            label: s,
            count: s === 'All' ? complaints.length : complaints.filter((c) => c.status === s).length,
          }))}
          active={status}
          onChange={setStatus}
          size="sm"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:max-w-xl">
        <FormField label="Priority" htmlFor="cp-priority-filter">
          <Select id="cp-priority-filter" value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="All">All priorities</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Category" htmlFor="cp-category-filter">
          <Select id="cp-category-filter" value={category} onChange={(e) => setCategory(e.target.value)}>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c === 'All' ? 'All categories' : c}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-card border border-line bg-white shadow-card">
          <EmptyState
            icon={SearchX}
            title="No complaints match these filters"
            description="Try clearing the search, status, priority or category filter."
            action={
              hasFilters ? (
                <Button variant="outline" onClick={resetFilters}>
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <>
          <DataTable
            columns={columns}
            data={pageItems}
            keyExtractor={(row) => row.id}
            onRowClick={(row) => navigate(`/admin/complaints/${row.id}`)}
            initialSort={{ key: 'submittedOn', dir: 'desc' }}
            emptyTitle="No complaints found"
            emptyIcon={ShieldAlert}
          />
          <Pagination page={page} totalPages={totalPages} onPageChange={goto} totalItems={totalItems} />
        </>
      )}
    </div>
  )
}

function ComplaintDetail({ id }) {
  useDocumentTitle(`Complaint ${id}`)
  const { complaints, updateComplaint } = useData()

  const complaint = complaints.find((c) => c.id === id)

  const [note, setNote] = useState('')
  const [resolution, setResolution] = useState('')
  const [previewFile, setPreviewFile] = useState(null)
  const [nextStage, setNextStage] = useState(null)
  const [resolveOpen, setResolveOpen] = useState(false)

  useEffect(() => {
    setResolution(complaint?.resolution || '')
    setNote('')
  }, [id, complaint?.resolution])

  if (!complaint) {
    return (
      <div className="space-y-6">
        <Breadcrumbs items={[{ label: 'Complaints', to: '/admin/complaints' }, { label: id }]} />
        <div className="rounded-card border border-line bg-white shadow-card">
          <EmptyState
            icon={SearchX}
            title="Complaint not found"
            description={`No complaint with ID ${id} exists in the demo data.`}
            action={
              <Button to="/admin/complaints" icon={ArrowLeft}>
                Back to complaints
              </Button>
            }
          />
        </div>
      </div>
    )
  }

  const currentIndex = COMPLAINT_STATUSES.indexOf(complaint.status)
  const nextStatus = COMPLAINT_STATUSES[currentIndex + 1]
  const isResolved = complaint.status === 'Resolved'

  const handleStageChange = () => {
    if (!nextStage) return
    updateComplaint(complaint.id, { status: nextStage }, `Status changed to ${nextStage}`)
    toast.success(`${complaint.id} moved to ${nextStage}`)
    setNextStage(null)
  }

  const handleAddNote = () => {
    const text = note.trim()
    if (!text) {
      toast.error('Write a note before adding it')
      return
    }
    updateComplaint(
      complaint.id,
      {
        internalNotes: [
          ...(complaint.internalNotes || []),
          { by: ADMIN, at: new Date().toISOString(), note: text },
        ],
      },
      'Internal note added',
    )
    setNote('')
    toast.success('Internal note added', { description: 'Visible to CareMate operations only.' })
  }

  const handleResolve = () => {
    const text = resolution.trim() || complaint.resolution
    if (!text) {
      toast.error('Add resolution notes before resolving')
      setResolveOpen(false)
      return
    }
    updateComplaint(complaint.id, { status: 'Resolved', resolution: text }, 'Complaint resolved')
    setResolveOpen(false)
    toast.success(`${complaint.id} resolved`, { description: 'The complainant is notified automatically in the demo.' })
  }

  const partyCard = (label, name, type, tone) => (
    <div className="rounded-card border border-line bg-white p-4 shadow-card">
      <p className="text-[10px] font-bold uppercase tracking-wider text-faint">{label}</p>
      <div className="mt-3 flex items-center gap-3">
        <Avatar name={name} size="md" />
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-bold text-ink">{name}</p>
          <p className="truncate text-xs text-muted">{type}</p>
        </div>
      </div>
      <div className="mt-3">
        <span
          className={cn(
            'inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset',
            tone,
          )}
        >
          {type === 'Platform' ? 'CareMate operations' : `${type} account`}
        </span>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Complaints', to: '/admin/complaints' }, { label: complaint.id }]} />

      <PageHeader
        title={`Complaint ${complaint.id}`}
        subtitle={complaint.subject}
        meta={
          <>
            <StatusBadge status={complaint.priority} dot={false} />
            <StatusBadge status={complaint.status} />
            <Chip>{complaint.category}</Chip>
            <Chip>{`Submitted ${formatDate(complaint.submittedOn, { long: true })}`}</Chip>
          </>
        }
        action={
          <Button to="/admin/complaints" variant="outline" icon={ArrowLeft}>
            Back to complaints
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Complaint summary" subtitle="What the complainant reported" icon={ShieldAlert} />
            <CardBody className="space-y-4">
              <div>
                <p className="font-display text-base font-bold text-ink">{complaint.subject}</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">
                  {complaint.description}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {complaint.bookingId ? (
                  <Button size="xs" variant="secondary" to="/admin/bookings">
                    Booking {complaint.bookingId}
                  </Button>
                ) : null}
                <span className="text-xs text-faint">
                  Filed by {complaint.complainant} ({complaint.complainantType}) on{' '}
                  {formatDate(complaint.submittedOn, { long: true })} at {formatTime(complaint.submittedOn)}
                </span>
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-faint">Evidence</p>
                {complaint.evidence?.length ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {complaint.evidence.map((file) => (
                      <button
                        key={file}
                        type="button"
                        onClick={() => setPreviewFile(file)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-slate-50 px-3 py-1.5 text-xs font-semibold text-ink-soft transition hover:border-primary-300 hover:text-primary-700"
                      >
                        <FileText className="h-3.5 w-3.5 text-primary-700" />
                        {file}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-muted">No evidence files were attached.</p>
                )}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Parties involved" subtitle="Complainant and reported party" icon={Users} />
            <CardBody>
              <div className="grid gap-4 sm:grid-cols-2">
                {partyCard(
                  'Complainant',
                  complaint.complainant,
                  complaint.complainantType,
                  'bg-info-50 text-info-700 ring-info-500/30',
                )}
                {partyCard(
                  'Reported party',
                  complaint.against,
                  complaint.againstType,
                  'bg-warning-50 text-warning-700 ring-warning-500/40',
                )}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Internal notes"
              subtitle="Visible to CareMate operations only"
              icon={Lock}
              action={
                <span className="inline-flex items-center gap-1.5 rounded-full bg-info-50 px-2.5 py-1 text-[11px] font-semibold text-info-700 ring-1 ring-inset ring-info-500/30">
                  <Lock className="h-3 w-3" /> Internal
                </span>
              }
            />
            <CardBody className="space-y-4">
              {complaint.internalNotes?.length ? (
                <ul className="space-y-3">
                  {complaint.internalNotes.map((n, i) => (
                    <li key={`${n.at}-${i}`} className="rounded-xl border border-line bg-slate-50/60 p-3.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-bold text-ink">{n.by}</p>
                        <p className="text-[11px] text-faint">
                          {formatDate(n.at)} · {formatTime(n.at)}
                        </p>
                      </div>
                      <p className="mt-1 text-sm leading-relaxed text-muted">{n.note}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">No internal notes have been added yet.</p>
              )}

              <div className="space-y-2">
                <FormField
                  label="Add internal note"
                  htmlFor="cp-internal-note"
                  hint="Only CareMate operations can see this."
                >
                  <Textarea
                    id="cp-internal-note"
                    rows={3}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="e.g. Called the caregiver — written explanation expected within 48 hours."
                  />
                </FormField>
                <Button size="sm" onClick={handleAddNote} disabled={!note.trim()}>
                  Add internal note
                </Button>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Audit log" subtitle="Every recorded action on this complaint" icon={History} />
            <CardBody className="p-0">
              <div className="thin-scrollbar overflow-x-auto">
                <table className="w-full min-w-[520px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-line bg-slate-50/80">
                      <th className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-faint">Action</th>
                      <th className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-faint">By</th>
                      <th className="px-5 py-3 text-right text-xs font-bold uppercase tracking-wider text-faint">
                        Time
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {(complaint.audit || []).map((a, i) => (
                      <tr key={`${a.at}-${i}`}>
                        <td className="px-5 py-3 text-sm font-semibold text-ink">{a.action}</td>
                        <td className="px-5 py-3 text-sm text-muted">{a.by}</td>
                        <td className="px-5 py-3 text-right text-xs tabular-nums text-muted">
                          {formatDate(a.at)} · {formatTime(a.at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Investigation workflow" subtitle="Move the case through each stage" icon={Scale} />
            <CardBody className="space-y-5">
              <StageStepper status={complaint.status} />
              {nextStatus ? (
                <div className="space-y-2">
                  <Button className="w-full" onClick={() => setNextStage(nextStatus)}>
                    Move to {nextStatus}
                  </Button>
                  <p className="text-center text-xs text-muted">
                    Current stage: {complaint.status} · next: {nextStatus}
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-success-100 bg-success-50 p-3.5 text-center">
                  <p className="flex items-center justify-center gap-1.5 text-xs font-bold text-success-700">
                    <CheckCircle2 className="h-4 w-4" /> Fully resolved
                  </p>
                  <p className="mt-1 text-xs text-success-700/80">No further stages to move to.</p>
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Resolution" subtitle="Outcome shared with the complainant" icon={CheckCircle2} />
            <CardBody className="space-y-4">
              {isResolved && complaint.resolution ? (
                <div className="rounded-xl border border-success-100 bg-success-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-success-700">Resolution recorded</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{complaint.resolution}</p>
                </div>
              ) : null}

              <FormField
                label="Resolution notes"
                htmlFor="cp-resolution"
                hint="Refund, corrective action and any follow-up owed to the customer."
              >
                <Textarea
                  id="cp-resolution"
                  rows={5}
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  placeholder="e.g. Pro-rata refund of ₹392 issued, handover training assigned to the caregiver."
                />
              </FormField>

              <Button
                className="w-full"
                variant={isResolved ? 'outline' : 'primary'}
                icon={CheckCircle2}
                disabled={isResolved}
                onClick={() => setResolveOpen(true)}
              >
                {isResolved ? 'Complaint resolved' : 'Resolve complaint'}
              </Button>
            </CardBody>
          </Card>
        </div>
      </div>

      <Modal
        open={Boolean(previewFile)}
        onClose={() => setPreviewFile(null)}
        title="Evidence preview"
        subtitle={previewFile || ''}
        size="md"
        footer={
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setPreviewFile(null)}>
              Close
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid h-56 place-items-center rounded-card border border-line bg-slate-50/70 p-6">
            <div className="w-full max-w-xs rounded-xl border border-line bg-white p-4 shadow-card">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-mint-100 text-primary-700">
                  <FileText className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-ink">{previewFile}</p>
                  <p className="text-[10px] text-faint">Uploaded with the complaint</p>
                </div>
              </div>
              <div className="mt-3 space-y-2">
                <span className="block h-2 w-full rounded bg-slate-200" />
                <span className="block h-2 w-5/6 rounded bg-slate-200" />
                <span className="block h-2 w-2/3 rounded bg-slate-200" />
                <span className="block h-2 w-4/5 rounded bg-slate-100" />
              </div>
            </div>
          </div>
          <p className="text-center text-xs leading-relaxed text-muted">
            Placeholder preview — evidence files in this demo are sample names only and contain no real customer
            data.
          </p>
        </div>
      </Modal>

      <ConfirmationDialog
        open={Boolean(nextStage)}
        onClose={() => setNextStage(null)}
        onConfirm={handleStageChange}
        tone="primary"
        title="Move this complaint forward?"
        message={`${complaint.id} will move from ${complaint.status} to ${nextStage || ''}. The stage change is written to the audit log.`}
        confirmLabel={nextStage ? `Move to ${nextStage}` : 'Confirm'}
      />

      <ConfirmationDialog
        open={resolveOpen}
        onClose={() => setResolveOpen(false)}
        onConfirm={handleResolve}
        tone="success"
        title="Resolve this complaint?"
        message="The resolution notes are stored on the case, the status moves to Resolved and the audit log records the closure."
        confirmLabel="Resolve complaint"
      />
    </div>
  )
}

export function ComplaintsPage() {
  const { id } = useParams()
  return id ? <ComplaintDetail id={id} /> : <ComplaintsList />
}

export default ComplaintsPage
