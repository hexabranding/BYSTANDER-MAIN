import { useState } from 'react'
import { Siren } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog'
import { useData } from '@/context/DataContext'
import { useAuth } from '@/context/AuthContext'

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
  const { createSos } = useData()
  const [open, setOpen] = useState(false)
  const [sending, setSending] = useState(false)

  const handleTrigger = async () => {
    setSending(true)
    const location = await captureLocation()
    const alert = createSos({
      bookingId: bookingId || '—',
      raisedBy: user?.name || 'User',
      userType: user?.role === 'caregiver' ? 'Caregiver' : 'Customer',
      caregiver: user?.role === 'caregiver' ? user?.name : 'Assigned caregiver',
      location,
      summary: `SOS raised by ${user?.name || 'user'}${bookingId ? ` from booking ${bookingId}` : ''}. Operations desk and emergency contact notified.`,
    })
    setSending(false)
    setOpen(false)
    toast.success(`SOS ${alert.id} raised — operations desk and your emergency contact have been notified.`)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ||
          'fixed right-4 bottom-20 z-40 inline-flex items-center gap-2 rounded-full bg-danger-600 px-4 py-3 text-sm font-bold text-white shadow-[0_14px_30px_-10px_rgba(220,38,38,0.8)] transition hover:scale-105 hover:bg-danger-700 sm:right-6 sm:bottom-6'
        }
        aria-label="Raise SOS emergency alert"
      >
        <Siren className="h-4 w-4" />
        SOS
      </button>

      <ConfirmationDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={handleTrigger}
        tone="danger"
        loading={sending}
        title="Raise an emergency SOS?"
        message="This alerts our 24×7 operations desk, notifies your emergency contact and captures your live location. Only use this in a genuine emergency."
        confirmLabel={sending ? 'Sending…' : 'Yes, raise SOS'}
      />
    </>
  )
}

export default SosButton
