import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { BadgeCheck, Check, Eye, FileCheck2, History, Info, RefreshCw, SearchX, ShieldCheck, XCircle } from 'lucide-react'
import { useData } from '@/context/DataContext'
import { useDebouncedValue, useDocumentTitle } from '@/hooks/useUi'
import { cn } from '@/utils/cn'
import { formatDateTime, formatDate, relativeTime } from '@/utils/format'
import { PageHeader } from '@/components/common/PageHeader'
import { SearchBar } from '@/components/common/SearchBar'
import { Chip, ProgressBar } from '@/components/common/Tabs'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Modal } from '@/components/common/Modal'
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog'
import { Button } from '@/components/common/Button'
import { Avatar } from '@/components/common/Avatar'
import { Card, CardBody, CardHeader } from '@/components/common/Card'
import { CardSkeleton, EmptyState, ErrorState } from '@/components/common/States'
import { Textarea } from '@/components/forms/FormField'
import { adminService, isMongoObjectId } from '@/services'

const FILTERS = ['All', 'Pending', 'Under Review', 'Verified', 'Rejected']

const maskName = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .map((part) => `${part[0]}${'•'.repeat(Math.max(part.length - 1, 2))}`)
    .join(' ')

function DocumentPreview({ record, doc }) {
  const last4 = String(record.regNo || '').replace(/\D/g, '').slice(-4) || '0000'
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-line bg-slate-50 p-5">
        <div className="flex items-start justify-between gap-3 border-b border-dashed border-line-strong pb-3">
          <div className="min-w-0">
            <p className="font-display text-sm font-bold text-ink">{doc.type}</p>
            <p className="mt-0.5 text-xs text-faint">Reference copy · redacted for admin review</p>
          </div>
          <span className="shrink-0 rounded-full bg-warning-50 px-2 py-0.5 text-[11px] font-bold text-warning-700 ring-1 ring-inset ring-warning-400/50">
            MASKED
          </span>
        </div>

        <dl className="mt-4 space-y-2.5 text-sm">
          <div className="flex items-start justify-between gap-4">
            <dt className="text-muted">Issued to</dt>
            <dd className="font-semibold text-ink">{maskName(record.name)}</dd>
          </div>
          <div className="flex items-start justify-between gap-4">
            <dt className="text-muted">Document number</dt>
            <dd className="font-semibold tabular-nums tracking-wide text-ink">XXXX XXXX {last4}</dd>
          </div>
          <div className="flex items-start justify-between gap-4">
            <dt className="text-muted">Uploaded on</dt>
            <dd className="font-semibold text-ink">{formatDate(doc.uploadedOn)}</dd>
          </div>
          <div className="flex items-start justify-between gap-4">
            <dt className="text-muted">File</dt>
            <dd className="max-w-[60%] truncate font-semibold text-ink">{doc.file}</dd>
          </div>
        </dl>

        <div className="mt-4 space-y-2.5 rounded-lg bg-white p-4 ring-1 ring-line">
          <div className="h-3 w-2/3 rounded-sm bg-slate-300" />
          <div className="h-3.5 w-full rounded-sm bg-slate-800" />
          <div className="h-3 w-5/6 rounded-sm bg-slate-300" />
          <div className="flex items-center gap-2">
            <div className="h-14 w-12 rounded-sm bg-slate-300" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-full rounded-sm bg-slate-800" />
              <div className="h-3 w-4/5 rounded-sm bg-slate-300" />
            </div>
          </div>
          <div className="h-3 w-1/2 rounded-sm bg-slate-300" />
        </div>
      </div>

      <p className="flex items-start gap-2 rounded-xl bg-mint-50 px-3.5 py-3 text-xs leading-relaxed text-primary-900">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary-700" />
        Only masked metadata is shown in the admin console. Unredacted files stay encrypted — request compliance
        approval if you need the full document.
      </p>
    </div>
  )
}

