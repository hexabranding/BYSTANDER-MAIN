import { useEffect, useState } from 'react'
import { Save, Siren, Phone, Car, Building2, MapPin, Wind, Activity, Bed } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/context/AuthContext'
import { useDocumentTitle } from '@/hooks/useUi'
import { CITIES } from '@/utils/constants'
import { Card, CardBody, CardHeader } from '@/components/common/Card'
import { Button } from '@/components/common/Button'
import { FormField, Input, Select } from '@/components/forms/FormField'
import { PageHeader } from '@/components/common/PageHeader'
import { getAmbulanceProfile, updateAmbulanceProfile } from '@/services/ambulanceService'

const AMBULANCE_TYPES = [
  'Basic Life Support (BLS)',
  'Advanced Life Support (ALS)',
  'ICU on Wheels',
  'Patient Transport',
]

export function AmbulanceProfilePage() {
  useDocumentTitle('Driver & Vehicle Profile · Bystander')
  const { user } = useAuth()

  const [form, setForm] = useState({
    driverName: user?.fullName || user?.name || '',
    phone: user?.phone || '',
    alternatePhone: '',
    vehicleNumber: '',
    ambulanceType: 'Basic Life Support (BLS)',
    city: user?.city || 'Mumbai',
    area: '',
    baseHospital: '',
    oxygenFitted: true,
    ventilatorFitted: false,
    stretcherAvailable: true,
    notes: '',
  })

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getAmbulanceProfile()
      .then((data) => {
        if (data) {
          setForm({
            driverName: data.driverName || user?.fullName || user?.name || '',
            phone: data.phone || user?.phone || '',
            alternatePhone: data.alternatePhone || '',
            vehicleNumber: data.vehicleNumber || '',
            ambulanceType: data.ambulanceType || 'Basic Life Support (BLS)',
            city: data.city || user?.city || 'Mumbai',
            area: data.area || '',
            baseHospital: data.baseHospital || '',
            oxygenFitted: data.oxygenFitted ?? true,
            ventilatorFitted: data.ventilatorFitted ?? false,
            stretcherAvailable: data.stretcherAvailable ?? true,
            notes: data.notes || '',
          })
        }
      })
      .catch(() => {
        setForm((prev) => ({
          ...prev,
          driverName: prev.driverName || user?.fullName || user?.name || '',
          phone: prev.phone || user?.phone || '',
        }))
      })
      .finally(() => setLoading(false))
  }, [user])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const updated = await updateAmbulanceProfile(form)
      if (updated) {
        setForm((prev) => ({
          ...prev,
          ...updated,
        }))
      }
      toast.success('Ambulance profile updated successfully!')
    } catch (err) {
      toast.error(err?.message || 'Failed to update profile.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ambulance & Driver Profile"
        subtitle="Keep your vehicle details and emergency contact numbers accurate for dispatch."
      />

      <Card>
        <CardBody className="p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Driver full name" required>
                <Input
                  value={form.driverName}
                  onChange={(e) => setForm({ ...form, driverName: e.target.value })}
                />
              </FormField>

              <FormField label="Emergency hotline phone" required>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </FormField>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Alternate phone">
                <Input
                  value={form.alternatePhone}
                  onChange={(e) => setForm({ ...form, alternatePhone: e.target.value })}
                />
              </FormField>

              <FormField label="Vehicle registration plate" required>
                <Input
                  value={form.vehicleNumber}
                  onChange={(e) => setForm({ ...form, vehicleNumber: e.target.value.toUpperCase() })}
                />
              </FormField>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Ambulance category" required>
                <Select
                  value={form.ambulanceType}
                  onChange={(e) => setForm({ ...form, ambulanceType: e.target.value })}
                >
                  {AMBULANCE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField label="Operational city" required>
                <Select value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })}>
                  {CITIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Base hospital / Trauma center">
                <Input
                  value={form.baseHospital}
                  onChange={(e) => setForm({ ...form, baseHospital: e.target.value })}
                />
              </FormField>

              <FormField label="Area / Locality">
                <Input
                  value={form.area}
                  onChange={(e) => setForm({ ...form, area: e.target.value })}
                />
              </FormField>
            </div>

            {/* Installed Equipment */}
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-faint">
                Installed Medical Equipment
              </label>
              <div className="grid grid-cols-3 gap-3">
                <label className="flex items-center gap-2 rounded-xl border border-line p-3 text-xs font-semibold cursor-pointer hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={form.oxygenFitted}
                    onChange={(e) => setForm({ ...form, oxygenFitted: e.target.checked })}
                    className="rounded text-red-600 focus:ring-red-500"
                  />
                  Oxygen Fitted
                </label>

                <label className="flex items-center gap-2 rounded-xl border border-line p-3 text-xs font-semibold cursor-pointer hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={form.ventilatorFitted}
                    onChange={(e) => setForm({ ...form, ventilatorFitted: e.target.checked })}
                    className="rounded text-red-600 focus:ring-red-500"
                  />
                  Transport Ventilator
                </label>

                <label className="flex items-center gap-2 rounded-xl border border-line p-3 text-xs font-semibold cursor-pointer hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={form.stretcherAvailable}
                    onChange={(e) => setForm({ ...form, stretcherAvailable: e.target.checked })}
                    className="rounded text-red-600 focus:ring-red-500"
                  />
                  Stretcher Bed
                </label>
              </div>
            </div>

            <FormField label="Notes & special capabilities">
              <Input
                placeholder="e.g. 24x7 trauma ready, pediatric support available"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </FormField>

            <div className="flex justify-end pt-2">
              <Button type="submit" loading={saving} icon={Save}>
                Save Changes
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  )
}

export default AmbulanceProfilePage
