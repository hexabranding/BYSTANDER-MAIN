import { useEffect, useState, useMemo, lazy, Suspense } from 'react'
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
  Navigation,
  Map,
  List,
  Layers,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'
import { CITIES } from '@/utils/constants'
import { cn } from '@/utils/cn'
import { Card, CardBody, CardHeader } from '@/components/common/Card'
import { Button } from '@/components/common/Button'
import { Input, Select } from '@/components/forms/FormField'
import { CardSkeleton } from '@/components/common/States'
import { fetchAmbulances, recordEmergencyCall } from '@/services/ambulanceService'

const AmbulanceMap = lazy(() => import('./AmbulanceMap'))

const AMBULANCE_TYPES = [
  'All',
  'ICU on Wheels',
  'Advanced Life Support (ALS)',
  'Basic Life Support (BLS)',
  'Patient Transport',
]

const RADIUS_OPTIONS = [
  { value: 10, label: 'Within 10 km (Immediate)' },
  { value: 20, label: 'Within 20 km (Rapid)' },
  { value: 30, label: 'Within 30 km (Extended)' },
]

export function AmbulanceDirectory({ userCity = 'All', title = 'Emergency Ambulances' }) {
  const [city, setCity] = useState(userCity || 'All')
  const [type, setType] = useState('All')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [availableOnly, setAvailableOnly] = useState(false)
  const [radiusKm, setRadiusKm] = useState(30)
  const [viewMode, setViewMode] = useState('split') // 'split' | 'map' | 'cards'
  const [userCoords, setUserCoords] = useState(null)
  const [locationStatus, setLocationStatus] = useState('detecting') // 'detecting' | 'detected' | 'denied'
  const [ambulances, setAmbulances] = useState([])
  const [loading, setLoading] = useState(true)

  // 300ms debounce on search input to prevent rapid typing API thrashing
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  // 1. Detect device GPS coordinates for 20km proximity calculations
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocationStatus('denied')
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserCoords({
          latitude: Number(pos.coords.latitude.toFixed(4)),
          longitude: Number(pos.coords.longitude.toFixed(4)),
        })
        setLocationStatus('detected')
      },
      () => {
        setLocationStatus('denied')
      },
      { timeout: 8000, maximumAge: 60000, enableHighAccuracy: true },
    )
  }, [])

  // 2. Fetch ambulances with live distance, ETA, and 20 km filter
  const loadData = async (isBackground = false) => {
    if (!isBackground) setLoading(true)
    try {
      const data = await fetchAmbulances({
        city,
        ambulanceType: type,
        search: debouncedSearch,
        availableOnly,
        lat: userCoords?.latitude,
        lng: userCoords?.longitude,
        radius: radiusKm,
      })
      setAmbulances(Array.isArray(data) ? data : [])
    } catch (_) {
      if (!isBackground) setAmbulances([])
    } finally {
      if (!isBackground) setLoading(false)
    }
  }

  // Reload when filters, debounced search, or user coordinates change
  useEffect(() => {
    loadData()
  }, [city, type, availableOnly, radiusKm, userCoords, debouncedSearch])

  // 3. Heartbeat auto-refresh every 60 seconds for live driver GPS tracking
  useEffect(() => {
    const timer = setInterval(() => {
      loadData(true)
    }, 60000)
    return () => clearInterval(timer)
  }, [city, type, availableOnly, radiusKm, userCoords, debouncedSearch])

  const handleCall = async (amb) => {
    if (!amb.phone) return
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

  // Ambulances within selected radius
  const ambulancesWithinRadius = useMemo(() => {
    return ambulances.filter((a) => {
      if (a.distanceKm !== null && a.distanceKm !== undefined) {
        return a.distanceKm <= radiusKm
      }
      return a.isWithinRadius !== false
    })
  }, [ambulances, radiusKm])

  return (
    <div className="space-y-6">
      {/* Emergency Notice & GPS Radar Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-red-200 bg-gradient-to-r from-red-50 via-rose-50 to-orange-50 p-5 shadow-sm">
        <div className="flex items-center gap-4">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-red-600 text-white shadow-md animate-pulse">
            <Siren className="h-7 w-7 text-white" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-display text-base font-extrabold text-red-950 sm:text-lg">
                Emergency Ambulance Radar
              </span>
              <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white">
                Live {radiusKm} km Tracking
              </span>
              {locationStatus === 'detected' ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> GPS Active
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-red-800/90 sm:text-sm">
              Instant connection to registered emergency ambulances. Drivers update live GPS coordinates every 1–2 minutes.
            </p>
          </div>
        </div>

        {/* View Toggle (Split / Map / Cards) */}
        <div className="flex items-center gap-1.5 rounded-2xl border border-line bg-white/90 p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setViewMode('split')}
            className={cn(
              'flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition',
              viewMode === 'split'
                ? 'bg-primary-700 text-white shadow-sm'
                : 'text-muted hover:text-ink',
            )}
            title="Split view (Interactive map + driver cards)"
          >
            <Layers className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Split Radar</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('map')}
            className={cn(
              'flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition',
              viewMode === 'map'
                ? 'bg-primary-700 text-white shadow-sm'
                : 'text-muted hover:text-ink',
            )}
            title="Full interactive map view"
          >
            <Map className="h-3.5 w-3.5" />
            <span>Map</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('cards')}
            className={cn(
              'flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition',
              viewMode === 'cards'
                ? 'bg-primary-700 text-white shadow-sm'
                : 'text-muted hover:text-ink',
            )}
            title="Compact cards list"
          >
            <List className="h-3.5 w-3.5" />
            <span>Cards</span>
          </button>
        </div>
      </div>

      {/* Interactive Map (Shown in Split & Map View) */}
      {(viewMode === 'split' || viewMode === 'map') && (
        <div className="space-y-2">
          <Suspense
            fallback={
              <div
                className={cn(
                  'relative flex items-center justify-center overflow-hidden rounded-2xl border border-line bg-slate-50',
                  viewMode === 'map' ? 'h-[550px]' : 'h-[360px]',
                )}
              >
                <div className="flex flex-col items-center gap-2 text-muted">
                  <span className="h-7 w-7 animate-spin rounded-full border-2 border-primary-700 border-t-transparent" />
                  <span className="text-xs font-semibold text-slate-500">
                    Loading emergency radar map...
                  </span>
                </div>
              </div>
            }
          >
            <AmbulanceMap
              userCoords={userCoords}
              ambulances={ambulancesWithinRadius}
              radiusKm={radiusKm}
              className={viewMode === 'map' ? 'h-[550px]' : 'h-[360px]'}
            />
          </Suspense>
        </div>
      )}

      {/* Filter and Radius Bar */}
      <Card>
        <CardBody className="p-4 sm:p-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-faint">
                Proximity Radius
              </label>
              <div className="grid grid-cols-3 gap-1.5 h-10">
                {[10, 20, 30].map((km) => (
                  <button
                    key={km}
                    type="button"
                    onClick={() => setRadiusKm(km)}
                    className={cn(
                      'flex items-center justify-center rounded-xl text-xs font-bold transition border',
                      radiusKm === km
                        ? 'bg-primary-700 text-white border-primary-700 shadow-sm'
                        : 'bg-white text-ink border-line hover:border-primary-300 hover:bg-slate-50',
                    )}
                  >
                    {km} km
                  </button>
                ))}
              </div>
            </div>

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
                Category
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
                placeholder="e.g. MIMS, KL 11, Rajesh"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setDebouncedSearch(search)
                  }
                }}
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

      {/* Listing Cards (Shown in Split & Cards View) */}
      {(viewMode === 'split' || viewMode === 'cards') && (
        <div>
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <CardSkeleton count={6} />
            </div>
          ) : ambulancesWithinRadius.length === 0 ? (
            <Card className="text-center py-12">
              <CardBody className="flex flex-col items-center">
                <span className="grid h-14 w-14 place-items-center rounded-full bg-slate-100 text-muted">
                  <Car className="h-7 w-7" />
                </span>
                <h3 className="mt-4 font-display text-base font-bold text-ink">
                  No ambulances found within {radiusKm} km
                </h3>
                <p className="mt-1 max-w-sm text-xs text-muted">
                  Try selecting 30 km or choosing "All Cities" to see more emergency vehicles.
                </p>
                <Button
                  className="mt-4"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setRadiusKm(30)
                    setCity('All')
                    setType('All')
                  }}
                >
                  Reset radius to 30 km
                </Button>
              </CardBody>
            </Card>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-muted px-1">
                <span className="font-bold text-ink">
                  Showing {ambulancesWithinRadius.length}{' '}
                  {ambulancesWithinRadius.length === 1 ? 'ambulance' : 'ambulances'}{' '}
                  within {radiusKm} km
                </span>
                <span className="text-[11px] font-semibold text-emerald-700">
                  Sorted by nearest distance first
                </span>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {ambulancesWithinRadius.map((amb) => {
                  const isAvail = amb.isAvailable !== false
                  return (
                    <Card
                      key={amb._id || amb.id}
                      className={cn(
                        'flex flex-col justify-between transition-all duration-200 hover:shadow-card',
                        isAvail
                          ? 'border-primary-200/80 bg-white'
                          : 'border-line bg-slate-50/70 opacity-80',
                      )}
                    >
                      <CardBody className="p-5 space-y-4">
                        {/* Top line: Status, Category & Live Distance Badge */}
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
                            {isAvail ? 'Available' : 'On Trip'}
                          </span>

                          <span className="rounded-lg border border-line bg-slate-100 px-2.5 py-1 font-mono text-xs font-extrabold text-ink tracking-wide">
                            {amb.vehicleNumber}
                          </span>
                        </div>

                        {/* Driver Name & Distance Metric */}
                        <div>
                          <div className="flex items-baseline justify-between gap-2">
                            <h3 className="font-display text-base font-extrabold text-ink truncate">
                              {amb.driverName}
                            </h3>
                            {amb.distanceKm !== null && amb.distanceKm !== undefined ? (
                              <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-extrabold text-emerald-900 border border-emerald-200">
                                <Zap className="h-3 w-3 text-emerald-700" />
                                {amb.distanceKm} km away
                              </span>
                            ) : null}
                          </div>
                          <div className="flex items-center justify-between text-xs mt-0.5">
                            <p className="font-bold text-primary-700">{amb.ambulanceType}</p>
                            {amb.etaMinutes ? (
                              <span className="font-semibold text-muted">~{amb.etaMinutes} min ETA</span>
                            ) : null}
                          </div>
                        </div>

                        {/* Location, Hospital & Live GPS Badge */}
                        <div className="space-y-1.5 text-xs text-muted">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-3.5 w-3.5 text-faint shrink-0" />
                            <span className="truncate">{amb.baseHospital}</span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 truncate">
                              <MapPin className="h-3.5 w-3.5 text-faint shrink-0" />
                              <span className="truncate">
                                {amb.area ? `${amb.area}, ` : ''}
                                <strong className="text-ink">{amb.city}</strong>
                              </span>
                            </div>
                            {amb.isLiveGps ? (
                              <span className="inline-flex items-center gap-1 rounded text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Live GPS
                              </span>
                            ) : null}
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
                      </CardBody>

                      {/* Bottom Action Footer with One-Click Dial */}
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
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default AmbulanceDirectory
