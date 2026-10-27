import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Accessibility,
  ArrowLeft,
  ArrowRight,
  Bandage,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  Home,
  MapPin,
  Moon,
  Pill,
  Plus,
  ShieldCheck,
  Sparkles,
  UserRound,
  Utensils,
  X,
  LogIn,
  Zap,
  Loader2,
  LocateFixed,
  Navigation,
  ExternalLink,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/context/AuthContext'
import { useData } from '@/context/DataContext'
import { SERVICES } from '@/data/services'
import { CITIES, GST_RATE, PLATFORM_FEE } from '@/utils/constants'
import { formatCurrency, formatDate } from '@/utils/format'
import { DURATION_GROUPS, durationBasis, formatDuration } from '@/utils/duration'
import { cn } from '@/utils/cn'
import { Card, CardBody, CardHeader } from '@/components/common/Card'
import { Button } from '@/components/common/Button'
import { FormField, Input, Select, Textarea } from '@/components/forms/FormField'
import { PriceBreakdown } from '@/components/common/TimelinePrice'
import { RatingStars } from '@/components/common/RatingStars'
import { CardSkeleton } from '@/components/common/States'
import { bookingService, servicesService, caregiversService, financeService, isMongoObjectId } from '@/services'

const CARE_REQUIREMENTS = [
  {
    id: 'night-supervision',
    name: 'Night supervision',
    icon: Moon,
    description: 'Continuous overnight bedside alertness, vitals logging, and fall prevention.',
    tag: 'Bedside Protocol',
  },
  {
    id: 'wound-dressing',
    name: 'Wound dressing',
    icon: Bandage,
    description: 'Sterile dressing change, surgical site cleaning, and antiseptic application.',
    tag: 'Clinical Care',
  },
  {
    id: 'mobility-support',
    name: 'Mobility support',
    icon: Accessibility,
    description: 'Bed-to-wheelchair transfers, assisted walking, and physical rehabilitation routines.',
    tag: 'Physical Assistance',
  },
  {
    id: 'vegetarian-meal-prep',
    name: 'Vegetarian meal prep',
    icon: Utensils,
    description: 'Preparation of hygienic vegetarian meals, hydration support & assisted feeding.',
    tag: 'Nutrition & Diet',
  },
  {
    id: 'medication-tracking',
    name: 'Medication reminders',
    icon: Pill,
    description: 'Timely prescription dose tracking, blood pressure checks, and schedule logging.',
    tag: 'Vitals & Dosing',
  },
  {
    id: 'personal-hygiene',
    name: 'Bathing & personal care',
    icon: Sparkles,
    description: 'Bed-sponge baths, assisted washroom visits, oral care, and linen changes.',
    tag: 'Hygiene & Comfort',
  },
]

const RELATIONS = ['Mother', 'Father', 'Grandmother', 'Grandfather', 'Wife', 'Husband', 'Sibling', 'Self', 'Other']

