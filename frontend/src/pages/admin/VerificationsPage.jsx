import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  BadgeCheck,
  Building2,
  Check,
  Download,
  ExternalLink,
  Eye,
  FileCheck2,
  FileText,
  History,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  SearchX,
  Send,
  XCircle,
} from 'lucide-react'
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

const DOC_REJECT_PRESETS = [
  'Document is blurry or unreadable',
  'Document has expired',
  'Name does not match application',
  'Invalid or unaccepted document format',
  'Missing official seal or required pages',
]

const APP_REJECT_PRESETS = [
  'Incomplete verification documents',
  'Credentials could not be verified',
  'Does not meet platform requirements',
  'Applicant requested withdrawal',
]

export function calculateVerificationScore(recordOrDocs, status) {
  const isObj = recordOrDocs && typeof recordOrDocs === 'object' && !Array.isArray(recordOrDocs)
  const docs = Array.isArray(recordOrDocs)
    ? recordOrDocs
    : Array.isArray(recordOrDocs?.documents)
      ? recordOrDocs.documents
      : []

  const currentStatus = isObj ? recordOrDocs.status || recordOrDocs.verificationStatus : status
  const isFullyVerified = String(currentStatus || '').toLowerCase() === 'verified'

  const physicalVerified = isObj
    ? recordOrDocs.physicalVerification?.status === 'verified' || isFullyVerified
    : isFullyVerified

  // 100% full approval requires both digital docs and in-office physical verification
  if (isFullyVerified && physicalVerified) {
    return 100
  }

  // Digital document score contributes up to 50%
  const mandatoryDocs = docs.filter((d) => d.required !== false)
  let digitalScore = 0
  if (mandatoryDocs.length > 0) {
    const verifiedMandatory = mandatoryDocs.filter(
      (d) => d.status === 'Verified' || d.verificationStatus === 'verified',
    ).length
    digitalScore = Math.round((verifiedMandatory / mandatoryDocs.length) * 50)
  } else if (docs.length > 0) {
    const verified = docs.filter(
      (d) => d.status === 'Verified' || d.verificationStatus === 'verified',
    ).length
    digitalScore = Math.round((verified / docs.length) * 50)
  }

  // In-Office Physical Verification contributes 50%
  const physicalScore = physicalVerified ? 50 : 0
  return Math.min(100, digitalScore + physicalScore)
}

function DocumentVisualFallback({ record, doc }) {
  const fileName = doc.file || doc.fileName || `${doc.type || 'Document'}.pdf`
  return (
    <div className="rounded-xl border border-line bg-slate-50 p-6 text-center">
      <FileText className="mx-auto h-12 w-12 text-primary-600" />
      <p className="mt-2 font-display text-sm font-bold text-ink">{doc.type}</p>
      <p className="text-xs text-muted">{record?.name || 'Applicant'} · Document proof</p>
      <div className="mt-3 inline-block rounded-full bg-slate-200/80 px-3 py-1 font-mono text-xs font-semibold text-slate-800">
        {fileName}
      </div>
    </div>
  )
}

