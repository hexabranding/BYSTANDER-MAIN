import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  AlertCircle,
  Camera,
  Check,
  Clock,
  MapPin,
  QrCode,
  RefreshCw,
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
  const [facingMode, setFacingMode] = useState('user')
  const [isFaceAligned, setIsFaceAligned] = useState(false)
  const [faceDetectionFeedback, setFaceDetectionFeedback] = useState('Position your face in the oval')
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
    setIsFaceAligned(false)
    setFaceDetectionFeedback('Position your face in the oval')
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
    setIsFaceAligned(false)
    setFaceDetectionFeedback('Position your face in the oval')
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

  // Real-time KYC biometric face detection loop
  useEffect(() => {
    if (!cameraActive) {
      setIsFaceAligned(false)
      return
    }

    let isMounted = true
    let animationId = null
    const canvas = document.createElement('canvas')
    canvas.width = 120
    canvas.height = 90
    const ctx = canvas.getContext('2d', { willReadFrequently: true })

    let nativeDetector = null
    if (typeof window !== 'undefined' && 'FaceDetector' in window) {
      try {
        nativeDetector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 2 })
      } catch (_) {}
    }

    let consecutiveHits = 0
    let lastScanTime = 0

    const scanFace = async (time) => {
      if (!isMounted) return

      // Run detection scan at ~8 FPS (every 125ms) for maximum responsiveness with negligible CPU
      if (time - lastScanTime > 125 && videoRef.current) {
        lastScanTime = time
        const video = videoRef.current

        if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
          let detected = false
          let message = 'Position your face in the oval'

          // Method 1: Hardware-accelerated browser Shape Detection API if present
          if (nativeDetector) {
            try {
              const faces = await nativeDetector.detect(video)
              if (faces && faces.length > 0) {
                const face = faces[0].boundingBox
                const vW = video.videoWidth
                const vH = video.videoHeight
                const faceCenterX = face.x + face.width / 2
                const faceCenterY = face.y + face.height / 2
                const widthRatio = face.width / vW

                const isCentered =
                  faceCenterX > vW * 0.28 &&
                  faceCenterX < vW * 0.72 &&
                  faceCenterY > vH * 0.16 &&
                  faceCenterY < vH * 0.78
                const isProperDistance = widthRatio >= 0.15 && widthRatio <= 0.75

                if (isCentered && isProperDistance) {
                  detected = true
                  message = 'Face aligned • Ready to capture'
                } else if (!isCentered) {
                  message = 'Center your face inside the oval'
                } else {
                  message = widthRatio < 0.15 ? 'Move slightly closer' : 'Move slightly back'
                }
              }
            } catch (_) {}
          }

          // Method 2: Biometric Skin & Facial Geometry Analyzer (Universal fallback)
          if (!detected && ctx) {
            ctx.drawImage(video, 0, 0, 120, 90)
            const imgData = ctx.getImageData(0, 0, 120, 90).data
            const w = 120
            const h = 90
            const cx = w * 0.5
            const cy = h * 0.465
            const rx = w * 0.19
            const ry = h * 0.445

            let ovalTotal = 0
            let ovalSkin = 0
            let leftSkin = 0
            let rightSkin = 0
            let outerTotal = 0
            let outerSkin = 0

            for (let y = 0; y < h; y += 2) {
              for (let x = 0; x < w; x += 2) {
                const idx = (y * w + x) * 4
                const r = imgData[idx]
                const g = imgData[idx + 1]
                const b = imgData[idx + 2]

                // Robust multi-complexion chrominance filter
                const Y = 0.299 * r + 0.587 * g + 0.114 * b
                const Cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b
                const Cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b

                const isSkin =
                  (Cr >= 133 && Cr <= 175 && Cb >= 75 && Cb <= 130 && Y >= 30) ||
                  (r > g && r - g >= 14 && r / (r + g + b || 1) >= 0.35 && Y >= 30)

                const dx = (x - cx) / rx
                const dy = (y - cy) / ry
                const insideOval = dx * dx + dy * dy <= 1.0

                if (insideOval) {
                  ovalTotal++
                  if (isSkin) {
                    ovalSkin++
                    if (x < cx) leftSkin++
                    else rightSkin++
                  }
                } else {
                  outerTotal++
                  if (isSkin) outerSkin++
                }
              }
            }

            const skinRatio = ovalSkin / (ovalTotal || 1)
            const symmetry = Math.min(leftSkin, rightSkin) / (Math.max(leftSkin, rightSkin) || 1)
            const outerSkinRatio = outerSkin / (outerTotal || 1)

            // Centered human face requires >= 20% skin coverage in oval, bilateral symmetry >= 0.52, and central prominence
            if (skinRatio >= 0.20 && skinRatio <= 0.85 && symmetry >= 0.52 && skinRatio > outerSkinRatio * 1.05) {
              detected = true
              message = 'Face aligned • Ready to capture'
            } else if (skinRatio < 0.20) {
              message = 'Position your face in the oval'
            } else {
              message = 'Center your face in the oval'
            }
          }

          // Temporal debounce filter (prevents flicker)
          if (detected) {
            consecutiveHits = Math.min(4, consecutiveHits + 1)
          } else {
            consecutiveHits = Math.max(0, consecutiveHits - 1)
          }

          const isConfirmed = consecutiveHits >= 2
          setIsFaceAligned(isConfirmed)
          setFaceDetectionFeedback(isConfirmed ? 'Face aligned • Ready to capture' : message)
        }
      }

      if (isMounted) {
        animationId = requestAnimationFrame(scanFace)
      }
    }

    animationId = requestAnimationFrame(scanFace)

    return () => {
      isMounted = false
      if (animationId) cancelAnimationFrame(animationId)
    }
  }, [cameraActive])

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
      console.error('[CheckInOutModal] Verification failed:', err)
      const message = err?.message || 'Verification failed. Please check the code with customer.'
      setErrorMsg(message)
      toast.error('Verification failed', { description: message })
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
            onClick={(e) => {
              e.preventDefault()
              handleSubmit()
            }}
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
            /* State B: Live Camera Stream View with KYC Oval & Face Detection */
            <div className="space-y-3 text-center">
              {cameraWarning ? (
                <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-left text-xs text-amber-200 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold">{cameraWarning}</p>
                    <p className="text-[11px] text-amber-300/80">
                      If WhatsApp, FaceTime, or another tab is open, macOS blocks camera frames to other apps. Close them and reopen camera.
                    </p>
                  </div>
                </div>
              ) : null}

              <div className="relative overflow-hidden rounded-2xl bg-slate-950 aspect-video flex items-center justify-center shadow-inner select-none">
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
                  className="rounded-2xl block"
                />

                {/* KYC Biometric Vertical Oval Face Overlay */}
                <svg
                  className="absolute inset-0 w-full h-full pointer-events-none z-10"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                >
                  <defs>
                    <mask id="kyc-face-mask">
                      <rect width="100" height="100" fill="white" />
                      <ellipse cx="50" cy="46.5" rx="19" ry="44.5" fill="black" />
                    </mask>
                  </defs>

                  {/* Darkened vignette around outside of the vertical oval */}
                  <rect
                    width="100"
                    height="100"
                    fill="rgba(15, 23, 42, 0.58)"
                    mask="url(#kyc-face-mask)"
                  />

                  {/* Dynamic Vertical Oval Border: Red when unaligned, Green when face aligned */}
                  <ellipse
                    cx="50"
                    cy="46.5"
                    rx="19"
                    ry="44.5"
                    fill="none"
                    stroke={isFaceAligned ? '#10b981' : '#ef4444'}
                    strokeWidth={isFaceAligned ? '1.5' : '1.2'}
                    strokeDasharray={isFaceAligned ? 'none' : '3 1.5'}
                    className="transition-all duration-300"
                    style={{
                      filter: isFaceAligned
                        ? 'drop-shadow(0 0 8px rgba(16, 185, 129, 0.95))'
                        : 'drop-shadow(0 0 6px rgba(239, 68, 68, 0.75))',
                    }}
                  />
                </svg>

                {/* Top Badge: Live Indicator */}
                <div className="absolute top-2.5 left-2.5 rounded-full bg-black/75 px-3 py-1 text-xs font-semibold text-white flex items-center gap-1.5 backdrop-blur-md z-20 shadow-sm select-none">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Live</span>
                </div>

                {/* Real-time KYC Feedback Pill */}
                <div className="absolute bottom-3 inset-x-0 flex justify-center z-20 pointer-events-none px-4">
                  <div
                    className={cn(
                      'inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-semibold backdrop-blur-md transition-all duration-300 shadow-md',
                      isFaceAligned
                        ? 'bg-emerald-600/90 text-white shadow-emerald-500/40 ring-1 ring-emerald-400/50'
                        : 'bg-red-600/90 text-white shadow-red-500/30 ring-1 ring-red-400/40'
                    )}
                  >
                    <span
                      className={cn(
                        'h-2 w-2 rounded-full',
                        isFaceAligned ? 'bg-white animate-ping' : 'bg-white'
                      )}
                    />
                    <span>{faceDetectionFeedback}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-center gap-3 pt-1">
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={snapPhoto}
                  disabled={!isFaceAligned}
                  icon={Camera}
                  className={cn(
                    'font-bold px-6 transition-all duration-200',
                    isFaceAligned
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/25 ring-2 ring-emerald-400/40'
                      : 'bg-slate-700 text-slate-400 border border-slate-600 cursor-not-allowed opacity-60'
                  )}
                  title={isFaceAligned ? 'Capture verification selfie' : 'Align your face in the oval to enable photo capture'}
                >
                  Take Photo Now
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

          {errorMsg ? (
            <div className="mt-3 rounded-xl border border-danger-200 bg-danger-50 p-3 text-xs font-semibold text-danger-700 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-danger-500 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          ) : null}

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
