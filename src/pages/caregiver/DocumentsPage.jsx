import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  Award,
  Download,
  FileText,
  Fingerprint,
  GraduationCap,
  Home,
  Landmark,
  Lock,
  ShieldCheck,
  UploadCloud,
  UserCheck,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useData } from '@/context/DataContext'
import { useDocumentTitle } from '@/hooks/useUi'
import { DOCUMENT_TYPES, getVerificationForCaregiver } from '@/data/verifications'
import { cn } from '@/utils/cn'
import { downloadText, formatDate } from '@/utils/format'
import { Button } from '@/components/common/Button'
import { Card, CardBody, CardHeader } from '@/components/common/Card'
import { StatusBadge } from '@/components/common/StatusBadge'
import { PageHeader } from '@/components/common/PageHeader'
import { ProgressBar } from '@/components/common/Tabs'
import { Modal } from '@/components/common/Modal'
import { FileUpload } from '@/components/forms/FileUpload'

const DOC_ICONS = {
  'Identity Verification': Fingerprint,
  'Nursing Registration Certificate': Award,
  'Nursing Student College ID': GraduationCap,
  'Police Clearance Certificate': ShieldCheck,
  'Address Verification': Home,
  'Bank Verification': Landmark,
  'Face Verification': UserCheck,
}

const today = () => new Date().toISOString().slice(0, 10)

