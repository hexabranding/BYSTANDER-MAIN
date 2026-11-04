import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Banknote,
  BadgeCheck,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  FileCheck2,
  Home,
  Info,
  Landmark,
  Loader2,
  LocateFixed,
  MapPin,
  PhoneCall,
  Radio,
  UserRound,
} from 'lucide-react'
import apiClient from '@/services/apiClient'
import { useDocumentTitle } from '@/hooks/useUi'
import { useAuth } from '@/context/AuthContext'
import { useData } from '@/context/DataContext'
import { FormField, Input, Select } from '@/components/forms/FormField'
import { FileUpload } from '@/components/forms/FileUpload'
import { Button } from '@/components/common/Button'
import { Card, CardBody } from '@/components/common/Card'
import { ProgressBar, Chip } from '@/components/common/Tabs'
import { StatusBadge } from '@/components/common/StatusBadge'
import { QUALIFICATIONS, LANGUAGES, KERALA_DISTRICTS, INDIAN_STATES } from '@/utils/constants'
import { cn } from '@/utils/cn'

const STEPS = [
  { key: 'personal', label: 'Personal', icon: UserRound },
  { key: 'professional', label: 'Professional', icon: BadgeCheck },
  { key: 'documents', label: 'Documents', icon: FileCheck2 },
  { key: 'bank', label: 'Bank & ID', icon: Landmark },
]

const STEP_FIELDS = [
  ['fullName', 'mobile', 'email', 'dob', 'gender', 'street', 'area', 'district', 'state', 'pincode', 'password'],
  ['qualification', 'experience', 'nursingRegNo', 'languages', 'careSettings'],
  [],
  ['emergencyName', 'emergencyRelationship', 'emergencyPhone', 'bankHolder', 'accountNumber', 'ifsc', 'declaration'],
]

const NURSING_QUALIFICATIONS = ['GNM Nursing', 'B.Sc Nursing', 'ANM Nursing', 'Nursing Student (Final Year)']
const isNursingQualification = (q) => NURSING_QUALIFICATIONS.includes(q)
const isNursingStudent = (q) => q === 'Nursing Student (Final Year)'

const CARE_SETTINGS = [
  { value: 'Home Care', label: 'Home visits', hint: 'In-home shifts with families' },
  { value: 'Hospital Care', label: 'Hospital placement', hint: 'Shifts via partner hospitals' },
]

const validateMobile = (value) => {
  const digits = String(value || '').replace(/\D/g, '')
  if (!digits) return 'Mobile number is required'
  if (!/^([6-9]\d{9}|91[6-9]\d{9})$/.test(digits)) return 'Enter a valid 10-digit Indian mobile number'
  return true
}

const DEMO_UPLOAD_HINT = 'Demo upload — files stay in your browser and are never stored or uploaded.'

function StepIndicator({ step }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[11px] font-semibold">
        {STEPS.map((s, i) => (
          <span
            key={s.key}
            className={cn(
              'flex items-center gap-1.5 transition-colors',
              i === step ? 'text-primary-700' : i < step ? 'text-ink-soft' : 'text-faint',
            )}
          >
            {i < step ? (
              <span className="grid h-5 w-5 place-items-center rounded-full bg-primary-700 text-white">
                <Check className="h-3 w-3" />
              </span>
            ) : (
              <span
                className={cn(
                  'grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold',
                  i === step ? 'bg-primary-700 text-white' : 'bg-slate-100 text-muted',
                )}
              >
                {i + 1}
              </span>
            )}
            <span className="hidden sm:inline">{s.label}</span>
          </span>
        ))}
      </div>
      <ProgressBar value={step} max={STEPS.length - 1} />
    </div>
  )
}

