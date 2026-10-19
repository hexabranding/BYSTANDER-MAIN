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
  const [otp, setOtp] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [now, setNow] = useState(() => new Date().toISOString())
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setSelfieAt(null)
    setOtp('')
    setErrorMsg('')
    setSubmitting(false)
    setNow(new Date().toISOString())
    const timer = setInterval(() => setNow(new Date().toISOString()), 1000)
    return () => clearInterval(timer)
  }, [open])

  const captureSelfie = () => {
    setSelfieAt(new Date().toISOString())
    setErrorMsg('')
  }

  const canSubmit = Boolean(selfieAt) && /^\d{6}$/.test(otp.trim())

  const handleSubmit = async () => {
    if (!selfieAt) {
      setErrorMsg('Capture the verification selfie first.')
      return
    }
    const cleanOtp = otp.trim()
    if (!/^\d{6}$/.test(cleanOtp)) {
      setErrorMsg('Enter the 6-digit verification code provided by the customer.')
      return
    }

    setSubmitting(true)
    setErrorMsg('')
    try {
      await onConfirm?.({
        otp: cleanOtp,
        selfieUrl: selfieAt,
        location: `${booking?.address || booking?.location?.addressLine || ''}`.trim(),
        notes: '',
        capturedAt: new Date().toISOString(),
      })
      onClose?.()
    } catch (err) {
      setErrorMsg(err.message || 'Verification failed. Please check the code with customer.')
    } finally {
      setSubmitting(false)
    }
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
          <Button
            type="submit"
            form="checkinout-form"
            disabled={!canSubmit}
            loading={submitting}
            icon={Check}
          >
            {isCheckIn ? 'Verify & start service' : 'Verify & complete service'}
          </Button>
        </div>
      }
    >
      <form
        id="checkinout-form"
        onSubmit={(event) => {
          event.preventDefault()
          handleSubmit()
        }}
        className="space-y-5"
      >
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
            Step 2 — 6-digit verification code
          </div>
          <p className="mt-1 text-xs text-muted">
            Ask the customer for the 6-digit OTP displayed on their visit pass.
          </p>
          <div className="mt-3">
            <FormField error={errorMsg}>
              <Input
                value={otp}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 6)
                  setOtp(val)
                  setErrorMsg('')
                }}
                maxLength={6}
                inputMode="numeric"
                className="font-mono text-center text-lg tracking-widest"
                placeholder="• • • • • •"
              />
            </FormField>
          </div>
        </div>

        {booking?.address ? (
          <div className="flex items-start gap-2 text-xs text-muted">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary-600" />
            <span>Location on file: {booking.address}</span>
          </div>
        ) : null}
      </form>
    </Modal>
  )
}

export default CheckInOutModal
