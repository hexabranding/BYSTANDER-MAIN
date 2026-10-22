import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Check, CheckCircle2, Eye, FileText, Lock, Paperclip, Plus, SearchX, ShieldAlert, X } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/context/AuthContext'
import { useData } from '@/context/DataContext'
import { useDebouncedValue, useDocumentTitle } from '@/hooks/useUi'
import { usePagination } from '@/hooks/usePagination'
import { cn } from '@/utils/cn'
import { formatDate, formatTime } from '@/utils/format'
import { COMPLAINT_STATUSES } from '@/utils/constants'
import { PageHeader } from '@/components/common/PageHeader'
import { StatCard } from '@/components/common/StatCard'
import { Tabs, Chip } from '@/components/common/Tabs'
import { DataTable } from '@/components/common/DataTable'
import { Pagination } from '@/components/common/Pagination'
import { SearchBar } from '@/components/common/SearchBar'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Modal } from '@/components/common/Modal'
import { Button } from '@/components/common/Button'
import { EmptyState, ErrorState, TableSkeleton } from '@/components/common/States'
import { FormField, Input, Select, Textarea } from '@/components/forms/FormField'
import { complaintService } from '@/services/complaintService'
import { isMongoObjectId } from '@/services/adapters'

const CATEGORIES = ['Misbehavior', 'Theft', 'Abuse', 'Harassment', 'Medical negligence', 'Other']
const PRIORITIES = ['High', 'Medium', 'Low']
const STATUS_TABS = ['All', ...COMPLAINT_STATUSES]

