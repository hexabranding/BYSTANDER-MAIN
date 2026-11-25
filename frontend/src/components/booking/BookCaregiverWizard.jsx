import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Accessibility,
  ArrowLeft,
  ArrowRight,
  Bandage,
  Building2,
  CalendarDays,
  CalendarRange,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  HeartHandshake,
  Home,
  MapPin,
  Mars,
  Moon,
  Pill,
  Plus,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
  Utensils,
  Venus,
  X,
  LogIn,
  Zap,
  Loader2,
  LocateFixed,
  Navigation,
  ExternalLink,
  Phone,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/context/AuthContext'
import { useData } from '@/context/DataContext'
import { SERVICES } from '@/data/services'
import { CITIES, GST_RATE, PLATFORM_FEE, KERALA_DISTRICTS, INDIAN_STATES, PRIMARY_HEALTH_CONDITIONS, HEALTH_CONDITION_SUGGESTIONS, AGE_OPTIONS_GROUPS } from '@/utils/constants'
import { formatCurrency, formatDate, formatNumber } from '@/utils/format'
import { DURATION_GROUPS, durationBasis, formatDuration } from '@/utils/duration'
import { cn } from '@/utils/cn'
import { Card, CardBody, CardHeader } from '@/components/common/Card'
import { Button } from '@/components/common/Button'
import { FormField, Input, Select, Textarea } from '@/components/forms/FormField'
import { PriceBreakdown } from '@/components/common/TimelinePrice'
import { RatingStars } from '@/components/common/RatingStars'
import { CardSkeleton } from '@/components/common/States'
import { bookingService, servicesService, caregiversService, financeService, profileService, isMongoObjectId, apiClient } from '@/services'
import InteractiveLocationPicker from './InteractiveLocationPicker'

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

