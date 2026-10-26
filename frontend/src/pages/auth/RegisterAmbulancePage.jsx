import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Siren, ArrowRight, ShieldCheck, Check, Car, Phone, Lock, User, Building2, MapPin } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/context/AuthContext'
import { useDocumentTitle } from '@/hooks/useUi'
import { CITIES } from '@/utils/constants'
import { Button } from '@/components/common/Button'
import { FormField, Input, Select } from '@/components/forms/FormField'
import { registerAmbulance } from '@/services/ambulanceService'

const AMBULANCE_TYPES = [
  'Basic Life Support (BLS)',
  'Advanced Life Support (ALS)',
  'ICU on Wheels',
  'Patient Transport',
]

export function RegisterAmbulancePage() {
  useDocumentTitle('Register as Ambulance Driver · Bystander')
  const navigate = useNavigate()
  const { login } = useAuth()

  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
    vehicleNumber: '',
    ambulanceType: 'Basic Life Support (BLS)',
    city: 'Mumbai',
    area: '',
    baseHospital: '',
    oxygenFitted: true,
    ventilatorFitted: false,
    stretcherAvailable: true,
  })

  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!form.fullName.trim() || !form.phone.trim() || !form.vehicleNumber.trim() || !form.password) {
      toast.error('Please fill in all mandatory fields.')
      return
    }

    if (form.password.length < 6) {
      toast.error('Password must be at least 6 characters.')
      return
    }

    if (form.password !== form.confirmPassword) {
      toast.error('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      const res = await registerAmbulance(form)
      toast.success('Registration successful!', {
        description: 'Welcome to Bystander Emergency Network. Your ambulance is now live.',
      })

      // Authenticate directly if login context method supports it or navigate to login
      if (res?.data?.token) {
        localStorage.setItem('caremate.token', res.data.token)
        localStorage.setItem('caremate.user', JSON.stringify(res.data.user))
        window.location.href = '/ambulance/dashboard'
      } else {
        navigate('/login?role=ambulance')
      }
    } catch (err) {
      toast.error('Registration failed', {
        description: err.response?.data?.message || err.message || 'Unable to register ambulance.',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-6">
      <div className="text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-red-600 text-white shadow-lg">
          <Siren className="h-7 w-7 text-white" />
        </span>
        <h1 className="mt-4 font-display text-2xl font-extrabold text-ink sm:text-3xl">
          Register Ambulance & Driver
        </h1>
        <p className="mt-1 text-sm text-muted">
          Connect your ambulance to families and hospital caretakers across your city for urgent patient transport.
        </p>
      </div>

      <div className="rounded-3xl border border-line bg-white p-6 shadow-card sm:p-8">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Driver full name" required>
              <Input
                placeholder="e.g. Rajesh Patil"
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              />
            </FormField>

            <FormField label="Primary phone number (For Emergency Calls)" required>
              <Input
                placeholder="e.g. +91 98201 12233"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Email address (Optional)">
              <Input
                type="email"
                placeholder="e.g. rajesh@ambulance.org"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </FormField>

            <FormField label="Ambulance vehicle plate number" required>
              <Input
                placeholder="e.g. MH 02 CZ 4421"
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
            <FormField label="Locality / Area">
              <Input
                placeholder="e.g. Bandra West, Parel"
                value={form.area}
                onChange={(e) => setForm({ ...form, area: e.target.value })}
              />
            </FormField>

            <FormField label="Base hospital / Trauma center">
              <Input
                placeholder="e.g. Lilavati Hospital, AIIMS"
                value={form.baseHospital}
                onChange={(e) => setForm({ ...form, baseHospital: e.target.value })}
              />
            </FormField>
          </div>

          {/* Equipment Checkboxes */}
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
                Oxygen Cylinder
              </label>

              <label className="flex items-center gap-2 rounded-xl border border-line p-3 text-xs font-semibold cursor-pointer hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={form.ventilatorFitted}
                  onChange={(e) => setForm({ ...form, ventilatorFitted: e.target.checked })}
                  className="rounded text-red-600 focus:ring-red-500"
                />
                Ventilator / ICU
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

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Password" required>
              <Input
                type="password"
                placeholder="At least 6 characters"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </FormField>

            <FormField label="Confirm password" required>
              <Input
                type="password"
                placeholder="Re-enter password"
                value={form.confirmPassword}
                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
              />
            </FormField>
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full bg-red-600 hover:bg-red-700 text-white"
            loading={loading}
            iconRight={ArrowRight}
          >
            Register Ambulance
          </Button>

          <p className="text-center text-xs text-muted">
            Already registered as an ambulance driver?{' '}
            <Link to="/login" className="font-bold text-red-700 hover:underline">
              Log in here
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}

export default RegisterAmbulancePage
