import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { Bell, Camera, KeyRound, LogOut, Mail, Pencil, RefreshCcw, Save, ShieldCheck, Star, UserRound } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/context/AuthContext'
import { useData } from '@/context/DataContext'
import { useDocumentTitle } from '@/hooks/useUi'
import { cn } from '@/utils/cn'
import { formatDate } from '@/utils/format'
import { CARE_TYPES, CITIES, KERALA_DISTRICTS, INDIAN_STATES } from '@/utils/constants'
import { PageHeader } from '@/components/common/PageHeader'
import { Card, CardBody, CardHeader } from '@/components/common/Card'
import { Avatar } from '@/components/common/Avatar'
import { Button } from '@/components/common/Button'
import { Chip, ProgressBar } from '@/components/common/Tabs'
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog'
import { FormField, Input, Select, Textarea } from '@/components/forms/FormField'
import { profileService } from '@/services'

const PREF_ITEMS = [
  { key: 'bookings', label: 'Booking updates', hint: 'Confirmations, caretaker assignment and live status changes.' },
  { key: 'messages', label: 'Message alerts', hint: 'New messages from your caretakers and the support desk.' },
  { key: 'promotions', label: 'Promotions', hint: 'Offers, seasonal discounts and new service launches.' },
  { key: 'receipts', label: 'Email receipts', hint: 'Invoices and payment receipts delivered to your inbox.' },
]

function Switch({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 focus:outline-none focus:ring-4 focus:ring-primary-100',
        checked ? 'bg-primary-700' : 'bg-slate-300',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-card transition-all duration-200',
          checked ? 'left-[22px]' : 'left-0.5',
        )}
      />
    </button>
  )
}

function strengthScore(value = '') {
  let score = 0
  if (value.length >= 8) score += 1
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1
  if (/\d/.test(value)) score += 1
  if (/[^A-Za-z0-9]/.test(value)) score += 1
  return score
}

const STRENGTH = [
  { label: 'Too short', tone: 'danger' },
  { label: 'Weak', tone: 'danger' },
  { label: 'Fair', tone: 'warning' },
  { label: 'Good', tone: 'accent' },
  { label: 'Strong', tone: 'success' },
]

