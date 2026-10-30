import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  AlertCircle,
  Award,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Fingerprint,
  GraduationCap,
  HelpCircle,
  Home,
  Landmark,
  Lock,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  UploadCloud,
  UserCheck,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useData } from '@/context/DataContext'
import { useDocumentTitle } from '@/hooks/useUi'
import { getVerificationForCaregiver } from '@/data/verifications'
import { documentService } from '@/services'
import { cn } from '@/utils/cn'
import { downloadText, formatDate } from '@/utils/format'
import { Button } from '@/components/common/Button'
import { Card, CardBody, CardHeader } from '@/components/common/Card'
import { StatusBadge } from '@/components/common/StatusBadge'
import { PageHeader } from '@/components/common/PageHeader'
import { ProgressBar } from '@/components/common/Tabs'
import { Modal } from '@/components/common/Modal'
import { FileUpload } from '@/components/forms/FileUpload'
import { CardSkeleton } from '@/components/common/States'

const DOC_ICONS = {
  'Identity Verification': Fingerprint,
  'Government Photo ID': Fingerprint,
  'Nursing Registration Certificate': Award,
  'Nursing Council Registration': Award,
  'Nursing Student College ID': GraduationCap,
  'College / Institute ID': GraduationCap,
  'Police Clearance Certificate': ShieldCheck,
  'Address Verification': Home,
  'Address Proof': Home,
  'Bank Verification': Landmark,
  'Bank Account Proof': Landmark,
  'Face Verification': UserCheck,
}

const fileToDataUrl = (file) => {
  return new Promise((resolve) => {
    if (!file) return resolve(null)
    if (file instanceof Blob || file instanceof File) {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(file)
    } else {
      resolve(null)
    }
  })
}