function DocumentPreview({ record, doc }) {
  const [imgError, setImgError] = useState(false)
  const fileName = doc.file || doc.fileName || ''
  const isImage = Boolean(
    doc.fileUrl &&
      !imgError &&
      (doc.fileUrl.startsWith('data:image') ||
        /\.(png|jpe?g|svg|webp|gif|bmp)($|\?)/i.test(doc.fileUrl) ||
        /\.(png|jpe?g|svg|webp|gif|bmp)($|\?)/i.test(fileName))
  )
  const isPdf = Boolean(
    doc.fileUrl &&
      (doc.fileUrl.startsWith('data:application/pdf') ||
        /\.pdf($|\?)/i.test(doc.fileUrl) ||
        /\.pdf($|\?)/i.test(fileName))
  )

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-line bg-slate-50 p-5">
        <div className="flex items-start justify-between gap-3 border-b border-dashed border-line-strong pb-3">
          <div className="min-w-0">
            <p className="font-display text-base font-bold text-ink">{doc.type}</p>
            <p className="mt-0.5 text-xs text-muted">Original verification proof submitted by applicant</p>
          </div>
          <StatusBadge status={doc.status} size="sm" />
        </div>

        <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg bg-white p-3 border border-line">
            <dt className="text-xs text-muted font-medium">Issued to / Applicant</dt>
            <dd className="font-bold text-ink mt-0.5">{record.name}</dd>
          </div>
          <div className="rounded-lg bg-white p-3 border border-line">
            <dt className="text-xs text-muted font-medium">Registration / Reference</dt>
            <dd className="font-bold font-mono text-ink mt-0.5">{record.regNo || 'VER-' + String(doc.id).slice(-6)}</dd>
          </div>
          <div className="rounded-lg bg-white p-3 border border-line">
            <dt className="text-xs text-muted font-medium">Uploaded on</dt>
            <dd className="font-semibold text-ink mt-0.5">{formatDate(doc.uploadedOn)}</dd>
          </div>
          <div className="rounded-lg bg-white p-3 border border-line">
            <dt className="text-xs text-muted font-medium">File name</dt>
            <dd className="truncate font-semibold font-mono text-xs text-ink mt-0.5">{fileName}</dd>
          </div>
        </dl>

        {doc.feedback && (
          <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-3.5 py-2.5 text-xs text-amber-900">
            <span className="font-bold">Reviewer Feedback: </span>
            {doc.feedback}
          </div>
        )}

        {/* Visual Document Viewer */}
        <div className="mt-5">
          {isImage ? (
            <div className="overflow-hidden rounded-xl border border-line bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-line bg-slate-50/80 px-4 py-2.5 text-xs text-muted">
                <span className="flex items-center gap-1.5 font-semibold text-ink">
                  <FileCheck2 className="h-4 w-4 text-primary-600" />
                  Uploaded Document
                </span>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-muted truncate max-w-[220px]">
                    {fileName}
                  </span>
                  {doc.fileUrl && (
                    <a
                      href={doc.fileUrl}
                      download={fileName || `${doc.type}.jpeg`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-semibold text-primary-600 hover:text-primary-800 hover:underline"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download
                    </a>
                  )}
                </div>
              </div>
              <div className="flex min-h-[280px] max-h-[560px] items-center justify-center overflow-auto p-4 bg-slate-50/40">
                <img
                  src={doc.fileUrl}
                  alt={doc.type}
                  onError={() => setImgError(true)}
                  className="max-h-[520px] w-auto max-w-full rounded-lg object-contain shadow-sm border border-slate-200/80"
                />
              </div>
            </div>
          ) : isPdf && doc.fileUrl && (doc.fileUrl.startsWith('data:') || doc.fileUrl.startsWith('http') || doc.fileUrl.startsWith('/')) ? (
            <div className="overflow-hidden rounded-xl border border-line bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-line bg-slate-50/80 px-4 py-2.5 text-xs text-muted">
                <span className="flex items-center gap-1.5 font-semibold text-ink">
                  <FileCheck2 className="h-4 w-4 text-primary-600" />
                  PDF Document Reader
                </span>
                <span className="font-mono text-xs text-muted truncate max-w-[220px]">
                  {fileName}
                </span>
              </div>
              <iframe
                src={doc.fileUrl}
                title={doc.type}
                className="h-[460px] w-full rounded-b-xl border-0 bg-white"
              />
            </div>
          ) : (
            <DocumentVisualFallback record={record} doc={doc} />
          )}
        </div>
      </div>
    </div>
  )
}