export function RegisterCaregiverPage() {
  useDocumentTitle('Apply as caretaker')
  const navigate = useNavigate()
  const { registerCaregiver } = useAuth()
  const { registerCaregiverProfile } = useData()
  const [step, setStep] = useState(0)
  const [showPassword, setShowPassword] = useState(false)
  const [docError, setDocError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const pendingEmail = useRef('')
  const redirectTimer = useRef(null)

  const adultCutoff = new Date(Date.now() - 18 * 365.25 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const {
    register,
    handleSubmit,
    trigger,
    setValue,
    getValues,
    control,
    formState: { errors, isSubmitting },
  } = useForm({
    mode: 'onTouched',
    defaultValues: {
      fullName: '',
      mobile: '',
      email: '',
      dob: '',
      gender: 'Female',
      street: '',
      area: '',
      city: '',
      district: '',
      state: 'Kerala',
      pincode: '',
      password: '',
      qualification: '',
      experience: '',
      nursingRegNo: '',
      languages: [],
      careSettings: [],
      docs: {
        nursingCertificate: null,
        nursingStudentId: null,
        identityDoc: null,
        addressProof: null,
        policeClearance: null,
        bankProof: null,
      },
      emergencyName: '',
      emergencyRelationship: '',
      emergencyPhone: '',
      bankHolder: '',
      accountNumber: '',
      ifsc: '',
      declaration: false,
    },
  })

  const qualification = useWatch({ control, name: 'qualification' })
  const languages = useWatch({ control, name: 'languages' }) || []
  const careSettings = useWatch({ control, name: 'careSettings' }) || []
  const declaration = useWatch({ control, name: 'declaration' })
  const docs = useWatch({ control, name: 'docs' }) || {}

  const prevQualification = useRef('')
  useEffect(() => {
    if (qualification === prevQualification.current) return
    prevQualification.current = qualification
    setValue('docs.nursingCertificate', null)
    setValue('docs.nursingStudentId', null)
    setValue('nursingRegNo', '')
  }, [qualification, setValue])

  const watchedStreet = useWatch({ control, name: 'street' })
  const watchedArea = useWatch({ control, name: 'area' })
  const watchedDistrict = useWatch({ control, name: 'district' })
  const watchedPincode = useWatch({ control, name: 'pincode' })
  const isGpsDetectingRef = useRef(false)
  const lastResolvedAddressRef = useRef('')

  useEffect(() => () => clearTimeout(redirectTimer.current), [])

  const setDoc = (name, file) => {
    setDocError('')
    setValue(`docs.${name}`, file, { shouldDirty: true, shouldTouch: true })
  }

  const toggleLanguage = (lang) => {
    const next = languages.includes(lang) ? languages.filter((l) => l !== lang) : [...languages, lang]
    setValue('languages', next, { shouldDirty: true, shouldTouch: true, shouldValidate: true })
  }

  const toggleSetting = (value) => {
    const next = careSettings.includes(value)
      ? careSettings.filter((s) => s !== value)
      : [...careSettings, value]
    setValue('careSettings', next, { shouldDirty: true, shouldTouch: true, shouldValidate: true })
  }

  const [detectingLocation, setDetectingLocation] = useState(false)
  const [locationCaptured, setLocationCaptured] = useState(null)

  // Smart Forward Geocoding: when user manually types address or PIN code, resolve coordinates
  useEffect(() => {
    if (isGpsDetectingRef.current) return

    const key = `${watchedStreet || ''}|${watchedArea || ''}|${watchedDistrict || ''}|${watchedPincode || ''}`
    if (key === lastResolvedAddressRef.current) return

    const hasMeaningfulLocation =
      (watchedArea && watchedArea.trim().length >= 3) ||
      (watchedPincode && /^[1-9][0-9]{5}$/.test(watchedPincode.trim())) ||
      (watchedStreet && watchedStreet.trim().length >= 5)

    if (!hasMeaningfulLocation) {
      if (!watchedArea?.trim() && !watchedStreet?.trim() && !watchedPincode?.trim()) {
        setLocationCaptured(null)
      }
      return
    }

    const timer = setTimeout(async () => {
      try {
        const geoRes = await apiClient.get('/geo/forward', {
          params: {
            address: watchedStreet || '',
            area: watchedArea || '',
            district: watchedDistrict || '',
            pincode: watchedPincode || '',
          },
        })
        const geo = geoRes?.data || geoRes
        if (geo?.latitude && geo?.longitude) {
          lastResolvedAddressRef.current = key
          setLocationCaptured({
            lat: geo.latitude,
            lng: geo.longitude,
            area: watchedArea || geo.displayName || '',
            district: watchedDistrict || 'Kerala',
            city: watchedArea || watchedDistrict,
            isManual: true,
          })
        }
      } catch (_) {
        // Non-blocking fallback
      }
    }, 600)

    return () => clearTimeout(timer)
  }, [watchedStreet, watchedArea, watchedDistrict, watchedPincode])

  const handleChooseCurrentLocation = async () => {
    isGpsDetectingRef.current = true
    setDetectingLocation(true)

    // 1. High-accuracy browser GPS positioning
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
            })
          },
          () => {
            clearTimeout(timer)
            resolve(null)
          },
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
        )
      })

    // 2. IP Geolocation fallback if GPS hardware or permissions are blocked
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
            }
          }
        }
      } catch (_) {}

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
            }
          }
        }
      } catch (_) {}

      return null
    }

    try {
      let coords = await getBrowserCoords()
      let ipData = null

      if (!coords) {
        ipData = await getIpCoords()
        if (ipData) {
          coords = {
            latitude: ipData.latitude,
            longitude: ipData.longitude,
          }
        }
      }

      if (!coords) {
        toast.error('Location detection unavailable', {
          description: 'Please grant location permissions in your browser or enter your address manually.',
        })
        return
      }

      const { latitude: lat, longitude: lng } = coords
      let detectedAddress = ''
      let detectedArea = ''
      let detectedCity = ''
      let detectedDistrict = ''
      let detectedState = ''
      let detectedPincode = ''

      // 3. Reverse Geocode via Bystander Geo Service
      try {
        const geoRes = await apiClient.get('/geo/reverse', {
          params: { lat, lng },
        })
        const geo = geoRes?.data || geoRes
        if (geo?.address || geo?.area || geo?.city) {
          detectedAddress = geo.address || ''
          detectedArea = geo.area || geo.city || ''
          detectedCity = geo.city || ''
          detectedDistrict = geo.district || ''
          detectedState = geo.state || 'Kerala'
          detectedPincode = geo.pincode || ''
        }
      } catch (geoErr) {
        console.warn('[RegisterCaregiver] Server reverse-geocoding fallback:', geoErr?.message)
      }

      // 4. Client-side OSM Nominatim fallback if server had an error
      if (!detectedAddress && !detectedArea) {
        try {
          const controller = new AbortController()
          const timer = setTimeout(() => controller.abort(), 4000)
          const nomRes = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=19&addressdetails=1`,
            {
              signal: controller.signal,
              headers: { 'Accept-Language': 'en' },
            },
          )
          clearTimeout(timer)
          if (nomRes.ok) {
            const data = await nomRes.json()
            const addr = data.address || {}
            detectedAddress = [addr.house_number ? `#${addr.house_number}` : '', addr.building, addr.road].filter(Boolean).join(', ')
            detectedArea = addr.suburb || addr.neighbourhood || addr.village || addr.town || addr.city || ''
            detectedCity = addr.city || addr.town || ''
            detectedDistrict = (addr.state_district || addr.county || '').replace(/\s+District$/i, '').trim()
            detectedState = addr.state || 'Kerala'
            detectedPincode = addr.postcode ? String(addr.postcode).replace(/\D/g, '').slice(0, 6) : ''
          }
        } catch (_) {}
      }

      if (!detectedAddress && detectedArea) {
        detectedAddress = detectedArea
      }

      // Populate react-hook-form fields
      if (detectedAddress) {
        setValue('street', detectedAddress, { shouldValidate: true, shouldDirty: true })
      }
      if (detectedArea) {
        setValue('area', detectedArea, { shouldValidate: true, shouldDirty: true })
      }
      if (detectedDistrict) {
        const matched = KERALA_DISTRICTS.find(
          (d) => d.toLowerCase() === detectedDistrict.toLowerCase() ||
                 detectedDistrict.toLowerCase().includes(d.toLowerCase()) ||
                 d.toLowerCase().includes(detectedDistrict.toLowerCase())
        )
        if (matched) {
          setValue('district', matched, { shouldValidate: true, shouldDirty: true })
        }
      }
      if (detectedState) {
        const matchedState = INDIAN_STATES.find(
          (s) => s.toLowerCase() === detectedState.toLowerCase()
        )
        if (matchedState) {
          setValue('state', matchedState, { shouldValidate: true, shouldDirty: true })
        }
      }
      if (detectedPincode && /^[1-9][0-9]{5}$/.test(detectedPincode)) {
        setValue('pincode', detectedPincode, { shouldValidate: true, shouldDirty: true })
      }

      lastResolvedAddressRef.current = `${detectedAddress}|${detectedArea}|${detectedDistrict}|${detectedPincode}`
      setLocationCaptured({
        lat,
        lng,
        area: detectedArea,
        city: detectedCity || detectedDistrict,
        district: detectedDistrict,
        isManual: false,
      })

      toast.success('Current location detected!', {
        description: `Filled address for ${detectedArea ? detectedArea + ', ' : ''}${detectedDistrict || 'Kerala'}.`,
      })
    } catch (err) {
      toast.error('Failed to detect location', {
        description: err.message || 'Please enter your address manually.',
      })
    } finally {
      setDetectingLocation(false)
      setTimeout(() => {
        isGpsDetectingRef.current = false
      }, 500)
    }
  }

  const validateDocs = () => {
    const currentDocs = getValues('docs') || {}
    const missing = []
    if (!currentDocs.identityDoc?.name) missing.push('Identity verification document')
    if (!currentDocs.policeClearance?.name) missing.push('Police clearance certificate')
    if (!currentDocs.bankProof?.name) missing.push('Bank verification document')
    if (missing.length) {
      setDocError(`Please upload the 3 mandatory files (*): ${missing.join(', ')}`)
      return false
    }
    setDocError('')
    return true
  }

  const goNext = async () => {
    if (step === 2) {
      if (!validateDocs()) return
      setStep((s) => Math.min(s + 1, STEPS.length - 1))
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    const valid = await trigger(STEP_FIELDS[step], { shouldFocus: true })
    if (valid) {
      setStep((s) => Math.min(s + 1, STEPS.length - 1))
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const goBack = () => {
    setStep((s) => Math.max(s - 1, 0))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const proceedToDashboard = () => {
    navigate('/caregiver/dashboard', { replace: true })
  }

  const onSubmit = async (values) => {
    const DOC_LABELS = {
      nursingCertificate: 'Nursing certificate',
      nursingStudentId: 'Nursing student ID',
      identityDoc: 'Identity proof',
      addressProof: 'Address proof',
      policeClearance: 'Police clearance',
      bankProof: 'Bank proof',
    }

    const serializedDocs = {}
    for (const [key, file] of Object.entries(values.docs || {})) {
      if (!file) continue
      const raw = file.rawFile || file.file
      let dataUrl = null
      if (raw && (raw instanceof Blob || (typeof File !== 'undefined' && raw instanceof File))) {
        try {
          dataUrl = await new Promise((resolve) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result)
            reader.onerror = () => resolve(null)
            reader.readAsDataURL(raw)
          })
        } catch {
          dataUrl = null
        }
      }
      if (!dataUrl && typeof file.preview === 'string' && file.preview.startsWith('data:')) {
        dataUrl = file.preview
      }
      if (!dataUrl && typeof file.fileData === 'string' && file.fileData.startsWith('data:')) {
        dataUrl = file.fileData
      }
      serializedDocs[key] = {
        name: file.name || String(file),
        size: file.size || 1024,
        type: file.type || 'application/pdf',
        fileData: dataUrl,
      }
    }

    const documentList = Object.entries(serializedDocs).map(([key, f]) => ({
      docId: key,
      type: DOC_LABELS[key] || key,
      file: { name: f.name, size: f.size, type: f.type },
      fileData: f.fileData,
      optional: key === 'bankProof',
    }))

      const resolvedCity = values.area?.trim() || values.district?.trim() || 'Kerala'
      const payload = {
        fullName: values.fullName.trim(),
        mobile: values.mobile.trim(),
        email: values.email.trim(),
        dob: values.dob,
        gender: values.gender || 'Female',
        street: values.street?.trim() || '',
        area: values.area?.trim() || '',
        city: resolvedCity,
        district: values.district?.trim() || '',
        state: values.state?.trim() || 'Kerala',
        pincode: values.pincode?.trim() || '',
        coordinates: locationCaptured?.lat && locationCaptured?.lng ? {
          latitude: locationCaptured.lat,
          longitude: locationCaptured.lng,
        } : undefined,
        address: {
          street: values.street?.trim() || '',
          area: values.area?.trim() || '',
          city: resolvedCity,
          district: values.district?.trim() || '',
          state: values.state?.trim() || 'Kerala',
          pincode: values.pincode?.trim() || '',
          coordinates: locationCaptured?.lat && locationCaptured?.lng ? {
            latitude: locationCaptured.lat,
            longitude: locationCaptured.lng,
          } : undefined,
        },
      password: values.password,
      qualification: values.qualification,
      experience: Number(values.experience),
      nursingRegNo: values.nursingRegNo?.trim() || '',
      languages: values.languages,
      careSettings: values.careSettings,
      docs: serializedDocs,
      documents: documentList,
      emergencyContact: {
        name: values.emergencyName.trim(),
        relationship: values.emergencyRelationship.trim(),
        phone: values.emergencyPhone.trim(),
      },
      bank: {
        holderName: values.bankHolder.trim(),
        accountNumber: values.accountNumber.trim(),
        ifsc: values.ifsc.trim().toUpperCase(),
      },
    }
    const result = await registerCaregiver(payload)

    if (!result.ok) {
      toast.error(result.message || 'Could not submit your application. Please try again.')
      return
    }
    registerCaregiverProfile({
      caregiverId: result.user?.id || 'cg-new',
      name: payload.fullName,
      gender: payload.gender,
      street: payload.street,
      area: payload.area,
      city: payload.city,
      district: payload.district,
      state: payload.state,
      pincode: payload.pincode,
      address: payload.address,
      qualification: payload.qualification,
      experience: payload.experience,
      nursingRegNo: payload.nursingRegNo,
      languages: payload.languages,
      careSettings: payload.careSettings,
      documents: documentList,
      bio: '',
    })
    pendingEmail.current = payload.email
    setSubmitted(true)
    toast.success('Application submitted — pending verification')
    redirectTimer.current = setTimeout(proceedToDashboard, 3000)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleFormSubmit = (event) => {
    event.preventDefault()
    if (step < STEPS.length - 1) {
      goNext()
      return
    }
    handleSubmit(onSubmit)()
  }

  if (submitted) {
    return (
      <div className="space-y-6 text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-mint-100 text-primary-700">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-extrabold text-ink">Application submitted</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Thanks for applying. Our verification team will review your documents — this usually takes 24–48 hours in a
            real deployment.
          </p>
          <div className="mt-4 flex justify-center">
            <StatusBadge status="Pending" />
          </div>
        </div>

        <div className="rounded-card border border-warning-200 bg-warning-50 p-4 text-left">
          <p className="flex items-center gap-2 text-sm font-bold text-warning-800">
            <AlertTriangle className="h-4 w-4" /> Pending Verification
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-warning-800/90">
            Your account will show <strong>Pending Verification</strong> until an administrator approves your documents.
            You can view your onboarding status and manage verification documents in your caretaker dashboard.
          </p>
        </div>

        <Button size="lg" className="w-full" onClick={proceedToDashboard} iconRight={ArrowRight}>
          Go to caretaker dashboard
        </Button>
        <p className="text-xs text-muted">Redirecting automatically…</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide text-primary-700">Caretaker application</p>
        <h1 className="mt-1 font-display text-2xl font-extrabold text-ink">Join Bystander as a caretaker</h1>
        <p className="mt-1.5 text-sm text-muted">
          Four short steps — your profile goes live after our team verifies your documents.
        </p>
      </div>

      <StepIndicator step={step} />

      <Card>
        <CardBody>
          <form onSubmit={handleFormSubmit} noValidate className="space-y-5">
            {step === 0 ? (
              <div className="space-y-4">
                <h2 className="font-display text-base font-bold text-ink">Personal details</h2>

                <FormField label="Full name" htmlFor="g-fullName" required error={errors.fullName?.message}>
                  <Input
                    id="g-fullName"
                    placeholder="e.g. Ananya Deshmukh"
                    autoComplete="name"
                    error={errors.fullName?.message}
                    {...register('fullName', {
                      required: 'Full name is required',
                      minLength: { value: 3, message: 'Enter your full name' },
                    })}
                  />
                </FormField>

                <FormField label="Mobile number" htmlFor="g-mobile" required error={errors.mobile?.message}>
                  <Input
                    id="g-mobile"
                    type="tel"
                    placeholder="98765 43210"
                    autoComplete="tel-national"
                    error={errors.mobile?.message}
                    {...register('mobile', { validate: validateMobile })}
                  />
                </FormField>

                <FormField label="Email address" htmlFor="g-email" required error={errors.email?.message}>
                  <Input
                    id="g-email"
                    type="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                    error={errors.email?.message}
                    {...register('email', {
                      required: 'Email is required',
                      pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email address' },
                    })}
                  />
                </FormField>

                <FormField
                  label="Date of birth"
                  htmlFor="g-dob"
                  required
                  error={errors.dob?.message}
                  hint="Caretakers must be at least 18 years old"
                >
                  <Input
                    id="g-dob"
                    type="date"
                    max={adultCutoff}
                    min="1950-01-01"
                    error={errors.dob?.message}
                    {...register('dob', {
                      required: 'Date of birth is required',
                      validate: (value) => {
                        const date = new Date(value)
                        if (Number.isNaN(date.getTime())) return 'Enter a valid date'
                        if (date > new Date()) return 'Date of birth cannot be in the future'
                        const age = Math.floor((Date.now() - date.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
                        return age >= 18 || 'You must be at least 18 years old to apply'
                      },
                    })}
                  />
                </FormField>

                <FormField label="Gender" htmlFor="g-gender" required error={errors.gender?.message}>
                  <Select
                    id="g-gender"
                    error={errors.gender?.message}
                    {...register('gender', { required: 'Please select your gender' })}
                  >
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                    <option value="Other">Other</option>
                  </Select>
                </FormField>

                <div className="pt-3 border-t border-slate-100">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      <Home className="h-4 w-4 text-primary-700" />
                      <h3 className="text-sm font-bold text-ink">Working Base / Residential Address</h3>
                      <span className="rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-bold text-primary-800">
                        30 km Job Zone
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handleChooseCurrentLocation}
                      disabled={detectingLocation}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-primary-200 bg-primary-50 px-3 py-1.5 text-xs font-bold text-primary-800 transition hover:bg-primary-100 active:scale-95 disabled:opacity-60 cursor-pointer shadow-2xs"
                    >
                      {detectingLocation ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary-700" />
                          <span>Detecting GPS...</span>
                        </>
                      ) : (
                        <>
                          <LocateFixed className="h-3.5 w-3.5 text-primary-700" />
                          <span>{locationCaptured ? 'Re-detect Location' : 'Choose My Current Location'}</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Informative Job Zone Guidance Card */}
                  <div className="mb-3 mt-1.5 rounded-xl border border-primary-200/90 bg-primary-50/70 p-3 text-xs">
                    <div className="flex items-start gap-2.5">
                      <Radio className="h-4 w-4 shrink-0 text-primary-700 mt-0.5 animate-pulse" />
                      <div>
                        <p className="font-semibold text-primary-950">
                          Where do you want to receive patient care shifts?
                        </p>
                        <p className="mt-0.5 text-[11px] leading-relaxed text-primary-800">
                          Please enter the location where you are <strong>currently living or available to work</strong> (hostel, rental, or family home). Patient bookings and urgent dispatch alerts are broadcasted within a <strong>30 km radius</strong> of this address.
                        </p>
                      </div>
                    </div>
                  </div>

                  {locationCaptured && (
                    <div className="mb-4 flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50/90 px-3 py-2 text-xs font-medium text-emerald-900">
                      <div className="flex items-center gap-2">
                        <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span>
                          <strong className="font-bold">
                            {locationCaptured.isManual ? '📍 Mapped to:' : 'Detected:'}
                          </strong>{' '}
                          {locationCaptured.area ? `${locationCaptured.area}, ` : ''}
                          {locationCaptured.district || locationCaptured.city || 'Kerala'} ({locationCaptured.isManual ? 'Coordinates resolved from address' : 'GPS coordinates attached'})
                        </span>
                      </div>
                      <span className="text-[10px] text-emerald-700 font-mono">
                        {locationCaptured.lat.toFixed(4)}, {locationCaptured.lng.toFixed(4)}
                      </span>
                    </div>
                  )}

                  <div className="space-y-4">
                    <FormField
                      label="House / Building / Flat Name & Street Address"
                      htmlFor="g-street"
                      required
                      error={errors.street?.message}
                      hint="e.g. House No. 12/450, Greenfield Villa, MG Road"
                    >
                      <Input
                        id="g-street"
                        placeholder="House / Flat No., Building Name, Street"
                        error={errors.street?.message}
                        {...register('street', {
                          required: 'Street address is required',
                          minLength: { value: 5, message: 'Please enter your complete street address' },
                        })}
                      />
                    </FormField>

                    <FormField
                      label="Locality / Town / Landmark"
                      htmlFor="g-area"
                      required
                      error={errors.area?.message}
                      hint="e.g. Koyilandy, Edappally, Kaloor, Thalassery"
                    >
                      <Input
                        id="g-area"
                        placeholder="e.g. Koyilandy, Edappally, Kaloor"
                        error={errors.area?.message}
                        {...register('area', {
                          required: 'Locality / Town is required',
                        })}
                      />
                    </FormField>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField
                        label="District"
                        htmlFor="g-district"
                        required
                        error={errors.district?.message}
                      >
                        <Select
                          id="g-district"
                          error={errors.district?.message}
                          {...register('district', { required: 'Please select your district' })}
                        >
                          <option value="" disabled>Choose District</option>
                          {KERALA_DISTRICTS.map((d) => (
                            <option key={d} value={d}>
                              {d}
                            </option>
                          ))}
                        </Select>
                      </FormField>

                      <FormField
                        label="State"
                        htmlFor="g-state"
                        required
                        error={errors.state?.message}
                      >
                        <Select
                          id="g-state"
                          error={errors.state?.message}
                          {...register('state', { required: 'Select your state' })}
                        >
                          {INDIAN_STATES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </Select>
                      </FormField>
                    </div>

                    <FormField
                      label="PIN Code (Postal Code)"
                      htmlFor="g-pincode"
                      required
                      error={errors.pincode?.message}
                      hint="6-digit Indian Postal PIN code (e.g. 682024)"
                    >
                      <Input
                        id="g-pincode"
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="e.g. 682024"
                        error={errors.pincode?.message}
                        {...register('pincode', {
                          required: 'PIN code is required',
                          pattern: {
                            value: /^[1-9][0-9]{5}$/,
                            message: 'Enter a valid 6-digit Indian PIN code (e.g. 682024)',
                          },
                        })}
                      />
                    </FormField>
                  </div>
                </div>

                <FormField label="Password" htmlFor="g-password" required error={errors.password?.message}>
                  <div className="relative">
                    <Input
                      id="g-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Create a strong password"
                      autoComplete="new-password"
                      className="pr-11"
                      error={errors.password?.message}
                      {...register('password', {
                        required: 'Password is required',
                        minLength: { value: 8, message: 'Use at least 8 characters' },
                      })}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-1 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-muted transition hover:bg-slate-100 hover:text-ink"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </FormField>
              </div>
            ) : null}

            {step === 1 ? (
              <div className="space-y-5">
                <h2 className="font-display text-base font-bold text-ink">Professional details</h2>

                <FormField label="Highest qualification" htmlFor="g-qualification" required error={errors.qualification?.message}>
                  <Select
                    id="g-qualification"
                    error={errors.qualification?.message}
                    {...register('qualification', { required: 'Select your qualification' })}
                  >
                    <option value="">Select a qualification</option>
                    {QUALIFICATIONS.map((q) => (
                      <option key={q} value={q}>
                        {q}
                      </option>
                    ))}
                  </Select>
                </FormField>

                {isNursingQualification(qualification) && !isNursingStudent(qualification) ? (
                  <FormField
                    label="Nursing registration number"
                    htmlFor="g-nursingRegNo"
                    required
                    error={errors.nursingRegNo?.message}
                    hint="Found on your Indian Nursing Council / State Nursing Council registration certificate"
                  >
                    <Input
                      id="g-nursingRegNo"
                      placeholder="e.g. MNC/2019/45210"
                      error={errors.nursingRegNo?.message}
                      {...register('nursingRegNo', {
                        validate: (value) => {
                          if (!isNursingQualification(qualification) || isNursingStudent(qualification)) return true
                          return Boolean(value && value.trim()) || 'Registration number is required for nurses'
                        },
                      })}
                    />
                  </FormField>
                ) : null}

                <FormField
                  label="Years of experience"
                  htmlFor="g-experience"
                  required
                  error={errors.experience?.message}
                >
                  <Input
                    id="g-experience"
                    type="number"
                    min="0"
                    max="45"
                    placeholder="e.g. 4"
                    error={errors.experience?.message}
                    {...register('experience', {
                      required: 'Years of experience is required',
                      validate: (value) => {
                        const n = Number(value)
                        if (value === '' || value === null) return 'Years of experience is required'
                        return (Number.isFinite(n) && n >= 0 && n <= 45) || 'Enter a value between 0 and 45'
                      },
                    })}
                  />
                </FormField>

                <FormField
                  label="Languages you speak"
                  required
                  error={errors.languages?.message}
                  hint="Families often prefer caretakers who speak their language"
                >
                  <div className="flex flex-wrap gap-2">
                    {LANGUAGES.map((lang) => (
                      <Chip key={lang} selected={languages.includes(lang)} onClick={() => toggleLanguage(lang)}>
                        {languages.includes(lang) ? <Check className="h-3 w-3" /> : null}
                        {lang}
                      </Chip>
                    ))}
                  </div>
                </FormField>

                <FormField label="Care settings" required error={errors.careSettings?.message}>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {CARE_SETTINGS.map((setting) => {
                      const checked = careSettings.includes(setting.value)
                      return (
                        <label
                          key={setting.value}
                          className={cn(
                            'flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition',
                            checked
                              ? 'border-primary-300 bg-mint-50 ring-1 ring-primary-200'
                              : 'border-line-strong bg-white hover:border-primary-200',
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleSetting(setting.value)}
                            className="mt-0.5 h-4 w-4 rounded accent-[#0F766E]"
                          />
                          <span>
                            <span className="block text-sm font-semibold text-ink">{setting.label}</span>
                            <span className="mt-0.5 block text-xs text-muted">{setting.hint}</span>
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </FormField>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="space-y-5">
                <h2 className="font-display text-base font-bold text-ink">Verification documents</h2>

                <div className="rounded-xl border border-warning-200 bg-warning-50 p-3.5">
                  <p className="flex items-center gap-2 text-sm font-bold text-warning-800">
                    <AlertTriangle className="h-4 w-4" /> Pending Verification
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-warning-800/90">
                    Your account will show <strong>Pending Verification</strong> until an administrator approves your
                    documents. All uploads below are simulated for this demo.
                  </p>
                </div>

                {/* 1. Identity Verification (Mandatory) */}
                <FileUpload
                  id="doc-identity"
                  label="Identity verification document *"
                  required
                  hint={`Aadhaar, Passport or Voter ID — photo and full name must match your application. ${DEMO_UPLOAD_HINT}`}
                  value={docs.identityDoc}
                  onChange={(file) => setDoc('identityDoc', file)}
                  error={errors.docs?.identityDoc?.message}
                />

                {/* 2. Police Clearance Certificate (Mandatory) */}
                <FileUpload
                  id="doc-police"
                  label="Police clearance certificate *"
                  required
                  hint={`Police clearance certificate or verification slip issued within last 12 months. ${DEMO_UPLOAD_HINT}`}
                  value={docs.policeClearance}
                  onChange={(file) => setDoc('policeClearance', file)}
                  error={errors.docs?.policeClearance?.message}
                />

                {/* 3. Bank Verification (Mandatory) */}
                <FileUpload
                  id="doc-bank"
                  label="Bank verification (cancelled cheque or passbook) *"
                  required
                  hint={`We match the account holder name with your application name before releasing payouts. ${DEMO_UPLOAD_HINT}`}
                  value={docs.bankProof}
                  onChange={(file) => setDoc('bankProof', file)}
                  error={errors.docs?.bankProof?.message}
                />

                {/* 4. Nursing / Qualification Certificate (Optional) */}
                {isNursingStudent(qualification) ? (
                  <FileUpload
                    id="doc-student-id"
                    label="Nursing student college ID (Optional unless requested)"
                    hint={`Valid nursing college identity card with current academic year. ${DEMO_UPLOAD_HINT}`}
                    value={docs.nursingStudentId}
                    onChange={(file) => setDoc('nursingStudentId', file)}
                    error={errors.docs?.nursingStudentId?.message}
                  />
                ) : (
                  <FileUpload
                    id="doc-nursing-cert"
                    label="Nursing registration or qualification certificate (Optional unless requested)"
                    hint={`State Nursing Council registration certificate, degree, or attendant certificate. ${DEMO_UPLOAD_HINT}`}
                    value={docs.nursingCertificate}
                    onChange={(file) => setDoc('nursingCertificate', file)}
                    error={errors.docs?.nursingCertificate?.message}
                  />
                )}

                {/* 5. Address Proof (Optional) */}
                <FileUpload
                  id="doc-address"
                  label="Address proof (Optional unless requested)"
                  hint={`Recent utility bill, bank statement or rent agreement with your current address. ${DEMO_UPLOAD_HINT}`}
                  value={docs.addressProof}
                  onChange={(file) => setDoc('addressProof', file)}
                  error={errors.docs?.addressProof?.message}
                />

                {docError ? (
                  <p className="flex items-start gap-1.5 text-xs font-medium text-danger-600" role="alert">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {docError}
                  </p>
                ) : null}
              </div>
            ) : null}

            {step === 3 ? (
              <div className="space-y-5">
                <h2 className="font-display text-base font-bold text-ink">Emergency contact & bank details</h2>
                <p className="text-xs text-muted">
                  Used only for shift emergencies and verified payouts — never shared with families.
                </p>

                <div className="rounded-xl border border-line bg-slate-50/70 p-4">
                  <p className="flex items-center gap-2 text-sm font-bold text-ink">
                    <PhoneCall className="h-4 w-4 text-primary-700" /> Emergency contact
                  </p>
                  <div className="mt-3 space-y-4">
                    <FormField label="Contact name" htmlFor="g-emergencyName" required error={errors.emergencyName?.message}>
                      <Input
                        id="g-emergencyName"
                        placeholder="e.g. Suresh Deshmukh"
                        error={errors.emergencyName?.message}
                        {...register('emergencyName', { required: 'Contact name is required' })}
                      />
                    </FormField>

                    <FormField
                      label="Relationship"
                      htmlFor="g-emergencyRelationship"
                      required
                      error={errors.emergencyRelationship?.message}
                    >
                      <Input
                        id="g-emergencyRelationship"
                        placeholder="e.g. Spouse, Parent, Sibling"
                        error={errors.emergencyRelationship?.message}
                        {...register('emergencyRelationship', { required: 'Relationship is required' })}
                      />
                    </FormField>

                    <FormField
                      label="Contact phone"
                      htmlFor="g-emergencyPhone"
                      required
                      error={errors.emergencyPhone?.message}
                    >
                      <Input
                        id="g-emergencyPhone"
                        type="tel"
                        placeholder="98765 43210"
                        error={errors.emergencyPhone?.message}
                        {...register('emergencyPhone', { validate: validateMobile })}
                      />
                    </FormField>
                  </div>
                </div>

                <div className="rounded-xl border border-line bg-slate-50/70 p-4">
                  <p className="flex items-center gap-2 text-sm font-bold text-ink">
                    <Banknote className="h-4 w-4 text-primary-700" /> Bank account
                  </p>
                  <div className="mt-3 space-y-4">
                    <FormField
                      label="Account holder name"
                      htmlFor="g-bankHolder"
                      required
                      error={errors.bankHolder?.message}
                      hint="Must match the name on your identity document"
                    >
                      <Input
                        id="g-bankHolder"
                        placeholder="e.g. Ananya R Deshmukh"
                        error={errors.bankHolder?.message}
                        {...register('bankHolder', {
                          required: 'Account holder name is required',
                          minLength: { value: 3, message: 'Enter the full name on the account' },
                        })}
                      />
                    </FormField>

                    <FormField label="Account number" htmlFor="g-accountNumber" required error={errors.accountNumber?.message}>
                      <Input
                        id="g-accountNumber"
                        inputMode="numeric"
                        placeholder="9–18 digit account number"
                        error={errors.accountNumber?.message}
                        {...register('accountNumber', {
                          required: 'Account number is required',
                          pattern: { value: /^\d{9,18}$/, message: 'Enter a valid 9–18 digit account number' },
                        })}
                      />
                    </FormField>

                    <FormField
                      label="IFSC"
                      htmlFor="g-ifsc"
                      required
                      error={errors.ifsc?.message}
                      hint="e.g. HDFC0001234 — printed on your cheque or passbook"
                    >
                      <Input
                        id="g-ifsc"
                        placeholder="HDFC0001234"
                        autoCapitalize="characters"
                        error={errors.ifsc?.message}
                        {...register('ifsc', {
                          required: 'IFSC is required',
                          pattern: {
                            value: /^[A-Za-z]{4}0[A-Za-z0-9]{6}$/,
                            message: 'Enter a valid IFSC (4 letters, 0, then 6 characters)',
                          },
                        })}
                      />
                    </FormField>
                  </div>
                </div>

                <label
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition',
                    errors.declaration
                      ? 'border-danger-300 bg-danger-50'
                      : declaration
                        ? 'border-primary-300 bg-mint-50'
                        : 'border-line-strong bg-white',
                  )}
                >
                  <input
                    id="g-declaration"
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded accent-[#0F766E]"
                    aria-invalid={Boolean(errors.declaration)}
                    {...register('declaration', {
                      validate: (value) => value === true || 'Please accept the declaration to continue',
                    })}
                  />
                  <span className="text-xs leading-relaxed text-ink-soft">
                    I declare that the documents and details shared are genuine. I understand that Bystander verifies
                    every submission and that false information leads to permanent removal from the platform.
                  </span>
                </label>
                {errors.declaration ? (
                  <p className="text-xs font-medium text-danger-600" role="alert">
                    {errors.declaration.message}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="flex items-center gap-3 border-t border-line pt-4">
              {step > 0 ? (
                <Button type="button" variant="outline" onClick={goBack} icon={ArrowLeft}>
                  Back
                </Button>
              ) : null}
              {step < STEPS.length - 1 ? (
                <Button type="button" onClick={goNext} iconRight={ArrowRight} className="flex-1">
                  Continue
                </Button>
              ) : (
                <Button type="submit" loading={isSubmitting} iconRight={CheckCircle2} className="flex-1">
                  Submit application
                </Button>
              )}
            </div>
          </form>
        </CardBody>
      </Card>

      <p className="text-center text-xs text-muted">
        Already registered?{' '}
        <Link to="/login" className="font-semibold text-primary-700 hover:underline">
          Sign in
        </Link>{' '}
        · Looking to book care?{' '}
        <Link to="/register" className="font-semibold text-primary-700 hover:underline">
          Create a customer account
        </Link>
      </p>
    </div>
  )
}

export default RegisterCaregiverPage