const RELATIONS = ['Mother', 'Father', 'Son', 'Daughter', 'Grandmother', 'Grandfather', 'Wife', 'Husband', 'Sibling', 'Self', 'Other']

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
  const { user, updateProfile } = useAuth()
  const { caregivers, createBooking } = useData()

  const [availableServices, setAvailableServices] = useState(SERVICES)
  const [availableCaregivers, setAvailableCaregivers] = useState([])
  const [loadingCaregivers, setLoadingCaregivers] = useState(true)
  const [pricingConfig, setPricingConfig] = useState({
    serviceBaseRate: 199,
    hourly: { initialRate: 200, maxCap: 500, dynamicPricingEnabled: true, tiers: [] },
    daily: { baseDailyRate: 1500, extraDayDiscount: 250 },
    monthly: { useFormula: true, fixedPackageRate: 37500 },
  })

  useEffect(() => {
    let isMounted = true
    bookingService
      .getPublicPricingConfig()
      .then((res) => {
        if (isMounted && res?.pricing) {
          setPricingConfig(res.pricing)
        }
      })
      .catch(() => { })

    return () => {
      isMounted = false
    }
  }, [])

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
      .catch(() => { })

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
  const [copiedId, setCopiedId] = useState(false)
  const [copiedRef, setCopiedRef] = useState(false)

  const copyToClipboard = async (text, type = 'id') => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(String(text))
      }
      if (type === 'id') {
        setCopiedId(true)
        setTimeout(() => setCopiedId(false), 2000)
      } else {
        setCopiedRef(true)
        setTimeout(() => setCopiedRef(false), 2000)
      }
      toast.success(`${type === 'id' ? 'Booking ID' : 'Reference'} copied to clipboard`)
    } catch {
      toast.info(`${type === 'id' ? 'Booking ID' : 'Reference'}: ${text}`)
    }
  }
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
    address:
      typeof user?.address === 'string' &&
        user?.address !== user?.city &&
        !user?.address.includes('Mumbai, MH')
        ? user.address
        : (user?.street || user?.address?.street || ''),
    city: user?.city && user?.city !== 'Mumbai, MH' && user?.city !== 'Mumbai' ? user.city : 'Kochi, KL',
    area: user?.area && user?.area !== 'Powai' ? user.area : '',
    district: user?.district || '',
    state: user?.state || 'Kerala',
    pincode: user?.pincode || '',
    date: '',
    startTime: '08:00',
    hours: 2,
    bookingType: 'hourly',
    days: 1,
    instructions: '',
    extras: [],
    preferredCaregiverGender: 'Any',
    contactPhone: user?.phone || '',
  }))

  const userPhoneLoadedRef = useRef(Boolean(user?.phone))
  useEffect(() => {
    if (user?.phone && !userPhoneLoadedRef.current) {
      userPhoneLoadedRef.current = true
      setForm((f) => ({ ...f, contactPhone: user.phone }))
    }
  }, [user?.phone])

  const toggleUrgentMode = () => {
    setIsUrgent((prev) => {
      const next = !prev
      if (next) {
        const upcoming = getNextUpcomingTime()
        const defaultUrgentService =
          availableServices.find((s) => s.slug === 'patient-monitoring' || s.name?.toLowerCase().includes('patient monitoring')) ||
          availableServices.find((s) => s.slug === 'companionship') ||
          availableServices[0] ||
          null
        setForm((f) => ({
          ...f,
          service: defaultUrgentService,
          date: upcoming.date,
          startTime: upcoming.startTime,
          hours: 2,
          careType: f.careType || 'Home Care',
          instructions: 'Urgent on-demand broadcast',
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
      const defaultUrgentService =
        availableServices.find((s) => s.slug === 'patient-monitoring' || s.name?.toLowerCase().includes('patient monitoring')) ||
        availableServices.find((s) => s.slug === 'companionship') ||
        availableServices[0] ||
        null
      setForm((f) => ({
        ...f,
        service: defaultUrgentService,
        date: upcoming.date,
        startTime: upcoming.startTime,
        hours: 2,
        careType: f.careType || 'Home Care',
        instructions: 'Urgent on-demand broadcast',
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
    } catch (_) { }
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
    pricingConfig?.hourly?.initialRate ||
    availableServices[0]?.baseHourlyRate ||
    199

  const bookingType = form.bookingType || 'hourly'
  const days = Math.max(1, Number(form.days) || 1)
  const hours = Number(form.hours) || 2

  const baseDaily = Number(pricingConfig?.daily?.baseDailyRate || 1500)
  const extraDiscount = Number(pricingConfig?.daily?.extraDayDiscount || 250)
  const monthlyFormula = pricingConfig?.monthly?.useFormula !== false
  const monthlyFixed = Number(pricingConfig?.monthly?.fixedPackageRate || 37500)

  let subtotal = 0
  let discountAmount = 0
  let grossShiftAmount = 0

  if (bookingType === 'daily') {
    grossShiftAmount = days * baseDaily
    discountAmount = Math.max(0, (days - 1) * extraDiscount)
    subtotal = Math.max(0, grossShiftAmount - discountAmount)
  } else if (bookingType === 'monthly') {
    grossShiftAmount = 30 * baseDaily
    if (monthlyFormula) {
      discountAmount = 29 * extraDiscount
      subtotal = Math.max(0, grossShiftAmount - discountAmount)
    } else {
      subtotal = monthlyFixed
      discountAmount = Math.max(0, grossShiftAmount - subtotal)
    }
  } else {
    subtotal = rate * hours
    grossShiftAmount = subtotal
    discountAmount = 0
  }

  const platformFee = PLATFORM_FEE
  const tax = Math.round((subtotal + platformFee) * GST_RATE)
  const total = subtotal + platformFee + tax

  const isStepValid = (stepId) => {
    switch (stepId) {
      case 'service':
        return Boolean(form.service)
      case 'patient': {
        const cleanPhone = String(form.contactPhone || user?.phone || '').trim().replace(/[\s-]/g, '')
        const phoneValid = cleanPhone.length >= 10
        return Boolean(form.patientName?.trim()) && Boolean(form.patientAge) && phoneValid
      }
      case 'setting': {
        const settingValid =
          Boolean(form.careType) &&
          Boolean(form.address?.trim()) &&
          Boolean(form.area?.trim()) &&
          Boolean(form.district?.trim())
        if (isUrgent) {
          return settingValid && terms && Number(form.hours || 2) >= 2
        }
        return settingValid
      }
      case 'schedule':
        return Boolean(form.date) && Boolean(form.startTime) && Number(form.hours) >= 2
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
  const isGpsOrPinDragRef = useRef(false)
  const lastResolvedRef = useRef('')

  // Smart Forward Geocoding: when user manually types address or PIN code, resolve coordinates and update map
  useEffect(() => {
    if (isGpsOrPinDragRef.current) return

    const key = `${form.address || ''}|${form.area || ''}|${form.district || ''}|${form.pincode || ''}`
    if (key === lastResolvedRef.current) return

    const hasMeaningfulLocation =
      (form.area && form.area.trim().length >= 3) ||
      (form.pincode && /^[1-9][0-9]{5}$/.test(form.pincode.trim())) ||
      (form.address && form.address.trim().length >= 6)

    if (!hasMeaningfulLocation) return

    const timer = setTimeout(async () => {
      try {
        const geoRes = await apiClient.get('/geo/forward', {
          params: {
            address: form.address || '',
            area: form.area || '',
            district: form.district || '',
            pincode: form.pincode || '',
          },
        })
        const geo = geoRes?.data || geoRes
        if (geo?.latitude && geo?.longitude) {
          lastResolvedRef.current = key
          setForm((prev) => {
            const next = {
              ...prev,
              coordinates: {
                latitude: geo.latitude,
                longitude: geo.longitude,
              },
            }
            // Smart PIN & Locality Auto-fill: auto-select or correct district from authoritative postal data
            if (geo.district) {
              const matchedDistrict = KERALA_DISTRICTS.find(
                (d) => d.toLowerCase() === String(geo.district).toLowerCase()
              )
              if (matchedDistrict && matchedDistrict !== prev.district) {
                next.district = matchedDistrict
              }
            }
            // Auto-populate locality if empty and post office / town is resolved
            if (!prev.area?.trim() && geo.locality) {
              next.area = geo.locality
            }
            return next
          })
          setLocationCaptured((prev) => ({
            ...(prev || {}),
            lat: geo.latitude,
            lng: geo.longitude,
            area: geo.locality || form.area || prev?.area,
            city: geo.city || geo.district || form.district,
            district: geo.district || form.district,
            accuracy: 25,
            isManual: true,
          }))
        }
      } catch (_) { }
    }, 600)

    return () => clearTimeout(timer)
  }, [form.address, form.area, form.district, form.pincode])

  const handleChooseCurrentLocation = async () => {
    isGpsOrPinDragRef.current = true
    setDetectingLocation(true)

    // High-accuracy browser GPS / Wi-Fi positioning (enableHighAccuracy forces GPS chip / Wi-Fi trilateration)
    const getBrowserCoords = () =>
      new Promise((resolve) => {
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
          resolve(null)
          return
        }
        const timer = setTimeout(() => resolve(null), 8000)
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            clearTimeout(timer)
            resolve({
              latitude: Number(pos.coords.latitude.toFixed(6)),
              longitude: Number(pos.coords.longitude.toFixed(6)),
              accuracy: pos.coords.accuracy ? Math.round(pos.coords.accuracy) : 10,
            })
          },
          () => {
            clearTimeout(timer)
            resolve(null)
          },
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
        )
      })

    // Instant IP Geolocation fallback (works when GPS hardware/permission is blocked)
    const getIpCoords = async () => {
      try {
        const res = await fetch('https://ipwho.is/')
        if (res.ok) {
          const data = await res.json()
          if (data.latitude && data.longitude) {
            return {
              latitude: Number(Number(data.latitude).toFixed(6)),
              longitude: Number(Number(data.longitude).toFixed(6)),
              city: data.city || '',
              region: data.region || '',
              postal: data.postal || '',
              accuracy: 50,
            }
          }
        }
      } catch (_) { }

      try {
        const res2 = await fetch('https://ipapi.co/json/')
        if (res2.ok) {
          const d2 = await res2.json()
          if (d2.latitude && d2.longitude) {
            return {
              latitude: Number(Number(d2.latitude).toFixed(6)),
              longitude: Number(Number(d2.longitude).toFixed(6)),
              city: d2.city || '',
              region: d2.region || '',
              postal: d2.postal || '',
              accuracy: 50,
            }
          }
        }
      } catch (_) { }

      return null
    }

    try {
      // 1. Try browser device coordinates with high-accuracy GPS
      let coords = await getBrowserCoords()
      let ipData = null

      // 2. If browser GPS timed out or failed, fallback to IP Geolocation
      if (!coords) {
        ipData = await getIpCoords()
        if (ipData) {
          coords = {
            latitude: ipData.latitude,
            longitude: ipData.longitude,
            accuracy: ipData.accuracy,
          }
        }
      }

      if (!coords) {
        throw new Error('Location detection unavailable. Please enter your address manually.')
      }

      const { latitude: lat, longitude: lng, accuracy } = coords
      let detectedCity = ''
      let detectedArea = ''
      let detectedAddress = ''
      let detectedDistrict = ''
      let detectedState = ''
      let detectedPincode = ''

      // 3. Reverse Geocode via Bystander Geo Service (Google Maps API + High-Resolution Nominatim + India Post)
      try {
        const geoRes = await apiClient.get('/geo/reverse', {
          params: { lat, lng },
        })
        const geo = geoRes?.data || geoRes
        if (geo?.address || geo?.area) {
          detectedAddress = geo.address || detectedAddress
          detectedArea = geo.area || detectedArea
          detectedCity = geo.city || detectedCity
          detectedDistrict = geo.district || detectedDistrict
          detectedState = geo.state || detectedState
          detectedPincode = geo.pincode || detectedPincode
        }
      } catch (geoErr) {
        console.warn('[Booking] Server reverse-geocoding fallback:', geoErr?.message)
      }

      // 4. Client-side fallback if backend was unavailable
      if (!detectedAddress || !detectedArea) {
        try {
          const controller = new AbortController()
          const timer = setTimeout(() => controller.abort(), 4000)
          const geoRes = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=19&addressdetails=1`,
            {
              signal: controller.signal,
              headers: { 'Accept-Language': 'en' },
            },
          )
          clearTimeout(timer)

          if (geoRes.ok) {
            const data = await geoRes.json()
            const addr = data.address || {}

            const rawCity =
              addr.city || addr.town || addr.city_district || addr.suburb || addr.state_district || ipData?.city || ''
            const rawState = addr.state || ipData?.region || ''

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

            detectedCity = detectedCity || matchedCity || rawCity
            detectedArea =
              detectedArea ||
              addr.suburb ||
              addr.neighbourhood ||
              addr.residential ||
              addr.subdistrict ||
              addr.quarter ||
              addr.city_district ||
              ipData?.city ||
              ''

            detectedDistrict =
              detectedDistrict ||
              KERALA_DISTRICTS.find(
                (d) =>
                  (addr.state_district && addr.state_district.toLowerCase().includes(d.toLowerCase())) ||
                  (addr.county && addr.county.toLowerCase().includes(d.toLowerCase())),
              ) || ''
            detectedPincode =
              detectedPincode || (addr.postcode ? String(addr.postcode).replace(/\D/g, '').slice(0, 6) : '')
            detectedState = detectedState || addr.state || (detectedDistrict ? 'Kerala' : '')

            const landmark =
              addr.shop ||
              addr.building ||
              addr.amenity ||
              addr.office ||
              addr.commercial ||
              addr.house_name ||
              addr.place

            const streetParts = [
              landmark ? `Near ${landmark}` : '',
              addr.house_number ? `#${addr.house_number}` : '',
              addr.road,
            ].filter(Boolean)

            if (!detectedAddress) {
              detectedAddress =
                streetParts.length > 0
                  ? streetParts.join(', ')
                  : data.display_name?.split(',').slice(0, 3).join(', ') || `${detectedArea}, ${detectedCity}`
            }
          }
        } catch (_) { }
      }

      if (!detectedCity && ipData) {
        detectedCity = ipData.region ? `${ipData.city}, ${ipData.region}` : ipData.city
        detectedArea = detectedArea || ipData.city
        detectedAddress = detectedAddress || `${ipData.city}, ${ipData.region}`
      }

      if (!detectedAddress) {
        detectedAddress = `Location (${lat}, ${lng})`
      }

      // Automatically populate inputs in form state
      setForm((prev) => ({
        ...prev,
        city: detectedCity || prev.city,
        area: detectedArea || prev.area,
        district: detectedDistrict || prev.district || '',
        state: detectedState || prev.state || 'Kerala',
        pincode: detectedPincode || prev.pincode || '',
        address: detectedAddress,
        coordinates: {
          latitude: lat,
          longitude: lng,
        },
      }))

      lastResolvedRef.current = `${detectedAddress}|${detectedArea}|${detectedDistrict}|${detectedPincode}`
      setLocationCaptured({
        lat,
        lng,
        accuracy,
        area: detectedArea,
        city: detectedCity,
        address: detectedAddress,
        isManual: false,
      })

      toast.success('Location detected & entered!', {
        description: `${detectedArea ? detectedArea + ', ' : ''}${detectedCity || 'Current location'}`,
      })
    } catch (err) {
      toast.error('Location detection failed', {
        description: err.message || 'Please type your city and address manually.',
      })
    } finally {
      setDetectingLocation(false)
      setTimeout(() => {
        isGpsOrPinDragRef.current = false
      }, 600)
    }
  }

  const handlePinMoved = async (newLat, newLng, placeDetails = null) => {
    isGpsOrPinDragRef.current = true
    setLocationCaptured((prev) => ({
      ...(prev || {}),
      lat: newLat,
      lng: newLng,
      isManual: false,
    }))

    setForm((prev) => ({
      ...prev,
      coordinates: {
        latitude: newLat,
        longitude: newLng,
      },
    }))

    // Reverse geocode moved pin to update address, area, district, and pincode
    try {
      let geo = placeDetails
      if (!geo) {
        const geoRes = await apiClient.get('/geo/reverse', {
          params: { lat: newLat, lng: newLng },
        })
        geo = geoRes?.data || geoRes
      }

      if (geo) {
        const resolvedAddress = geo.address || geo.formattedAddress || ''
        const resolvedArea = geo.area || ''
        const resolvedCity = geo.city || ''
        const resolvedDistrict = geo.district || ''
        const resolvedState = geo.state || 'Kerala'
        const resolvedPincode = geo.pincode || ''

        const matchedDistrict =
          KERALA_DISTRICTS.find((d) => d.toLowerCase() === String(resolvedDistrict).toLowerCase()) ||
          resolvedDistrict

        lastResolvedRef.current = `${resolvedAddress}|${resolvedArea}|${matchedDistrict || ''}|${resolvedPincode}`

        setForm((prev) => ({
          ...prev,
          address: resolvedAddress || prev.address,
          area: resolvedArea || prev.area,
          city: resolvedCity || prev.city,
          district: matchedDistrict || prev.district,
          state: resolvedState || prev.state,
          pincode: resolvedPincode || prev.pincode,
        }))

        setLocationCaptured((prev) => ({
          ...(prev || {}),
          lat: newLat,
          lng: newLng,
          area: resolvedArea || prev?.area,
          city: resolvedCity || prev?.city,
          address: resolvedAddress || prev?.address,
        }))

        if (resolvedAddress || resolvedArea) {
          toast.success('Location selected from map', {
            description: [resolvedAddress, resolvedArea, resolvedCity].filter(Boolean).join(', '),
          })
        }
      }
    } catch (err) {
      console.warn('[handlePinMoved] reverse geocode error:', err)
    } finally {
      setTimeout(() => {
        isGpsOrPinDragRef.current = false
      }, 600)
    }
  }

  const handleConfirm = async () => {
    let activeService = form.service
    if (isUrgent) {
      const defaultUrgentService =
        availableServices.find((s) => s.slug === 'patient-monitoring' || s.name?.toLowerCase().includes('patient monitoring')) ||
        availableServices.find((s) => s.slug === 'companionship') ||
        availableServices[0] ||
        null
      activeService = defaultUrgentService
    } else if (!activeService && availableServices.length > 0) {
      activeService = availableServices[0]
      setForm((f) => ({ ...f, service: availableServices[0] }))
    }

    if (!activeService || submitting) return

    // Guest Authentication Guard
    if (!user) {
      try {
        sessionStorage.setItem('pending_booking_broadcast', JSON.stringify({ ...form, service: activeService }))
      } catch (_) { }
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

      const isDailyBooking = form.bookingType === 'daily'
      const isMonthlyBooking = form.bookingType === 'monthly'
      const totalShiftHours = isMonthlyBooking
        ? 30 * 24
        : isDailyBooking
          ? Math.max(1, Number(form.days) || 1) * 24
          : Math.max(2, Math.min(24, Number(form.hours) || 2))
      const localEndDate = new Date(localStartDate.getTime() + totalShiftHours * 60 * 60 * 1000)

      // Broadcast payload: No caregiverId required. Broadcasts to all active caretakers!
      const payload = {
        serviceId,
        isUrgent: Boolean(isUrgent),
        bookingType: form.bookingType || 'hourly',
        days: isMonthlyBooking ? 30 : isDailyBooking ? Math.max(1, Number(form.days) || 1) : 1,
        discountAmount,
        startDateTime: localStartDate.toISOString(),
        endDateTime: localEndDate.toISOString(),
        timezone: 'Asia/Kolkata',
        preferredGender: form.preferredCaregiverGender || 'Any',
        location: {
          street: form.address.trim(),
          addressLine: form.address.trim(),
          city: (form.city || form.area || form.district || 'Kerala').trim(),
          area: form.area.trim(),
          district: (form.district || '').trim(),
          state: (form.state || 'Kerala').trim(),
          pincode: (form.pincode || '').trim(),
          careSetting: form.careType === 'Hospital Care' ? 'Hospital Care' : 'Home Care',
          coordinates: form.coordinates?.latitude && form.coordinates?.longitude
            ? {
              latitude: Number(form.coordinates.latitude),
              longitude: Number(form.coordinates.longitude),
            }
            : undefined,
        },
        patientDetails: {
          name: form.patientName.trim(),
          age: Number(form.patientAge) || Number(patientInfo?.age) || 60,
          gender: 'Other',
          specialInstructions: [
            isUrgent ? 'URGENT DISPATCH PROTOCOL' : '',
            form.contactPhone?.trim() ? `Emergency Contact Phone: ${form.contactPhone.trim()}` : '',
            form.instructions?.trim() ? `Instructions: ${form.instructions.trim()}` : '',
            form.extras?.length > 0 ? `Care Directives: ${form.extras.join(', ')}` : '',
            form.preferredCaregiverGender && form.preferredCaregiverGender !== 'Any'
              ? `Preferred Caretaker Gender: ${form.preferredCaregiverGender}`
              : '',
          ]
            .filter(Boolean)
            .join(' · ') || (isUrgent ? 'Urgent shift protocol' : 'Standard shift protocol'),
        },
      }

      const cleanPhone = String(form.contactPhone || user?.phone || '').trim()
      if (cleanPhone && cleanPhone !== user?.phone) {
        try {
          await profileService.updateCustomerProfile({
            phone: cleanPhone,
            mobile: cleanPhone,
          })
          if (updateProfile) {
            updateProfile({ phone: cleanPhone })
          }
        } catch (_) { }
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
        description: `Reference ${booking.ref} — all active caretakers within 30 km in ${form.city} have been notified. You can pay once your shift is completed.`,
      })
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
      <Card className="mx-auto max-w-2xl overflow-hidden border border-line bg-white shadow-card">
        <div className="h-1.5 w-full bg-gradient-to-r from-primary-600 via-mint-500 to-primary-700" />
        <CardBody className="flex flex-col items-center px-5 py-8 sm:px-8 sm:py-10 text-center">
          <motion.span
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 18 }}
            className="grid h-16 w-16 place-items-center rounded-full bg-mint-100 text-primary-700 shadow-sm"
          >
            <CheckCircle2 className="h-9 w-9" />
          </motion.span>
          <h2 className="mt-4 font-display text-2xl font-extrabold text-ink sm:text-3xl">
            You're all set, {(user?.name || form.patientName || 'Customer').split(' ')[0]}!
          </h2>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">
            We are broadcasting your request to verified caretakers in <strong>{form.city}</strong> for <strong>{created.service || form.service?.name}</strong>. You will get immediate updates once accepted.
          </p>

          {/* Reference & Booking ID Section */}
          <div className="mt-6 w-full max-w-lg space-y-3 rounded-2xl border border-line bg-slate-50/80 p-4 sm:p-5 text-left shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/70 pb-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Booking Reference</p>
                <div className="mt-0.5 flex items-center gap-2">
                  <span className="font-display text-lg font-black tracking-tight text-primary-800">
                    {created.ref || `CM-${String(created.id).slice(-6).toUpperCase()}`}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(created.ref || created.id, 'ref')}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-line bg-white text-muted transition hover:bg-slate-100 hover:text-ink active:scale-95 cursor-pointer"
                    title="Copy Reference"
                    aria-label="Copy Reference"
                  >
                    {copiedRef ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800 shadow-2xs">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-600" />
                </span>
                Live Broadcast Active
              </span>
            </div>

            {/* Booking ID Fixed Layout */}
            <div className="pt-0.5">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted">System Booking ID</p>
                <span className="text-[10px] font-semibold text-faint">Database Key</span>
              </div>
              <div className="mt-1.5 flex items-center justify-between gap-2 rounded-xl border border-line bg-white px-3 py-2 shadow-2xs">
                <span className="min-w-0 select-all font-mono text-xs sm:text-[13px] font-semibold text-slate-700 break-all" title={created.id}>
                  {created.id}
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(created.id, 'id')}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-bold text-primary-700 hover:bg-primary-50 transition active:scale-95 cursor-pointer"
                  title="Copy Booking ID"
                >
                  {copiedId ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                      <span className="text-emerald-700">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5 text-primary-600" />
                      <span>Copy ID</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Summary Details Grid */}
            <div className="grid grid-cols-2 gap-2.5 border-t border-line/70 pt-2.5 text-xs text-muted">
              <div>
                <span className="text-faint">Service:</span>{' '}
                <strong className="font-semibold text-ink">{created.service || form.service?.name}</strong>
              </div>
              <div>
                <span className="text-faint">Patient:</span>{' '}
                <strong className="font-semibold text-ink">
                  {form.patientName} {form.patientAge ? `(${form.patientAge}y)` : ''}
                </strong>
              </div>
              <div>
                <span className="text-faint">Location:</span>{' '}
                <strong className="font-semibold text-ink">{form.city}</strong>
              </div>
              <div>
                <span className="text-faint">Duration:</span>{' '}
                <strong className="font-semibold text-ink">
                  {form.bookingType === 'daily' ? `${days} day${days > 1 ? 's' : ''}` : `${form.hours} hrs`}
                </strong>
              </div>
            </div>
          </div>
          <div className="mt-7 flex w-full max-w-sm flex-col gap-2.5 sm:flex-row sm:max-w-md justify-center">
            <Button size="lg" className="w-full sm:w-auto" onClick={() => navigate(`/customer/bookings/${created.id}`)} iconRight={ArrowRight}>
              View live status
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="w-full sm:w-auto"
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
                                {formatCurrency(svc.baseHourlyRate || svc.startingPrice || 199)}/hr
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
                          id="patient-age"
                          min={1}
                          max={120}
                          placeholder="e.g. 44"
                          value={form.patientAge}
                          onChange={(e) => {
                            const val = e.target.value
                            if (val === '') {
                              set({ patientAge: '' })
                              return
                            }
                            const num = parseInt(val, 10)
                            if (!Number.isNaN(num)) {
                              set({ patientAge: String(Math.min(120, Math.max(0, num))) })
                            }
                          }}
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
                      <FormField
                        label="Contact mobile number"
                        required
                        hint={
                          user?.phone && form.contactPhone && form.contactPhone !== user.phone ? (
                            <span className="flex items-center gap-1.5">
                              <span>Custom contact number</span>
                              <button
                                type="button"
                                onClick={() => set({ contactPhone: user.phone })}
                                className="text-primary-700 underline hover:text-primary-800"
                              >
                                (Reset to {user.phone})
                              </button>
                            </span>
                          ) : user?.phone ? (
                            'Confirmed on file · caretakers call to coordinate arrival'
                          ) : (
                            'Required — used for arrival calls & SMS shift alerts'
                          )
                        }
                      >
                        <div className="relative">
                          <Input
                            type="tel"
                            placeholder="e.g. 98765 43210"
                            value={form.contactPhone}
                            onChange={(e) => set({ contactPhone: e.target.value })}
                            className={form.contactPhone ? 'pr-9' : ''}
                          />
                          {form.contactPhone ? (
                            <button
                              type="button"
                              aria-label="Clear mobile number"
                              title="Clear mobile number"
                              onClick={() => set({ contactPhone: '' })}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted transition hover:bg-slate-100 hover:text-ink active:scale-95"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          ) : null}
                        </div>
                      </FormField>
                    </div>

                    <FormField
                      label="Primary health condition / mobility"
                      hint="Select a standard condition or click a quick suggestion, then customize if needed"
                    >
                      <div className="space-y-2.5">
                        {/* Dropdown Selection */}
                        <Select
                          value={
                            PRIMARY_HEALTH_CONDITIONS.includes(form.requirements)
                              ? form.requirements
                              : form.requirements
                                ? 'Other / Custom Condition'
                                : ''
                          }
                          onChange={(e) => {
                            const val = e.target.value
                            if (val === 'Other / Custom Condition') {
                              if (PRIMARY_HEALTH_CONDITIONS.includes(form.requirements)) {
                                set({ requirements: '' })
                              }
                            } else {
                              set({ requirements: val })
                            }
                          }}
                        >
                          <option value="">-- Select primary health condition / mobility --</option>
                          {PRIMARY_HEALTH_CONDITIONS.map((cond) => (
                            <option key={cond} value={cond}>
                              {cond}
                            </option>
                          ))}
                        </Select>

                        {/* Quick Suggestions Badges */}
                        <div>
                          <div className="mb-1.5 flex items-center gap-1.5">
                            <Sparkles className="h-3.5 w-3.5 text-primary-600" />
                            <span className="text-xs font-semibold text-muted">Quick suggestions:</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {HEALTH_CONDITION_SUGGESTIONS.map((sug) => {
                              const isSelected =
                                form.requirements === sug.value ||
                                (form.requirements && form.requirements.toLowerCase().includes(sug.label.toLowerCase()))
                              return (
                                <button
                                  key={sug.label}
                                  type="button"
                                  onClick={() => {
                                    if (form.requirements === sug.value) {
                                      set({ requirements: '' })
                                    } else {
                                      set({ requirements: sug.value })
                                    }
                                  }}
                                  className={cn(
                                    'inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition-all',
                                    isSelected
                                      ? 'border-primary-500 bg-primary-50 text-primary-800 shadow-sm ring-1 ring-primary-500/20'
                                      : 'border-line bg-slate-50/80 text-ink-soft hover:border-primary-300 hover:bg-white hover:text-primary-700'
                                  )}
                                >
                                  {isSelected ? (
                                    <Check className="h-3 w-3 text-primary-600" />
                                  ) : (
                                    <Plus className="h-3 w-3 text-muted" />
                                  )}
                                  {sug.label}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    </FormField>

                    {/* Preferred Caretaker Gender Selection */}
                    <div className="pt-2">
                      <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted">
                        Preferred Caretaker Gender
                      </label>
                      <div className="grid gap-3 sm:grid-cols-3">
                        {[
                          {
                            id: 'Female',
                            label: 'Female Caretaker',
                            hint: 'Recommended for female patients & personal hygiene care',
                            icon: UserRound,
                            subIcon: Venus,
                            iconBg: 'bg-rose-50 text-rose-600 border border-rose-200/80',
                            subBadgeBg: 'bg-rose-600 text-white',
                          },
                          {
                            id: 'Male',
                            label: 'Male Caretaker',
                            hint: 'Recommended for physical lifting & mobility assistance',
                            icon: UserRound,
                            subIcon: Mars,
                            iconBg: 'bg-sky-50 text-sky-600 border border-sky-200/80',
                            subBadgeBg: 'bg-sky-600 text-white',
                          },
                          {
                            id: 'Any',
                            label: 'Any / No Preference',
                            hint: 'Fastest responses from all nearby verified caretakers',
                            icon: Users,
                            subIcon: HeartHandshake,
                            iconBg: 'bg-emerald-50 text-emerald-700 border border-emerald-200/80',
                            subBadgeBg: 'bg-emerald-600 text-white',
                          },
                        ].map((g) => {
                          const active = (form.preferredCaregiverGender || 'Any') === g.id
                          const Icon = g.icon
                          const SubIcon = g.subIcon
                          return (
                            <button
                              key={g.id}
                              type="button"
                              onClick={() => set({ preferredCaregiverGender: g.id })}
                              className={cn(
                                'flex flex-col items-start rounded-xl border p-3.5 text-left transition',
                                active
                                  ? 'border-primary-600 bg-primary-50/70 ring-2 ring-primary-500/20 shadow-sm'
                                  : 'border-line bg-surface hover:border-slate-300 hover:bg-slate-50/60',
                              )}
                            >
                              <div className="flex w-full items-center justify-between">
                                <span className={cn('relative grid h-10 w-10 place-items-center rounded-xl shadow-xs', g.iconBg)}>
                                  <Icon className="h-5 w-5" />
                                  <span className={cn('absolute -bottom-1 -right-1 grid h-4 w-4 place-items-center rounded-full shadow-xs', g.subBadgeBg)}>
                                    <SubIcon className="h-2.5 w-2.5" />
                                  </span>
                                </span>
                                {active ? (
                                  <span className="grid h-5 w-5 place-items-center rounded-full bg-primary-600 text-white shadow-xs">
                                    <Check className="h-3 w-3" />
                                  </span>
                                ) : (
                                  <span className="h-5 w-5 rounded-full border border-line bg-surface" />
                                )}
                              </div>
                              <p className="mt-2.5 text-sm font-bold text-ink">{g.label}</p>
                              <p className="mt-0.5 text-xs leading-relaxed text-muted">{g.hint}</p>
                            </button>
                          )
                        })}
                      </div>
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
                              ? locationCaptured.isManual
                                ? `📍 Mapped to: ${locationCaptured.area ? locationCaptured.area + ', ' : ''}${locationCaptured.city || form.district || 'Kerala'} (via typed address)`
                                : `✓ Located: ${locationCaptured.area ? locationCaptured.area + ', ' : ''}${locationCaptured.city || ''} (±${locationCaptured.accuracy || 15}m)`
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
                      <InteractiveLocationPicker
                        lat={locationCaptured.lat}
                        lng={locationCaptured.lng}
                        accuracy={locationCaptured.accuracy}
                        onLocationChange={handlePinMoved}
                      />
                    )}

                    <FormField label="House / Building / Flat Name & Street Address / Hospital Room" required>
                      <Input
                        placeholder="e.g. House No. 12/450, Greenfield Villa, MG Road / Room 312, Aster Medcity"
                        value={form.address}
                        onChange={(e) => set({ address: e.target.value })}
                      />
                    </FormField>

                    <FormField label="Locality / Town / Landmark" required hint="e.g. Koyilandy, Edappally, Kaloor, Thalassery">
                      <Input
                        placeholder="e.g. Koyilandy, Edappally, Kaloor"
                        value={form.area}
                        onChange={(e) => set({ area: e.target.value })}
                      />
                    </FormField>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField label="District" required>
                        <Select value={form.district || ''} onChange={(e) => set({ district: e.target.value })}>
                          <option value="" disabled>Choose District</option>
                          {KERALA_DISTRICTS.map((d) => (
                            <option key={d} value={d}>
                              {d}
                            </option>
                          ))}
                        </Select>
                      </FormField>

                      <FormField label="State" required>
                        <Select value={form.state || 'Kerala'} onChange={(e) => set({ state: e.target.value })}>
                          {INDIAN_STATES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </Select>
                      </FormField>
                    </div>

                    <FormField label="PIN Code (Postal Code)" hint="6-digit Indian PIN code">
                      <Input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="e.g. 682024"
                        value={form.pincode || ''}
                        onChange={(e) => set({ pincode: e.target.value.replace(/\D/g, '').slice(0, 6) })}
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
                  <CardHeader title="When do you need the caretaker?" subtitle="Choose between flexible hourly shifts, multi-day care with discounts, or a monthly schedule." />
                  <CardBody className="space-y-6">
                    {/* Booking Mode Selector */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-2">
                        Select Booking Mode
                      </label>
                      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                        {[
                          {
                            id: 'hourly',
                            label: 'Hourly Shifts',
                            desc: 'Flexible 2 to 24 hrs care',
                            icon: Clock,
                            iconColor: 'text-amber-600',
                            iconBg: 'bg-amber-50',
                          },
                          {
                            id: 'daily',
                            label: 'Daily (1, 2, 3+ Days)',
                            desc: 'Multi-day with progressive discounts',
                            icon: CalendarDays,
                            iconColor: 'text-primary-700',
                            iconBg: 'bg-mint-50',
                          },
                          {
                            id: 'monthly',
                            label: 'Monthly Package',
                            desc: '30-day comprehensive care plan',
                            icon: CalendarRange,
                            iconColor: 'text-indigo-600',
                            iconBg: 'bg-indigo-50',
                          },
                        ].map((m) => {
                          const active = (form.bookingType || 'hourly') === m.id
                          const ModeIcon = m.icon
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => set({ bookingType: m.id })}
                              className={cn(
                                'flex flex-col items-start rounded-xl border p-3.5 text-left transition-all',
                                active
                                  ? 'border-primary-700 bg-primary-50/70 ring-2 ring-primary-600/20 shadow-xs'
                                  : 'border-line bg-white hover:border-slate-300 hover:bg-slate-50',
                              )}
                            >
                              <div className="flex w-full items-center justify-between">
                                <span className={cn('grid h-7 w-7 place-items-center rounded-lg border border-line/60', m.iconBg, m.iconColor)}>
                                  <ModeIcon className="h-3.5 w-3.5" />
                                </span>
                                {active ? (
                                  <span className="grid h-4 w-4 place-items-center rounded-full bg-primary-700 text-white shadow-xs">
                                    <Check className="h-2.5 w-2.5" />
                                  </span>
                                ) : null}
                              </div>
                              <span className={cn('mt-2 text-xs font-bold', active ? 'text-primary-900' : 'text-ink')}>
                                {m.label}
                              </span>
                              <span className="mt-0.5 text-[11px] text-muted">{m.desc}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField label="Starting date" required>
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

                    {/* Mode A: Hourly Duration */}
                    {(form.bookingType || 'hourly') === 'hourly' ? (
                      <div>
                        <div className="flex items-center justify-between">
                          <label className="block text-xs font-bold uppercase tracking-wider text-muted">
                            Shift duration (hours) · Min 2 hrs
                          </label>
                          <span className="text-xs font-semibold text-primary-700">
                            {form.hours || 2} hours selected
                          </span>
                        </div>
                        <div className="mt-2.5 grid grid-cols-4 gap-2 sm:grid-cols-7">
                          {[2, 4, 6, 8, 10, 12, 24].map((h) => {
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
                        <div className="mt-3 flex items-center gap-2">
                          <span className="text-xs text-muted">Custom duration:</span>
                          <div className="inline-flex items-center rounded-lg border border-line bg-white shadow-xs">
                            <button
                              type="button"
                              aria-label="Decrease hours"
                              title="Decrease hours (-1)"
                              onClick={() => {
                                const curr = Number(form.hours) || 2
                                set({ hours: Math.max(2, curr - 1) })
                              }}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-l-lg border-r border-line text-xs font-bold text-muted hover:bg-slate-100 hover:text-ink active:scale-95"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min={2}
                              max={24}
                              value={form.hours ?? ''}
                              onChange={(e) => {
                                const raw = e.target.value
                                if (raw === '') {
                                  set({ hours: '' })
                                  return
                                }
                                const val = parseInt(raw, 10)
                                if (!Number.isNaN(val)) {
                                  set({ hours: Math.min(24, Math.max(1, val)) })
                                }
                              }}
                              onBlur={() => {
                                if (!form.hours || Number(form.hours) < 2) {
                                  set({ hours: 2 })
                                }
                              }}
                              className="w-14 text-center text-xs font-bold text-ink focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <button
                              type="button"
                              aria-label="Increase hours"
                              title="Increase hours (+1)"
                              onClick={() => {
                                const curr = Number(form.hours) || 2
                                set({ hours: Math.min(24, curr + 1) })
                              }}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-r-lg border-l border-line text-xs font-bold text-muted hover:bg-slate-100 hover:text-ink active:scale-95"
                            >
                              +
                            </button>
                          </div>
                          <span className="text-xs text-muted">hours (open freely, min 2 hrs)</span>
                        </div>
                      </div>
                    ) : null}

                    {/* Mode B: Daily Multi-Day Duration */}
                    {form.bookingType === 'daily' ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="block text-xs font-bold uppercase tracking-wider text-muted">
                            Number of Days · Progressive Multi-Day Discount
                          </label>
                          <span className="text-xs font-semibold text-primary-700">
                            {days} {days === 1 ? 'day' : 'days'} selected
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
                          {[1, 2, 3, 4, 5, 7].map((d) => {
                            const pGross = d * baseDaily
                            const pSave = Math.max(0, (d - 1) * extraDiscount)
                            const pPrice = Math.max(0, pGross - pSave)
                            const selected = days === d
                            return (
                              <button
                                key={d}
                                type="button"
                                onClick={() => set({ days: d })}
                                className={cn(
                                  'flex flex-col items-center justify-center rounded-xl border p-2.5 text-center transition',
                                  selected
                                    ? 'border-primary-700 bg-primary-700 text-white shadow-sm'
                                    : 'border-line bg-white hover:border-primary-300 hover:bg-slate-50 text-ink',
                                )}
                              >
                                <span className="text-xs font-bold">
                                  {d} {d === 1 ? 'Day' : 'Days'}
                                </span>
                                <span className={cn('text-[11px] font-semibold', selected ? 'text-primary-100' : 'text-primary-800')}>
                                  ₹{formatNumber(pPrice)}
                                </span>
                                {pSave > 0 ? (
                                  <span
                                    className={cn(
                                      'mt-1 rounded-full px-1.5 py-0.2 text-[9px] font-extrabold',
                                      selected ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800',
                                    )}
                                  >
                                    Save ₹{formatNumber(pSave)}
                                  </span>
                                ) : null}
                              </button>
                            )
                          })}
                        </div>

                        <div className="mt-3 flex items-center gap-2">
                          <span className="text-xs text-muted">Custom days:</span>
                          <div className="inline-flex items-center rounded-lg border border-line bg-white shadow-xs">
                            <button
                              type="button"
                              aria-label="Decrease days"
                              title="Decrease days (-1)"
                              onClick={() => {
                                const curr = Number(days) || 1
                                set({ days: Math.max(1, curr - 1) })
                              }}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-l-lg border-r border-line text-xs font-bold text-muted hover:bg-slate-100 hover:text-ink active:scale-95"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min={1}
                              max={60}
                              value={days ?? ''}
                              onChange={(e) => {
                                const raw = e.target.value
                                if (raw === '') {
                                  set({ days: '' })
                                  return
                                }
                                const val = parseInt(raw, 10)
                                if (!Number.isNaN(val)) {
                                  set({ days: Math.min(60, Math.max(1, val)) })
                                }
                              }}
                              onBlur={() => {
                                if (!days || Number(days) < 1) {
                                  set({ days: 1 })
                                }
                              }}
                              className="w-14 text-center text-xs font-bold text-ink focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <button
                              type="button"
                              aria-label="Increase days"
                              title="Increase days (+1)"
                              onClick={() => {
                                const curr = Number(days) || 1
                                set({ days: Math.min(60, curr + 1) })
                              }}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-r-lg border-l border-line text-xs font-bold text-muted hover:bg-slate-100 hover:text-ink active:scale-95"
                            >
                              +
                            </button>
                          </div>
                          <span className="text-xs text-muted">
                            days ({formatCurrency(baseDaily)}/day base with -{formatCurrency(extraDiscount)} per extra day)
                          </span>
                        </div>

                        {discountAmount > 0 ? (
                          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 text-xs text-emerald-900">
                            <Sparkles className="h-4 w-4 shrink-0 text-emerald-700" />
                            <span>
                              <strong>Multi-Day Discount Applied:</strong> You are saving{' '}
                              <strong>{formatCurrency(discountAmount)}</strong> on this {days}-day booking!
                            </span>
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {/* Mode C: Monthly Package */}
                    {form.bookingType === 'monthly' ? (
                      <div className="rounded-xl border border-primary-200 bg-gradient-to-br from-mint-50/80 via-white to-slate-50 p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-primary-900 text-sm">
                            30-Day Comprehensive Bedside Care Package
                          </span>
                          <span className="rounded-full bg-primary-700 px-3 py-1 text-xs font-bold text-white shadow-xs">
                            {formatCurrency(subtotal)} / Month
                          </span>
                        </div>
                        <p className="text-xs text-muted leading-relaxed">
                          Includes dedicated daily bystander coverage for 30 consecutive days from{' '}
                          <strong className="text-ink">{form.date || 'your selected start date'}</strong>.{' '}
                          {discountAmount > 0 ? (
                            <>
                              Maximum family savings of{' '}
                              <strong className="text-emerald-700">{formatCurrency(discountAmount)}</strong> compared to standard single-day rates (~{formatCurrency(Math.round(subtotal / 30))}/day effective).
                            </>
                          ) : (
                            <>Dedicated monthly package rate (~{formatCurrency(Math.round(subtotal / 30))}/day effective).</>
                          )}
                        </p>
                      </div>
                    ) : null}
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
                        items={
                          discountAmount > 0
                            ? [
                              {
                                label:
                                  form.bookingType === 'daily'
                                    ? `${days} Days Shift (${formatCurrency(baseDaily)}/day base)`
                                    : '30-Day Monthly Care Package',
                                amount: grossShiftAmount,
                              },
                              {
                                label: 'Multi-Day Progressive Discount',
                                amount: -discountAmount,
                                meta: 'Special multi-day booking discount applied',
                              },
                            ]
                            : []
                        }
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
                        { icon: UserRound, label: 'Patient', value: form.patientAge ? `${form.patientName} (${form.patientAge} yrs, ${form.relation})` : `${form.patientName} (${form.relation})` },
                        { icon: Phone, label: 'Contact Phone', value: form.contactPhone || user?.phone || 'On file' },
                        {
                          icon: UserRound,
                          label: 'Preferred Caretaker',
                          value: `${form.preferredCaregiverGender || 'Any'} Gender (${form.preferredCaregiverGender === 'Female'
                              ? 'Female caretaker requested'
                              : form.preferredCaregiverGender === 'Male'
                                ? 'Male caretaker requested'
                                : 'Any gender / fastest match'
                            })`,
                        },
                        {
                          icon: MapPin,
                          label: 'Location',
                          value: `${form.address}, ${form.area}${form.district ? `, ${form.district}` : ''}${form.pincode ? ` - ${form.pincode}` : ''}`,
                        },
                        {
                          icon: CalendarDays,
                          label: 'Schedule',
                          value: `${formatDate(form.date, { long: true })} · ${form.startTime} · ${formatDuration(form.hours)}`,
                        },
                        { icon: Sparkles, label: 'Selection Mode', value: 'Multi-Caretaker Offers · You Choose Best Match' },
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
                        <p className="font-bold text-primary-900">Multi-Caretaker Offer & Selection Flow</p>
                        <p className="mt-0.5 text-muted">
                          When you confirm, your request is broadcasted to verified {form.preferredCaregiverGender && form.preferredCaregiverGender !== 'Any' ? `${form.preferredCaregiverGender.toLowerCase()} ` : ''}caretakers in {form.city}. Multiple caretakers can accept with their rating and hourly rate, allowing you to choose the exact caretaker you prefer.
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
                ) : (
                  <Row
                    label="Booking mode"
                    value={
                      form.bookingType === 'daily'
                        ? `Daily (${days} ${days === 1 ? 'day' : 'days'})`
                        : form.bookingType === 'monthly'
                          ? 'Monthly Package (30 days)'
                          : 'Hourly Shift'
                    }
                  />
                )}
                <Row label="Service" value={isUrgent ? 'On-Demand Caretaker Dispatch' : (form.service?.name || 'Not selected')} />
                {form.bookingType === 'hourly' || isUrgent ? (
                  <>
                    <Row
                      label="Caretaker rate"
                      value={form.service || isUrgent ? `${formatCurrency(rate)} / hour` : '—'}
                    />
                    <Row label="Duration" value={isUrgent ? 'Initial dispatch (2 hrs)' : `${form.hours || 2} hours`} />
                  </>
                ) : (
                  <>
                    <Row label="Gross shift charges" value={formatCurrency(grossShiftAmount)} />
                    {discountAmount > 0 ? (
                      <div className="flex items-center justify-between gap-3 text-sm font-semibold text-emerald-700">
                        <span>Multi-day discount</span>
                        <span className="tabular-nums">− {formatCurrency(discountAmount)}</span>
                      </div>
                    ) : null}
                    <Row label="Net shift charges" value={formatCurrency(subtotal)} />
                  </>
                )}
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
