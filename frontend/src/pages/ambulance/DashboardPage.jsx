import { useEffect, useState } from 'react'
import {
  Siren,
  Phone,
  Car,
  Activity,
  Wind,
  Bed,
  Building2,
  MapPin,
  CheckCircle2,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Sparkles,
  Lock,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/context/AuthContext'
import { useDocumentTitle } from '@/hooks/useUi'
import { cn } from '@/utils/cn'
import { Card, CardBody, CardHeader } from '@/components/common/Card'
import { Button } from '@/components/common/Button'
import {
  getAmbulanceProfile,
  toggleAmbulanceAvailability,
  updateAmbulanceLocation,
} from '@/services/ambulanceService'

export function AmbulanceDashboardPage() {
  useDocumentTitle('Ambulance Dashboard · Bystander')
  const { user } = useAuth()

  const [ambulance, setAmbulance] = useState(null)
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(false)

  const loadProfile = async () => {
    setLoading(true)
    try {
      const data = await getAmbulanceProfile()
      if (data) {
        setAmbulance(data)
      } else {
        setAmbulance({
          driverName: user?.fullName || user?.name || '',
          phone: user?.phone || '',
          vehicleNumber: '',
          ambulanceType: 'Basic Life Support (BLS)',
          baseHospital: '',
          city: '',
          area: '',
          isAvailable: false,
          verificationStatus: 'pending',
          oxygenFitted: true,
          ventilatorFitted: false,
          stretcherAvailable: true,
          emergencyCallCount: 0,
        })
      }
    } catch (_) {
      setAmbulance({
        driverName: user?.fullName || user?.name || '',
        phone: user?.phone || '',
        vehicleNumber: '',
        ambulanceType: 'Basic Life Support (BLS)',
        baseHospital: '',
        city: '',
        area: '',
        isAvailable: false,
        verificationStatus: 'pending',
        oxygenFitted: true,
        ventilatorFitted: false,
        stretcherAvailable: true,
        emergencyCallCount: 0,
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProfile()
  }, [])

  const isVerified = (ambulance?.verificationStatus || '').toLowerCase() === 'verified'
  const isAvail = isVerified && ambulance?.isAvailable !== false

  const [gpsStatus, setGpsStatus] = useState({
    active: false,
    lastPing: null,
    coords: null,
  })

  // Heartbeat live GPS ping every 60 seconds when on-call
  useEffect(() => {
    if (!isAvail) {
      setGpsStatus({ active: false, lastPing: null, coords: null })
      return
    }

    const pingLocation = () => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) return
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { latitude, longitude } = pos.coords
          try {
            await updateAmbulanceLocation(latitude, longitude)
            setGpsStatus({
              active: true,
              lastPing: new Date(),
              coords: {
                latitude: Number(latitude.toFixed(4)),
                longitude: Number(longitude.toFixed(4)),
              },
            })
          } catch (_) {}
        },
        () => {},
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
      )
    }

    // Initial ping on going on-call
    pingLocation()

    // 60-second periodic heartbeat
    const interval = setInterval(pingLocation, 60000)
    return () => clearInterval(interval)
  }, [isAvail])

  const handleToggle = async () => {
    if (!isVerified) {
      toast.error('Verification pending', {
        description: 'Your ambulance profile is awaiting admin approval before you can switch to on-call.',
      })
      return
    }
    if (!ambulance || toggling) return
    const nextState = !ambulance.isAvailable
    setToggling(true)
    try {
      await toggleAmbulanceAvailability(nextState)
      setAmbulance((prev) => ({ ...prev, isAvailable: nextState }))
      toast.success(
        nextState ? 'Status set to AVAILABLE' : 'Status set to OFF-DUTY',
        {
          description: nextState
            ? 'Your ambulance is now visible to families and hospital caretakers for emergency calls.'
            : 'You are now off-duty. Your contact will be hidden from emergency searches.',
        },
      )
    } catch (err) {
      // Optimistic update
      setAmbulance((prev) => ({ ...prev, isAvailable: nextState }))
      toast.info(`Status updated to ${nextState ? 'Available' : 'Off-duty'}`)
    } finally {
      setToggling(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-line bg-white p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-red-600 text-white shadow-md">
            <Siren className="h-8 w-8 text-white" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-extrabold text-ink">
                Welcome, {ambulance?.driverName || user?.fullName || user?.name || 'Driver'}
              </h1>
              {isVerified ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-primary-200 bg-mint-50 px-2.5 py-0.5 text-xs font-bold text-primary-800">
                  <ShieldCheck className="h-3.5 w-3.5" /> Verified Driver
                </span>
              ) : ambulance?.verificationStatus === 'suspended' ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-bold text-red-800">
                  <AlertTriangle className="h-3.5 w-3.5" /> Suspended
                </span>
              ) : ambulance?.verificationStatus === 'rejected' ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-xs font-bold text-rose-800">
                  <AlertTriangle className="h-3.5 w-3.5" /> Rejected
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-800">
                  <Clock className="h-3.5 w-3.5 text-amber-600" /> Pending Verification
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-muted sm:text-sm">
              Vehicle Registration:{' '}
              <strong className="font-mono text-ink">{ambulance?.vehicleNumber || '—'}</strong>
              {ambulance?.baseHospital ? (
                <>
                  {' '}· Base: <strong className="text-ink">{ambulance.baseHospital}</strong>
                  {ambulance.city ? ` (${ambulance.city})` : ''}
                </>
              ) : ambulance?.city ? (
                <> · City: <strong className="text-ink">{ambulance.city}</strong></>
              ) : null}
            </p>
          </div>
        </div>

        <div className="text-left sm:text-right">
          <span className="block text-[11px] font-bold uppercase tracking-wider text-faint">
            Emergency Calls Received
          </span>
          <span className="font-display text-2xl font-extrabold text-red-600">
            {ambulance?.emergencyCallCount || 0}
          </span>
        </div>
      </div>

      {/* Account Verification Warning Banner (When not verified) */}
      {!isVerified && (
        <div className="flex items-start gap-3.5 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 via-amber-50/80 to-orange-50/50 p-4 sm:p-5 text-amber-950 shadow-sm">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-500 text-white shadow-sm">
            <Lock className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <p className="font-bold text-sm sm:text-base text-amber-950">
              {ambulance?.verificationStatus === 'suspended'
                ? 'Account Suspended by Operations Admin'
                : ambulance?.verificationStatus === 'rejected'
                ? 'Registration Rejected by Operations Desk'
                : 'Account Under Review by Admin'}
            </p>
            <p className="text-xs sm:text-sm text-amber-900/80 leading-relaxed">
              {ambulance?.verificationStatus === 'suspended'
                ? 'Your emergency dispatch privileges have been temporarily suspended. Please contact the Bystander operations desk.'
                : ambulance?.verificationStatus === 'rejected'
                ? 'Your registration could not be verified with the provided credentials. Please contact support or update your vehicle details.'
                : 'Your ambulance vehicle credentials, driving license, and base hospital information are currently awaiting administrative review. Once approved by the operations desk, your on-call switch will unlock.'}
            </p>
          </div>
        </div>
      )}

      {/* BIG AVAILABILITY TOGGLE CARD */}
      <Card
        className={cn(
          'transition-all duration-300 border-2',
          !isVerified
            ? 'border-slate-300 bg-slate-50/80'
            : isAvail
            ? 'border-emerald-500 bg-gradient-to-r from-emerald-50 via-teal-50 to-mint-50/40 shadow-card'
            : 'border-slate-300 bg-slate-50',
        )}
      >
        <CardBody className="p-6 sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    'h-4 w-4 rounded-full',
                    !isVerified
                      ? 'bg-amber-400'
                      : isAvail
                      ? 'bg-emerald-500 animate-pulse'
                      : 'bg-slate-400',
                  )}
                />
                <span className="font-display text-xl font-extrabold text-ink sm:text-2xl">
                  {!isVerified
                    ? 'ON-CALL LOCKED — AWAITING VERIFICATION'
                    : isAvail
                    ? 'ON-CALL & AVAILABLE FOR EMERGENCY'
                    : 'OFF-DUTY / OCCUPIED'}
                </span>
              </div>
              <p className="max-w-xl text-xs leading-relaxed text-muted sm:text-sm">
                {!isVerified
                  ? 'Your profile is awaiting admin approval. Once Bystander operations desk approves your vehicle plate and credentials, you will be able to toggle on-call and receive direct emergency transfer calls.'
                  : isAvail
                  ? 'Your ambulance is active on the radar! Customers and caretakers in your city can see your phone number and call you directly for urgent transfers.'
                  : 'You are currently hidden from search results. Toggle on when you are parked at your base hospital or ready to take emergency transfers.'}
              </p>
              {isAvail && (
                <div className="flex items-center gap-2 pt-1 text-xs font-semibold text-emerald-800">
                  <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                  <span>
                    GPS Radar: {gpsStatus.active ? 'Broadcasting live coordinates' : 'Detecting GPS signal…'}
                    {gpsStatus.coords ? ` (${gpsStatus.coords.latitude}, ${gpsStatus.coords.longitude})` : ''}
                  </span>
                </div>
              )}
            </div>

            <Button
              size="lg"
              onClick={handleToggle}
              loading={toggling}
              disabled={!isVerified}
              icon={!isVerified ? Lock : undefined}
              className={cn(
                'shrink-0 text-white shadow-md text-base px-8 py-3.5',
                !isVerified
                  ? 'bg-slate-400 cursor-not-allowed hover:bg-slate-400 opacity-80'
                  : isAvail
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-slate-700 hover:bg-slate-800',
              )}
            >
              {!isVerified
                ? 'Locked — Awaiting Approval'
                : isAvail
                ? 'Switch to Off-Duty'
                : 'Go Available Now'}
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Ambulance Specs & Details Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Ambulance Specifications"
            subtitle="Equipped facilities and vehicle details"
            icon={Car}
          />
          <CardBody className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl border border-line p-3">
                <span className="text-[11px] font-bold uppercase text-faint">Vehicle Plate</span>
                <p className="font-mono text-base font-extrabold text-ink">{ambulance?.vehicleNumber || '—'}</p>
              </div>
              <div className="rounded-xl border border-line p-3">
                <span className="text-[11px] font-bold uppercase text-faint">Category</span>
                <p className="text-sm font-extrabold text-primary-800">{ambulance?.ambulanceType || 'Basic Life Support (BLS)'}</p>
              </div>
            </div>

            <div className="space-y-2 border-t border-line pt-3">
              <p className="text-xs font-bold uppercase tracking-wider text-faint">Installed Life Support</p>
              <div className="flex flex-wrap gap-2">
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold',
                    ambulance?.oxygenFitted
                      ? 'border-sky-300 bg-sky-50 text-sky-800'
                      : 'border-line bg-slate-100 text-faint',
                  )}
                >
                  <Wind className="h-4 w-4" /> Oxygen Cylinder (Fitted)
                </span>

                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold',
                    ambulance?.ventilatorFitted
                      ? 'border-purple-300 bg-purple-50 text-purple-800'
                      : 'border-line bg-slate-100 text-faint',
                  )}
                >
                  <Activity className="h-4 w-4" /> Transport Ventilator / ICU
                </span>

                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold',
                    ambulance?.stretcherAvailable
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                      : 'border-line bg-slate-100 text-faint',
                  )}
                >
                  <Bed className="h-4 w-4" /> Wheeled Stretcher Bed
                </span>
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 p-3.5 text-xs text-muted space-y-1">
              <div className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 text-faint" />
                <span>Primary Hotline: <strong className="text-ink">{ambulance?.phone || user?.phone || '—'}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <Building2 className="h-3.5 w-3.5 text-faint" />
                <span>Hospital Anchor: <strong className="text-ink">{ambulance?.baseHospital || '—'}</strong></span>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Emergency Dispatch Protocol */}
        <Card>
          <CardHeader
            title="Driver Duty Protocol"
            subtitle="Standard operating procedures for emergency calls"
            icon={ShieldCheck}
          />
          <CardBody className="space-y-4 text-xs leading-relaxed text-muted">
            <div className="flex items-start gap-3 rounded-2xl border border-line bg-mint-50/50 p-3.5">
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary-700 shrink-0" />
              <div>
                <strong className="text-ink">1. Immediate Call Answer</strong>
                <p className="mt-0.5">
                  When a customer or hospital bystander calls, confirm the patient location, mobility status, and hospital destination immediately.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-2xl border border-line bg-mint-50/50 p-3.5">
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary-700 shrink-0" />
              <div>
                <strong className="text-ink">2. Oxygen & Vitals Readiness</strong>
                <p className="mt-0.5">
                  Check cylinder pressure gauges and ensure stretcher straps are secured before arrival at the residence or hospital bay.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-2xl border border-line bg-amber-50 p-3.5 text-amber-900 border-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-700 shrink-0" />
              <div>
                <strong>3. Off-Duty Switch</strong>
                <p className="mt-0.5">
                  Whenever you take a patient on board or conclude your shift, switch your status to <strong>Off-Duty</strong> so other families aren't kept waiting.
                </p>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}

export default AmbulanceDashboardPage
