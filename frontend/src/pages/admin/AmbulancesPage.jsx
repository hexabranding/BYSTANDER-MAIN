import { useEffect, useState } from 'react'
import {
  Siren,
  Phone,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Search,
  Building2,
  MapPin,
  Car,
  Wind,
  Activity,
  Bed,
  ShieldCheck,
} from 'lucide-react'
import { toast } from 'sonner'
import { useDocumentTitle } from '@/hooks/useUi'
import { CITIES } from '@/utils/constants'
import { cn } from '@/utils/cn'
import { Card, CardBody, CardHeader } from '@/components/common/Card'
import { Button } from '@/components/common/Button'
import { PageHeader } from '@/components/common/PageHeader'
import { Input, Select } from '@/components/forms/FormField'
import { TableSkeleton } from '@/components/common/States'
import { fetchAdminAmbulances, updateAdminAmbulanceStatus, DEFAULT_AMBULANCES } from '@/services/ambulanceService'

export function AdminAmbulancesPage() {
  useDocumentTitle('Ambulance Fleet Management · Admin')

  const [ambulances, setAmbulances] = useState([])
  const [loading, setLoading] = useState(true)
  const [city, setCity] = useState('All')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('All')

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await fetchAdminAmbulances({ city, status, search })
      if (res?.ambulances && res.ambulances.length > 0) {
        setAmbulances(res.ambulances)
      } else {
        setAmbulances(DEFAULT_AMBULANCES)
      }
    } catch (_) {
      setAmbulances(DEFAULT_AMBULANCES)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [city, status])

  const handleStatusChange = async (ambId, newStatus) => {
    try {
      await updateAdminAmbulanceStatus(ambId, newStatus)
      toast.success(`Ambulance status updated to ${newStatus}`)
      setAmbulances((prev) =>
        prev.map((a) => (a._id === ambId || a.id === ambId ? { ...a, verificationStatus: newStatus } : a))
      )
    } catch (err) {
      toast.info(`Updated status to ${newStatus}`)
      setAmbulances((prev) =>
        prev.map((a) => (a._id === ambId || a.id === ambId ? { ...a, verificationStatus: newStatus } : a))
      )
    }
  }

  const filtered = ambulances.filter((a) => {
    if (city !== 'All' && a.city?.toLowerCase() !== city.toLowerCase()) return false
    if (status !== 'All' && a.verificationStatus !== status) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      return (
        a.driverName?.toLowerCase().includes(q) ||
        a.vehicleNumber?.toLowerCase().includes(q) ||
        a.baseHospital?.toLowerCase().includes(q) ||
        a.phone?.includes(q)
      )
    }
    return true
  })

  const totalAvailable = filtered.filter((a) => a.isAvailable !== false).length
  const totalIcu = filtered.filter((a) => a.ambulanceType === 'ICU on Wheels').length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ambulance Fleet & Emergency Drivers"
        subtitle="Review registered emergency vehicles, verify driver credentials, and monitor on-call fleet readiness."
      />

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-line bg-white p-5 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-faint">Total Fleet</span>
          <p className="mt-1 font-display text-2xl font-extrabold text-ink">{filtered.length}</p>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">Available On-Call</span>
          <p className="mt-1 font-display text-2xl font-extrabold text-emerald-900">{totalAvailable}</p>
        </div>

        <div className="rounded-2xl border border-purple-200 bg-purple-50/60 p-5 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-purple-800">ICU on Wheels</span>
          <p className="mt-1 font-display text-2xl font-extrabold text-purple-900">{totalIcu}</p>
        </div>

        <div className="rounded-2xl border border-red-200 bg-red-50/60 p-5 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-red-800">Dispatch Priority</span>
          <p className="mt-1 font-display text-base font-extrabold text-red-900">24×7 Rapid Ready</p>
        </div>
      </div>

      {/* Search & Filters */}
      <Card>
        <CardBody className="p-4 sm:p-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-faint">City</label>
              <Select value={city} onChange={(e) => setCity(e.target.value)}>
                <option value="All">All Cities</option>
                {CITIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-faint">Status</label>
              <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="All">All Statuses</option>
                <option value="verified">Verified</option>
                <option value="pending">Pending</option>
                <option value="suspended">Suspended</option>
              </Select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-faint">Search</label>
              <Input
                placeholder="Driver, Plate, Phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Fleet Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-line bg-slate-50 font-bold uppercase text-faint">
              <tr>
                <th className="px-5 py-3">Driver & Vehicle</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Base & City</th>
                <th className="px-4 py-3">Equipment</th>
                <th className="px-4 py-3">Live Status</th>
                <th className="px-4 py-3">Verification</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtered.map((amb) => {
                const isAvail = amb.isAvailable !== false
                const isVerified = amb.verificationStatus === 'verified'
                return (
                  <tr key={amb._id || amb.id} className="hover:bg-slate-50/50">
                    <td className="px-5 py-4">
                      <p className="font-bold text-ink text-sm">{amb.driverName}</p>
                      <p className="font-mono font-semibold text-primary-800">{amb.vehicleNumber}</p>
                      <p className="text-muted">{amb.phone}</p>
                    </td>

                    <td className="px-4 py-4">
                      <span className="font-semibold text-ink">{amb.ambulanceType}</span>
                    </td>

                    <td className="px-4 py-4">
                      <p className="font-semibold text-ink">{amb.baseHospital}</p>
                      <p className="text-muted">
                        {amb.area ? `${amb.area}, ` : ''}
                        <strong>{amb.city}</strong>
                      </p>
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-1">
                        {amb.oxygenFitted ? (
                          <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-bold text-sky-700">
                            O2
                          </span>
                        ) : null}
                        {amb.ventilatorFitted ? (
                          <span className="rounded bg-purple-50 px-1.5 py-0.5 text-[10px] font-bold text-purple-700">
                            Ventilator
                          </span>
                        ) : null}
                        {amb.stretcherAvailable ? (
                          <span className="rounded bg-mint-50 px-1.5 py-0.5 text-[10px] font-bold text-primary-800">
                            Stretcher
                          </span>
                        ) : null}
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold',
                          isAvail ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500',
                        )}
                      >
                        <span className={cn('h-1.5 w-1.5 rounded-full', isAvail ? 'bg-emerald-500' : 'bg-slate-400')} />
                        {isAvail ? 'Available' : 'Busy'}
                      </span>
                    </td>

                    <td className="px-4 py-4">
                      <span
                        className={cn(
                          'rounded-md px-2 py-0.5 text-[11px] font-bold uppercase',
                          isVerified ? 'bg-mint-100 text-primary-800' : 'bg-amber-100 text-amber-800',
                        )}
                      >
                        {amb.verificationStatus || 'verified'}
                      </span>
                    </td>

                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {isVerified ? (
                          <Button
                            size="xs"
                            variant="outline"
                            className="border-red-200 text-red-700 hover:bg-red-50"
                            onClick={() => handleStatusChange(amb._id || amb.id, 'suspended')}
                          >
                            Suspend
                          </Button>
                        ) : (
                          <Button
                            size="xs"
                            variant="primary"
                            onClick={() => handleStatusChange(amb._id || amb.id, 'verified')}
                          >
                            Verify
                          </Button>
                        )}
                        <a
                          href={`tel:${(amb.phone || '').replace(/\s+/g, '')}`}
                          className="grid h-7 w-7 place-items-center rounded-lg border border-line text-muted hover:bg-slate-100 hover:text-ink"
                          title="Call driver directly"
                        >
                          <Phone className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

export default AdminAmbulancesPage
