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
  Clock,
} from 'lucide-react'
import { toast } from 'sonner'
import { useDocumentTitle } from '@/hooks/useUi'
import { CITIES } from '@/utils/constants'
import { cn } from '@/utils/cn'
import { formatDate } from '@/utils/format'
import { Card, CardBody, CardHeader } from '@/components/common/Card'
import { Button } from '@/components/common/Button'
import { PageHeader } from '@/components/common/PageHeader'
import { Input, Select } from '@/components/forms/FormField'
import { TableSkeleton, EmptyState } from '@/components/common/States'
import { fetchAdminAmbulances, updateAdminAmbulanceStatus } from '@/services/ambulanceService'

export function AdminAmbulancesPage() {
  useDocumentTitle('Ambulance Fleet Management · Admin')

  const [ambulances, setAmbulances] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('all') // 'all' | 'verifications'
  const [city, setCity] = useState('All')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('All')

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await fetchAdminAmbulances({ city, status, search })
      const list = res?.ambulances || res?.data?.ambulances || (Array.isArray(res) ? res : [])
      setAmbulances(list)
    } catch (_) {
      setAmbulances([])
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
      if (newStatus === 'verified') {
        toast.success('Ambulance driver verified and approved for on-call emergency service!')
      } else if (newStatus === 'rejected') {
        toast.error('Ambulance driver registration rejected.')
      } else {
        toast.success(`Ambulance status updated to ${newStatus}`)
      }
      setAmbulances((prev) =>
        prev.map((a) =>
          a._id === ambId || a.id === ambId
            ? { ...a, verificationStatus: newStatus, isAvailable: newStatus === 'verified' ? a.isAvailable : false }
            : a,
        ),
      )
    } catch (err) {
      toast.info(`Updated status to ${newStatus}`)
      setAmbulances((prev) =>
        prev.map((a) =>
          a._id === ambId || a.id === ambId
            ? { ...a, verificationStatus: newStatus, isAvailable: newStatus === 'verified' ? a.isAvailable : false }
            : a,
        ),
      )
    }
  }

  const pendingAmbulances = ambulances.filter(
    (a) => (a.verificationStatus || '').toLowerCase() === 'pending',
  )
  const pendingCount = pendingAmbulances.length

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

  const totalAvailable = ambulances.filter(
    (a) => a.isAvailable !== false && a.verificationStatus === 'verified',
  ).length
  const totalIcu = ambulances.filter((a) => a.ambulanceType === 'ICU on Wheels').length

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
          <p className="mt-1 font-display text-2xl font-extrabold text-ink">{ambulances.length}</p>
        </div>

        <div
          onClick={() => setActiveTab('verifications')}
          className={cn(
            'rounded-2xl border p-5 shadow-sm cursor-pointer transition-all',
            pendingCount > 0
              ? 'border-amber-300 bg-amber-50/70 hover:bg-amber-100/60'
              : 'border-slate-200 bg-slate-50/60',
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-900">
              Pending Approvals
            </span>
            {pendingCount > 0 ? (
              <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-ping" />
            ) : null}
          </div>
          <p className="mt-1 font-display text-2xl font-extrabold text-amber-900">{pendingCount}</p>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">Available On-Call</span>
          <p className="mt-1 font-display text-2xl font-extrabold text-emerald-900">{totalAvailable}</p>
        </div>

        <div className="rounded-2xl border border-purple-200 bg-purple-50/60 p-5 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-purple-800">ICU on Wheels</span>
          <p className="mt-1 font-display text-2xl font-extrabold text-purple-900">{totalIcu}</p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-line">
        <button
          type="button"
          onClick={() => setActiveTab('all')}
          className={cn(
            'flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-bold transition-colors',
            activeTab === 'all'
              ? 'border-primary-700 text-primary-800'
              : 'border-transparent text-muted hover:text-ink',
          )}
        >
          <Car className="h-4 w-4" />
          All Drivers & Fleet
          <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
            {ambulances.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('verifications')}
          className={cn(
            'flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-bold transition-colors',
            activeTab === 'verifications'
              ? 'border-amber-600 text-amber-900'
              : 'border-transparent text-muted hover:text-ink',
          )}
        >
          <Clock className="h-4 w-4" />
          Verification Requests
          {pendingCount > 0 ? (
            <span className="ml-1 rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-white">
              {pendingCount}
            </span>
          ) : (
            <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
              0
            </span>
          )}
        </button>
      </div>

      {/* Tab 2: Verification Requests Queue */}
      {activeTab === 'verifications' ? (
        <div className="space-y-4">
          {loading ? (
            <TableSkeleton rows={3} cols={4} />
          ) : pendingAmbulances.length === 0 ? (
            <Card>
              <CardBody className="py-16 text-center">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-600 shadow-sm">
                  <CheckCircle2 className="h-7 w-7" />
                </div>
                <h3 className="mt-4 font-display text-lg font-bold text-ink">
                  No Pending Ambulance Verifications
                </h3>
                <p className="mx-auto mt-1 max-w-md text-sm text-muted">
                  All registered emergency drivers and vehicles have been approved or processed. Any newly registered ambulance will appear here for verification.
                </p>
              </CardBody>
            </Card>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-xs text-amber-950">
                <span className="flex items-center gap-2 font-bold">
                  <Clock className="h-4 w-4 text-amber-600 shrink-0" />
                  {pendingAmbulances.length}{' '}
                  {pendingAmbulances.length === 1
                    ? 'driver application awaiting approval'
                    : 'driver applications awaiting approval'}
                </span>
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
                  Operations Verification
                </span>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {pendingAmbulances.map((amb) => {
                  const id = amb._id || amb.id
                  return (
                    <Card key={id} className="border-amber-200/90 shadow-card">
                      <CardBody className="p-5 space-y-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <span className="grid h-12 w-12 place-items-center rounded-xl bg-red-600 text-white shadow-sm shrink-0">
                              <Siren className="h-6 w-6 text-white" />
                            </span>
                            <div>
                              <h4 className="font-bold text-base text-ink">{amb.driverName}</h4>
                              <span className="inline-block font-mono text-xs font-extrabold text-primary-800 bg-mint-50 border border-mint-200 rounded px-1.5 py-0.5 mt-0.5">
                                {amb.vehicleNumber}
                              </span>
                            </div>
                          </div>
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-900">
                            <Clock className="h-3 w-3" /> Awaiting Review
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 text-xs">
                          <div>
                            <span className="text-faint font-semibold uppercase text-[10px] block">
                              Category
                            </span>
                            <span className="font-bold text-ink">{amb.ambulanceType}</span>
                          </div>
                          <div>
                            <span className="text-faint font-semibold uppercase text-[10px] block">
                              City / Area
                            </span>
                            <span className="font-semibold text-ink">
                              {amb.area ? `${amb.area}, ` : ''}
                              {amb.city}
                            </span>
                          </div>
                          <div className="mt-1">
                            <span className="text-faint font-semibold uppercase text-[10px] block">
                              Base Hospital
                            </span>
                            <span className="font-semibold text-ink truncate block">
                              {amb.baseHospital || 'Trauma Network'}
                            </span>
                          </div>
                          <div className="mt-1">
                            <span className="text-faint font-semibold uppercase text-[10px] block">
                              Registered Date
                            </span>
                            <span className="text-muted">
                              {amb.createdAt ? formatDate(amb.createdAt) : 'Recently'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2 border-t border-line pt-3">
                          <div className="flex items-center gap-1.5">
                            {amb.oxygenFitted ? (
                              <span className="rounded bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700">
                                Oxygen (O2)
                              </span>
                            ) : null}
                            {amb.ventilatorFitted ? (
                              <span className="rounded bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700">
                                Ventilator
                              </span>
                            ) : null}
                            {amb.stretcherAvailable ? (
                              <span className="rounded bg-mint-50 px-2 py-0.5 text-[10px] font-bold text-primary-800">
                                Stretcher
                              </span>
                            ) : null}
                          </div>
                          <a
                            href={`tel:${(amb.phone || '').replace(/\s+/g, '')}`}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-ink"
                          >
                            <Phone className="h-3.5 w-3.5 text-primary-700" />
                            {amb.phone}
                          </a>
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                          <Button
                            variant="primary"
                            size="sm"
                            className="flex-1"
                            icon={CheckCircle2}
                            onClick={() => handleStatusChange(id, 'verified')}
                          >
                            Approve & Verify
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-rose-200 text-rose-700 hover:bg-rose-50"
                            icon={XCircle}
                            onClick={() => handleStatusChange(id, 'rejected')}
                          >
                            Reject
                          </Button>
                        </div>
                      </CardBody>
                    </Card>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Tab 1: All Drivers & Fleet */
        <div className="space-y-6">
          {/* Search & Filters */}
          <Card>
            <CardBody className="p-4 sm:p-5">
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-faint">
                    City
                  </label>
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
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-faint">
                    Status
                  </label>
                  <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                    <option value="All">All Statuses</option>
                    <option value="verified">Verified</option>
                    <option value="pending">Pending</option>
                    <option value="suspended">Suspended</option>
                    <option value="rejected">Rejected</option>
                  </Select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-faint">
                    Search
                  </label>
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
                    const isAvail = amb.isAvailable !== false && amb.verificationStatus === 'verified'
                    const isVerified = amb.verificationStatus === 'verified'
                    const isPending = amb.verificationStatus === 'pending'
                    const id = amb._id || amb.id
                    return (
                      <tr key={id} className="hover:bg-slate-50/50">
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
                              isAvail
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-slate-100 text-slate-500',
                            )}
                          >
                            <span
                              className={cn(
                                'h-1.5 w-1.5 rounded-full',
                                isAvail ? 'bg-emerald-500' : 'bg-slate-400',
                              )}
                            />
                            {isAvail ? 'Available' : 'Off-Duty'}
                          </span>
                        </td>

                        <td className="px-4 py-4">
                          <span
                            className={cn(
                              'rounded-md px-2 py-0.5 text-[11px] font-bold uppercase',
                              isVerified
                                ? 'bg-mint-100 text-primary-800'
                                : isPending
                                ? 'bg-amber-100 text-amber-900'
                                : 'bg-rose-100 text-rose-800',
                            )}
                          >
                            {amb.verificationStatus || 'pending'}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {isVerified ? (
                              <Button
                                size="xs"
                                variant="outline"
                                className="border-red-200 text-red-700 hover:bg-red-50"
                                onClick={() => handleStatusChange(id, 'suspended')}
                              >
                                Suspend
                              </Button>
                            ) : (
                              <Button
                                size="xs"
                                variant="primary"
                                onClick={() => handleStatusChange(id, 'verified')}
                              >
                                Approve
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
      )}
    </div>
  )
}

export default AdminAmbulancesPage
