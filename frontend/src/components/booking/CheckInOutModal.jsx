import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  Camera,
  Check,
  Clock,
  MapPin,
  QrCode,
  RefreshCw,
  SwitchCamera,
  Video,
  X,
} from 'lucide-react'
import { Modal } from '@/components/common/Modal'
import { Button } from '@/components/common/Button'
import { FormField, Input } from '@/components/forms/FormField'
import { cn } from '@/utils/cn'
import { formatDateTime } from '@/utils/format'

export function CheckInOutModal({ open, onClose, mode = 'checkin', booking, onConfirm }) {
  const isCheckIn = mode === 'checkin'
  const [selfieDataUrl, setSelfieDataUrl] = useState(null)
  const [selfieAt, setSelfieAt] = useState(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraStarting, setCameraStarting] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [cameraWarning, setCameraWarning] = useState('')
  const [cameraDeviceName, setCameraDeviceName] = useState('')
  const [facingMode, setFacingMode] = useState('user')
  const [otp, setOtp] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [now, setNow] = useState(() => new Date().toISOString())
  const [submitting, setSubmitting] = useState(false)

  const videoRef = useRef(null)
  const streamRef = useRef(null)

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setCameraActive(false)
    setCameraStarting(false)
    setCameraWarning('')
  }, [])

  const attachVideoRef = useCallback((videoEl) => {
    videoRef.current = videoEl
    if (videoEl && streamRef.current) {
      if (videoEl.srcObject !== streamRef.current) {
        videoEl.srcObject = streamRef.current
      }
      videoEl.muted = true
      videoEl.playsInline = true
      const playVideo = () => {
        videoEl.play().catch((err) => {
          console.warn('[CheckInOutModal] Autoplay warning:', err)
        })
      }
      if (videoEl.readyState >= 1) {
        playVideo()
      } else {
        videoEl.addEventListener('loadedmetadata', playVideo, { once: true })
      }
      playVideo()
    }
  }, [])

  const startCamera = async (overrideFacing) => {
    setCameraError('')
    setCameraWarning('')
    setErrorMsg('')
    setCameraStarting(true)
    const targetFacing = overrideFacing || facingMode
    try {
      if (!navigator?.mediaDevices?.getUserMedia) {
        throw new Error(
          'Live camera streaming is not supported on this browser or connection. Please use a modern browser with camera permissions enabled.'
        )
      }
      // Stop any existing stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }
      let stream = null
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: targetFacing ? { ideal: targetFacing } : 'user',
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
          audio: false,
        })
      } catch (modeErr) {
        console.warn('[CheckInOutModal] Facing constraint failed, trying basic video:', modeErr)
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        })
      }

      streamRef.current = stream
      setCameraActive(true)

      const track = stream.getVideoTracks()[0]
      if (track) {
        setCameraDeviceName(track.label || 'FaceTime HD Camera')
        if (track.muted) {
          setCameraWarning('Camera stream is locked or muted by another macOS application (such as WhatsApp). Please close WhatsApp or other camera apps.')
        }
        track.onmute = () => {
          setCameraWarning('Camera stream is locked or muted by another macOS application (such as WhatsApp). Please close WhatsApp or other camera apps.')
        }
        track.onunmute = () => {
          setCameraWarning('')
        }
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.muted = true
        videoRef.current.playsInline = true
        videoRef.current.play().catch(() => {})
      }
    } catch (err) {
      stopCamera()
      setCameraError(
        err?.message ||
          'Unable to access camera. Please allow camera permissions in your browser to capture the live attendance selfie.'
      )
    } finally {
      setCameraStarting(false)
    }
  }

  const toggleFacing = () => {
    const nextFacing = facingMode === 'user' ? 'environment' : 'user'
    setFacingMode(nextFacing)
    startCamera(nextFacing)
  }

  const snapPhoto = () => {
    if (!videoRef.current) return
    const video = videoRef.current
    const canvas = document.createElement('canvas')
    const width = video.videoWidth || 640
    const height = video.videoHeight || 480
    // Target max width 640 for lightweight payload (~50KB)
    const scale = Math.min(1, 640 / width)
    canvas.width = Math.round(width * scale)
    canvas.height = Math.round(height * scale)

    const ctx = canvas.getContext('2d')
    // Mirror horizontally if user/selfie camera so photo orientation is natural
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0)
      ctx.scale(-1, 1)
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    const dataUrl = canvas.toDataURL('image/jpeg', 0.82)
    setSelfieDataUrl(dataUrl)
    setSelfieAt(new Date().toISOString())
    stopCamera()
    setErrorMsg('')
  }

  const retakeSelfie = () => {
    setSelfieDataUrl(null)
    setSelfieAt(null)
    startCamera()
  }

  useEffect(() => {
    if (!open) {
      stopCamera()
      return
    }
    setSelfieDataUrl(null)
    setSelfieAt(null)
    setCameraActive(false)
    setCameraStarting(false)
    setCameraError('')
    setFacingMode('user')
    setOtp('')
    setErrorMsg('')
    setSubmitting(false)
    setNow(new Date().toISOString())

    const timer = setInterval(() => setNow(new Date().toISOString()), 1000)
    return () => {
      clearInterval(timer)
      stopCamera()
    }
  }, [open, stopCamera])

  const canSubmit = Boolean(selfieDataUrl || selfieAt) && /^\d{6}$/.test(otp.trim())

  const handleSubmit = async () => {
    if (!selfieDataUrl && !selfieAt) {
      setErrorMsg('Capture the live attendance selfie first.')
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
        selfieUrl: selfieDataUrl || selfieAt,
        location: `${booking?.address || booking?.location?.addressLine || ''}`.trim(),
        notes: '',
        capturedAt: new Date().toISOString(),
      })
      stopCamera()
      onClose?.()
    } catch (err) {
      setErrorMsg(err.message || 'Verification failed. Please check the code with customer.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    stopCamera()
    onClose?.()
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      size="md"
      title={isCheckIn ? 'Service check-in' : 'Service check-out'}
      subtitle={
        booking
          ? `${booking.id} · ${booking.service} · ${booking.patient?.name || booking.patientName || 'Patient'}`
          : 'Identity verification'
      }
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={handleClose}>
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

        {/* Step 1: Real Selfie Camera Capture Card */}
        <div
          className={cn(
            'rounded-card border p-4 transition-all',
            selfieDataUrl
              ? 'border-success-500/80 bg-success-50/50'
              : cameraActive
                ? 'border-primary-500 bg-slate-900 text-white'
                : 'border-line-strong border-dashed bg-canvas text-center'
          )}
        >
          {/* State A: Photo captured successfully */}
          {selfieDataUrl ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-success-700">
                  <Check className="h-4 w-4" />
                  Selfie Captured
                </span>
                <span className="text-[11px] text-muted">{formatDateTime(selfieAt)}</span>
              </div>
              <div className="relative overflow-hidden rounded-xl border border-success-200 bg-black/5 shadow-xs flex justify-center">
                <img
                  src={selfieDataUrl}
                  alt="Attendance verification selfie"
                  className="max-h-56 w-auto object-cover rounded-xl"
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={retakeSelfie}
                  icon={RefreshCw}
                >
                  Retake photo
                </Button>
              </div>
            </div>
          ) : cameraActive ? (
            /* State B: Live Camera Stream View */
            <div className="space-y-3 text-center">
              {cameraWarning ? (
                <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-left text-xs text-amber-200 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold">{cameraWarning}</p>
                    <p className="text-[11px] text-amber-300/80">
                      If WhatsApp, FaceTime, or another tab is open, macOS blocks camera frames to other apps. Close them and click Reload Feed.
                    </p>
                  </div>
                </div>
              ) : null}

              <div className="relative overflow-hidden rounded-xl bg-slate-950 aspect-video flex items-center justify-center shadow-inner">
                <video
                  ref={attachVideoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    transform: facingMode === 'user' ? 'scaleX(-1)' : 'none',
                  }}
                  className="rounded-xl block"
                />

                <div className="absolute top-2 left-2 rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-semibold text-white flex items-center gap-1.5 backdrop-blur-xs z-10">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  {cameraDeviceName || 'Live On-Site Camera'}
                </div>

                <button
                  type="button"
                  onClick={toggleFacing}
                  title="Switch camera (Front / Rear)"
                  className="absolute top-2 right-2 rounded-full bg-black/60 p-2 text-white hover:bg-black/80 transition-colors z-10"
                >
                  <SwitchCamera className="h-4 w-4" />
                </button>
              </div>

              <div className="flex items-center justify-center gap-3 pt-1">
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={snapPhoto}
                  icon={Camera}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-md font-bold px-6"
                >
                  Take Photo Now
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => startCamera()}
                  icon={RefreshCw}
                  className="border-slate-700 text-slate-300 hover:bg-white/10"
                >
                  Reload Feed
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={stopCamera}
                  className="text-slate-300 hover:text-white hover:bg-white/10"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            /* State C: Initial state — prompt to take live photo */
            <div className="py-2">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white text-primary-700 shadow-card">
                <Camera className="h-6 w-6" />
              </span>
              <p className="mt-3 text-sm font-bold text-ink">
                Step 1 — Attendance Selfie Verification
              </p>
              <p className="mt-1 text-xs text-muted max-w-sm mx-auto">
                Caretakers must capture a live photo on site right now. Gallery uploads and saved photos are disabled to prevent fraud.
              </p>

              {cameraError ? (
                <div className="mt-2.5 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-left text-xs text-amber-800 flex items-start gap-1.5">
                  <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                  <span>{cameraError}</span>
                </div>
              ) : null}

              <div className="mt-4 flex items-center justify-center gap-2">
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => startCamera()}
                  loading={cameraStarting}
                  icon={Camera}
                  className="font-semibold shadow-xs px-5"
                >
                  {cameraStarting ? 'Connecting Camera...' : 'Open Camera'}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Step 2: Customer 6-Digit OTP Verification */}
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
