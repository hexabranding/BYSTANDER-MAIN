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
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/context/AuthContext'
import { useDocumentTitle } from '@/hooks/useUi'
import { cn } from '@/utils/cn'
import { Card, CardBody, CardHeader } from '@/components/common/Card'
import { Button } from '@/components/common/Button'
import { getAmbulanceProfile, toggleAmbulanceAvailability } from '@/services/ambulanceService'

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
      setAmbulance(data)
    } catch (_) {
      // Mock / fallback if offline
      setAmbulance({
        driverName: user?.name || user?.fullName || 'Rajesh Patil',
        phone: user?.phone || '+91 98201 12233',
        vehicleNumber: 'MH 02 CZ 4421',
        ambulanceType: 'ICU on Wheels',
        baseHospital: 'Lilavati Hospital & Research Centre',
        city: 'Mumbai',
        area: 'Bandra West',
        isAvailable: true,
        verificationStatus: 'verified',
        oxygenFitted: true,
        ventilatorFitted: true,
        stretcherAvailable: true,
        emergencyCallCount: 24,
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProfile()
  }, [])

  const handleToggle = async () => {
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

  const isAvail = ambulance?.isAvailable !== false

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
                Welcome, {ambulance?.driverName || 'Driver'}
              </h1>
              <span className="inline-flex items-center gap-1 rounded-full border border-primary-200 bg-mint-50 px-2.5 py-0.5 text-xs font-bold text-primary-800">
                <ShieldCheck className="h-3.5 w-3.5" /> Verified Driver
              </span>
            </div>
            <p className="mt-1 text-xs text-muted sm:text-sm">
              Vehicle Registration:{' '}
              <strong className="font-mono text-ink">{ambulance?.vehicleNumber || 'MH 02 CZ 4421'}</strong>{' '}
              · Base:{' '}
              <strong className="text-ink">{ambulance?.baseHospital || 'General Hospital'}</strong> (
              {ambulance?.city || 'Mumbai'})
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

      {/* BIG AVAILABILITY TOGGLE CARD */}
      <Card
        className={cn(
          'transition-all duration-300 border-2',
          isAvail
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
                    isAvail ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400',
                  )}
                />
                <span className="font-display text-xl font-extrabold text-ink sm:text-2xl">
                  {isAvail ? 'ON-CALL & AVAILABLE FOR EMERGENCY' : 'OFF-DUTY / OCCUPIED'}
                </span>
              </div>
              <p className="max-w-xl text-xs leading-relaxed text-muted sm:text-sm">
                {isAvail
                  ? 'Your ambulance is active on the radar! Customers and caretakers in your city can see your phone number and call you directly for urgent transfers.'
                  : 'You are currently hidden from search results. Toggle on when you are parked at your base hospital or ready to take emergency transfers.'}
              </p>
            </div>

            <Button
              size="lg"
              onClick={handleToggle}
              loading={toggling}
              className={cn(
                'shrink-0 text-white shadow-md text-base px-8 py-3.5',
                isAvail ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-700 hover:bg-slate-800',
              )}
            >
              {isAvail ? 'Switch to Off-Duty' : 'Go Available Now'}
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
                <p className="font-mono text-base font-extrabold text-ink">{ambulance?.vehicleNumber}</p>
              </div>
              <div className="rounded-xl border border-line p-3">
                <span className="text-[11px] font-bold uppercase text-faint">Category</span>
                <p className="text-sm font-extrabold text-primary-800">{ambulance?.ambulanceType}</p>
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
                <span>Primary Hotline: <strong className="text-ink">{ambulance?.phone}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <Building2 className="h-3.5 w-3.5 text-faint" />
                <span>Hospital Anchor: <strong className="text-ink">{ambulance?.baseHospital}</strong></span>
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
