import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, AlertTriangle, CheckCircle2, MapPin, Phone, Siren, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog'
import { Modal } from '@/components/common/Modal'
import { Button } from '@/components/common/Button'
import { StatusBadge } from '@/components/common/StatusBadge'
import { useAuth } from '@/context/AuthContext'
import { useData } from '@/context/DataContext'
import { formatDateTime } from '@/utils/format'
import { sosService, bookingService, isMongoObjectId } from '@/services'

/**
 * Captures live browser GPS coordinates if granted.
 * In strict adherence to security rules, NEVER invents or fabricates coordinates.
 */
function captureLocation() {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve({
        isAvailable: false,
        label: 'Location unavailable in this browser',
        latitude: null,
        longitude: null,
        accuracy: null,
      })
      return
    }

    const timer = setTimeout(() => {
      resolve({
        isAvailable: false,
        label: 'Location capture timed out — coordinates omitted',
        latitude: null,
        longitude: null,
        accuracy: null,
      })
    }, 4000)

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timer)
        resolve({
          isAvailable: true,
          label: 'Live device location captured',
          latitude: Number(pos.coords.latitude.toFixed(5)),
          longitude: Number(pos.coords.longitude.toFixed(5)),
          accuracy: pos.coords.accuracy ? Number(pos.coords.accuracy.toFixed(1)) : null,
        })
      },
      () => {
        clearTimeout(timer)
        resolve({
          isAvailable: false,
          label: 'Location permission denied — coordinates omitted',
          latitude: null,
          longitude: null,
          accuracy: null,
        })
      },
      { timeout: 3500, maximumAge: 60000 },
    )
  })
}

