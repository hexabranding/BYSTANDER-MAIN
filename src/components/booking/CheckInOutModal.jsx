import { useEffect, useState } from 'react'
import { Camera, Check, Clock, MapPin, QrCode, ScanLine } from 'lucide-react'
import { Modal } from '@/components/common/Modal'
import { Button } from '@/components/common/Button'
import { FormField, Input } from '@/components/forms/FormField'
import { cn } from '@/utils/cn'
import { formatDateTime } from '@/utils/format'

const EXPECTED_QR_PREFIX = 'CM-QR'

export function CheckInOutModal({ open, onClose, mode = 'checkin', booking, onConfirm }) {
  const isCheckIn = mode === 'checkin'
  const [selfieAt, setSelfieAt] = useState(null)
  const [qrCode, setQrCode] = useState('')
  const [qrError, setQrError] = useState('')
  const [now, setNow] = useState(() => new Date().toISOString())
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setSelfieAt(null)
    setQrCode('')
    setQrError('')
    setSubmitting(false)
    setNow(new Date().toISOString())
    const timer = setInterval(() => setNow(new Date().toISOString()), 1000)
    return () => clearInterval(timer)
  }, [open])

  const expectedQr = booking ? `${EXPECTED_QR_PREFIX}-${booking.id}` : `${EXPECTED_QR_PREFIX}-DEMO`

  const captureSelfie = () => setSelfieAt(new Date().toISOString())

  const scanQr = () => {
    setQrCode(expectedQr)
    setQrError('')
  }

  const canSubmit = Boolean(selfieAt) && qrCode.trim().length >= 4

  const handleSubmit = () => {
    if (!selfieAt) {
      setQrError('Capture the verification selfie first.')
      return
    }
    if (qrCode.trim().length < 4) {
      setQrError('Scan or enter the customer QR code to continue.')
      return
    }
    setSubmitting(true)
    onConfirm?.({
      selfie: selfieAt,
      qrCode: qrCode.trim(),
      capturedAt: new Date().toISOString(),
      location: `${booking?.address || ''}`.trim(),
    })
    onClose?.()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={isCheckIn ? 'Service check-in' : 'Service check-out'}
      subtitle={
        booking
          ? `${booking.id} · ${booking.service} · ${booking.patient?.name || booking.patientName || 'Patient'}`
          : 'Identity verification'
      }
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit} loading={submitting} icon={Check}>
            {isCheckIn ? 'Verify & start service' : 'Verify & complete service'}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="flex items-center gap-2 rounded-xl border border-line bg-canvas px-4 py-3 text-sm text-muted">
          <Clock className="h-4 w-4 shrink-0 text-primary-600" />
          <span>
            Current time will be recorded: <strong className="text-ink">{formatDateTime(now)}</strong>
          </span>
        </div>

        <div
          className={cn(
            'rounded-card border border-dashed p-5 text-center transition',
            selfieAt ? 'border-success-500 bg-success-50' : 'border-line-strong bg-canvas',
          )}
        >
          <span
            className={cn(
              'mx-auto grid h-14 w-14 place-items-center rounded-2xl',
              selfieAt ? 'bg-success-500 text-white' : 'bg-white text-primary-700 shadow-card',
            )}
          >
            <Camera className="h-6 w-6" />
          </span>
          <p className="mt-3 text-sm font-bold text-ink">
            {selfieAt ? 'Selfie captured' : 'Step 1 — selfie verification'}
          </p>
          <p className="mt-1 text-xs text-muted">
            {selfieAt
              ? `Captured at ${formatDateTime(selfieAt)} (camera is simulated in this demo)`
              : 'Take a quick selfie at the service location so we can verify attendance.'}
          </p>
          <Button
            variant={selfieAt ? 'outline' : 'secondary'}
            size="sm"
            className="mt-3"
            onClick={captureSelfie}
            icon={Camera}
          >
            {selfieAt ? 'Retake selfie' : 'Capture selfie'}
          </Button>
        </div>

        <div className="rounded-card border border-line bg-white p-5">
          <div className="flex items-center gap-2 text-sm font-bold text-ink">
            <QrCode className="h-4 w-4 text-primary-700" />
            Step 2 — customer QR verification
          </div>
          <p className="mt-1 text-xs text-muted">
            Ask the customer for their booking QR code, or scan it with the camera. Demo code: <code className="font-mono text-primary-700">{expectedQr}</code>
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <FormField className="flex-1" error={qrError}>
              <Input
                value={qrCode}
                onChange={(e) => {
                  setQrCode(e.target.value)
                  setQrError('')
                }}
                placeholder="Enter QR code"
              />
            </FormField>
            <Button variant="secondary" onClick={scanQr} icon={ScanLine} className="sm:self-start">
              Scan code
            </Button>
          </div>
        </div>

        {booking?.address ? (
          <div className="flex items-start gap-2 text-xs text-muted">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary-600" />
            <span>Location on file: {booking.address}</span>
          </div>
        ) : null}
      </div>
    </Modal>
  )
}

export default CheckInOutModal
