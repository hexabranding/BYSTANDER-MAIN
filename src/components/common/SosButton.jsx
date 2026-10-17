import { useState } from 'react'
import { CheckCircle2, MapPin, Phone, Siren, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog'
import { Modal } from '@/components/common/Modal'
import { Button } from '@/components/common/Button'
import { StatusBadge } from '@/components/common/StatusBadge'
import { useData } from '@/context/DataContext'
import { useAuth } from '@/context/AuthContext'
import { formatDateTime } from '@/utils/format'

const DEMO_COORDS = { lat: 19.076, lng: 72.8777 }

function captureLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ label: 'Location unavailable — demo coordinates', ...DEMO_COORDS })
      return
    }
    const timer = setTimeout(() => {
      resolve({ label: 'Location capture timed out — demo coordinates', ...DEMO_COORDS })
    }, 4000)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timer)
        resolve({
          label: 'Live location captured',
          lat: Number(pos.coords.latitude.toFixed(4)),
          lng: Number(pos.coords.longitude.toFixed(4)),
        })
      },
      () => {
        clearTimeout(timer)
        resolve({ label: 'Location permission denied — demo coordinates', ...DEMO_COORDS })
      },
      { timeout: 3500, maximumAge: 60000 },
    )
  })
}

export function SosButton({ bookingId, className }) {
  const { user } = useAuth()
  const { createSos, sos } = useData()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const [activeId, setActiveId] = useState(null)
  const [sending, setSending] = useState(false)

  const raisedByMe = sos.filter((alert) => alert.raisedBy === user?.name)
  const openAlert = raisedByMe.find((alert) => alert.status === 'Open' || alert.status === 'Under Investigation')
  const active = raisedByMe.find((alert) => alert.id === activeId) || openAlert || raisedByMe[0] || null

  const handleOpen = () => {
    if (openAlert) {
      setActiveId(openAlert.id)
      setStatusOpen(true)
      return
    }
    setConfirmOpen(true)
  }

  const handleTrigger = async () => {
    setSending(true)
    const location = await captureLocation()
    const alert = createSos({
      bookingId: bookingId || '—',
      raisedBy: user?.name || 'User',
      userType: user?.role === 'caregiver' ? 'Caretaker' : 'Customer',
      caregiver: user?.role === 'caregiver' ? user?.name : 'Assigned caretaker',
      location,
      summary: `SOS raised by ${user?.name || 'user'}${bookingId ? ` from booking ${bookingId}` : ''}. Operations desk and emergency contact notified.`,
    })
    setSending(false)
    setConfirmOpen(false)
    setActiveId(alert.id)
    setStatusOpen(true)
    toast.success(`SOS ${alert.id} raised — operations desk and your emergency contact have been notified.`)
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className={
          className ||
          'fixed right-4 bottom-20 z-40 inline-flex items-center gap-2 rounded-full bg-danger-600 px-4 py-3 text-sm font-bold text-white shadow-[0_14px_30px_-10px_rgba(220,38,38,0.8)] transition hover:scale-105 hover:bg-danger-700 sm:right-6 sm:bottom-6'
        }
        aria-label={openAlert ? 'View SOS status' : 'Raise SOS emergency alert'}
      >
        <Siren className="h-4 w-4" />
        SOS
        {openAlert ? (
          <span className="absolute -top-1 -right-1 h-3 w-3 animate-ping rounded-full bg-white" aria-hidden="true" />
        ) : null}
      </button>

      <ConfirmationDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleTrigger}
        tone="danger"
        loading={sending}
        title="Raise an emergency SOS?"
        message="This alerts our 24×7 operations desk, notifies your emergency contact and captures your live location. Only use this in a genuine emergency."
        confirmLabel={sending ? 'Sending…' : 'Yes, raise SOS'}
      />

      <Modal
        open={statusOpen}
        onClose={() => setStatusOpen(false)}
        title="SOS status"
        subtitle={active ? `Alert ${active.id}` : 'No alert raised yet'}
        size="lg"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setStatusOpen(false)}>
              Close
            </Button>
            {!openAlert ? (
              <Button
                variant="outline"
                icon={Phone}
                onClick={() => toast.success('Connecting you to the CareMate care helpline', { description: '+91 22 4890 1100 — demo, no call is placed.' })}
              >
                Call care helpline
              </Button>
            ) : null}
          </div>
        }
      >
        {active ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger-200 bg-danger-50 px-4 py-3">
              <div className="flex items-center gap-2.5">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-danger-600 text-white">
                  <ShieldAlert className="h-4.5 w-4.5" />
                </span>
                <div>
                  <p className="text-sm font-bold text-danger-700">
                    {active.status === 'Resolved' ? 'Alert resolved' : 'Alert active — desk is engaged'}
                  </p>
                  <p className="text-xs text-danger-600">Raised {formatDateTime(active.reportedAt)}</p>
                </div>
              </div>
              <StatusBadge status={active.status === 'Resolved' ? 'Completed' : 'Critical'} size="sm" dot={false} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-line bg-slate-50 p-3.5">
                <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-faint">
                  <MapPin className="h-3.5 w-3.5" /> Location
                </p>
                <p className="mt-1.5 text-sm font-semibold text-ink">
                  {active.location?.label || 'Location unavailable'}
                </p>
                <p className="text-xs tabular-nums text-muted">
                  {active.location?.lat ?? '—'}, {active.location?.lng ?? '—'}
                </p>
              </div>
              <div className="rounded-xl border border-line bg-slate-50 p-3.5">
                <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-faint">
                  <Siren className="h-3.5 w-3.5" /> Linked booking
                </p>
                <p className="mt-1.5 text-sm font-semibold text-ink">{active.bookingId || '—'}</p>
                <p className="text-xs text-muted">Emergency contact notified: yes</p>
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-faint">Escalation timeline</p>
              <ol className="mt-2 space-y-2.5 border-l-2 border-line pl-4">
                {(active.timeline || []).map((entry, index) => (
                  <li key={`${entry.at}-${index}`} className="relative">
                    <span
                      className="absolute -left-[22px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-white"
                      style={{ background: index === (active.timeline.length - 1) ? '#0F766E' : '#94A3B8' }}
                      aria-hidden="true"
                    />
                    <p className="text-sm font-semibold text-ink">{entry.action}</p>
                    <p className="text-xs text-muted">
                      {formatDateTime(entry.at)} · {entry.by}
                    </p>
                  </li>
                ))}
              </ol>
            </div>

            <p className="flex items-start gap-2 rounded-xl bg-mint-50 px-3.5 py-3 text-xs leading-relaxed text-primary-900">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary-700" />
              Stay on this screen until the operations desk confirms. This is a frontend demo — no emergency service
              is actually contacted.
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted">No SOS alert has been raised from this device.</p>
        )}
      </Modal>
    </>
  )
}

export default SosButton