export function SosButton({ bookingId: explicitBookingId, className }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { sos: localSosList, createSos: localCreateSos } = useData()

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [noBookingOpen, setNoBookingOpen] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [activeAlert, setActiveAlert] = useState(null)
  const [resolvedBookingId, setResolvedBookingId] = useState(explicitBookingId || null)

  // Fetch open SOS incidents for current user
  const refreshActiveSos = useCallback(async () => {
    if (!user) return
    try {
      const res = await sosService.getSosIncidents({ limit: 5 })
      const list = res.incidents || []
      const open = list.find((i) => i.status === 'Open' || i.status === 'Under Investigation')
      if (open) {
        setActiveAlert(open)
      } else if (list.length > 0 && !activeAlert) {
        setActiveAlert(list[0])
      }
    } catch {
      // In case of unauthenticated or network error, fallback to local store if present
      if (Array.isArray(localSosList) && localSosList.length > 0) {
        const raisedByMe = localSosList.filter((s) => s.raisedBy === user?.name)
        const open = raisedByMe.find((s) => s.status === 'Open' || s.status === 'Under Investigation')
        if (open) setActiveAlert(open)
      }
    }
  }, [user, localSosList, activeAlert])

  useEffect(() => {
    refreshActiveSos()
  }, [refreshActiveSos])

  const handleOpen = async () => {
    // If there is an active/open alert, show status dialog immediately
    if (activeAlert && (activeAlert.status === 'Open' || activeAlert.status === 'Under Investigation')) {
      setStatusOpen(true)
      return
    }

    // Determine bookingId: check explicit prop, or fetch caller's ongoing/active bookings
    let targetBookingId = explicitBookingId
    if (!targetBookingId || !isMongoObjectId(targetBookingId)) {
      try {
        const bookingsRes = await bookingService.getBookings({ limit: 10 })
        const activeBookings = (bookingsRes.bookings || []).filter(
          (b) => b.status === 'In Progress' || b.status === 'Confirmed' || b.status === 'Pending',
        )
        if (activeBookings.length > 0) {
          targetBookingId = activeBookings[0].id
        }
      } catch {
        // Fallback to checking local mock bookings if unauthenticated
      }
    }

    if (!targetBookingId || !isMongoObjectId(targetBookingId)) {
      // No valid active booking exists — explain requirement safely
      setNoBookingOpen(true)
      return
    }

    setResolvedBookingId(targetBookingId)
    setConfirmOpen(true)
  }

  const handleTrigger = async () => {
    setSending(true)
    try {
      const location = await captureLocation()
      const summary = `Emergency SOS raised by ${user?.name || user?.role || 'user'}. Urgent assistance requested.`

      const incident = await sosService.raiseSos({
        bookingId: resolvedBookingId,
        summary,
        priority: 'Critical',
        location,
      })

      setActiveAlert(incident)
      setConfirmOpen(false)
      setStatusOpen(true)
      toast.success(`SOS incident ${incident.incidentNumber} raised`, {
        description: 'Operations desk alerted. External telephony/SMS dispatch is not configured.',
      })

      // Sync local context for backward compatibility
      if (typeof localCreateSos === 'function') {
        localCreateSos({
          id: incident.incidentNumber,
          bookingId: resolvedBookingId,
          raisedBy: user?.name || 'User',
          summary,
          location,
        })
      }
    } catch (err) {
      toast.error(err.message || 'Failed to raise SOS emergency alert')
    } finally {
      setSending(false)
    }
  }

  const hasOpenAlert = activeAlert && (activeAlert.status === 'Open' || activeAlert.status === 'Under Investigation')

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className={
          className ||
          'fixed right-4 bottom-20 z-40 inline-flex items-center gap-2 rounded-full bg-danger-600 px-4 py-3 text-sm font-bold text-white shadow-[0_14px_30px_-10px_rgba(220,38,38,0.8)] transition hover:scale-105 hover:bg-danger-700 sm:right-6 sm:bottom-6'
        }
        aria-label={hasOpenAlert ? 'View active SOS incident status' : 'Raise SOS emergency alert'}
      >
        <Siren className="h-4 w-4" />
        SOS
        {hasOpenAlert ? (
          <span className="absolute -top-1 -right-1 h-3 w-3 animate-ping rounded-full bg-white" aria-hidden="true" />
        ) : null}
      </button>

      {/* Confirmation Dialog before raising SOS */}
      <ConfirmationDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleTrigger}
        tone="danger"
        loading={sending}
        title="Raise an emergency SOS?"
        message="This alerts our operations desk and records your incident in the care engagement audit log. Only trigger this for a genuine safety concern or clinical emergency."
        confirmLabel={sending ? 'Raising SOS…' : 'Yes, raise SOS'}
      />

      {/* Dialog when no active booking exists */}
      <Modal
        open={noBookingOpen}
        onClose={() => setNoBookingOpen(false)}
        title="Active booking required for SOS"
        subtitle="SOS emergency alerts are linked to active care engagements"
        size="md"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setNoBookingOpen(false)}>
              Understood
            </Button>
            <Button
              variant="danger"
              icon={Siren}
              onClick={() => {
                setNoBookingOpen(false)
                navigate(user?.role === 'caregiver' ? '/caregiver/ambulances' : '/customer/ambulances')
              }}
            >
              Call Local Ambulance
            </Button>
          </div>
        }
      >
        <div className="space-y-4 py-2">
          <div className="flex items-start gap-3 rounded-xl border border-warning-200 bg-warning-50 p-4 text-warning-900">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning-700" />
            <div className="text-sm">
              <p className="font-bold">No active care booking found</p>
              <p className="mt-1 leading-relaxed text-warning-800">
                In-app SOS alerts require an active booking with an assigned caretaker so operations can identify the participants and location.
              </p>
            </div>
          </div>
          <div className="rounded-xl border border-line bg-slate-50 p-4 text-xs text-muted">
            <p className="font-semibold text-ink">Need immediate emergency response?</p>
            <p className="mt-1">
              For life-threatening medical emergencies or immediate police assistance in India, please dial <strong>112</strong> directly or call a registered ambulance driver nearby.
            </p>
          </div>
        </div>
      </Modal>

      {/* Incident Status Modal */}
      <Modal
        open={statusOpen}
        onClose={() => setStatusOpen(false)}
        title="SOS Emergency Status"
        subtitle={activeAlert ? `Incident ${activeAlert.incidentNumber || activeAlert.id}` : 'No alert raised yet'}
        size="lg"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setStatusOpen(false)}>
              Close
            </Button>
            <Button
              variant="outline"
              icon={Phone}
              onClick={() => toast.info('Care helpline simulated (+91 22 4890 1100). Telephony integration not configured.')}
            >
              Helpline info
            </Button>
            <Button
              variant="danger"
              icon={Siren}
              onClick={() => {
                setStatusOpen(false)
                navigate(user?.role === 'caregiver' ? '/caregiver/ambulances' : '/customer/ambulances')
              }}
            >
              Call Local Ambulance
            </Button>
          </div>
        }
      >
        {activeAlert ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger-200 bg-danger-50 px-4 py-3">
              <div className="flex items-center gap-2.5">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-danger-600 text-white">
                  <ShieldAlert className="h-4.5 w-4.5" />
                </span>
                <div>
                  <p className="text-sm font-bold text-danger-700">
                    {activeAlert.status === 'Resolved'
                      ? 'Incident Resolved'
                      : activeAlert.status === 'Under Investigation'
                      ? 'Under Investigation — Operations Desk Engaged'
                      : 'Incident Active — Operations Desk Alerted'}
                  </p>
                  <p className="text-xs text-danger-600">
                    Reported {formatDateTime(activeAlert.reportedAt || activeAlert.createdAt)}
                  </p>
                </div>
              </div>
              <StatusBadge
                status={activeAlert.status === 'Resolved' ? 'Completed' : 'Critical'}
                size="sm"
                dot={false}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-line bg-slate-50 p-3.5">
                <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-faint">
                  <MapPin className="h-3.5 w-3.5" /> Location
                </p>
                <p className="mt-1.5 text-sm font-semibold text-ink">
                  {activeAlert.location?.label || 'Location not shared'}
                </p>
                <p className="text-xs tabular-nums text-muted">
                  {activeAlert.location?.latitude && activeAlert.location?.longitude
                    ? `${activeAlert.location.latitude}, ${activeAlert.location.longitude}`
                    : 'Coordinates omitted (permission denied or unavailable)'}
                </p>
              </div>

              <div className="rounded-xl border border-line bg-slate-50 p-3.5">
                <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-faint">
                  <Siren className="h-3.5 w-3.5" /> External Dispatch Status
                </p>
                <p className="mt-1.5 text-sm font-semibold text-ink">
                  {activeAlert.emergencyContactNotification?.status === 'not_configured'
                    ? 'Not Configured (In-App Only)'
                    : activeAlert.emergencyContactNotification?.status || 'Not Configured'}
                </p>
                <p className="text-xs text-muted">
                  {activeAlert.emergencyContactNotification?.notes ||
                    'Automated telephony/SMS emergency dispatch provider is not configured in this environment.'}
                </p>
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-faint">Audit timeline</p>
              <ol className="mt-2 space-y-2.5 border-l-2 border-line pl-4">
                {(activeAlert.timeline || []).map((entry, index) => (
                  <li key={`${entry.at || entry.id}-${index}`} className="relative">
                    <span
                      className="absolute -left-[22px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-white"
                      style={{
                        background:
                          index === (activeAlert.timeline.length - 1) ? '#0F766E' : '#94A3B8',
                      }}
                      aria-hidden="true"
                    />
                    <p className="text-sm font-semibold text-ink">{entry.action}</p>
                    <p className="text-xs text-muted">
                      {formatDateTime(entry.at)} · {entry.by} {entry.notes ? `— ${entry.notes}` : ''}
                    </p>
                  </li>
                ))}
              </ol>
            </div>

            <div className="flex items-start gap-2.5 rounded-xl border border-line bg-slate-50 px-3.5 py-3 text-xs leading-relaxed text-muted">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-faint" />
              <p>
                This incident is logged in the CareMate operational safety log. External emergency services (e.g., 112)
                are not automatically dispatched. In an immediate life-threatening emergency, always contact local authorities directly.
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted">No active SOS alert has been recorded for this account.</p>
        )}
      </Modal>
    </>
  )
}

export default SosButton