const TIME_OPTIONS = Array.from({ length: 31 }, (_, i) => {
  const mins = 6 * 60 + i * 30
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`
})

const todayISO = () => new Date().toISOString().slice(0, 10)

const getNextUpcomingTime = () => {
  const now = new Date(Date.now() + 20 * 60 * 1000)
  const mins = now.getMinutes()
  const roundedMins = mins <= 30 ? 30 : 60
  if (roundedMins === 60) {
    now.setHours(now.getHours() + 1, 0, 0, 0)
  } else {
    now.setMinutes(30, 0, 0)
  }
  const hours = String(now.getHours()).padStart(2, '0')
  const m = String(now.getMinutes()).padStart(2, '0')
  return {
    date: now.toISOString().slice(0, 10),
    startTime: `${hours}:${m}`,
  }
}

export function BookCaregiverWizard({ isPublic = false, className = '' }) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const { caregivers, createBooking } = useData()

  const [availableServices, setAvailableServices] = useState(SERVICES)
  const [availableCaregivers, setAvailableCaregivers] = useState([])
  const [loadingCaregivers, setLoadingCaregivers] = useState(true)

  useEffect(() => {
    let isMounted = true
    servicesService
      .getServices()
      .then((res) => {
        const list = Array.isArray(res?.data?.services)
          ? res.data.services
          : Array.isArray(res?.services)
            ? res.services
            : []
        if (isMounted && list.length > 0) {
          setAvailableServices(list)
        }
      })
      .catch(() => {})

    caregiversService
      .getCaregivers()
      .then((res) => {
        const list = Array.isArray(res?.data?.caregivers)
          ? res.data.caregivers
          : Array.isArray(res?.caregivers)
            ? res.caregivers
            : []
        if (isMounted) {
          setAvailableCaregivers(list)
        }
      })
      .catch(() => {
        if (isMounted) {
          setAvailableCaregivers([])
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoadingCaregivers(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  const patientInfo = user?.patientInfo
  const preselectedId = searchParams.get('caregiver') || ''

  const [isUrgent, setIsUrgent] = useState(() => searchParams.get('urgent') === 'true')
  const [step, setStep] = useState(0)
  const [maxStep, setMaxStep] = useState(0)
  const [terms, setTerms] = useState(false)
  const [created, setCreated] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [selectedCaregiverId, setSelectedCaregiverId] = useState(() => preselectedId || '')

  useEffect(() => {
    if (preselectedId && preselectedId !== selectedCaregiverId) {
      setSelectedCaregiverId(preselectedId)
    }
  }, [preselectedId, selectedCaregiverId])

  const [form, setForm] = useState(() => ({
    service: null,
    patientName: patientInfo?.name || '',
    patientAge: patientInfo?.age ? String(patientInfo.age) : '',
    relation: patientInfo?.relation || 'Mother',
    requirements: patientInfo?.condition || '',
    careType: 'Home Care',
    address: user?.address || '',
    city: user?.city || CITIES[0],
    area: user?.area || '',
    date: '',
    startTime: '08:00',
    hours: 6,
    instructions: '',
    extras: [],
  }))

  const toggleUrgentMode = () => {
    setIsUrgent((prev) => {
      const next = !prev
      if (next) {
        const upcoming = getNextUpcomingTime()
        setForm((f) => ({
          ...f,
          service: f.service || availableServices[0] || null,
          date: f.date || upcoming.date,
          startTime: f.startTime || upcoming.startTime,
          hours: f.hours || 6,
          careType: f.careType || 'Home Care',
          instructions: f.instructions || 'Urgent on-demand broadcast',
        }))
        setTerms(true)
        setStep(0)
        setMaxStep(0)
        toast.info('Urgent 2-Step Booking Activated', {
          description: 'Step 1: Patient details · Step 2: Care setting & address.',
        })
      } else {
        setStep(0)
        setMaxStep(0)
        toast.info('Switched to Standard 7-Step Booking')
      }
      return next
    })
  }

  useEffect(() => {
    if (searchParams.get('urgent') === 'true' && availableServices.length > 0) {
      const upcoming = getNextUpcomingTime()
      setForm((f) => ({
        ...f,
        service: f.service || availableServices[0],
        date: f.date || upcoming.date,
        startTime: f.startTime || upcoming.startTime,
        hours: f.hours || 6,
        careType: f.careType || 'Home Care',
        instructions: f.instructions || 'Urgent on-demand broadcast',
      }))
      setTerms(true)
    }
  }, [searchParams, availableServices])

  // Rehydrate pending booking if saved prior to login
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('pending_booking_broadcast')
      if (saved) {
        const parsed = JSON.parse(saved)
        setForm((prev) => ({ ...prev, ...parsed }))
        setStep(6) // Jump directly to Review & Confirm step
        setMaxStep(6)
        sessionStorage.removeItem('pending_booking_broadcast')
        toast.info('Your booking details were restored!', {
          description: 'Review your details and click Confirm & Broadcast to notify caretakers.',
        })
      }
    } catch (_) {}
  }, [])

  const set = (patchOrFn) =>
    setForm((f) => ({
      ...f,
      ...(typeof patchOrFn === 'function' ? patchOrFn(f) : patchOrFn),
    }))

  const matchedCaregiver = useMemo(() => {
    const targetId = selectedCaregiverId || preselectedId
    if (targetId) {
      const picked = availableCaregivers.find(
        (c) =>
          c.id === targetId ||
          c._id === targetId ||
          String(c.id) === String(targetId) ||
          String(c._id) === String(targetId),
      )
      if (picked) return picked
    }
    return null
  }, [availableCaregivers, selectedCaregiverId, preselectedId])

  // Direct On-Demand Broadcast Flow (2 steps in urgent mode, 7 in standard):
  const steps = useMemo(() => {
    if (isUrgent) {
      return [
        { id: 'patient', label: 'Patient' },
        { id: 'setting', label: 'Care setting' },
      ]
    }
    return [
      { id: 'service', label: 'Care service' },
      { id: 'patient', label: 'Patient' },
      { id: 'setting', label: 'Care setting' },
      { id: 'schedule', label: 'Schedule' },
      { id: 'instructions', label: 'Directives' },
      { id: 'price', label: 'Pricing' },
      { id: 'confirm', label: 'Confirm & Broadcast' },
    ]
  }, [isUrgent])

  const currentStep = steps[step] || steps[0]
  const currentStepId = currentStep?.id || (isUrgent ? 'patient' : 'service')

  const rate =
    form.service?.baseHourlyRate ||
    form.service?.startingPrice ||
    matchedCaregiver?.hourlyRate ||
    availableServices[0]?.baseHourlyRate ||
    499
  const hours = Number(form.hours) || (isUrgent ? 6 : 0)
  const subtotal = rate * hours
  const platformFee = PLATFORM_FEE
  const tax = Math.round((subtotal + platformFee) * GST_RATE)
  const total = subtotal + platformFee + tax

  const isStepValid = (stepId) => {
    switch (stepId) {
      case 'service':
        return Boolean(form.service)
      case 'patient':
        return Boolean(form.patientName?.trim()) && Number(form.patientAge) > 0
      case 'setting': {
        const settingValid =
          Boolean(form.careType) &&
          Boolean(form.address?.trim()) &&
          Boolean(form.city) &&
          Boolean(form.area?.trim())
        if (isUrgent) {
          return settingValid && terms
        }
        return settingValid
      }
      case 'schedule':
        return Boolean(form.date) && Boolean(form.startTime) && Number(form.hours) > 0
      case 'instructions':
        return true
      case 'price':
        return true
      case 'confirm':
        return terms
      default:
        return false
    }
  }

  const isCurrentStepValid = isStepValid(currentStepId)

  const goNext = () => {
    if (!isCurrentStepValid) return
    const next = Math.min(step + 1, steps.length - 1)
    setStep(next)
    setMaxStep((m) => Math.max(m, next))
  }

  const goBack = () => setStep((s) => Math.max(0, s - 1))

  const jumpTo = (i) => {
    if (i <= maxStep && i < steps.length) setStep(i)
  }

  const [customExtra, setCustomExtra] = useState('')

  const toggleExtra = (extra) => {
    setForm((f) => {
      const current = Array.isArray(f.extras) ? f.extras : []
      const exists = current.includes(extra)
      const nextExtras = exists ? current.filter((e) => e !== extra) : [...current, extra]
      return { ...f, extras: nextExtras }
    })
  }

  const addCustomExtra = () => {
    const trimmed = customExtra.trim()
    if (!trimmed) return
    setForm((f) => {
      const current = Array.isArray(f.extras) ? f.extras : []
      if (current.includes(trimmed)) return f
      return { ...f, extras: [...current, trimmed] }
    })
    setCustomExtra('')
  }

  const removeExtra = (extra) => {
    setForm((f) => {
      const current = Array.isArray(f.extras) ? f.extras : []
      return { ...f, extras: current.filter((e) => e !== extra) }
    })
  }

  const [detectingLocation, setDetectingLocation] = useState(false)
  const [locationCaptured, setLocationCaptured] = useState(null)

  const handleChooseCurrentLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser', {
        description: 'Please enter your address manually in the fields below.',
      })
      return
    }

    setDetectingLocation(true)

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        const accuracy = pos.coords.accuracy ? Math.round(pos.coords.accuracy) : null

        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
            {
              headers: {
                'Accept-Language': 'en',
              },
            },
          )

          if (res.ok) {
            const data = await res.json()
            const addr = data.address || {}

            const rawCity =
              addr.city || addr.town || addr.city_district || addr.suburb || addr.state_district || ''
            const rawState = addr.state || ''

            let matchedCity = CITIES.find((c) => {
              const base = c.split(',')[0].toLowerCase()
              return (
                rawCity.toLowerCase().includes(base) ||
                base.includes(rawCity.toLowerCase()) ||
                (base === 'bengaluru' && rawCity.toLowerCase().includes('bangalore')) ||
                (base === 'mumbai' &&
                  (rawCity.toLowerCase().includes('bombay') || rawCity.toLowerCase().includes('thane'))) ||
                (base === 'delhi ncr' &&
                  (rawCity.toLowerCase().includes('delhi') ||
                    rawCity.toLowerCase().includes('noida') ||
                    rawCity.toLowerCase().includes('gurugram') ||
                    rawCity.toLowerCase().includes('gurgaon')))
              )
            })

            if (!matchedCity && rawCity) {
              matchedCity = rawState ? `${rawCity}, ${rawState}` : rawCity
            }

            const detectedArea =
              addr.suburb ||
              addr.neighbourhood ||
              addr.residential ||
              addr.subdistrict ||
              addr.quarter ||
              addr.city_district ||
              ''

            const streetParts = [
              addr.building || addr.amenity || addr.house_name,
              addr.house_number ? `#${addr.house_number}` : '',
              addr.road,
              detectedArea,
            ].filter(Boolean)

            const detectedAddress =
              streetParts.length > 0
                ? streetParts.join(', ')
                : data.display_name?.split(',').slice(0, 3).join(', ') || `GPS: ${lat.toFixed(4)}, ${lng.toFixed(4)}`

            setForm((prev) => ({
              ...prev,
              city: matchedCity || prev.city || CITIES[0],
              area: detectedArea || prev.area,
              address: detectedAddress || prev.address,
              coordinates: {
                latitude: Number(lat.toFixed(5)),
                longitude: Number(lng.toFixed(5)),
              },
            }))

            setLocationCaptured({
              lat: Number(lat.toFixed(5)),
              lng: Number(lng.toFixed(5)),
              accuracy,
              area: detectedArea,
              city: matchedCity || rawCity,
              address: detectedAddress,
            })

            toast.success('Current location chosen!', {
              description: `${detectedArea ? detectedArea + ', ' : ''}${matchedCity || rawCity || 'Location'} (Accuracy ±${accuracy || 15}m)`,
            })
          } else {
            throw new Error('Geocoding service unavailable')
          }
        } catch {
          const fallbackAddress = `GPS: ${lat.toFixed(4)}, ${lng.toFixed(4)}`
          setForm((prev) => ({
            ...prev,
            coordinates: {
              latitude: Number(lat.toFixed(5)),
              longitude: Number(lng.toFixed(5)),
            },
            address: prev.address || fallbackAddress,
          }))

          setLocationCaptured({
            lat: Number(lat.toFixed(5)),
            lng: Number(lng.toFixed(5)),
            accuracy,
          })

          toast.success('Device GPS captured', {
            description: `Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)} (Accuracy ±${accuracy || 20}m)`,
          })
        } finally {
          setDetectingLocation(false)
        }
      },
      (err) => {
        setDetectingLocation(false)
        let msg = 'Could not access device location.'
        if (err.code === 1) {
          msg = 'Location permission was denied. Please allow location permissions in your browser or type your address manually.'
        } else if (err.code === 2) {
          msg = 'Position unavailable. Please check your GPS signal or enter address manually.'
        } else if (err.code === 3) {
          msg = 'Location detection timed out. Please try again or type manually.'
        }
        toast.error('Location detection failed', { description: msg })
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      },
    )
  }

  const handleConfirm = async () => {
    let activeService = form.service
    if (!activeService && availableServices.length > 0) {
      activeService = availableServices[0]
      setForm((f) => ({ ...f, service: availableServices[0] }))
    }

    if (!activeService || submitting) return

    // Guest Authentication Guard
    if (!user) {
      try {
        sessionStorage.setItem('pending_booking_broadcast', JSON.stringify({ ...form, service: activeService }))
      } catch (_) {}
      toast.info('Please sign in to broadcast your request', {
        description: 'Your booking requirements are saved and will be restored immediately after sign-in.',
      })
      navigate(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`)
      return
    }

    if (user.role && user.role !== 'customer') {
      toast.error('Booking restricted', {
        description: 'Only customer accounts can place care bookings. Please switch to or register a customer account.',
      })
      return
    }

    setSubmitting(true)

    try {
      // 1. Resolve Service ObjectId
      let serviceId = activeService?._id || activeService?.id
      if (!isMongoObjectId(serviceId)) {
        const found =
          availableServices.find(
            (s) =>
              isMongoObjectId(s._id || s.id) &&
              (s.name === activeService?.name ||
                s.slug === activeService?.slug ||
                s.name?.toLowerCase() === activeService?.name?.toLowerCase()),
          ) || availableServices.find((s) => isMongoObjectId(s._id || s.id))
        if (found) {
          serviceId = found._id || found.id
        }
      }

      if (!isMongoObjectId(serviceId)) {
        throw new Error('Please ensure a valid service from the system catalog is selected.')
      }

      // 2. Temporal bounds
      let targetDate = form.date
      let targetStartTime = form.startTime

      if (isUrgent || !targetDate || !targetStartTime) {
        const upcoming = getNextUpcomingTime()
        targetDate = targetDate || upcoming.date
        targetStartTime = targetStartTime || upcoming.startTime
      }

      const [startHour, startMin] = (targetStartTime || '08:00').split(':').map(Number)
      const [year, month, day] = targetDate.split('-').map(Number)
      let localStartDate = new Date(year, month - 1, day, startHour, startMin, 0)

      if (isNaN(localStartDate.getTime()) || localStartDate.getTime() <= Date.now()) {
        const upcoming = getNextUpcomingTime()
        const [uH, uM] = upcoming.startTime.split(':').map(Number)
        const [uY, uMo, uD] = upcoming.date.split('-').map(Number)
        localStartDate = new Date(uY, uMo - 1, uD, uH, uM, 0)
      }

      const hoursNum = Math.max(0.5, Math.min(24, Number(form.hours) || (isUrgent ? 6 : 1)))
      const localEndDate = new Date(localStartDate.getTime() + hoursNum * 60 * 60 * 1000)

      // Broadcast payload: No caregiverId required. Broadcasts to all active caretakers!
      const payload = {
        serviceId,
        startDateTime: localStartDate.toISOString(),
        endDateTime: localEndDate.toISOString(),
        timezone: 'Asia/Kolkata',
        location: {
          addressLine: form.address.trim(),
          city: form.city.trim(),
          area: form.area.trim(),
          careSetting: form.careType === 'Hospital Care' ? 'Hospital Care' : 'Home Care',
        },
        patientDetails: {
          name: form.patientName.trim(),
          age: Number(form.patientAge) || 0,
          gender: 'Other',
          specialInstructions: [
            isUrgent ? 'URGENT DISPATCH PROTOCOL' : '',
            form.instructions?.trim() ? `Instructions: ${form.instructions.trim()}` : '',
            form.extras?.length > 0 ? `Care Directives: ${form.extras.join(', ')}` : '',
          ]
            .filter(Boolean)
            .join(' · ') || (isUrgent ? 'Urgent shift protocol' : 'Standard shift protocol'),
        },
      }

      if (isMongoObjectId(preselectedId)) {
        payload.caregiverId = preselectedId
      }

      const booking = await bookingService.createBooking(payload)

      if (createBooking) {
        createBooking({
          ...booking,
          customerId: user?.id || booking.customerId,
          notes: form.requirements.trim(),
        })
      }

      setCreated(booking)
      toast.success('Booking broadcasted successfully', {
        description: `Reference ${booking.ref} — all active caretakers in ${form.city} have been notified.`,
      })

      // Initiate Razorpay Test Mode Escrow Checkout
      const targetBookingId = booking.id || booking._id || booking.dbId
      if (isMongoObjectId(targetBookingId)) {
        try {
          await financeService.loadRazorpayScript()
          const orderRes = await financeService.createPaymentOrder(targetBookingId)

          if (typeof window !== 'undefined' && window.Razorpay && orderRes?.order?.id) {
            const rzp = new window.Razorpay({
              key: orderRes.order?.keyId || orderRes.keyId || 'rzp_test_bystander_sandbox',
              amount: orderRes.order?.amount,
              currency: orderRes.order?.currency || 'INR',
              name: 'Bystander Healthcare',
              description: `${booking.serviceName || 'Bedside Care'} Shift Escrow (Test Mode)`,
              order_id: orderRes.order?.id,
              prefill: {
                name: user?.name || user?.fullName || form.patientName,
                email: user?.email || '',
                contact: user?.phone || '',
              },
              theme: {
                color: '#06263B',
              },
              handler: async function (response) {
                try {
                  await financeService.verifyPaymentSignature({
                    bookingId: targetBookingId,
                    razorpay_order_id: response.razorpay_order_id,
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_signature: response.razorpay_signature,
                  })
                  toast.success('Payment secured in Razorpay Escrow (Test Mode)', {
                    description: `Tx Ref: ${response.razorpay_payment_id}. Funds will be released upon shift completion.`,
                  })
                } catch (vErr) {
                  console.warn('[Razorpay Verification Notice]', vErr.message)
                }
              },
              modal: {
                ondismiss: function () {
                  toast.info('Payment pending in test escrow', {
                    description: 'You can complete escrow payment anytime from your booking dashboard.',
                  })
                },
              },
            })
            rzp.open()
          }
        } catch (payErr) {
          console.warn('[Razorpay Order Notice]', payErr.message)
        }
      }
    } catch (err) {
      toast.error('Booking creation failed', {
        description: err.message || 'Unable to submit booking request to the server.',
      })
    } finally {
      setSubmitting(false)
    }
  }

  /* ---------------- success screen ---------------- */

  if (created) {
    return (
      <Card className="mx-auto max-w-2xl shadow-card">
        <CardBody className="flex flex-col items-center px-6 py-12 text-center">
          <motion.span
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 18 }}
            className="grid h-20 w-20 place-items-center rounded-full bg-mint-100 text-primary-700"
          >
            <CheckCircle2 className="h-10 w-10" />
          </motion.span>
          <h2 className="mt-5 font-display text-2xl font-extrabold text-ink">
            You're all set, {(user?.name || 'Customer').split(' ')[0]}!
          </h2>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">
            We are matching you with a verified caretaker for {created.service}. You will get a confirmation
            notification once they accept your broadcast.
          </p>
          <div className="mt-6 grid w-full max-w-sm grid-cols-2 gap-3">
            <div className="rounded-xl border border-line bg-slate-50 px-4 py-3 text-left">
              <p className="text-[11px] font-bold uppercase tracking-wider text-faint">Reference</p>
              <p className="mt-1 font-display text-sm font-extrabold text-primary-800">{created.ref}</p>
            </div>
            <div className="rounded-xl border border-line bg-slate-50 px-4 py-3 text-left">
              <p className="text-[11px] font-bold uppercase tracking-wider text-faint">Booking ID</p>
              <p className="mt-1 font-display text-sm font-extrabold text-ink">{created.id}</p>
            </div>
          </div>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Button size="lg" onClick={() => navigate(`/customer/bookings/${created.id}`)} iconRight={ArrowRight}>
              View live status
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate(user ? '/customer/dashboard' : '/')}
            >
              {user ? 'Back to dashboard' : 'Return to Home'}
            </Button>
          </div>
        </CardBody>
      </Card>
    )
  }

  /* ---------------- main booking wizard ---------------- */

  return (
    <div className={cn('space-y-6', className)}>
      {/* Live Broadcast Feature Notice with Urgent Mode Toggle */}
      <div
        className={cn(
          'flex flex-wrap items-center justify-between gap-4 rounded-card border p-4 shadow-sm sm:p-5 transition-colors duration-200',
          isUrgent
            ? 'border-orange-300 bg-orange-50/80 shadow-md ring-1 ring-orange-400/40'
            : 'border-primary-200 bg-mint-50/70',
        )}
      >
        <div className="flex items-center gap-3.5">
          <span
            className={cn(
              'grid h-12 w-12 shrink-0 place-items-center rounded-full font-display text-base font-extrabold text-white shadow-sm transition',
              isUrgent ? 'bg-orange-500' : 'bg-primary-700',
            )}
          >
            {isUrgent ? <Zap className="h-6 w-6 text-white animate-pulse" /> : <Sparkles className="h-6 w-6 text-white" />}
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-display text-base font-bold text-ink">
                {isUrgent ? 'Urgent Caretaker Dispatch · Fast Track' : 'On-Demand Caretaker Dispatch'}
              </span>
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold border',
                  isUrgent
                    ? 'bg-orange-100 text-orange-900 border-orange-300'
                    : 'bg-success-50 text-success-700 border-success-200',
                )}
              >
                {isUrgent ? <Zap className="h-3 w-3 text-orange-600" /> : <ShieldCheck className="h-3 w-3" />}
                {isUrgent ? '2-Step Urgent Mode' : 'Live Broadcast'}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted">
              {isUrgent
                ? 'Quick 2-step booking (Patient details → Care setting). Your urgent request will be broadcasted immediately.'
                : 'Your request will be sent to all qualified caretakers across the app. The first available caretaker will accept and be assigned immediately.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleUrgentMode}
            className={cn(
              'inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-bold transition shadow-xs cursor-pointer',
              isUrgent
                ? 'border-slate-300 bg-white text-ink hover:bg-slate-100'
                : 'border-orange-500 bg-orange-500 text-white hover:bg-orange-600 shadow-sm',
            )}
          >
            <Zap className={cn('h-4 w-4', isUrgent ? 'text-orange-600' : 'text-white')} />
            {isUrgent ? 'Switch to Standard (7 Steps)' : 'Urgent Booking (2 Steps)'}
          </button>

          <div className="text-left sm:text-right border-l border-line pl-3">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-faint">Hourly Rate</span>
            <span className="font-display text-base font-extrabold text-primary-800">
              {formatCurrency(rate)}/hr
            </span>
          </div>
        </div>
      </div>

      {/* Progress Steps Header */}
      <Card>
        <CardBody className="py-4">
          <ol className="flex items-center gap-1 overflow-x-auto no-scrollbar sm:gap-2" aria-label="Booking steps">
            {steps.map((st, i) => {
              const done = i < step
              const current = i === step
              const reachable = i <= maxStep
              return (
                <li key={st.id} className="flex shrink-0 items-center gap-1 sm:gap-2">
                  <button
                    type="button"
                    onClick={() => jumpTo(i)}
                    disabled={!reachable}
                    aria-current={current ? 'step' : undefined}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-full px-2 py-1.5 text-xs font-semibold transition sm:px-3',
                      current ? 'bg-mint-100 text-primary-800' : done && reachable ? 'text-ink hover:bg-slate-100' : 'text-faint',
                      reachable ? 'cursor-pointer' : 'cursor-not-allowed opacity-60',
                    )}
                  >
                    <span
                      className={cn(
                        'grid h-7 w-7 shrink-0 place-items-center rounded-full border text-[11px] font-bold',
                        current
                          ? 'border-primary-700 bg-primary-700 text-white'
                          : done && reachable
                            ? 'border-primary-300 bg-mint-100 text-primary-700'
                            : 'border-line-strong bg-white text-faint',
                      )}
                    >
                      {done && reachable ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}
                    </span>
                    <span className="hidden md:inline">{st.label}</span>
                  </button>
                  {i < steps.length - 1 ? <span className="h-px w-4 shrink-0 bg-line sm:w-6" aria-hidden="true" /> : null}
                </li>
              )
            })}
          </ol>
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
            >
              {/* Step 1: Care Service */}
              {currentStepId === 'service' ? (
                <Card>
                  <CardHeader title="What care does your loved one need?" subtitle="Pick the service that fits best — you can add notes later." />
                  <CardBody className="grid gap-3 sm:grid-cols-2">
                    {availableServices.map((svc) => {
                      const selected = form.service?.id === svc.id || form.service?._id === svc._id
                      const Icon = svc.icon || Sparkles
                      return (
                        <button
                          key={svc.id || svc._id}
                          type="button"
                          onClick={() => set({ service: svc })}
                          className={cn(
                            'group flex items-start gap-4 rounded-2xl border p-4 text-left transition',
                            selected
                              ? 'border-primary-700 bg-mint-50/70 shadow-card ring-2 ring-primary-700/20'
                              : 'border-line bg-white hover:border-primary-300 hover:bg-slate-50',
                          )}
                        >
                          <span
                            className={cn(
                              'grid h-12 w-12 shrink-0 place-items-center rounded-xl transition',
                              selected ? 'bg-primary-700 text-white shadow-sm' : 'bg-mint-100 text-primary-700 group-hover:bg-primary-700 group-hover:text-white',
                            )}
                          >
                            <Icon className="h-6 w-6" />
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <h4 className="font-display text-sm font-bold text-ink">{svc.name}</h4>
                              <span className="font-mono text-xs font-semibold text-primary-700">
                                {formatCurrency(svc.baseHourlyRate || svc.startingPrice || 499)}/hr
                              </span>
                            </div>
                            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">{svc.description}</p>
                          </div>
                        </button>
                      )
                    })}
                  </CardBody>
                </Card>
              ) : null}

              {/* Step 2: Patient Details */}
              {currentStepId === 'patient' ? (
                <Card>
                  <CardHeader title="Who is the care for?" subtitle="Basic patient information helps caretakers prepare appropriately." />
                  <CardBody className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField label="Patient full name" required>
                        <Input
                          placeholder="e.g. Ramesh Sharma"
                          value={form.patientName}
                          onChange={(e) => set({ patientName: e.target.value })}
                        />
                      </FormField>
                      <FormField label="Patient age" required>
                        <Input
                          type="number"
                          placeholder="e.g. 72"
                          min={1}
                          max={120}
                          value={form.patientAge}
                          onChange={(e) => set({ patientAge: e.target.value })}
                        />
                      </FormField>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField label="Relationship to patient" required>
                        <Select value={form.relation} onChange={(e) => set({ relation: e.target.value })}>
                          {RELATIONS.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </Select>
                      </FormField>
                      <FormField label="Primary health condition / mobility">
                        <Input
                          placeholder="e.g. Post-stroke recovery, bedbound"
                          value={form.requirements}
                          onChange={(e) => set({ requirements: e.target.value })}
                        />
                      </FormField>
                    </div>
                  </CardBody>
                </Card>
              ) : null}

              {/* Step 3: Care Setting & Location */}
              {currentStepId === 'setting' ? (
                <Card>
                  <CardHeader title="Where will care take place?" subtitle="Choose between home or hospital bedside care, and enter the address." />
                  <CardBody className="space-y-5">
                    <div className="grid gap-3 sm:grid-cols-2">
                      {[
                        {
                          id: 'Home Care',
                          title: 'Home Bedside',
                          desc: 'Private residence care, companionship, and daily assistance.',
                          icon: Home,
                        },
                        {
                          id: 'Hospital Care',
                          title: 'Hospital Bedside',
                          desc: 'In-hospital attendant support, night vitals, and assistance.',
                          icon: Building2,
                        },
                      ].map((type) => {
                        const selected = form.careType === type.id
                        const Icon = type.icon
                        return (
                          <button
                            key={type.id}
                            type="button"
                            onClick={() => set({ careType: type.id })}
                            className={cn(
                              'flex items-start gap-3.5 rounded-2xl border p-4 text-left transition',
                              selected
                                ? 'border-primary-700 bg-mint-50/70 shadow-card ring-2 ring-primary-700/20'
                                : 'border-line bg-white hover:border-primary-300 hover:bg-slate-50',
                            )}
                          >
                            <span
                              className={cn(
                                'grid h-10 w-10 shrink-0 place-items-center rounded-xl',
                                selected ? 'bg-primary-700 text-white' : 'bg-mint-100 text-primary-700',
                              )}
                            >
                              <Icon className="h-5 w-5" />
                            </span>
                            <div>
                              <p className="font-display text-sm font-bold text-ink">{type.title}</p>
                              <p className="mt-0.5 text-xs text-muted">{type.desc}</p>
                            </div>
                          </button>
                        )
                      })}
                    </div>

                    {/* Quick GPS Location Picker */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-primary-200 bg-mint-50/60 p-4 shadow-xs transition-all duration-200">
                      <div className="flex items-start gap-3">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl font-bold text-white shadow-xs bg-primary-700">
                          <Navigation className={cn('h-5 w-5', detectingLocation && 'animate-spin')} />
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-display text-sm font-bold text-ink">Choose My Current Location</p>
                            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border bg-primary-100 text-primary-800 border-primary-300">
                              <LocateFixed className="h-3 w-3" />
                              GPS Fast Fill
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-muted">
                            {locationCaptured
                              ? `✓ Located: ${locationCaptured.area ? locationCaptured.area + ', ' : ''}${locationCaptured.city || ''} (±${locationCaptured.accuracy || 15}m)`
                              : 'Instantly detect and fill your current city, locality, and street address.'}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleChooseCurrentLocation}
                        disabled={detectingLocation}
                        className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition shadow-xs cursor-pointer shrink-0 bg-primary-700 text-white hover:bg-primary-800 disabled:opacity-60"
                      >
                        {detectingLocation ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin text-white" />
                            Detecting GPS...
                          </>
                        ) : (
                          <>
                            <LocateFixed className="h-4 w-4 text-white" />
                            {locationCaptured ? 'Re-detect My Location' : 'Choose My Current Location'}
                          </>
                        )}
                      </button>
                    </div>

                    {locationCaptured?.lat && locationCaptured?.lng && (
                      <div className="overflow-hidden rounded-xl border border-line bg-slate-50 p-2.5 text-xs">
                        <div className="mb-2 flex items-center justify-between px-1 text-slate-700">
                          <span className="flex items-center gap-1.5 font-medium text-[11px]">
                            <MapPin className="h-3.5 w-3.5 text-primary-700" />
                            GPS: {locationCaptured.lat}, {locationCaptured.lng}
                            {locationCaptured.accuracy && (
                              <span className="text-[10px] text-muted font-normal">(±{locationCaptured.accuracy}m)</span>
                            )}
                          </span>
                          <a
                            href={`https://www.google.com/maps?q=${locationCaptured.lat},${locationCaptured.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary-700 hover:text-primary-800 hover:underline"
                          >
                            <span>Open in Google Maps</span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                        <div className="relative h-36 w-full overflow-hidden rounded-lg bg-slate-200 shadow-inner">
                          <iframe
                            title="Google Maps Location Preview"
                            width="100%"
                            height="100%"
                            loading="lazy"
                            className="border-0"
                            src={`https://maps.google.com/maps?q=${locationCaptured.lat},${locationCaptured.lng}&hl=en&z=15&output=embed`}
                          />
                        </div>
                      </div>
                    )}

                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField label="City" required>
                        <Select value={form.city} onChange={(e) => set({ city: e.target.value })}>
                          {Array.from(new Set([form.city, ...CITIES].filter(Boolean))).map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </Select>
                      </FormField>
                      <FormField label="Locality / Area" required>
                        <Input
                          placeholder="e.g. Bandra West, Indiranagar"
                          value={form.area}
                          onChange={(e) => set({ area: e.target.value })}
                        />
                      </FormField>
                    </div>

                    <FormField label="Full street address / Hospital room no." required>
                      <Input
                        placeholder="e.g. Flat 402, Sunshine Apts, Linking Road / Room 312, Lilavati Hospital"
                        value={form.address}
                        onChange={(e) => set({ address: e.target.value })}
                      />
                    </FormField>

                    {isUrgent ? (
                      <div className="pt-2">
                        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-slate-50 px-4 py-3">
                          <input
                            type="checkbox"
                            checked={terms}
                            onChange={(e) => setTerms(e.target.checked)}
                            className="mt-0.5 h-4 w-4 rounded border-line-strong accent-[#0F766E]"
                          />
                          <span className="text-xs leading-relaxed text-muted">
                            I agree to the Bystander{' '}
                            <Link
                              to="/legal/terms"
                              target="_blank"
                              rel="noreferrer"
                              className="font-semibold text-primary-700 underline decoration-primary-300 underline-offset-2 hover:text-primary-800"
                            >
                              terms of service
                            </Link>{' '}
                            and escrow holding policy.
                          </span>
                        </label>
                      </div>
                    ) : null}
                  </CardBody>
                </Card>
              ) : null}

              {/* Step 4: Schedule */}
              {currentStepId === 'schedule' ? (
                <Card>
                  <CardHeader title="When do you need the caretaker?" subtitle="Pick the starting date, time, and shift duration." />
                  <CardBody className="space-y-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField label="Service date" required>
                        <Input
                          type="date"
                          min={todayISO()}
                          value={form.date}
                          onChange={(e) => set({ date: e.target.value })}
                        />
                      </FormField>
                      <FormField label="Start time" required>
                        <Select value={form.startTime} onChange={(e) => set({ startTime: e.target.value })}>
                          {TIME_OPTIONS.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </Select>
                      </FormField>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-muted">
                        Shift duration (hours)
                      </label>
                      <div className="mt-2.5 grid grid-cols-4 gap-2 sm:grid-cols-6">
                        {[4, 6, 8, 10, 12, 24].map((h) => {
                          const selected = Number(form.hours) === h
                          return (
                            <button
                              key={h}
                              type="button"
                              onClick={() => set({ hours: h })}
                              className={cn(
                                'rounded-xl border py-2.5 text-xs font-bold transition',
                                selected
                                  ? 'border-primary-700 bg-primary-700 text-white shadow-sm'
                                  : 'border-line bg-white text-ink hover:border-primary-300 hover:bg-slate-50',
                              )}
                            >
                              {h} hrs
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </CardBody>
                </Card>
              ) : null}

              {/* Step 5: Directives */}
              {currentStepId === 'instructions' ? (
                <Card>
                  <CardHeader title="Care Directives & Protocols" subtitle="Select specific directives or add custom instructions for the caretaker." />
                  <CardBody className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      {CARE_REQUIREMENTS.map((req) => {
                        const Icon = req.icon
                        const selected = form.extras.includes(req.name)
                        return (
                          <button
                            key={req.id}
                            type="button"
                            onClick={() => toggleExtra(req.name)}
                            className={cn(
                              'flex items-start gap-3 rounded-xl border p-3 text-left transition',
                              selected
                                ? 'border-primary-700 bg-mint-50/70 shadow-sm ring-1 ring-primary-700'
                                : 'border-line bg-white hover:border-primary-300 hover:bg-slate-50',
                            )}
                          >
                            <span
                              className={cn(
                                'grid h-8 w-8 shrink-0 place-items-center rounded-lg',
                                selected ? 'bg-primary-700 text-white' : 'bg-mint-100 text-primary-700',
                              )}
                            >
                              <Icon className="h-4 w-4" />
                            </span>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-ink">{req.name}</p>
                              <p className="mt-0.5 line-clamp-2 text-[11px] text-muted">{req.description}</p>
                            </div>
                          </button>
                        )
                      })}
                    </div>

                    <div className="flex gap-2">
                      <Input
                        placeholder="Add custom directive (e.g. Diabex insulin at 8 PM)"
                        value={customExtra}
                        onChange={(e) => setCustomExtra(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            addCustomExtra()
                          }
                        }}
                      />
                      <Button variant="outline" onClick={addCustomExtra} icon={Plus}>
                        Add
                      </Button>
                    </div>

                    {form.extras.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {form.extras.map((ex) => (
                          <span
                            key={ex}
                            className="inline-flex items-center gap-1.5 rounded-full border border-primary-200 bg-mint-50 px-2.5 py-1 text-xs font-semibold text-primary-900"
                          >
                            {ex}
                            <button
                              type="button"
                              onClick={() => removeExtra(ex)}
                              className="rounded p-0.5 text-primary-700 hover:bg-mint-200"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    ) : null}

                    <FormField label="Special notes / instructions">
                      <Textarea
                        rows={3}
                        placeholder="Any additional details regarding doctor notes, diet preferences, or emergency contacts..."
                        value={form.instructions}
                        onChange={(e) => set({ instructions: e.target.value })}
                      />
                    </FormField>
                  </CardBody>
                </Card>
              ) : null}

              {/* Step 6: Pricing Overview */}
              {currentStepId === 'price' ? (
                <div className="space-y-4">
                  <Card>
                    <CardHeader title="Pricing transparency" subtitle="All fees are clearly broken down. Payment is held in secure escrow." />
                    <CardBody className="space-y-4">
                      <PriceBreakdown
                        baseRate={rate}
                        hours={hours}
                        subtotal={subtotal}
                        platformFee={platformFee}
                        gst={tax}
                        total={total}
                      />
                    </CardBody>
                  </Card>

                  <Card>
                    <CardBody className="flex items-start gap-3">
                      <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary-700" />
                      <p className="text-sm leading-relaxed text-muted">
                        All Bystander caretakers are ID-verified, background-checked and credentialed. Platform fee of{' '}
                        {formatCurrency(platformFee)} includes 24×7 support and the Bystander protection plan.
                      </p>
                    </CardBody>
                  </Card>
                </div>
              ) : null}

              {/* Step 7: Confirm & Broadcast */}
              {currentStepId === 'confirm' ? (
                <Card>
                  <CardHeader title="Review & confirm" subtitle="Please check the details before sending your request." />
                  <CardBody className="space-y-5">
                    <SummaryGrid
                      items={[
                        { icon: UserRound, label: 'Patient', value: `${form.patientName} (${form.patientAge} yrs, ${form.relation})` },
                        { icon: Home, label: 'Service', value: `${form.service?.name} · ${form.careType}` },
                        { icon: MapPin, label: 'Location', value: `${form.address}, ${form.area}, ${form.city}` },
                        {
                          icon: CalendarDays,
                          label: 'Schedule',
                          value: `${formatDate(form.date, { long: true })} · ${form.startTime} · ${formatDuration(form.hours)}`,
                        },
                        { icon: Sparkles, label: 'Dispatch mechanism', value: 'Instant Platform Broadcast (First-come acceptance)' },
                        {
                          icon: ShieldCheck,
                          label: 'Care requirements',
                          value: form.extras.length > 0 ? form.extras.join(', ') : 'Standard care protocol',
                        },
                        {
                          icon: CheckCircle2,
                          label: 'Special notes',
                          value: form.instructions.trim() || 'None added',
                        },
                      ]}
                    />

                    <div className="flex items-start gap-3 rounded-xl border border-primary-200 bg-mint-50/70 p-4">
                      <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary-700" />
                      <div className="text-xs leading-relaxed text-ink">
                        <p className="font-bold text-primary-900">On-Demand Caretaker Broadcast</p>
                        <p className="mt-0.5 text-muted">
                          When you confirm, your request is broadcasted simultaneously to all verified caretakers in {form.city}. The first available caretaker will accept the request and be assigned immediately.
                        </p>
                      </div>
                    </div>

                    {!user ? (
                      <div className="flex items-center gap-3 rounded-xl border border-accent-200 bg-accent-50/80 p-4">
                        <LogIn className="h-5 w-5 shrink-0 text-accent-700" />
                        <div className="text-xs leading-relaxed text-ink">
                          <p className="font-bold text-accent-900">Guest Checkout</p>
                          <p className="text-muted">
                            You are not signed in. Clicking confirm will save your booking details and prompt a quick sign-in to dispatch your request.
                          </p>
                        </div>
                      </div>
                    ) : null}

                    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-slate-50 px-4 py-3.5">
                      <input
                        type="checkbox"
                        checked={terms}
                        onChange={(e) => setTerms(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-line-strong accent-[#0F766E]"
                      />
                      <span className="text-sm leading-relaxed text-muted">
                        I agree to the Bystander{' '}
                        <Link
                          to="/legal/terms"
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold text-primary-700 underline decoration-primary-300 underline-offset-2 hover:text-primary-800"
                        >
                          terms of service
                        </Link>{' '}
                        and understand that payment is held in escrow until the service is completed. Cancellations
                        within 4 hours of the start time may attract a fee.
                      </span>
                    </label>
                  </CardBody>
                </Card>
              ) : null}
            </motion.div>
          </AnimatePresence>

          <div className="mt-6 flex items-center justify-between gap-3">
            <Button variant="ghost" onClick={goBack} disabled={step === 0} icon={ArrowLeft}>
              Back
            </Button>
            {step < steps.length - 1 ? (
              <Button onClick={goNext} disabled={!isCurrentStepValid} iconRight={ArrowRight}>
                {isUrgent ? 'Next: Care setting' : 'Next'}
              </Button>
            ) : (
              <Button
                onClick={handleConfirm}
                disabled={(!terms && !isUrgent) || (!isCurrentStepValid && isUrgent) || submitting}
                loading={submitting}
                icon={isUrgent ? Zap : CheckCircle2}
                className={cn(isUrgent && 'bg-orange-500 hover:bg-orange-600 text-white font-bold shadow-md')}
              >
                {isUrgent ? 'Confirm & broadcast urgent request' : 'Confirm & broadcast request'}
              </Button>
            )}
          </div>
        </div>

        {/* Order Summary Sidebar */}
        <aside className="lg:col-span-4">
          <div className="space-y-4 lg:sticky lg:top-6">
            <Card>
              <CardHeader title="Price summary" subtitle={isUrgent ? 'Urgent dispatch estimate' : 'Live estimate'} />
              <CardBody className="space-y-3">
                {isUrgent ? (
                  <Row label="Booking mode" value="Urgent 2-Step (Immediate)" />
                ) : null}
                <Row label="Service" value={form.service?.name || (isUrgent ? 'On-Demand Caretaker Dispatch' : 'Not selected')} />
                <Row
                  label="Caretaker rate"
                  value={form.service || isUrgent ? `${formatCurrency(rate)} / hour` : '—'}
                />
                <Row label="Duration" value={`${form.hours || (isUrgent ? 6 : 0)} hours`} />
                <Row label="Care setting" value={form.careType || '—'} />
                <Row label="Date" value={form.date ? `${formatDate(form.date)}${isUrgent ? ' (Immediate)' : ''}` : (isUrgent ? 'Today' : '—')} />
                {form.extras?.length ? (
                  <div className="border-t border-line pt-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-faint">Directives</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {form.extras.map((ex) => (
                        <span
                          key={ex}
                          className="inline-flex items-center gap-1 rounded-full bg-mint-50 px-2 py-0.5 text-[11px] font-medium text-primary-900"
                        >
                          <Check className="h-2.5 w-2.5 text-primary-600" />
                          {ex}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="flex items-center justify-between gap-3 border-t border-dashed border-line pt-3.5">
                  <span className="text-sm font-bold text-ink">Estimated total</span>
                  <span className="font-display text-xl font-extrabold tabular-nums text-primary-800">
                    {form.service ? formatCurrency(total) : '—'}
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-faint">
                  Includes platform fee {formatCurrency(platformFee)} and GST (18%) {formatCurrency(tax)}.
                </p>
              </CardBody>
            </Card>
          </div>
        </aside>
      </div>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted">{label}</span>
      <span className="truncate text-right font-semibold text-ink">{value}</span>
    </div>
  )
}

function SummaryGrid({ items }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="flex items-start gap-3 rounded-xl border border-line px-4 py-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-mint-100 text-primary-700">
            <item.icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-faint">{item.label}</p>
            <p className="mt-0.5 text-sm font-semibold leading-snug text-ink">{item.value}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

export default BookCaregiverWizard