export function DocumentsPage() {
  useDocumentTitle('My Documents')

  const { user } = useAuth()
  const { verifications, caregivers, updateDocument } = useData()

  const myId = user?.caregiverId || 'cg-101'
  const caregiver = caregivers.find((c) => c.id === myId) || caregivers[0]

  const record = useMemo(() => {
    const live = verifications.find((v) => v.caregiverId === myId)
    if (live) return live
    const seeded = getVerificationForCaregiver(myId)
    if (seeded) return seeded
    return {
      id: `VR-${myId.toUpperCase()}`,
      caregiverId: myId,
      name: caregiver?.name || 'Caretaker',
      regNo: caregiver?.regNo || 'MH-NUR-2018-4471',
      submittedOn: caregiver?.joinedOn,
      status: 'Verified',
      documents: DOCUMENT_TYPES.map((type, i) => ({
        id: `stub-${i}`,
        type,
        file: `${type.toLowerCase().replace(/\s+/g, '-')}.pdf`,
        status: 'Verified',
        feedback: '',
        uploadedOn: caregiver?.joinedOn,
      })),
      history: [{ at: caregiver?.joinedOn, action: 'Application submitted', by: caregiver?.name || 'Caretaker' }],
    }
  }, [verifications, myId, caregiver])

  const [overrides, setOverrides] = useState({})
  const [uploadType, setUploadType] = useState(null)
  const [uploadFile, setUploadFile] = useState(null)
  const [uploadError, setUploadError] = useState('')
  const [viewDoc, setViewDoc] = useState(null)

  const docs = useMemo(
    () =>
      DOCUMENT_TYPES.map((type) => {
        const existing = record.documents.find((d) => d.type === type)
        return existing || overrides[type] || { id: `missing-${type}`, type, file: '', status: 'Not uploaded', feedback: '', uploadedOn: null }
      }),
    [record, overrides],
  )

  const verifiedCount = docs.filter((d) => d.status === 'Verified').length
  const completionPct = Math.round((verifiedCount / DOCUMENT_TYPES.length) * 100)

  const maskedReg = `XXXX XXXX ${(record.regNo || '0000').slice(-4)}`

  const openUpload = (doc) => {
    setUploadType(doc.type)
    setUploadFile(null)
    setUploadError('')
  }

  const submitUpload = () => {
    if (!uploadFile) {
      setUploadError('Choose a file before submitting')
      return
    }
    const existing = record.documents.find((d) => d.type === uploadType)
    if (existing) {
      updateDocument(record.id, existing.id, { status: 'Under Review', file: uploadFile.name, uploadedOn: today(), feedback: '' })
    } else {
      setOverrides((prev) => ({
        ...prev,
        [uploadType]: {
          id: `local-${uploadType}`,
          type: uploadType,
          file: uploadFile.name,
          status: 'Under Review',
          feedback: '',
          uploadedOn: today(),
        },
      }))
    }
    toast.success('Document uploaded — now under review')
    setUploadType(null)
    setUploadFile(null)
  }

  const handleDownload = (doc) => {
    downloadText(
      `${doc.type.toLowerCase().replace(/\s+/g, '-')}-demo.txt`,
      [
        'CareMate demo document',
        `Type: ${doc.type}`,
        `File: ${doc.file}`,
        `Caretaker: ${record.name}`,
        `Identifier: ${maskedReg}`,
        'Sensitive fields are masked in demo mode.',
      ].join('\n'),
      'text/plain',
    )
    toast.success('Demo document downloaded')
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Verification documents"
        subtitle="Upload and track the documents that keep your profile trusted. Customers never see the files themselves — only your Verified badge."
        meta={
          <>
            <StatusBadge status={record.status} />
            <span className="text-sm text-muted">
              {verifiedCount} of {DOCUMENT_TYPES.length} documents verified
            </span>
          </>
        }
      />

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
                <span className="font-semibold text-ink">{record.submittedOn ? formatDate(record.submittedOn, { long: true }) : '—'}</span>
              </p>
              <p className="text-xs">Ref {record.id}</p>
            </div>
          </div>
          <ProgressBar value={verifiedCount} max={DOCUMENT_TYPES.length} tone="primary" />
          <div className="flex items-start gap-3 rounded-xl border border-line bg-gradient-to-br from-slate-50 to-white p-4">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-faint" />
            <p className="text-xs leading-relaxed text-muted">
              Files are encrypted at rest and only accessible to the CareMate verification team. Identifiers are masked everywhere in the
              product — full numbers are never displayed or shared.
            </p>
          </div>
        </CardBody>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {docs.map((doc) => {
          const Icon = DOC_ICONS[doc.type] || FileText
          const isRejected = doc.status === 'Rejected'
          const isVerified = doc.status === 'Verified'
          const uploaded = Boolean(doc.file) && doc.status !== 'Not uploaded'
          return (
            <Card key={doc.type} className="flex flex-col">
              <CardBody className="flex flex-1 flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-mint-100 text-primary-700">
                    <Icon className="h-5 w-5" />
                  </span>
                  <StatusBadge status={doc.status} size="sm" />
                </div>
                <h3 className="font-display text-sm font-bold text-ink">{doc.type}</h3>
                <p className="text-sm text-muted">{doc.file || 'No file uploaded'}</p>
                {doc.uploadedOn ? <p className="text-xs text-faint">Uploaded {formatDate(doc.uploadedOn)}</p> : null}
                {doc.feedback ? (
                  <p
                    className={cn(
                      'rounded-xl p-3 text-xs leading-relaxed',
                      isRejected ? 'bg-danger-50 text-danger-600' : isVerified ? 'bg-success-50 text-success-700' : 'bg-slate-50 text-muted',
                    )}
                  >
                    {doc.feedback}
                  </p>
                ) : null}
              </CardBody>
              <div className="flex gap-2 border-t border-line px-5 py-3.5">
                {!uploaded || isRejected ? (
                  <Button variant="primary" size="sm" className="flex-1" icon={UploadCloud} onClick={() => openUpload(doc)}>
                    {uploaded ? 'Re-upload' : 'Upload'}
                  </Button>
                ) : null}
                {uploaded ? (
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => setViewDoc(doc)}>
                    View
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
          <ol className="relative space-y-0">
            {record.history.map((h, i) => {
              const last = i === record.history.length - 1
              return (
                <li key={`${h.at}-${i}`} className="relative flex gap-4 pb-6 last:pb-0">
                  {!last ? <span className="absolute left-[13px] top-7 h-[calc(100%-16px)] w-px bg-line" aria-hidden="true" /> : null}
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
        </CardBody>
      </Card>

      <Modal
        open={Boolean(uploadType)}
        onClose={() => setUploadType(null)}
        title="Upload document"
        subtitle={uploadType || ''}
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setUploadType(null)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={submitUpload}>
              Submit for review
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <FileUpload
            id="doc-upload"
            label="Document file"
            hint="PDF, JPG or PNG · max 5 MB. Make sure all four corners are visible and text is legible."
            value={uploadFile}
            onChange={(f) => {
              setUploadFile(f)
              setUploadError('')
            }}
            error={uploadError}
            required
          />
          <p className="rounded-xl bg-mint-50 p-3 text-xs leading-relaxed text-primary-900/80">
            Our verification team reviews fresh uploads within 24–48 hours. You will get a notification the moment the status changes.
          </p>
        </div>
      </Modal>

      <Modal
        open={Boolean(viewDoc)}
        onClose={() => setViewDoc(null)}
        title={viewDoc?.type || ''}
        subtitle={viewDoc?.file || ''}
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setViewDoc(null)}>
              Close
            </Button>
            <Button variant="primary" icon={Download} onClick={() => handleDownload(viewDoc)}>
              Download demo
            </Button>
          </div>
        }
      >
        {viewDoc ? (
          <div className="space-y-4">
            <div className="rounded-card border border-line bg-white p-5 shadow-card">
              <div className="flex items-center justify-between gap-3 border-b border-line pb-3">
                <p className="font-display text-sm font-bold text-ink">CareMate · {viewDoc.type}</p>
                <FileText className="h-4 w-4 text-faint" />
              </div>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-faint">Document file</p>
              <p className="mt-1 text-sm text-ink">{viewDoc.file}</p>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-faint">Identifier</p>
              <p className="mt-1 font-display text-lg font-extrabold tracking-widest text-ink">{maskedReg}</p>
              <div className="mt-5 space-y-2" aria-hidden="true">
                <div className="h-3 w-4/5 rounded bg-slate-200" />
                <div className="h-3 w-3/5 rounded bg-slate-200" />
                <div className="h-3 w-2/3 rounded bg-slate-200" />
                <div className="h-3 w-1/2 rounded bg-slate-100" />
              </div>
              <p className="mt-5 rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-muted">
                Sensitive fields (full ID numbers, bank details, addresses) are redacted in demo mode.
              </p>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}

export default DocumentsPage
