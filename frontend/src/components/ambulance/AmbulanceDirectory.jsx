import { useEffect, useState, useMemo } from 'react'
import {
  Phone,
  Siren,
  Search,
  MapPin,
  CheckCircle2,
  ShieldAlert,
  Car,
  Activity,
  Wind,
  Bed,
  Building2,
  Copy,
  ExternalLink,
} from 'lucide-react'
import { toast } from 'sonner'
import { CITIES } from '@/utils/constants'
import { cn } from '@/utils/cn'
import { Card, CardBody, CardHeader } from '@/components/common/Card'
import { Button } from '@/components/common/Button'
import { Input, Select } from '@/components/forms/FormField'
import { CardSkeleton } from '@/components/common/States'
import { fetchAmbulances, recordEmergencyCall } from '@/services/ambulanceService'

const AMBULANCE_TYPES = [
  'All',
  'ICU on Wheels',
  'Advanced Life Support (ALS)',
  'Basic Life Support (BLS)',
  'Patient Transport',
]

export function AmbulanceDirectory({ userCity = 'Mumbai', title = 'Emergency Ambulances' }) {
  const [city, setCity] = useState(userCity || 'Mumbai')
  const [type, setType] = useState('All')
  const [search, setSearch] = useState('')
  const [availableOnly, setAvailableOnly] = useState(false)
  const [ambulances, setAmbulances] = useState([])
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    setLoading(true)
    try {
      const data = await fetchAmbulances({
        city,
        ambulanceType: type,
        search,
        availableOnly,
      })
      setAmbulances(data)
    } catch (_) {
      setAmbulances([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [city, type, availableOnly])

  const handleCall = async (amb) => {
    if (!amb.phone) return
    // Log call count
    recordEmergencyCall(amb._id || amb.id).catch(() => {})
    toast.success(`Calling ${amb.driverName}`, {
      description: `Dialing ${amb.phone} for vehicle ${amb.vehicleNumber}...`,
    })
    window.location.href = `tel:${amb.phone.replace(/\s+/g, '')}`
  }

  const handleCopy = (phone) => {
    navigator.clipboard.writeText(phone)
    toast.info('Phone number copied to clipboard', { description: phone })
  }

  return (
    <div className="space-y-6">
      {/* Emergency Notice Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-red-200 bg-gradient-to-r from-red-50 via-rose-50 to-orange-50 p-5 shadow-sm">
        <div className="flex items-center gap-4">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-red-600 text-white shadow-md animate-pulse">
            <Siren className="h-7 w-7 text-white" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display text-base font-extrabold text-red-950 sm:text-lg">
                Emergency Ambulance Directory
              </span>
              <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white">
                24×7 Active
              </span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-red-800/90 sm:text-sm">
              Instant direct connection to verified ambulance drivers with life support, oxygen, and ICU equipment.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="border-red-300 bg-white text-red-700 hover:bg-red-50"
            onClick={() => {
              setCity('All')
              setType('All')
              setSearch('')
              setAvailableOnly(false)
            }}
          >
            Reset filters
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card>
        <CardBody className="p-4 sm:p-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-faint">
                City / Region
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
                Ambulance Category
              </label>
              <Select value={type} onChange={(e) => setType(e.target.value)}>
                {AMBULANCE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-faint">
                Search Driver / Hospital
              </label>
              <Input
                placeholder="e.g. Lilavati, MH 02, Rajesh"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadData()}
              />
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={() => setAvailableOnly((v) => !v)}
                className={cn(
                  'flex h-10 w-full items-center justify-center gap-2 rounded-xl border text-xs font-bold transition',
                  availableOnly
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                    : 'border-line bg-white text-muted hover:border-emerald-300 hover:bg-slate-50',
                )}
              >
                <span
                  className={cn(
                    'h-2.5 w-2.5 rounded-full',
                    availableOnly ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300',
                  )}
                />
                Available Only
              </button>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Listing Cards */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <CardSkeleton count={6} />
        </div>
      ) : ambulances.length === 0 ? (
        <Card className="text-center py-12">
          <CardBody className="flex flex-col items-center">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-slate-100 text-muted">
              <Car className="h-7 w-7" />
            </span>
            <h3 className="mt-4 font-display text-base font-bold text-ink">No ambulances found</h3>
            <p className="mt-1 max-w-sm text-xs text-muted">
              Try switching your city filter to "All Cities" or selecting a different ambulance category.
            </p>
            <Button
              className="mt-4"
              size="sm"
              variant="outline"
              onClick={() => {
                setCity('All')
                setType('All')
              }}
            >
              Show all ambulances
            </Button>
          </CardBody>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ambulances.map((amb) => {
            const isAvail = amb.isAvailable !== false
            return (
              <Card
                key={amb._id || amb.id}
                className={cn(
                  'flex flex-col justify-between transition-all duration-200 hover:shadow-card',
                  isAvail ? 'border-primary-200/70 bg-white' : 'border-line bg-slate-50/70 opacity-80',
                )}
              >
                <CardBody className="p-5 space-y-4">
                  {/* Top line: Status & Category */}
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold',
                        isAvail
                          ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border border-slate-200 bg-slate-100 text-slate-500',
                      )}
                    >
                      <span
                        className={cn(
                          'h-2 w-2 rounded-full',
                          isAvail ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400',
                        )}
                      />
                      {isAvail ? 'Available for Call' : 'On Trip / Busy'}
                    </span>

                    <span className="rounded-lg border border-line bg-slate-100 px-2.5 py-1 font-mono text-xs font-extrabold text-ink tracking-wide">
                      {amb.vehicleNumber}
                    </span>
                  </div>

                  {/* Driver Name & Type */}
                  <div>
                    <h3 className="font-display text-base font-extrabold text-ink">{amb.driverName}</h3>
                    <p className="text-xs font-bold text-primary-700">{amb.ambulanceType}</p>
                  </div>

                  {/* Location & Hospital */}
                  <div className="space-y-1 text-xs text-muted">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-3.5 w-3.5 text-faint shrink-0" />
                      <span className="truncate">{amb.baseHospital}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-faint shrink-0" />
                      <span>
                        {amb.area ? `${amb.area}, ` : ''}
                        <strong className="text-ink">{amb.city}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Features Chips */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {amb.oxygenFitted ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700 border border-sky-100">
                        <Wind className="h-3 w-3" /> Oxygen
                      </span>
                    ) : null}
                    {amb.ventilatorFitted ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2 py-0.5 text-[11px] font-semibold text-purple-700 border border-purple-100">
                        <Activity className="h-3 w-3" /> Ventilator
                      </span>
                    ) : null}
                    {amb.stretcherAvailable ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-mint-50 px-2 py-0.5 text-[11px] font-semibold text-primary-800 border border-mint-200">
                        <Bed className="h-3 w-3" /> Stretcher
                      </span>
                    ) : null}
                  </div>

                  {amb.notes ? (
                    <p className="text-[11px] leading-relaxed text-faint line-clamp-2 italic">
                      "{amb.notes}"
                    </p>
                  ) : null}
                </CardBody>

                {/* Bottom Action Footer */}
                <div className="border-t border-line bg-slate-50/50 p-4">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCall(amb)}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-extrabold text-white shadow-sm transition hover:bg-red-700 active:scale-[0.98]"
                    >
                      <Phone className="h-4 w-4 text-white" />
                      <span>Call Driver Now</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopy(amb.phone)}
                      title="Copy phone number"
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line bg-white text-muted hover:bg-slate-100 hover:text-ink"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="mt-2 text-center font-mono text-xs font-semibold text-ink">
                    {amb.phone}
                  </p>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default AmbulanceDirectory