export function DocumentsPage() {
  useDocumentTitle('My Documents')

  const { user } = useAuth()
  const { verifications, caregivers, updateDocument } = useData()

  const [loading, setLoading] = useState(true)
  const [apiDossier, setApiDossier] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const [uploadTarget, setUploadTarget] = useState(null)
  const [uploadFile, setUploadFile] = useState(null)
  const [uploadError, setUploadError] = useState('')
  const [viewDoc, setViewDoc] = useState(null)

  const myId = user?.caregiverId || user?.id || 'cg-101'
  const caregiver = caregivers.find((c) => c.id === myId) || caregivers[0]

  // Fetch truthful documents from API
  const fetchDocuments = useCallback(async () => {
    try {
      const res = await documentService.getMyDocuments()
      if (res) {
        setApiDossier(res)
      }
    } catch (err) {
      console.warn('Could not fetch live documents from API, falling back to local session:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  // Derive truthful dossier
  const record = useMemo(() => {
    if (apiDossier) {
      return apiDossier
    }

    const live = verifications.find((v) => v.caregiverId === myId || v.id === myId)
    if (live) return live

    const seeded = getVerificationForCaregiver(myId)
    if (seeded) return seeded

    // Truthful fallback for unseeded / newly registered caregivers
    const isStudent =
      user?.qualification === 'nursing_student' ||
      user?.qualification === 'Nursing Student (Final Year)' ||
      caregiver?.qualification === 'Nursing Student (Final Year)'

    const defaultSlots = [
      {
        id: 'missing-identity',
        type: 'Identity Verification',
        documentType: 'identity',
        file: '',
        fileName: '',
        status: 'Not uploaded',
        verificationStatus: 'not_uploaded',
        feedback: '',
        hint: 'Government-issued photo ID (Aadhaar / Passport / Voter ID)',
        required: true,
      },
      isStudent
        ? {
            id: 'missing-college-id',
            type: 'Nursing Student College ID',
            documentType: 'college_id',
            file: '',
            fileName: '',
            status: 'Not uploaded',
            verificationStatus: 'not_uploaded',
            feedback: '',
            hint: 'Valid nursing college identity card with current academic year',
            required: true,
          }
        : {
            id: 'missing-nursing-reg',
            type: 'Nursing Registration Certificate',
            documentType: 'nursing_registration',
            file: '',
            fileName: '',
            status: 'Not uploaded',
            verificationStatus: 'not_uploaded',
            feedback: '',
            hint: 'State Nursing Council registration certificate or degree proof',
            required: true,
          },
      {
        id: 'missing-address',
        type: 'Address Verification',
        documentType: 'address_proof',
        file: '',
        fileName: '',
        status: 'Not uploaded',
        verificationStatus: 'not_uploaded',
        feedback: '',
        hint: 'Recent utility bill, rent agreement, or bank passbook address page',
        required: true,
      },
      {
        id: 'missing-pcc',
        type: 'Police Clearance Certificate',
        documentType: 'police_clearance',
        file: '',
        fileName: '',
        status: 'Not uploaded',
        verificationStatus: 'not_uploaded',
        feedback: '',
        hint: 'Police clearance certificate issued within the last 12 months',
        required: true,
      },
      {
        id: 'missing-bank',
        type: 'Bank Verification',
        documentType: 'bank_verification',
        file: '',
        fileName: '',
        status: 'Not uploaded',
        verificationStatus: 'not_uploaded',
        feedback: '',
        hint: 'Cancelled cheque or bank passbook showing account number and IFSC',
        required: true,
      },
    ]

    const overallStatus = user?.verificationStatus === 'verified' ? 'Verified' : 'Pending'

    return {
      id: `VR-${String(myId).toUpperCase()}`,
      caregiverId: myId,
      name: user?.fullName || caregiver?.name || 'Caretaker',
      regNo: user?.regNo || caregiver?.regNo || '',
      submittedOn: user?.joinedOn || caregiver?.joinedOn,
      status: overallStatus,
      verificationStatus: (user?.verificationStatus || 'pending').toLowerCase(),
      verified: overallStatus === 'Verified',
      completionPct: overallStatus === 'Verified' ? 100 : 0,
      verifiedCount: overallStatus === 'Verified' ? defaultSlots.length : 0,
      totalRequired: defaultSlots.length,
      documents: defaultSlots,
      history: [
        {
          at: user?.joinedOn || caregiver?.joinedOn || new Date().toISOString(),
          action: 'Application submitted',
          by: user?.fullName || caregiver?.name || 'Caretaker',
        },
      ],
    }
  }, [apiDossier, verifications, myId, caregiver, user])

  const docs = record.documents || []
  const verifiedCount = docs.filter((d) => d.status === 'Verified').length
  const totalRequired = docs.length || 5
  const completionPct = Math.round((verifiedCount / totalRequired) * 100)

  const maskedReg = record.regNo ? `XXXX XXXX ${String(record.regNo).slice(-4)}` : 'Not provided'

  const openUpload = (doc) => {
    setUploadTarget(doc)
    setUploadFile(null)
    setUploadError('')
  }

  const submitUpload = async () => {
    if (!uploadFile) {
      setUploadError('Choose a file before submitting')
      return
    }

    try {
      setSubmitting(true)
      const dataUrl = await fileToDataUrl(uploadFile.rawFile || uploadFile.file)

      const docTypeKey =
        uploadTarget.documentType ||
        (uploadTarget.type === 'Identity Verification'
          ? 'identity'
          : uploadTarget.type === 'Nursing Registration Certificate'
            ? 'nursing_registration'
            : uploadTarget.type === 'Nursing Student College ID'
              ? 'college_id'
              : uploadTarget.type === 'Address Verification'
                ? 'address_proof'
                : uploadTarget.type === 'Police Clearance Certificate'
                  ? 'police_clearance'
                  : uploadTarget.type === 'Bank Verification'
                    ? 'bank_verification'
                    : 'other')

      await documentService.uploadDocument({
        documentType: docTypeKey,
        fileName: uploadFile.name,
        fileSize: uploadFile.size,
        mimeType: uploadFile.type || 'application/pdf',
        fileData: dataUrl,
      })

      // Update in-memory data context for instant responsiveness
      if (record.id) {
        updateDocument(record.id, uploadTarget.id, {
          status: 'Under Review',
          file: uploadFile.name,
          uploadedOn: new Date().toISOString().slice(0, 10),
          feedback: '',
        })
      }

      toast.success('Document uploaded — now under review by verification desk')
      setUploadTarget(null)
      setUploadFile(null)
      await fetchDocuments()
    } catch (err) {
      toast.error('Upload failed', { description: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDownload = (doc) => {
    if (doc.fileUrl && doc.fileUrl.startsWith('data:')) {
      const link = document.createElement('a')
      link.href = doc.fileUrl
      link.download = doc.fileName || doc.file || 'document'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      toast.success('Document downloaded')
      return
    }

    downloadText(
      `${doc.type.toLowerCase().replace(/\s+/g, '-')}-record.txt`,
      [
        'Bystander Verified Document Record',
        `Document: ${doc.type}`,
        `File Name: ${doc.file || doc.fileName || 'N/A'}`,
        `Caretaker: ${record.name}`,
        `Registration / ID: ${record.regNo || 'N/A'}`,
        `Verification Status: ${doc.status}`,
        `Uploaded On: ${doc.uploadedOn || 'N/A'}`,
        doc.feedback ? `Compliance Notes: ${doc.feedback}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
      'text/plain',
    )
    toast.success('Document metadata downloaded')
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Verification documents"
          subtitle="Upload and track the documents that keep your profile trusted."
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <CardSkeleton count={6} />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Verification documents"
        subtitle="Upload and track the documents that keep your profile trusted. Customers never see the files themselves — only your Verified badge."
        meta={
          <div className="flex items-center gap-3">
            <StatusBadge status={record.status} />
            <span className="text-sm font-medium text-muted">
              {verifiedCount} of {totalRequired} documents verified
            </span>
            <Button
              variant="ghost"
              size="sm"
              icon={RefreshCw}
              onClick={fetchDocuments}
              aria-label="Refresh documents"
            />
          </div>
        }
      />

      {record.status === 'Pending' || record.status === 'not_uploaded' ? (
        <div className="flex items-start gap-3 rounded-2xl border border-warning-200 bg-warning-50/70 p-4 text-warning-900 shadow-sm">
          <Clock className="mt-0.5 h-5 w-5 shrink-0 text-warning-600" />
          <div className="min-w-0 text-sm">
            <p className="font-bold">Verification Pending — Upload Your Proofs</p>
            <p className="mt-0.5 text-xs text-warning-800">
              Please upload all {totalRequired} required verification documents below. Once submitted, our compliance
              desk will review your credentials to unlock your full caretaker dashboard.
            </p>
          </div>
        </div>
      ) : record.status === 'Under Review' ? (
        <div className="flex items-start gap-3 rounded-2xl border border-primary-200 bg-mint-50/70 p-4 text-primary-950 shadow-sm">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-primary-700" />
          <div className="min-w-0 text-sm">
            <p className="font-bold">Application Under Review</p>
            <p className="mt-0.5 text-xs text-primary-900/80">
              Your documents have been submitted and are currently being reviewed by our operations desk. Reviews are
              typically finalized within 24–48 hours.
            </p>
          </div>
        </div>
      ) : record.status === 'Verified' ? (
        <div className="flex items-start gap-3 rounded-2xl border border-success-200 bg-success-50/70 p-4 text-success-950 shadow-sm">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success-600" />
          <div className="min-w-0 text-sm">
            <p className="font-bold">Profile Fully Verified</p>
            <p className="mt-0.5 text-xs text-success-900/80">
              All credentials and identity proofs have been approved. Your profile carries the official Verified badge
              and is actively accepting bookings.
            </p>
          </div>
        </div>
      ) : record.status === 'Rejected' ? (
        <div className="flex items-start gap-3 rounded-2xl border border-danger-200 bg-danger-50/70 p-4 text-danger-950 shadow-sm">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-danger-600" />
          <div className="min-w-0 text-sm">
            <p className="font-bold">Action Required: Document Revision Needed</p>
            <p className="mt-0.5 text-xs text-danger-900/80">
              One or more submitted documents were not approved by the verification team. Please inspect the feedback
              notes below and re-upload clear copies.
            </p>
          </div>
        </div>
      ) : null}

      <Card>
        <CardBody className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-faint">Verification completion</p>
              <p className="mt-1 font-display text-2xl font-extrabold tabular-nums text-ink">{completionPct}%</p>
            </div>
            <div className="text-right text-sm text-muted">
              <p>
                Submitted{' '}
                <span className="font-semibold text-ink">
                  {record.submittedOn ? formatDate(record.submittedOn, { long: true }) : '—'}
                </span>
              </p>
              <p className="text-xs">Ref {record.id}</p>
            </div>
          </div>
          <ProgressBar value={verifiedCount} max={totalRequired} tone="primary" />
          <div className="flex items-start gap-3 rounded-xl border border-line bg-gradient-to-br from-slate-50 to-white p-4">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-faint" />
            <p className="text-xs leading-relaxed text-muted">
              Files are encrypted at rest and only accessible to the Bystander verification team. Identifiers are masked
              everywhere in the product — full numbers are never displayed or shared.
            </p>
          </div>
        </CardBody>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {docs.map((doc) => {
          const Icon = DOC_ICONS[doc.type] || FileText
          const isRejected = doc.status === 'Rejected'
          const isVerified = doc.status === 'Verified'
          const isUnderReview = doc.status === 'Under Review' || doc.status === 'Pending'
          const isNotUploaded = doc.status === 'Not uploaded' || !doc.file

          return (
            <Card key={doc.id || doc.type} className="flex flex-col">
              <CardBody className="flex flex-1 flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-mint-100 text-primary-700">
                    <Icon className="h-5 w-5" />
                  </span>
                  <StatusBadge status={doc.status} size="sm" />
                </div>
                <h3 className="font-display text-sm font-bold text-ink">{doc.type}</h3>
                {doc.hint ? <p className="text-xs text-faint">{doc.hint}</p> : null}

                <div className="mt-auto pt-2">
                  <p className="text-xs font-semibold text-muted">
                    {doc.file || doc.fileName || 'No document submitted'}
                  </p>
                  {doc.uploadedOn ? (
                    <p className="mt-0.5 text-[11px] text-faint">Uploaded {formatDate(doc.uploadedOn)}</p>
                  ) : null}
                </div>

                {doc.feedback ? (
                  <div
                    className={cn(
                      'rounded-xl p-3 text-xs leading-relaxed',
                      isRejected
                        ? 'border border-danger-200 bg-danger-50 text-danger-700'
                        : isVerified
                          ? 'border border-success-200 bg-success-50 text-success-700'
                          : 'border border-line bg-slate-50 text-muted',
                    )}
                  >
                    <p className="font-semibold">{isRejected ? 'Rejection Reason:' : 'Compliance Note:'}</p>
                    <p className="mt-0.5">{doc.feedback}</p>
                  </div>
                ) : null}
              </CardBody>

              <div className="flex gap-2 border-t border-line px-5 py-3.5">
                {isNotUploaded || isRejected ? (
                  <Button
                    variant="primary"
                    size="sm"
                    className="flex-1"
                    icon={UploadCloud}
                    onClick={() => openUpload(doc)}
                  >
                    {isRejected ? 'Re-upload Proof' : 'Upload File'}
                  </Button>
                ) : isUnderReview ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => setViewDoc(doc)}
                    >
                      View
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1"
                      icon={UploadCloud}
                      onClick={() => openUpload(doc)}
                    >
                      Update
                    </Button>
                  </>
                ) : isVerified ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setViewDoc(doc)}
                  >
                    View Verified File
                  </Button>
                ) : null}
              </div>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHeader title="Verification history" subtitle="Audit trail of your application" icon={ShieldCheck} />
        <CardBody>
          {record.history && record.history.length > 0 ? (
            <ol className="relative space-y-0">
              {record.history.map((h, i) => {
                const last = i === record.history.length - 1
                return (
                  <li key={`${h.at}-${i}`} className="relative flex gap-4 pb-6 last:pb-0">
                    {!last ? (
                      <span className="absolute left-[13px] top-7 h-[calc(100%-16px)] w-px bg-line" aria-hidden="true" />
                    ) : null}
                    <span className="relative z-10 grid h-[27px] w-[27px] shrink-0 place-items-center rounded-full border-2 border-primary-600 bg-primary-600 text-white">
                      <ShieldCheck className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 pt-0.5">
                      <p className="text-sm font-semibold text-ink">{h.action}</p>
                      <p className="mt-0.5 text-xs text-faint">
                        {formatDate(h.at, { long: true })} · by {h.by}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ol>
          ) : (
            <p className="text-sm text-muted">No audit events recorded yet.</p>
          )}
        </CardBody>
      </Card>

      {/* Upload Modal */}
      <Modal
        open={Boolean(uploadTarget)}
        onClose={() => !submitting && setUploadTarget(null)}
        title="Upload verification document"
        subtitle={uploadTarget?.type || ''}
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" disabled={submitting} onClick={() => setUploadTarget(null)}>
              Cancel
            </Button>
            <Button variant="primary" loading={submitting} onClick={submitUpload}>
              Submit for review
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {uploadTarget?.hint ? (
            <p className="text-xs text-muted leading-relaxed">
              <strong>Requirement:</strong> {uploadTarget.hint}
            </p>
          ) : null}

          <FileUpload
            id="doc-upload"
            label="Document file"
            hint="PDF, JPG or PNG · max 5 MB. Make sure all corners are visible and text is legible."
            value={uploadFile}
            onChange={(f) => {
              setUploadFile(f)
              setUploadError('')
            }}
            error={uploadError}
            required
          />

          <p className="rounded-xl bg-mint-50 p-3 text-xs leading-relaxed text-primary-900/80">
            Our verification desk reviews newly submitted proofs within 24–48 hours. Once approved, your status
            updates automatically.
          </p>
        </div>
      </Modal>

      {/* View Document Modal */}
      <Modal
        open={Boolean(viewDoc)}
        onClose={() => setViewDoc(null)}
        title={viewDoc?.type || ''}
        subtitle={viewDoc?.fileName || viewDoc?.file || ''}
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setViewDoc(null)}>
              Close
            </Button>
            <Button variant="primary" icon={Download} onClick={() => handleDownload(viewDoc)}>
              Download
            </Button>
          </div>
        }
      >
        {viewDoc ? (
          <div className="space-y-4">
            <div className="rounded-card border border-line bg-white p-5 shadow-card">
              <div className="flex items-center justify-between gap-3 border-b border-line pb-3">
                <p className="font-display text-sm font-bold text-ink">Bystander · {viewDoc.type}</p>
                <StatusBadge status={viewDoc.status} size="sm" />
              </div>

              {viewDoc.fileUrl && viewDoc.fileUrl.startsWith('data:image') ? (
                <div className="mt-4 overflow-hidden rounded-xl border border-line bg-slate-50 p-2">
                  <img
                    src={viewDoc.fileUrl}
                    alt={viewDoc.type}
                    className="max-h-72 w-full rounded-lg object-contain"
                  />
                </div>
              ) : null}

              <dl className="mt-4 space-y-2.5 text-sm">
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-muted">Document Name</dt>
                  <dd className="font-semibold text-ink">{viewDoc.type}</dd>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-muted">File Name</dt>
                  <dd className="font-semibold text-ink truncate max-w-[60%]">
                    {viewDoc.fileName || viewDoc.file || 'N/A'}
                  </dd>
                </div>
                {viewDoc.fileSize ? (
                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-muted">File Size</dt>
                    <dd className="font-semibold text-ink">
                      {Math.max(1, Math.round(viewDoc.fileSize / 1024))} KB
                    </dd>
                  </div>
                ) : null}
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-muted">Identifier</dt>
                  <dd className="font-display font-semibold text-ink tracking-wider">{maskedReg}</dd>
                </div>
                {viewDoc.uploadedOn ? (
                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-muted">Submitted On</dt>
                    <dd className="font-semibold text-ink">{formatDate(viewDoc.uploadedOn)}</dd>
                  </div>
                ) : null}
                {viewDoc.reviewedBy ? (
                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-muted">Reviewed By</dt>
                    <dd className="font-semibold text-ink">{viewDoc.reviewedBy}</dd>
                  </div>
                ) : null}
              </dl>

              {viewDoc.feedback ? (
                <div className="mt-4 rounded-xl border border-line bg-slate-50 p-3 text-xs">
                  <p className="font-semibold text-ink">Reviewer Feedback:</p>
                  <p className="mt-1 text-muted leading-relaxed">{viewDoc.feedback}</p>
                </div>
              ) : null}

              <p className="mt-5 rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-muted">
                Private documents are secured with end-to-end access controls. Sensitive fields are masked across public
                profiles.
              </p>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}

export default DocumentsPage