function DetailPanel({
  record,
  onApproveApplication,
  onRejectApplication,
  onPreview,
  onApproveDoc,
  onRejectDoc,
  onRequestDoc,
  onVerifyPhysical,
}) {
  const score = calculateVerificationScore(record)
  const scoreTone = score >= 80 ? 'success' : score >= 60 ? 'warning' : 'danger'

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
            <div className="shrink-0 rounded-xl border border-line bg-gradient-to-br from-slate-50 to-white px-4 py-3 text-center sm:w-44">
              <p className="font-display text-2xl font-extrabold tabular-nums text-ink">{score}%</p>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-faint">
                {score === 100 ? '100% Fully Approved' : score >= 50 ? '50% · Office Pending' : 'Overall score'}
              </p>
              <ProgressBar value={score} tone={scoreTone} className="mt-2" />
            </div>
          </div>

          {/* Full Residential Address & Contact Details */}
          <div className="rounded-xl border border-line bg-slate-50/70 p-3.5 text-xs">
            <div className="mb-2 flex items-center gap-1.5 font-bold uppercase tracking-wider text-slate-700 text-[11px]">
              <MapPin className="h-3.5 w-3.5 text-primary-700" />
              <span>Full Address & Contact Details</span>
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2 md:grid-cols-4">
              <div>
                <span className="block text-[10px] uppercase font-semibold text-muted">House / Street</span>
                <span className="font-medium text-ink">{record.street || record.address?.street || 'Not specified'}</span>
              </div>
              <div>
                <span className="block text-[10px] uppercase font-semibold text-muted">Locality / Area</span>
                <span className="font-medium text-ink">{record.area || record.address?.area || '—'}</span>
              </div>
              <div>
                <span className="block text-[10px] uppercase font-semibold text-muted">City & District</span>
                <span className="font-medium text-ink">{record.city}{record.district ? `, ${record.district}` : ''}</span>
              </div>
              <div>
                <span className="block text-[10px] uppercase font-semibold text-muted">State & PIN Code</span>
                <span className="font-medium text-ink">{record.state || 'Kerala'} {record.pincode ? `— ${record.pincode}` : ''}</span>
              </div>
            </div>
            {(record.phone || record.email) && (
              <div className="mt-2.5 pt-2 border-t border-slate-200/80 flex flex-wrap gap-4 text-[11px]">
                {record.phone && (
                  <span className="flex items-center gap-1 text-slate-700 font-medium">
                    <Phone className="h-3 w-3 text-primary-700" />
                    Phone: <span className="font-mono font-semibold text-ink">{record.phone}</span>
                  </span>
                )}
                {record.email && (
                  <span className="flex items-center gap-1 text-slate-700 font-medium">
                    <Mail className="h-3 w-3 text-primary-700" />
                    Email: <span className="text-ink font-medium">{record.email}</span>
                  </span>
                )}
              </div>
            )}
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
          </div>
        </CardBody>
      </Card>

      {/* Stage 2: In-Person Physical Verification at Office */}
      <Card
        className={cn(
          'border-2 transition-all',
          record.status === 'Verified' || record.physicalVerification?.status === 'verified'
            ? 'border-success-300 bg-success-50/20'
            : score >= 50
              ? 'border-amber-300 bg-amber-50/30'
              : 'border-line bg-white',
        )}
      >
        <CardBody className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  'grid h-10 w-10 shrink-0 place-items-center rounded-xl',
                  record.status === 'Verified' || record.physicalVerification?.status === 'verified'
                    ? 'bg-success-100 text-success-700'
                    : 'bg-amber-100 text-amber-800',
                )}
              >
                <Building2 className="h-5 w-5" />
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-display text-sm font-bold text-ink">
                    Stage 2: In-Person Physical Document Verification at Office
                  </h3>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                      record.status === 'Verified' || record.physicalVerification?.status === 'verified'
                        ? 'border border-success-300 bg-success-100 text-success-800'
                        : 'border border-amber-300 bg-amber-100 text-amber-800',
                    )}
                  >
                    {record.status === 'Verified' || record.physicalVerification?.status === 'verified'
                      ? 'Verified (In-Office)'
                      : 'Pending Office Visit'}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  {record.status === 'Verified' || record.physicalVerification?.status === 'verified'
                    ? `Physical original documents were verified in person at ${record.physicalVerification?.officeLocation || 'Bystander Head Office'}. The caretaker has 100% full approval.`
                    : 'The caretaker must visit the office with original hard-copy proofs (Govt ID, Police Clearance, Bank Proof) to achieve 100% full approval and unlock their dashboard.'}
                </p>
              </div>
            </div>
            <div className="shrink-0 sm:self-center">
              {record.status === 'Verified' || record.physicalVerification?.status === 'verified' ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-success-700">
                  <BadgeCheck className="h-4 w-4" /> 100% Approved
                </span>
              ) : (
                <Button
                  size="sm"
                  variant="primary"
                  icon={Building2}
                  onClick={onVerifyPhysical}
                  disabled={score < 50}
                  title={score < 50 ? 'Approve mandatory digital documents first' : 'Confirm in-office physical documents verification'}
                >
                  Verify In-Office (100% Full Approval)
                </Button>
              )}
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Document review"
          subtitle={`${record.documents.filter((d) => d.file && d.file !== 'Not submitted' && !String(d.id).startsWith('missing-')).length} of ${record.documents.length} documents submitted (3 mandatory)`}
          icon={FileCheck2}
        />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          {record.documents.map((doc) => {
            const hasFile = doc.file && doc.file !== 'Not submitted' && !String(doc.id).startsWith('missing-')
            const isRequested = doc.status === 'Requested by Admin' || doc.verificationStatus === 'requested'

            return (
              <div
                key={doc.id || doc.type}
                className={cn(
                  'rounded-xl border p-4 transition-all',
                  isRequested ? 'border-amber-300 bg-amber-50/20' : 'border-line bg-white'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="truncate text-sm font-bold text-ink">{doc.type}</p>
                      {doc.required !== false ? (
                        <span className="rounded-full bg-red-50 text-red-700 border border-red-200 px-1.5 py-0.5 text-[10px] font-bold">
                          Mandatory *
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 text-slate-600 border border-slate-200 px-1.5 py-0.5 text-[10px] font-medium">
                          Optional
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-faint mt-0.5">{doc.file || 'Not submitted'}</p>
                  </div>
                  <StatusBadge status={doc.status} size="sm" />
                </div>
                <p className="mt-2 text-[11px] text-faint">
                  {doc.uploadedOn ? `Uploaded ${formatDate(doc.uploadedOn)}` : 'Not uploaded yet'}
                </p>
                <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-muted">
                  <span className="font-semibold text-ink-soft">Reviewer note: </span>
                  {doc.feedback || doc.reviewerNotes || (isRequested ? 'Document requested from caretaker' : 'No feedback recorded yet.')}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {hasFile ? (
                    <>
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
                      <Button
                        size="xs"
                        variant="dangerGhost"
                        icon={XCircle}
                        onClick={() => onRejectDoc(doc)}
                        disabled={doc.status === 'Rejected'}
                      >
                        Reject
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="xs"
                      variant={isRequested ? 'outline' : 'primary'}
                      icon={Send}
                      onClick={() => onRequestDoc?.(doc)}
                      disabled={isRequested}
                    >
                      {isRequested ? 'Requested from caretaker' : 'Request document'}
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
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

  const [realVerifications, setRealVerifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [filter, setFilter] = useState('All')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [isDesktop, setIsDesktop] = useState(true)
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false)
  const [rejectModal, setRejectModal] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [isRejecting, setIsRejecting] = useState(false)
  const [confirmPrompt, setConfirmPrompt] = useState(null)
  const [previewDoc, setPreviewDoc] = useState(null)

  const debouncedQuery = useDebouncedValue(query)

  const fetchVerifications = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true)
    setError(null)
    try {
      const res = await adminService.getVerifications()
      setRealVerifications(res.verifications || [])
    } catch (err) {
      setError(err.message || 'Unable to load caregiver verification queue')
      if (showLoading) setRealVerifications([])
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchVerifications(true)
  }, [fetchVerifications])

  const verifications = useMemo(() => {
    return realVerifications || []
  }, [realVerifications])

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

  const record = useMemo(() => {
    if (selectedId) {
      const match = verifications.find((v) => v.id === selectedId)
      if (match) return match
    }
    return filtered[0] || null
  }, [verifications, selectedId, filtered])

  const select = (id) => {
    setSelectedId(id)
    if (!isDesktop) setMobileDetailOpen(true)
  }

  const openRejectApplication = () => {
    setRejectReason(APP_REJECT_PRESETS[0])
    setRejectModal({ kind: 'application' })
  }

  const openRejectDocument = (doc) => {
    setRejectReason(DOC_REJECT_PRESETS[0])
    setRejectModal({ kind: 'document', doc })
  }

  const executeReject = async () => {
    if (!rejectModal || !record) return

    const isDoc = rejectModal.kind === 'document'
    const targetDoc = rejectModal.doc
    const fallbackReason = isDoc
      ? 'Document rejected during review. Please upload a clear and valid replacement.'
      : 'Application rejected during administrative review.'
    const finalReason = rejectReason.trim() || fallbackReason

    setIsRejecting(true)

    try {
      if (isDoc && targetDoc) {
        // Optimistic in-memory update for the document
        setRealVerifications((prev) => {
          if (!prev) return prev
          return prev.map((v) => {
            if (v.id !== record.id) return v
            const nextDocs = (v.documents || []).map((d) =>
              d.id === targetDoc.id
                ? {
                    ...d,
                    status: 'Rejected',
                    verificationStatus: 'rejected',
                    feedback: finalReason,
                    reviewerNotes: finalReason,
                    reviewedAt: new Date().toISOString(),
                    reviewedBy: 'Admin',
                  }
                : d,
            )
            return {
              ...v,
              documents: nextDocs,
              overallScore: calculateVerificationScore(nextDocs, v.status),
              history: [
                {
                  at: new Date().toISOString(),
                  action: `${targetDoc.type} marked Rejected: ${finalReason}`,
                  by: 'Admin',
                },
                ...(v.history || []),
              ],
            }
          })
        })

        // Also update previewDoc if preview modal is open
        if (previewDoc && previewDoc.id === targetDoc.id) {
          setPreviewDoc((prev) => ({
            ...prev,
            status: 'Rejected',
            verificationStatus: 'rejected',
            feedback: finalReason,
            reviewerNotes: finalReason,
            reviewedAt: new Date().toISOString(),
            reviewedBy: 'Admin',
          }))
        }

        try {
          await adminService.updateDocumentStatus(targetDoc.id, {
            status: 'rejected',
            notes: finalReason,
          })
        } catch (err) {
          toast.error('Failed to update document status', { description: err.message })
        }

        toast.success(`${targetDoc.type} rejected`, {
          description: finalReason,
        })
      } else {
        // Optimistic in-memory update for the caregiver application
        setRealVerifications((prev) => {
          if (!prev) return prev
          return prev.map((v) => {
            if (v.id !== record.id) return v
            return {
              ...v,
              status: 'Rejected',
              verificationStatus: 'rejected',
              history: [
                {
                  at: new Date().toISOString(),
                  action: `Application rejected: ${finalReason}`,
                  by: 'Admin',
                },
                ...(v.history || []),
              ],
            }
          })
        })

        try {
          await adminService.updateCaregiverVerificationStatus(record.id, {
            status: 'rejected',
            reason: finalReason,
          })
        } catch (err) {
          toast.error('Failed to update application status', { description: err.message })
        }

        toast.success(`${record.name}'s application rejected`, {
          description: finalReason,
        })

        if (filter !== 'All' && filter !== 'Rejected') {
          setFilter('Rejected')
        }
      }

      // Smooth background refresh without showing loading skeleton
      fetchVerifications(false)
      setRejectModal(null)
    } catch (err) {
      toast.error('Failed to reject', {
        description: err.message || 'An error occurred while updating status',
      })
    } finally {
      setIsRejecting(false)
    }
  }

  const runConfirm = async () => {
    const action = confirmPrompt
    setConfirmPrompt(null)
    if (!action || !record) return

    if (action.kind === 'approveApplication') {
      // Optimistic update
      setRealVerifications((prev) => {
        if (!prev) return prev
        return prev.map((v) => {
          if (v.id !== record.id) return v
          const verifiedDocs = (v.documents || []).map((d) => ({
            ...d,
            status: 'Verified',
            verificationStatus: 'verified',
          }))
          return {
            ...v,
            status: 'Verified',
            verificationStatus: 'verified',
            documents: verifiedDocs,
            overallScore: 100,
            history: [
              {
                at: new Date().toISOString(),
                action: 'Application approved — profile marked Verified',
                by: 'Admin',
              },
              ...(v.history || []),
            ],
          }
        })
      })

      try {
        await adminService.updateCaregiverVerificationStatus(record.id, {
          status: 'verified',
          reason: 'Application approved — profile marked Verified',
          trustScore: 90,
        })
        toast.success(`${record.name} approved`, {
          description: 'Profile marked Verified and visible in customer search.',
        })
        fetchVerifications(false)
      } catch (err) {
        toast.error('Failed to approve application', { description: err.message })
        fetchVerifications(false)
      }
    } else if (action.kind === 'approveDocument') {
      const doc = action.doc
      // Optimistic update
      setRealVerifications((prev) => {
        if (!prev) return prev
        return prev.map((v) => {
          if (v.id !== record.id) return v
          const nextDocs = (v.documents || []).map((d) =>
            d.id === doc.id
              ? {
                  ...d,
                  status: 'Verified',
                  verificationStatus: 'verified',
                  feedback: 'Approved by admin',
                  reviewerNotes: 'Approved by admin',
                  reviewedAt: new Date().toISOString(),
                  reviewedBy: 'Admin',
                }
              : d,
          )
          return {
            ...v,
            documents: nextDocs,
            overallScore: calculateVerificationScore(nextDocs, v.status),
            history: [
              {
                at: new Date().toISOString(),
                action: `${doc.type} marked Verified: Approved by admin`,
                by: 'Admin',
              },
              ...(v.history || []),
            ],
          }
        })
      })

      if (previewDoc && previewDoc.id === doc.id) {
        setPreviewDoc((prev) => ({
          ...prev,
          status: 'Verified',
          verificationStatus: 'verified',
          feedback: 'Approved by admin',
          reviewerNotes: 'Approved by admin',
          reviewedAt: new Date().toISOString(),
          reviewedBy: 'Admin',
        }))
      }

      try {
        await adminService.updateDocumentStatus(doc.id, {
          status: 'verified',
          notes: 'Approved by admin',
        })
        toast.success(`${doc.type} approved`)
        fetchVerifications(false)
      } catch (err) {
        toast.error('Failed to approve document', { description: err.message })
        fetchVerifications(false)
      }
    } else if (action.kind === 'verifyPhysical') {
      try {
        await adminService.verifyPhysicalDocuments(record.id, {
          notes: 'Original physical documents verified in person at Bystander office',
          officeLocation: 'Bystander Head Office',
        })
        toast.success(`In-office physical verification confirmed for ${record.name}!`, {
          description: 'Application is now 100% fully approved and caretaker dashboard is unlocked.',
        })
        setRealVerifications((prev) =>
          prev.map((v) => {
            if (v.id !== record.id) return v
            return {
              ...v,
              status: 'Verified',
              verificationStatus: 'verified',
              physicalVerification: {
                status: 'verified',
                verifiedAt: new Date().toISOString(),
                notes: 'Original physical documents verified in person at Bystander office',
                officeLocation: 'Bystander Head Office',
              },
              overallScore: 100,
              history: [
                {
                  at: new Date().toISOString(),
                  action: 'Physical documents verified at Bystander office — 100% full approval',
                  by: 'Admin',
                },
                ...(v.history || []),
              ],
            }
          }),
        )
        fetchVerifications(false)
      } catch (err) {
        toast.error('Failed to confirm physical verification', { description: err.message })
      }
    }
  }

  const handleRequestDocument = async (doc) => {
    if (!record) return
    const docType = doc.documentType || (doc.type || '').toLowerCase().replace(/\s+/g, '_')
    try {
      await adminService.requestCaregiverDocument(record.id, {
        documentType: docType,
        notes: `Admin requested ${doc.type || docType}`,
      })
      toast.success(`Requested ${doc.type} from ${record.name}`, {
        description: 'The caretaker will be notified to upload this document in their portal.',
      })
      setRealVerifications((prev) =>
        prev.map((v) => {
          if (v.id !== record.id) return v
          const nextDocs = (v.documents || []).map((d) =>
            d.documentType === docType || d.id === doc.id
              ? {
                  ...d,
                  status: 'Requested by Admin',
                  verificationStatus: 'requested',
                  reviewerNotes: `Admin requested ${doc.type || docType}`,
                  feedback: `Admin requested ${doc.type || docType}`,
                }
              : d,
          )
          return { ...v, documents: nextDocs }
        }),
      )
      fetchVerifications(false)
    } catch (err) {
      toast.error('Failed to request document', { description: err.message })
    }
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
  } else if (confirmPrompt?.kind === 'approveDocument') {
    dialogTone = 'primary'
    dialogTitle = 'Approve this document?'
    dialogMessage = `${confirmPrompt.doc?.type} will be marked Verified with the note “Approved by admin”.`
    dialogLabel = 'Approve document'
  } else if (confirmPrompt?.kind === 'verifyPhysical') {
    dialogTone = 'success'
    dialogTitle = 'Confirm In-Office Physical Verification?'
    dialogMessage = `Confirm that ${record?.name} has visited the office and submitted all original physical documents. This will award 100% full approval and unlock their dashboard.`
    dialogLabel = 'Confirm Physical Verification (100%)'
  }

  const detailProps = record
    ? {
        record,
        onApproveApplication: () => setConfirmPrompt({ kind: 'approveApplication' }),
        onRejectApplication: openRejectApplication,
        onPreview: setPreviewDoc,
        onApproveDoc: (doc) => setConfirmPrompt({ kind: 'approveDocument', doc }),
        onRejectDoc: openRejectDocument,
        onRequestDoc: handleRequestDocument,
        onVerifyPhysical: () => setConfirmPrompt({ kind: 'verifyPhysical' }),
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
            ) : error && verifications.length === 0 ? (
              <div className="rounded-card border border-line bg-white p-4 shadow-card">
                <ErrorState
                  title="Failed to load verifications"
                  description={error}
                  onRetry={() => fetchVerifications(true)}
                />
              </div>
            ) : filtered.length ? (
              filtered.map((v) => {
                const active = v.id === selectedId
                const score = calculateVerificationScore(v)
                const tone = score >= 80 ? 'success' : score >= 60 ? 'warning' : 'danger'
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
                      <ProgressBar value={score} tone={tone} className="flex-1" />
                      <span className="text-[11px] font-bold tabular-nums text-muted">{score}%</span>
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

      {/* Unified Reject Modal with quick presets */}
      <Modal
        open={Boolean(rejectModal)}
        onClose={() => !isRejecting && setRejectModal(null)}
        title={
          rejectModal?.kind === 'application'
            ? `Reject Application: ${record?.name || 'Applicant'}`
            : `Reject Document: ${rejectModal?.doc?.type || 'Document'}`
        }
        subtitle={
          rejectModal?.kind === 'application'
            ? 'This will mark the application as Rejected and notify the applicant.'
            : 'Mark this document as Rejected and request a replacement from the applicant.'
        }
        size="md"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="ghost"
              onClick={() => setRejectModal(null)}
              disabled={isRejecting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              icon={XCircle}
              onClick={executeReject}
              disabled={isRejecting}
            >
              {isRejecting
                ? 'Rejecting...'
                : rejectModal?.kind === 'application'
                  ? 'Reject Application'
                  : 'Reject Document'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted">
              Quick reasons
            </label>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(rejectModal?.kind === 'application' ? APP_REJECT_PRESETS : DOC_REJECT_PRESETS).map((preset) => {
                const isSelected = rejectReason === preset
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setRejectReason(preset)}
                    className={cn(
                      'rounded-full px-3 py-1 text-xs font-medium transition cursor-pointer',
                      isSelected
                        ? 'bg-rose-100 text-rose-800 ring-1 ring-rose-400 font-semibold'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
                    )}
                  >
                    {preset}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted">
              Rejection notes for applicant
            </label>
            <Textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Select a reason above or type specific instructions..."
              className="mt-1.5"
              aria-label="Reason for rejection"
            />
            <p className="mt-2 text-xs text-muted">
              The applicant will see this explanation so they can upload a corrected document.
            </p>
          </div>
        </div>
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
        subtitle={record ? `${record.name} · Official document verification dossier` : ''}
        size="lg"
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3 w-full">
            <div className="flex items-center gap-2">
              <StatusBadge status={previewDoc?.status} size="sm" />
              {previewDoc?.fileUrl && (
                <a
                  href={previewDoc.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700 hover:text-primary-800 hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open in New Tab
                </a>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="dangerGhost"
                size="sm"
                icon={XCircle}
                onClick={() => openRejectDocument(previewDoc)}
                disabled={previewDoc?.status === 'Rejected'}
              >
                Reject Document
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={Check}
                onClick={() => {
                  const doc = previewDoc
                  setConfirmPrompt({ kind: 'approveDocument', doc })
                }}
                disabled={previewDoc?.status === 'Verified'}
              >
                Approve Document
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPreviewDoc(null)}>
                Close
              </Button>
            </div>
          </div>
        }
      >
        {previewDoc && record ? <DocumentPreview record={record} doc={previewDoc} /> : null}
      </Modal>
    </div>
  )
}

export default VerificationsPage