export function ProfilePage() {
  useDocumentTitle('My profile')
  const navigate = useNavigate()
  const { user, updateProfile, logout } = useAuth()

  const [signOutOpen, setSignOutOpen] = useState(false)
  const [savingPersonal, setSavingPersonal] = useState(false)
  const [savingPatient, setSavingPatient] = useState(false)
  const [profileData, setProfileData] = useState(null)

  const [prefs, setPrefs] = useState(() => ({
    bookings: true,
    messages: true,
    promotions: false,
    receipts: true,
    ...user?.notificationPrefs,
  }))

  const personal = useForm({
    mode: 'onTouched',
    defaultValues: {
      fullName: user?.name || '',
      email: user?.email || '',
      mobile: user?.phone || '',
      city: user?.city || 'Kochi, KL',
      area: user?.area || '',
      street: user?.street || user?.address || '',
      district: user?.district || 'Ernakulam',
      state: user?.state || 'Kerala',
      pincode: user?.pincode || '',
      address: user?.address || '',
    },
  })

  const patient = useForm({
    mode: 'onTouched',
    defaultValues: {
      patientName: user?.patientInfo?.name || '',
      patientAge: user?.patientInfo?.age ? String(user.patientInfo.age) : '',
      relation: user?.patientInfo?.relation || '',
      condition: user?.patientInfo?.condition || '',
      careType: user?.patientInfo?.preferredCareType || CARE_TYPES[0],
    },
  })

  useEffect(() => {
    let isMounted = true
    profileService
      .getCustomerProfile()
      .then((data) => {
        if (!isMounted || !data) return
        setProfileData(data)
        personal.reset({
          fullName: data.fullName || user?.name || '',
          email: data.email || user?.email || '',
          mobile: data.phone || user?.phone || '',
          city: data.defaultAddress?.city || user?.city || 'Kochi, KL',
          area: data.defaultAddress?.area || user?.area || '',
          street: data.defaultAddress?.street || data.defaultAddress?.addressLine || user?.address || '',
          district: data.defaultAddress?.district || user?.district || 'Ernakulam',
          state: data.defaultAddress?.state || user?.state || 'Kerala',
          pincode: data.defaultAddress?.pincode || user?.pincode || '',
          address: data.defaultAddress?.addressLine || user?.address || '',
        })
        const p = data.patients?.[0]
        if (p) {
          patient.reset({
            patientName: p.name || '',
            patientAge: p.age ? String(p.age) : '',
            relation: p.relation || '',
            condition: p.condition || '',
            careType: CARE_TYPES[0],
          })
        }
      })
      .catch(() => {})

    return () => {
      isMounted = false
    }
  }, [])

  const password = useForm({
    mode: 'onTouched',
    defaultValues: { current: '', next: '', confirm: '' },
  })

  const nextValue = useWatch({ control: password.control, name: 'next' }) || ''
  const score = strengthScore(nextValue)
  const strength = STRENGTH[score]

  const onPersonal = async (values) => {
    setSavingPersonal(true)
    try {
      const streetVal = (values.street || values.address || '').trim()
      const resolvedCity = values.area?.trim() || values.district || 'Kerala'
      await profileService.updateCustomerProfile({
        fullName: values.fullName.trim(),
        defaultAddress: {
          street: streetVal,
          addressLine: streetVal,
          city: resolvedCity,
          area: values.area.trim(),
          district: values.district || 'Ernakulam',
          state: values.state || 'Kerala',
          pincode: values.pincode?.trim() || '',
        },
      })
      updateProfile({
        name: values.fullName.trim(),
        email: values.email.trim(),
        phone: values.mobile.trim(),
        city: resolvedCity,
        area: values.area.trim(),
        street: streetVal,
        district: values.district || 'Ernakulam',
        state: values.state || 'Kerala',
        pincode: values.pincode?.trim() || '',
        address: streetVal,
      })
      toast.success('Profile updated successfully')
    } catch (err) {
      toast.error('Profile update failed', {
        description: err.message || 'Server rejected changes.',
      })
    } finally {
      setSavingPersonal(false)
    }
  }

  const onPatient = async (values) => {
    setSavingPatient(true)
    try {
      const patientData = {
        name: values.patientName.trim(),
        age: Number(values.patientAge) || 0,
        relation: values.relation.trim(),
        condition: values.condition.trim(),
      }
      await profileService.updateCustomerProfile({
        patients: [patientData],
      })
      updateProfile({
        patientInfo: {
          ...patientData,
          preferredCareType: values.careType,
        },
      })
      toast.success('Patient details saved')
    } catch (err) {
      toast.error('Patient update failed', {
        description: err.message || 'Server rejected patient updates.',
      })
    } finally {
      setSavingPatient(false)
    }
  }


  const onPassword = ({ current, next }) => {
    if (!current || current.length < 6) {
      toast.error('Current password is required', {
        description: 'Please enter your current active password.',
      })
      return
    }
    if (current === next) {
      toast.error('New password must be different from current password')
      return
    }
    updateProfile({ password: next })
    toast.success('Password changed', { description: 'Your security credentials have been updated successfully.' })
    password.reset()
  }

  const savePrefs = () => {
    updateProfile({ notificationPrefs: prefs })
    toast.success('Notification preferences saved')
  }

  const scrollToDetails = (event) => {
    event.preventDefault()
    document.getElementById('personal-details')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const confirmSignOut = () => {
    setSignOutOpen(false)
    logout()
    navigate('/login')
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="My profile"
        subtitle="Manage your personal details, patient information, security and notifications."
        action={
          <Button variant="outline" icon={Pencil} href="#personal-details" onClick={scrollToDetails}>
            Edit profile
          </Button>
        }
      />

      <Card>
        <CardBody className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="flex flex-col items-center gap-2 sm:items-start">
            <Avatar src={user?.avatar} name={user?.name || user?.fullName || 'Bystander User'} size="xl" verified />
            <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold text-primary-700 hover:bg-primary-50 transition">
              <Camera className="h-3.5 w-3.5" />
              <span>Change photo</span>
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    const reader = new FileReader()
                    reader.onloadend = () => {
                      updateProfile({ avatar: reader.result })
                      toast.success('Profile photo updated')
                    }
                    reader.readAsDataURL(file)
                  }
                }}
              />
            </label>
          </div>

          <div className="min-w-0 flex-1 text-center sm:text-left">
            <h2 className="font-display text-xl font-extrabold text-ink">{user?.name || user?.fullName || 'Bystander user'}</h2>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-sm text-muted sm:justify-start">
              <span className="inline-flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-faint" /> {user?.email}
              </span>
              <span className="hidden text-faint sm:inline">·</span>
              <span className="inline-flex items-center gap-1.5">
                <UserRound className="h-3.5 w-3.5 text-faint" /> {user?.phone || 'No mobile on file'}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <Chip>{`Member since ${formatDate(user?.joinedOn, { long: true })}`}</Chip>
              <Chip>{user?.city || 'City not set'}</Chip>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 ring-1 ring-inset ring-amber-500/30">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
                {Number(profileData?.rating?.average ?? user?.rating?.average ?? 5.0).toFixed(1)} / 5.0 · {profileData?.rating?.count ?? user?.rating?.count ?? 0} Caretaker {(profileData?.rating?.count === 1) ? 'review' : 'reviews'}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-success-50 px-3 py-1.5 text-xs font-semibold text-success-700 ring-1 ring-inset ring-success-500/40">
                <ShieldCheck className="h-3.5 w-3.5" /> Verified customer
              </span>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card as="section" id="personal-details">
        <CardHeader title="Personal details" subtitle="Used for booking confirmations, invoices and emergency contact." icon={UserRound} />
        <CardBody>
          <form onSubmit={personal.handleSubmit(onPersonal)} noValidate className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Full name" htmlFor="pf-name" required error={personal.formState.errors.fullName?.message}>
                <Input
                  id="pf-name"
                  autoComplete="name"
                  error={personal.formState.errors.fullName?.message}
                  {...personal.register('fullName', {
                    required: 'Full name is required',
                    minLength: { value: 3, message: 'Enter your full name' },
                  })}
                />
              </FormField>

              <FormField label="Email address" htmlFor="pf-email" required error={personal.formState.errors.email?.message}>
                <Input
                  id="pf-email"
                  type="email"
                  autoComplete="email"
                  error={personal.formState.errors.email?.message}
                  {...personal.register('email', {
                    required: 'Email is required',
                    pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email address' },
                  })}
                />
              </FormField>

              <FormField label="Mobile number" htmlFor="pf-mobile" required error={personal.formState.errors.mobile?.message}>
                <Input
                  id="pf-mobile"
                  type="tel"
                  autoComplete="tel"
                  error={personal.formState.errors.mobile?.message}
                  {...personal.register('mobile', {
                    required: 'Mobile number is required',
                    minLength: { value: 10, message: 'Enter a valid 10-digit mobile number' },
                  })}
                />
              </FormField>

              <FormField label="Locality / Town / Landmark" htmlFor="pf-area" error={personal.formState.errors.area?.message}>
                <Input
                  id="pf-area"
                  placeholder="e.g. Koyilandy, Edappally, Kaloor, Thalassery"
                  error={personal.formState.errors.area?.message}
                  {...personal.register('area')}
                />
              </FormField>

              <FormField label="District" htmlFor="pf-district" error={personal.formState.errors.district?.message}>
                <Select id="pf-district" {...personal.register('district')}>
                  {KERALA_DISTRICTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField label="State" htmlFor="pf-state" error={personal.formState.errors.state?.message}>
                <Select id="pf-state" {...personal.register('state')}>
                  {INDIAN_STATES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField label="PIN Code (Postal Code)" htmlFor="pf-pincode" error={personal.formState.errors.pincode?.message}>
                <Input
                  id="pf-pincode"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="e.g. 682024"
                  error={personal.formState.errors.pincode?.message}
                  {...personal.register('pincode', {
                    pattern: {
                      value: /^([1-9][0-9]{5})?$/,
                      message: 'Enter a valid 6-digit Indian PIN code',
                    },
                  })}
                />
              </FormField>
            </div>

            <FormField label="House / Building / Flat Name & Street Address" htmlFor="pf-street" error={personal.formState.errors.street?.message}>
              <Textarea
                id="pf-street"
                rows={2}
                placeholder="e.g. House No. 12/450, Greenfield Villa, MG Road"
                error={personal.formState.errors.street?.message}
                {...personal.register('street')}
              />
            </FormField>

            <div className="flex justify-end">
              <Button type="submit" icon={Save} loading={savingPersonal}>
                Save changes
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <Card as="section" id="patient-information">
        <CardHeader
          title="Patient information"
          subtitle="Details of the person receiving care — shared with the assigned caretaker."
          icon={ShieldCheck}
        />
        <CardBody>
          <form onSubmit={patient.handleSubmit(onPatient)} noValidate className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField label="Patient name" htmlFor="pt-name" required error={patient.formState.errors.patientName?.message}>
                <Input
                  id="pt-name"
                  placeholder="e.g. Radhika Sharma"
                  error={patient.formState.errors.patientName?.message}
                  {...patient.register('patientName', { required: 'Patient name is required' })}
                />
              </FormField>

              <FormField label="Age" htmlFor="pt-age" required error={patient.formState.errors.patientAge?.message}>
                <Input
                  id="pt-age"
                  type="number"
                  min="1"
                  max="120"
                  placeholder="74"
                  error={patient.formState.errors.patientAge?.message}
                  {...patient.register('patientAge', {
                    validate: (value) => {
                      if (!String(value).trim()) return 'Age is required'
                      const age = Number(value)
                      if (Number.isNaN(age) || age < 1 || age > 120) return 'Enter a valid age between 1 and 120'
                      return true
                    },
                  })}
                />
              </FormField>

              <FormField label="Relation" htmlFor="pt-relation" error={patient.formState.errors.relation?.message}>
                <Input
                  id="pt-relation"
                  placeholder="e.g. Mother"
                  error={patient.formState.errors.relation?.message}
                  {...patient.register('relation')}
                />
              </FormField>
            </div>

            <FormField
              label="Condition & care requirements"
              htmlFor="pt-condition"
              error={patient.formState.errors.condition?.message}
              hint="Anything the caretaker should know before the first visit"
            >
              <Textarea
                id="pt-condition"
                rows={4}
                placeholder="e.g. Post hip-replacement recovery, mild hypertension, mobilises with a walker."
                error={patient.formState.errors.condition?.message}
                {...patient.register('condition')}
              />
            </FormField>

            <FormField label="Default care type" htmlFor="pt-caretype" error={patient.formState.errors.careType?.message}>
              <Select id="pt-caretype" {...patient.register('careType')}>
                {CARE_TYPES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </FormField>

            <div className="flex justify-end">
              <Button type="submit" icon={Save} loading={savingPatient}>
                Save patient information
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <Card as="section" id="change-password">
        <CardHeader title="Change password" subtitle="Use at least 8 characters with a mix of cases, numbers and symbols." icon={KeyRound} />
        <CardBody>
          <form onSubmit={password.handleSubmit(onPassword)} noValidate className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField label="Current password" htmlFor="pw-current" required error={password.formState.errors.current?.message}>
                <Input
                  id="pw-current"
                  type="password"
                  autoComplete="current-password"
                  error={password.formState.errors.current?.message}
                  {...password.register('current', { required: 'Enter your current password' })}
                />
              </FormField>

              <FormField label="New password" htmlFor="pw-next" required error={password.formState.errors.next?.message}>
                <Input
                  id="pw-next"
                  type="password"
                  autoComplete="new-password"
                  error={password.formState.errors.next?.message}
                  {...password.register('next', {
                    required: 'Choose a new password',
                    minLength: { value: 8, message: 'Password must be at least 8 characters' },
                  })}
                />
              </FormField>

              <FormField label="Confirm password" htmlFor="pw-confirm" required error={password.formState.errors.confirm?.message}>
                <Input
                  id="pw-confirm"
                  type="password"
                  autoComplete="new-password"
                  error={password.formState.errors.confirm?.message}
                  {...password.register('confirm', {
                    required: 'Confirm your new password',
                    validate: (value) => value === (password.getValues('next') || '') || 'Passwords do not match',
                  })}
                />
              </FormField>
            </div>

            <div className="rounded-xl border border-line bg-slate-50/70 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-muted">Password strength</span>
                <span
                  className={cn(
                    'text-xs font-bold',
                    score >= 4 ? 'text-success-700' : score >= 3 ? 'text-accent-600' : score >= 2 ? 'text-warning-700' : 'text-danger-600',
                  )}
                >
                  {nextValue ? strength.label : 'Not set'}
                </span>
              </div>
              <ProgressBar className="mt-2" value={score} max={4} tone={strength.tone} />
            </div>

            <div className="flex justify-end">
              <Button type="submit" icon={KeyRound}>
                Update password
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <Card as="section" id="notifications">
        <CardHeader title="Notification preferences" subtitle="Choose what Bystander should notify you about." icon={Bell} />
        <CardBody className="space-y-1">
          {PREF_ITEMS.map((item) => (
            <div key={item.key} className="flex items-start justify-between gap-4 border-b border-line py-3.5 last:border-0 last:pb-0 first:pt-0">
              <div className="min-w-0">
                <p id={`pref-${item.key}`} className="text-sm font-bold text-ink">
                  {item.label}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted">{item.hint}</p>
              </div>
              <Switch
                label={item.label}
                checked={prefs[item.key]}
                onChange={(next) => setPrefs((prev) => ({ ...prev, [item.key]: next }))}
              />
            </div>
          ))}
          <div className="flex justify-end pt-4">
            <Button icon={Save} onClick={savePrefs}>
              Save preferences
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card as="section" id="security">
        <CardHeader title="Account security" subtitle="Manage your session security and active devices." icon={ShieldCheck} />
        <CardBody className="space-y-4">
          <div className="flex flex-col gap-3 rounded-xl border border-line px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-bold text-ink">Sign out of this session</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted">
                Ends your active session on this device. You will need to sign in again to access bookings.
              </p>
            </div>
            <Button variant="dangerGhost" icon={LogOut} onClick={() => setSignOutOpen(true)} className="shrink-0">
              Sign out
            </Button>
          </div>
        </CardBody>
      </Card>

      <ConfirmationDialog
        open={signOutOpen}
        onClose={() => setSignOutOpen(false)}
        onConfirm={confirmSignOut}
        title="Sign out of Bystander?"
        message="You will be returned to the login screen. Any unsaved changes on this page will be lost."
        confirmLabel="Sign out"
        cancelLabel="Stay signed in"
        tone="danger"
      />
    </div>
  )
}

export default ProfilePage