function StatusStepper({ status }) {
  const current = Math.max(0, COMPLAINT_STATUSES.indexOf(status))
  const step = COMPLAINT_STATUSES.length - 1

  return (
    <div className="relative px-1">
      <span className="absolute left-[12.5%] right-[12.5%] top-[13px] h-0.5 bg-line" aria-hidden="true" />
      <span
        className="absolute left-[12.5%] top-[13px] h-0.5 bg-primary-600 transition-all duration-500"
        style={{ width: `${(current / step) * 75}%` }}
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

function ComplaintDetail({ complaint }) {
  if (!complaint) return null
  const resolved = complaint.status === 'Resolved'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={complaint.status} />
        <StatusBadge status={complaint.priority} size="sm" dot={false} />
        <Chip>{complaint.category}</Chip>
        <Chip>{`Booking ${complaint.bookingNumber || complaint.bookingId || 'General'}`}</Chip>
      </div>

      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-faint">What happened</p>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">{complaint.description}</p>
        <p className="mt-3 text-xs text-faint">
          Reported on {formatDate(complaint.submittedOn, { long: true })} at {formatTime(complaint.submittedOn)} ·
          Against {complaint.against} ({complaint.againstType})
        </p>
      </div>

      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-faint">Evidence</p>
        {complaint.evidence?.length ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {complaint.evidence.map((file) => (
              <span
                key={file}
                className="inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-slate-50 px-3 py-1.5 text-xs font-semibold text-ink-soft"
              >
                <FileText className="h-3.5 w-3.5 text-primary-700" />
                {file}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">No evidence files were attached to this complaint.</p>
        )}
      </div>

      <div className="rounded-card border border-line bg-slate-50/60 p-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-faint">Status progression</p>
        <StatusStepper status={complaint.status} />
      </div>

      {resolved && complaint.resolution ? (
        <div className="rounded-xl border border-success-100 bg-success-50 p-4">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-success-700">
            <CheckCircle2 className="h-4 w-4" /> Resolution
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{complaint.resolution}</p>
        </div>
      ) : null}

      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-faint">Audit log</p>
        <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
          {complaint.audit?.length ? (
            complaint.audit.map((a, i) => (
              <li key={`${a.at}-${i}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                <span className="text-sm font-semibold text-ink">{a.action}</span>
                <span className="text-xs text-muted">
                  {a.by} · {formatDate(a.at)} {formatTime(a.at)}
                </span>
              </li>
            ))
          ) : (
            <li className="px-4 py-3 text-sm text-muted">No audit entries recorded.</li>
          )}
        </ul>
      </div>
    </div>
  )
}

export function ComplaintsPage() {
  useDocumentTitle('Complaints')
  const { user } = useAuth()
  const { bookings } = useData()

  const [complaints, setComplaints] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('All')
  const [raiseOpen, setRaiseOpen] = useState(false)
  const [evidence, setEvidence] = useState([])
  const [viewing, setViewing] = useState(null)
  const debouncedSearch = useDebouncedValue(search)

  const customerId = user?.id || user?._id || 'cu-201'

  const myBookings = useMemo(() => {
    return (bookings || []).filter((b) => b.customerId === customerId || b.customer === customerId)
  }, [bookings, customerId])

  const fetchComplaints = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await complaintService.getMyComplaints()
      setComplaints(data.complaints || [])
    } catch (err) {
      setError(err.message || 'Failed to load complaints')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchComplaints()
  }, [])

  const counts = useMemo(() => {
    const c = { Total: complaints.length, Open: 0, 'Under review': 0, Resolved: 0 }
    complaints.forEach((x) => {
      if (x.status === 'Resolved') c.Resolved += 1
      else c.Open += 1
      if (['Under Review', 'Investigation'].includes(x.status)) c['Under review'] += 1
    })
    return c
  }, [complaints])

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    return complaints.filter((c) => {
      const matchesStatus = status === 'All' || c.status === status
      const matchesSearch =
        !q ||
        (c.id && c.id.toLowerCase().includes(q)) ||
        (c.subject && c.subject.toLowerCase().includes(q)) ||
        (c.category && c.category.toLowerCase().includes(q)) ||
        (c.bookingId && String(c.bookingId).toLowerCase().includes(q)) ||
        (c.bookingNumber && String(c.bookingNumber).toLowerCase().includes(q))
      return matchesStatus && matchesSearch
    })
  }, [complaints, debouncedSearch, status])

  const { page, totalPages, totalItems, pageItems, goto } = usePagination(filtered, 6)
  useEffect(() => {
    goto(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, status])

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    mode: 'onTouched',
    defaultValues: { bookingId: '', category: CATEGORIES[0], priority: 'Medium', subject: '', description: '' },
  })

  const closeRaise = () => {
    setRaiseOpen(false)
    setEvidence([])
    reset()
  }

  const onPickFiles = (event) => {
    const picked = Array.from(event.target.files || []).map((file) => file.name)
    if (!picked.length) return
    setEvidence((prev) => [...new Set([...prev, ...picked])])
    toast.success(`${picked.length} file${picked.length > 1 ? 's' : ''} attached`)
    event.target.value = ''
  }

  const onSubmit = async (values) => {
    setIsSubmitting(true)
    try {
      const payload = {
        bookingId: isMongoObjectId(values.bookingId) ? values.bookingId : undefined,
        category: values.category,
        priority: values.priority,
        subject: values.subject.trim(),
        description: values.description.trim(),
        evidence,
      }
      const created = await complaintService.submitComplaint(payload)
      setComplaints((prev) => [created, ...prev])
      toast.success(`Complaint ${created.id} submitted`, {
        description: 'Our operations team will review it within 24 hours.',
      })
      closeRaise()
    } catch (err) {
      toast.error(err.message || 'Failed to submit complaint')
    } finally {
      setIsSubmitting(false)
    }
  }

  const columns = [
    { key: 'id', header: 'ID', render: (c) => <span className="font-display text-sm font-bold text-ink">{c.id}</span> },
    {
      key: 'subject',
      header: 'Subject',
      render: (c) => (
        <div className="max-w-xs">
          <p className="truncate font-semibold text-ink">{c.subject}</p>
          <p className="truncate text-xs text-faint">{c.bookingId || 'General'}</p>
        </div>
      ),
    },
    { key: 'category', header: 'Category', sortable: false },
    { key: 'priority', header: 'Priority', render: (c) => <StatusBadge status={c.priority} size="sm" dot={false} /> },
    {
      key: 'submittedOn',
      header: 'Reported on',
      render: (c) => <span className="whitespace-nowrap">{formatDate(c.submittedOn, { long: true })}</span>,
    },
    { key: 'status', header: 'Status', render: (c) => <StatusBadge status={c.status} size="sm" /> },
    {
      key: 'view',
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
            setViewing(c)
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
        title="Complaints"
        subtitle="Raise an issue with a booking and track it through to resolution."
        action={
          <Button icon={Plus} onClick={() => setRaiseOpen(true)}>
            Raise a complaint
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Total complaints" value={counts.Total} icon={FileText} tone="primary" hint="All time" delay={0} />
        <StatCard
          label="Open"
          value={counts.Open}
          icon={ShieldAlert}
          tone="warning"
          hint="Awaiting resolution"
          delay={0.05}
        />
        <StatCard
          label="Under review"
          value={counts['Under review']}
          icon={Eye}
          tone="info"
          hint="With operations desk"
          delay={0.1}
        />
        <StatCard label="Resolved" value={counts.Resolved} icon={CheckCircle2} tone="success" hint="Closed cases" delay={0.15} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search by ID, subject or category…"
          className="sm:max-w-sm sm:flex-1"
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

      {isLoading ? (
        <TableSkeleton rows={5} cols={5} />
      ) : error ? (
        <div className="rounded-card border border-line bg-white shadow-card">
          <ErrorState
            title="Failed to load complaints"
            description={error}
            onRetry={fetchComplaints}
          />
        </div>
      ) : complaints.length === 0 ? (
        <div className="rounded-card border border-line bg-white shadow-card">
          <EmptyState
            icon={ShieldAlert}
            title="No complaints raised"
            description="If something went wrong with a booking, raise a complaint and we will track it for you."
            action={
              <Button icon={Plus} onClick={() => setRaiseOpen(true)}>
                Raise a complaint
              </Button>
            }
          />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-card border border-line bg-white shadow-card">
          <EmptyState
            icon={SearchX}
            title="No complaints found"
            description="Try clearing the search or switching the status filter."
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
            onRowClick={(row) => setViewing(row)}
            initialSort={{ key: 'submittedOn', dir: 'desc' }}
            emptyTitle="No complaints found"
            emptyIcon={ShieldAlert}
          />
          <Pagination page={page} totalPages={totalPages} onPageChange={goto} totalItems={totalItems} />
        </>
      )}

      <Modal
        open={raiseOpen}
        onClose={closeRaise}
        title="Raise a complaint"
        subtitle="Tell us what went wrong — our operations desk reviews every case."
        size="lg"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={closeRaise} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" form="raise-complaint-form" disabled={isSubmitting}>
              {isSubmitting ? 'Submitting…' : 'Submit complaint'}
            </Button>
          </div>
        }
      >
        <form id="raise-complaint-form" onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <FormField label="Related booking" htmlFor="cp-booking" error={errors.bookingId?.message}>
            <Select id="cp-booking" error={errors.bookingId?.message} {...register('bookingId')}>
              <option value="">General — not linked to a booking</option>
              {myBookings.map((b) => (
                <option key={b._id || b.id} value={b._id || b.id}>
                  {b.bookingNumber || b.id} · {b.serviceName || b.service} · {formatDate(b.date)}
                </option>
              ))}
            </Select>
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Category" htmlFor="cp-category" required error={errors.category?.message}>
              <Select id="cp-category" error={errors.category?.message} {...register('category', { required: 'Choose a category' })}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Priority" htmlFor="cp-priority" required error={errors.priority?.message}>
              <Select id="cp-priority" error={errors.priority?.message} {...register('priority', { required: 'Choose a priority' })}>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>

          <FormField label="Subject" htmlFor="cp-subject" required error={errors.subject?.message}>
            <Input
              id="cp-subject"
              placeholder="e.g. Caretaker arrived 40 minutes late"
              error={errors.subject?.message}
              {...register('subject', {
                required: 'Add a short subject',
                minLength: { value: 6, message: 'Subject should be at least 6 characters' },
              })}
            />
          </FormField>

          <FormField
            label="Description"
            htmlFor="cp-description"
            required
            error={errors.description?.message}
            hint="Describe what happened, when, and what you expect. Minimum 20 characters."
          >
            <Textarea
              id="cp-description"
              rows={5}
              placeholder="Share the full story so we can investigate quickly…"
              error={errors.description?.message}
              {...register('description', {
                required: 'Please describe the issue',
                minLength: { value: 20, message: 'Please describe the issue in at least 20 characters' },
              })}
            />
          </FormField>

          <div className="rounded-xl border border-dashed border-line-strong bg-slate-50 px-4 py-3.5">
            <label className="flex cursor-pointer items-start gap-3">
              <Paperclip className="mt-0.5 h-4 w-4 shrink-0 text-primary-700" />
              <span className="text-sm leading-relaxed text-muted">
                <span className="font-semibold text-ink">Attach evidence</span> — photos, invoices or screenshots. Evidence files are encrypted and submitted to the dispute investigation docket.
                <input
                  type="file"
                  multiple
                  accept="image/*,.pdf"
                  onChange={onPickFiles}
                  className="sr-only"
                  aria-label="Attach evidence files"
                />
              </span>
            </label>
            {evidence.length ? (
              <ul className="mt-3 flex flex-wrap gap-2">
                {evidence.map((file) => (
                  <li
                    key={file}
                    className="inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-white px-3 py-1.5 text-xs font-semibold text-ink-soft"
                  >
                    <FileText className="h-3.5 w-3.5 text-primary-700" />
                    <span className="max-w-[10rem] truncate">{file}</span>
                    <button
                      type="button"
                      onClick={() => setEvidence((prev) => prev.filter((name) => name !== file))}
                      className="grid h-4 w-4 place-items-center rounded-full text-faint transition hover:bg-danger-50 hover:text-danger-500"
                      aria-label={`Remove ${file}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <p className="flex items-start gap-2 rounded-xl bg-mint-50 px-3.5 py-3 text-xs leading-relaxed text-primary-900">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary-700" />
            Complaints are reviewed by Bystander operations. You will see status updates here and in your notifications.
          </p>

          <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
        </form>
      </Modal>

      <Modal
        open={Boolean(viewing)}
        onClose={() => setViewing(null)}
        title={viewing ? `${viewing.id} · ${viewing.subject}` : 'Complaint'}
        subtitle={viewing ? `Reported on ${formatDate(viewing.submittedOn, { long: true })}` : ''}
        size="lg"
        footer={
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setViewing(null)}>
              Close
            </Button>
          </div>
        }
      >
        <ComplaintDetail complaint={viewing} />
      </Modal>
    </div>
  )
}

export default ComplaintsPage