function DetailPanel({
  record,
  onApproveApplication,
  onRejectApplication,
  onRequestInfo,
  onPreview,
  onApproveDoc,
  onRejectDoc,
}) {
  const scoreTone = record.overallScore >= 80 ? 'success' : record.overallScore >= 60 ? 'warning' : 'danger'

  return (
    <div className="space-y-5">
      <Card>
        <CardBody className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <Avatar src={record.avatar} name={record.name} size="xl" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-lg font-bold text-ink">{record.name}</h2>
                <StatusBadge status={record.status} size="sm" />
              </div>
              <p className="mt-1 text-sm text-muted">
                {record.qualification} · {record.regNo} · {record.city}
              </p>
              <p className="mt-1 text-xs text-faint">
                Application {record.id} · submitted {formatDate(record.submittedOn, { long: true })} (
                {relativeTime(record.submittedOn)})
              </p>
            </div>
            <div className="shrink-0 rounded-xl border border-line bg-gradient-to-br from-slate-50 to-white px-4 py-3 text-center sm:w-40">
              <p className="font-display text-2xl font-extrabold tabular-nums text-ink">{record.overallScore}%</p>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-faint">Overall score</p>
              <ProgressBar value={record.overallScore} tone={scoreTone} className="mt-2" />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              icon={BadgeCheck}
              onClick={onApproveApplication}
              disabled={record.status === 'Verified'}
            >
              Approve application
            </Button>
            <Button variant="dangerGhost" icon={XCircle} onClick={onRejectApplication} disabled={record.status === 'Rejected'}>
              Reject application
            </Button>
            <Button variant="outline" icon={Info} onClick={onRequestInfo}>
              Request more information
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Document review"
          subtitle={`${record.documents.length} document${record.documents.length === 1 ? '' : 's'} submitted`}
          icon={FileCheck2}
        />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          {record.documents.map((doc) => (
            <div key={doc.id} className="rounded-xl border border-line bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-ink">{doc.type}</p>
                  <p className="truncate text-xs text-faint">{doc.file}</p>
                </div>
                <StatusBadge status={doc.status} size="sm" />
              </div>
              <p className="mt-2 text-[11px] text-faint">Uploaded {formatDate(doc.uploadedOn)}</p>
              <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-muted">
                <span className="font-semibold text-ink-soft">Reviewer note: </span>
                {doc.feedback || 'No feedback recorded yet.'}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="xs" variant="outline" icon={Eye} onClick={() => onPreview(doc)}>
                  Preview
                </Button>
                <Button
                  size="xs"
                  variant="secondary"
                  icon={Check}
                  onClick={() => onApproveDoc(doc)}
                  disabled={doc.status === 'Verified'}
                >
                  Approve
                </Button>
                <Button size="xs" variant="dangerGhost" onClick={() => onRejectDoc(doc)}>
                  Reject
                </Button>
              </div>
            </div>
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Verification history" subtitle="Every action taken on this application" icon={History} />
        <CardBody>
          <ol className="space-y-4">
            {record.history.map((entry, index) => {
              const last = index === record.history.length - 1
              return (
                <li key={`${entry.at}-${index}`} className="relative flex gap-3 pb-4 last:pb-0">
                  {!last ? (
                    <span className="absolute left-[7px] top-4 h-[calc(100%-8px)] w-px bg-line" aria-hidden="true" />
                  ) : null}
                  <span
                    className={cn(
                      'relative z-10 mt-1 h-3.5 w-3.5 shrink-0 rounded-full ring-4 ring-white',
                      last ? 'bg-primary-600' : 'bg-primary-200',
                    )}
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">{entry.action}</p>
                    <p className="mt-0.5 text-xs text-faint">
                      {formatDateTime(entry.at)} · {entry.by}
                    </p>
                  </div>
                </li>
              )
            })}
          </ol>
        </CardBody>
      </Card>
    </div>
  )
}

export function VerificationsPage() {
  useDocumentTitle('Verifications')

  const { verifications: seedVerifications, setVerificationStatus, updateDocument } = useData()

  const [realVerifications, setRealVerifications] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [filter, setFilter] = useState('All')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [isDesktop, setIsDesktop] = useState(true)
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false)
  const [reasonPrompt, setReasonPrompt] = useState(null)
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState('')
  const [confirmPrompt, setConfirmPrompt] = useState(null)
  const [previewDoc, setPreviewDoc] = useState(null)

  const debouncedQuery = useDebouncedValue(query)

  const fetchVerifications = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await adminService.getVerifications()
      setRealVerifications(res.verifications || [])
    } catch (err) {
      setError(err.message || 'Unable to load caregiver verification queue')
      setRealVerifications(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchVerifications()
  }, [fetchVerifications])

  const verifications = useMemo(() => {
    if (realVerifications !== null) return realVerifications
    return seedVerifications || []
  }, [realVerifications, seedVerifications])

  useEffect(() => {
    if (!selectedId && verifications.length > 0) {
      const first =
        verifications.find((v) => v.status === 'Pending') ||
        verifications.find((v) => v.status === 'Under Review')
      setSelectedId(first?.id ?? verifications[0]?.id ?? null)
    }
  }, [selectedId, verifications])

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const update = () => setIsDesktop(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  const counts = useMemo(() => {
    const map = { All: verifications.length }
    FILTERS.slice(1).forEach((f) => {
      map[f] = verifications.filter((v) => v.status === f).length
    })
    return map
  }, [verifications])

  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase()
    return verifications.filter((v) => {
      const matchesFilter = filter === 'All' || v.status === filter
      const matchesQuery = !q || `${v.name} ${v.regNo} ${v.city} ${v.qualification} ${v.id}`.toLowerCase().includes(q)
      return matchesFilter && matchesQuery
    })
  }, [verifications, debouncedQuery, filter])

  useEffect(() => {
    if (filtered.length && !filtered.some((v) => v.id === selectedId)) {
      setSelectedId(filtered[0].id)
    }
  }, [filtered, selectedId])

  const record = filtered.length ? verifications.find((v) => v.id === selectedId) || null : null

  const select = (id) => {
    setSelectedId(id)
    if (!isDesktop) setMobileDetailOpen(true)
  }

  const openRejectApplication = () => {
    setReason('')
    setReasonError('')
    setReasonPrompt({ kind: 'application' })
  }

  const openRejectDocument = (doc) => {
    setReason('')
    setReasonError('')
    setReasonPrompt({ kind: 'document', doc })
  }

  const submitReason = () => {
    const value = reason.trim()
    if (value.length < 8) {
      setReasonError('Give a clear reason of at least 8 characters — it is sent to the applicant.')
      return
    }
    if (reasonPrompt?.kind === 'application') {
      setConfirmPrompt({ kind: 'rejectApplication', reason: value })
    } else if (reasonPrompt?.doc) {
      setConfirmPrompt({ kind: 'rejectDocument', doc: reasonPrompt.doc, reason: value })
    }
    setReasonPrompt(null)
    setReason('')
    setReasonError('')
  }

  const runConfirm = async () => {
    const action = confirmPrompt
    setConfirmPrompt(null)
    if (!action || !record) return

    if (action.kind === 'approveApplication') {
      if (isMongoObjectId(record.id)) {
        try {
          await adminService.updateCaregiverVerificationStatus(record.id, {
            status: 'verified',
            reason: 'Application approved — profile marked Verified',
            trustScore: 90,
          })
          toast.success(`${record.name} approved`, {
            description: 'Profile marked Verified and visible in customer search.',
          })
          await fetchVerifications()
        } catch (err) {
          toast.error('Failed to approve application', { description: err.message })
        }
      } else {
        setVerificationStatus(record.id, 'Verified', 'Application approved — profile marked Verified')
        toast.success(`${record.name} approved`, {
          description: 'Profile marked Verified and visible in customer search.',
        })
      }
    } else if (action.kind === 'rejectApplication') {
      if (isMongoObjectId(record.id)) {
        try {
          await adminService.updateCaregiverVerificationStatus(record.id, {
            status: 'rejected',
            reason: action.reason,
          })
          toast.error(`${record.name}'s application rejected`, { description: action.reason })
          await fetchVerifications()
        } catch (err) {
          toast.error('Failed to reject application', { description: err.message })
        }
      } else {
        setVerificationStatus(record.id, 'Rejected', action.reason)
        toast.error(`${record.name}'s application rejected`, { description: action.reason })
      }
    } else if (action.kind === 'approveDocument') {
      if (isMongoObjectId(action.doc.id)) {
        try {
          await adminService.updateDocumentStatus(action.doc.id, {
            status: 'verified',
            notes: 'Approved by admin',
          })
          toast.success(`${action.doc.type} approved`)
          await fetchVerifications()
        } catch (err) {
          toast.error('Failed to approve document', { description: err.message })
        }
      } else {
        updateDocument(record.id, action.doc.id, { status: 'Verified', feedback: 'Approved by admin' })
        toast.success(`${action.doc.type} approved`)
      }
    } else if (action.kind === 'rejectDocument') {
      if (isMongoObjectId(action.doc.id)) {
        try {
          await adminService.updateDocumentStatus(action.doc.id, {
            status: 'rejected',
            notes: action.reason,
          })
          toast.error(`${action.doc.type} rejected`, { description: action.reason })
          await fetchVerifications()
        } catch (err) {
          toast.error('Failed to reject document', { description: err.message })
        }
      } else {
        updateDocument(record.id, action.doc.id, { status: 'Rejected', feedback: action.reason })
        toast.error(`${action.doc.type} rejected`, { description: action.reason })
      }
    }
  }

  const requestInfo = () => {
    if (!record) return
    toast.info(`More information requested from ${record.name}`, {
      description: 'They have 72 hours to respond before the application is closed.',
    })
  }

  let dialogTone = 'primary'
  let dialogTitle = 'Are you sure?'
  let dialogMessage = ''
  let dialogLabel = 'Confirm'

  if (confirmPrompt?.kind === 'approveApplication') {
    dialogTone = 'success'
    dialogTitle = 'Approve this application?'
    dialogMessage = `${record?.name} will be marked Verified, appear in customer search and can accept paid bookings right away.`
    dialogLabel = 'Approve application'
  } else if (confirmPrompt?.kind === 'rejectApplication') {
    dialogTone = 'danger'
    dialogTitle = 'Reject this application?'
    dialogMessage = `Reason: “${confirmPrompt.reason}” — this is shared with ${record?.name} and their profile stays unverified.`
    dialogLabel = 'Reject application'
  } else if (confirmPrompt?.kind === 'approveDocument') {
    dialogTone = 'primary'
    dialogTitle = 'Approve this document?'
    dialogMessage = `${confirmPrompt.doc?.type} will be marked Verified with the note “Approved by admin”.`
    dialogLabel = 'Approve document'
  } else if (confirmPrompt?.kind === 'rejectDocument') {
    dialogTone = 'danger'
    dialogTitle = 'Reject this document?'
    dialogMessage = `Reason: “${confirmPrompt.reason}” — ${confirmPrompt.doc?.type} is sent back to ${record?.name} for a fresh upload.`
    dialogLabel = 'Reject document'
  }

  const detailProps = record
    ? {
        record,
        onApproveApplication: () => setConfirmPrompt({ kind: 'approveApplication' }),
        onRejectApplication: openRejectApplication,
        onRequestInfo: requestInfo,
        onPreview: setPreviewDoc,
        onApproveDoc: (doc) => setConfirmPrompt({ kind: 'approveDocument', doc }),
        onRejectDoc: openRejectDocument,
      }
    : null

  return (
    <div className="space-y-6">
      <PageHeader
        title="Caretaker verifications"
        subtitle="Review submitted documents, approve or reject applications and keep an auditable trail of every decision."
        meta={
          <>
            <Chip>{`Pending · ${counts.Pending}`}</Chip>
            <Chip>{`Under review · ${counts['Under Review']}`}</Chip>
            <Chip>{`Verified · ${counts.Verified}`}</Chip>
            <Chip>{`Rejected · ${counts.Rejected}`}</Chip>
          </>
        }
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" icon={RefreshCw} onClick={fetchVerifications} disabled={loading}>
              Refresh
            </Button>
            <Button to="/admin/caregivers" variant="outline" size="sm">
              Caretaker directory
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-4">
          <SearchBar value={query} onChange={setQuery} placeholder="Search applicant or reg no…" />

          <nav aria-label="Verification filters" className="space-y-1.5">
            {FILTERS.map((f) => {
              const active = filter === f
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={cn(
                    'flex w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition',
                    active
                      ? 'border-primary-300 bg-mint-100 text-primary-800 shadow-card'
                      : 'border-line bg-white text-muted hover:border-primary-200 hover:text-primary-700',
                  )}
                >
                  <span>{f === 'All' ? 'All applications' : f}</span>
                  <span
                    className={cn(
                      'grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-bold',
                      active ? 'bg-primary-700 text-white' : 'bg-slate-100 text-muted',
                    )}
                  >
                    {counts[f]}
                  </span>
                </button>
              )
            })}
          </nav>

          <div className="thin-scrollbar max-h-[26rem] space-y-2 overflow-y-auto pr-1">
            {loading ? (
              <div className="space-y-3 p-1">
                <CardSkeleton count={2} />
              </div>
            ) : error && allVerifications.length === 0 ? (
              <div className="rounded-card border border-line bg-white p-4 shadow-card">
                <ErrorState
                  title="Failed to load verifications"
                  description={error}
                  onRetry={fetchVerifications}
                />
              </div>
            ) : filtered.length ? (
              filtered.map((v) => {
                const active = v.id === selectedId
                const tone = v.overallScore >= 80 ? 'success' : v.overallScore >= 60 ? 'warning' : 'danger'
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => select(v.id)}
                    className={cn(
                      'w-full rounded-xl border p-3 text-left transition',
                      active
                        ? 'border-primary-300 bg-mint-50 ring-1 ring-primary-200'
                        : 'border-line bg-white hover:border-primary-200',
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <Avatar src={v.avatar} name={v.name} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-ink">{v.name}</p>
                        <p className="truncate text-xs text-muted">
                          {v.qualification} · {v.regNo}
                        </p>
                        <p className="mt-0.5 text-[11px] text-faint">Submitted {formatDate(v.submittedOn)}</p>
                      </div>
                      <StatusBadge status={v.status} size="sm" />
                    </div>
                    <div className="mt-2.5 flex items-center gap-2">
                      <ProgressBar value={v.overallScore} tone={tone} className="flex-1" />
                      <span className="text-[11px] font-bold tabular-nums text-muted">{v.overallScore}%</span>
                    </div>
                  </button>
                )
              })
            ) : (
              <div className="rounded-card border border-line bg-white shadow-card">
                <EmptyState
                  icon={SearchX}
                  title="No applications found"
                  description="Nothing matches this filter or search term."
                  action={
                    <Button
                      variant="outline"
                      onClick={() => {
                        setQuery('')
                        setFilter('All')
                      }}
                    >
                      Clear filters
                    </Button>
                  }
                  className="py-10"
                />
              </div>
            )}
          </div>
        </div>

        <div className="hidden lg:block">
          {record && detailProps ? (
            <DetailPanel {...detailProps} />
          ) : (
            <div className="rounded-card border border-line bg-white shadow-card">
              <EmptyState
                icon={FileCheck2}
                title="No application selected"
                description="Pick an applicant from the queue to review their documents and history."
              />
            </div>
          )}
        </div>
      </div>

      <Modal
        open={!isDesktop && mobileDetailOpen}
        onClose={() => setMobileDetailOpen(false)}
        title={record?.name || 'Application'}
        subtitle={record ? `${record.qualification} · ${record.regNo}` : ''}
        size="xl"
        footer={
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setMobileDetailOpen(false)}>
              Close
            </Button>
          </div>
        }
      >
        {record && detailProps ? <DetailPanel {...detailProps} /> : null}
      </Modal>

      <Modal
        open={Boolean(reasonPrompt)}
        onClose={() => {
          setReasonPrompt(null)
          setReason('')
          setReasonError('')
        }}
        title="Reason for rejection"
        subtitle="Required — this is shared with the applicant."
        size="sm"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="ghost"
              onClick={() => {
                setReasonPrompt(null)
                setReason('')
                setReasonError('')
              }}
            >
              Cancel
            </Button>
            <Button variant="danger" onClick={submitReason}>
              Continue
            </Button>
          </div>
        }
      >
        <Textarea
          rows={4}
          value={reason}
          onChange={(e) => {
            setReason(e.target.value)
            setReasonError('')
          }}
          placeholder="e.g. Police clearance certificate was issued more than 12 months ago. Please upload a current copy."
          error={reasonError}
          aria-label="Reason for rejection"
        />
        <p className="mt-3 text-xs leading-relaxed text-muted">
          Be specific — the applicant sees this note next to the rejected document or application.
        </p>
      </Modal>

      <ConfirmationDialog
        open={Boolean(confirmPrompt)}
        onClose={() => setConfirmPrompt(null)}
        onConfirm={runConfirm}
        tone={dialogTone}
        title={dialogTitle}
        message={dialogMessage}
        confirmLabel={dialogLabel}
      />

      <Modal
        open={Boolean(previewDoc)}
        onClose={() => setPreviewDoc(null)}
        title={previewDoc ? previewDoc.type : 'Document preview'}
        subtitle={record ? `${record.name} · masked copy` : ''}
        size="lg"
        footer={
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setPreviewDoc(null)}>
              Close
            </Button>
          </div>
        }
      >
        {previewDoc && record ? <DocumentPreview record={record} doc={previewDoc} /> : null}
      </Modal>
    </div>
  )
}

export default VerificationsPage
