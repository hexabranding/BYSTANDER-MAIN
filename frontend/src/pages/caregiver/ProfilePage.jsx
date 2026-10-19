import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Eye, MapPin, Save, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useData } from '@/context/DataContext'
import { useDocumentTitle } from '@/hooks/useUi'
import { CITIES, LANGUAGES, QUALIFICATIONS } from '@/utils/constants'
import { formatCurrency, formatDate } from '@/utils/format'
import { Button } from '@/components/common/Button'
import { Card, CardBody, CardHeader } from '@/components/common/Card'
import { StatusBadge } from '@/components/common/StatusBadge'
import { PageHeader } from '@/components/common/PageHeader'
import { Avatar } from '@/components/common/Avatar'
import { RatingStars } from '@/components/common/RatingStars'
import { Chip, ProgressBar } from '@/components/common/Tabs'
import { FormField, Input, Select, Textarea } from '@/components/forms/FormField'
import { profileService } from '@/services'

const CARE_SETTINGS = ['Home Care', 'Hospital Care']

export function ProfilePage() {
  useDocumentTitle('My Profile')

  const { user, updateProfile } = useAuth()
  const { caregivers, verifications } = useData()

  const [realProfile, setRealProfile] = useState(null)
  const myId = user?.caregiverId || 'cg-101'
  const caregiver = realProfile || caregivers.find((c) => c.id === myId) || caregivers[0]
  const verification = verifications.find((v) => v.caregiverId === myId)

  const verifiedDocs = (verification?.documents || []).filter((d) => d.status === 'Verified').length
  const totalDocs = verification?.documents?.length || 7
  const completeness = useMemo(() => {
    let pct = 60
    pct += Math.min(30, verifiedDocs * 10)
    if (caregiver?.bio && caregiver?.hourlyRate && caregiver?.languages?.length) pct += 10
    return Math.min(100, pct)
  }, [caregiver, verifiedDocs])

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      name: caregiver?.name || user?.name || '',
      qualification: caregiver?.qualification || QUALIFICATIONS[0],
      experienceYears: caregiver?.experienceYears ?? 0,
      hourlyRate: caregiver?.hourlyRate ?? 0,
      languages: caregiver?.languages || [],
      careSettings: caregiver?.careSettings || ['Home Care'],
      bio: caregiver?.bio || '',
      city: caregiver?.city || CITIES[0],
      area: caregiver?.area || '',
    },
  })

  useEffect(() => {
    let isMounted = true
    profileService
      .getCaregiverProfile()
      .then((data) => {
        if (!isMounted || !data) return
        setRealProfile(data)
        reset({
          name: data.fullName || data.name || user?.name || '',
          qualification: data.qualification || QUALIFICATIONS[0],
          experienceYears: data.experienceYears ?? 0,
          hourlyRate: data.hourlyRate ?? 0,
          languages: data.languages || [],
          careSettings: data.careSettings || ['Home Care'],
          bio: data.bio || '',
          city: data.city || CITIES[0],
          area: data.area || '',
        })
      })
      .catch(() => {})

    return () => {
      isMounted = false
    }
  }, [reset, user?.name])

  const languages = watch('languages')
  const careSettings = watch('careSettings')
  const hourlyRate = watch('hourlyRate')
  const bio = watch('bio')

  const toggleLanguage = (lang) => {
    const next = languages.includes(lang) ? languages.filter((l) => l !== lang) : [...languages, lang]
    setValue('languages', next, { shouldDirty: true })
  }

  const toggleSetting = (setting) => {
    const next = careSettings.includes(setting)
      ? careSettings.filter((s) => s !== setting)
      : [...careSettings, setting]
    setValue('careSettings', next, { shouldDirty: true })
  }

  const onSubmit = async (data) => {
    try {
      const sanitized = {
        bio: data.bio.trim(),
        experienceYears: Number(data.experienceYears) || 0,
        hourlyRate: Number(data.hourlyRate) || 0,
        languages: data.languages,
        careSettings: data.careSettings,
        city: data.city,
        area: data.area.trim(),
      }
      const updated = await profileService.updateCaregiverProfile(sanitized)
      setRealProfile(updated)
      updateProfile({
        name: data.name,
        qualification: data.qualification,
        ...sanitized,
      })
      toast.success('Profile updated successfully')
    } catch (err) {
      toast.error('Profile update failed', {
        description: err.message || 'Server rejected changes.',
      })
    }
  }

  const handlePreview = () => {
    toast.info('This is exactly what customers see')
  }


  return (
    <div className="space-y-6">
      <PageHeader
        title="My profile"
        subtitle="Keep your public profile accurate — it is the first thing customers evaluate before booking."
        meta={
          <>
            <StatusBadge status={caregiver?.verificationStatus || 'Pending'} />
            <span className="text-sm text-muted">Member since {formatDate(caregiver?.joinedOn, { long: true })}</span>
          </>
        }
      />

      <Card>
        <CardBody>
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <Avatar src={caregiver?.photo} name={caregiver?.name} size="xl" verified={caregiver?.verified} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-xl font-extrabold text-ink">{caregiver?.name}</h2>
                <StatusBadge status={caregiver?.verificationStatus || 'Pending'} size="sm" />
              </div>
              <p className="mt-1 text-sm text-muted">
                {caregiver?.qualification} · Reg {caregiver?.regNo}
              </p>
              <div className="mt-3 max-w-md">
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="font-semibold text-ink-soft">Profile completeness</span>
                  <span className="font-bold text-primary-700">{completeness}%</span>
                </div>
                <ProgressBar value={completeness} tone="primary" showLabel={false} />
              </div>
            </div>
            <Button variant="outline" icon={Eye} onClick={handlePreview}>
              Preview public profile
            </Button>
          </div>
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Public profile preview" subtitle="Exactly what customers see on your listing" icon={Eye} />
          <CardBody className="space-y-5">
            <div className="flex items-center gap-4">
              <Avatar src={caregiver?.photo} name={caregiver?.name} size="lg" verified={caregiver?.verified} />
              <div>
                <p className="font-display text-lg font-bold text-ink">{caregiver?.name}</p>
                <RatingStars value={caregiver?.rating ?? 0} count={caregiver?.reviewCount} showValue size={16} className="mt-1" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-line bg-gradient-to-br from-slate-50 to-white p-3.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-faint">Hourly rate</p>
                <p className="mt-1 font-display text-lg font-extrabold tabular-nums text-ink">{formatCurrency(caregiver?.hourlyRate)}</p>
              </div>
              <div className="rounded-xl border border-line bg-gradient-to-br from-slate-50 to-white p-3.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-faint">Experience</p>
                <p className="mt-1 font-display text-lg font-extrabold tabular-nums text-ink">{caregiver?.experienceYears} yrs</p>
              </div>
            </div>

            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-faint">Services</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(caregiver?.services || []).map((s) => (
                  <span key={s} className="rounded-full bg-mint-100 px-3 py-1 text-xs font-semibold text-primary-800">
                    {s}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-faint">Languages</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(caregiver?.languages || []).map((l) => (
                  <Chip key={l}>{l}</Chip>
                ))}
              </div>
            </div>

            <p className="inline-flex items-center gap-2 text-sm text-muted">
              <MapPin className="h-4 w-4 shrink-0 text-faint" />
              {caregiver?.area}, {caregiver?.city}
            </p>

            <div className="flex flex-wrap gap-2">
              {(caregiver?.badges || []).map((badge) => (
                <span key={badge} className="rounded-full border border-primary-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-primary-700">
                  {badge}
                </span>
              ))}
            </div>

            <p className="rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-muted">
              Identity, bank and police documents are never shown to customers or other caretakers.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Profile details" subtitle="Update what customers read before booking" icon={Save} />
          <CardBody>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Display name" htmlFor="pf-name" required error={errors.name?.message}>
                  <Input id="pf-name" error={errors.name} {...register('name', { required: 'Name is required' })} />
                </FormField>
                <FormField label="Qualification" htmlFor="pf-qualification" required>
                  <Select id="pf-qualification" {...register('qualification')}>
                    {QUALIFICATIONS.map((q) => (
                      <option key={q} value={q}>
                        {q}
                      </option>
                    ))}
                  </Select>
                </FormField>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Experience (years)" htmlFor="pf-exp" required error={errors.experienceYears?.message}>
                  <Input
                    id="pf-exp"
                    type="number"
                    min={0}
                    max={60}
                    error={errors.experienceYears}
                    {...register('experienceYears', {
                      required: 'Required',
                      min: { value: 0, message: 'Cannot be negative' },
                      max: { value: 60, message: 'Max 60 years' },
                    })}
                  />
                </FormField>
                <FormField
                  label="Hourly rate (₹)"
                  htmlFor="pf-rate"
                  required
                  error={errors.hourlyRate?.message}
                  hint={`Customers will see ${formatCurrency(hourlyRate || 0)}/hr`}
                >
                  <Input
                    id="pf-rate"
                    type="number"
                    min={99}
                    max={5000}
                    error={errors.hourlyRate}
                    {...register('hourlyRate', {
                      required: 'Required',
                      min: { value: 99, message: 'Minimum ₹99/hr' },
                      max: { value: 5000, message: 'Maximum ₹5,000/hr' },
                    })}
                  />
                </FormField>
              </div>

              <FormField label="Languages" htmlFor="pf-langs" hint="Tap to toggle — customers filter by language.">
                <div className="flex flex-wrap gap-2 pt-1">
                  {LANGUAGES.map((lang) => (
                    <Chip key={lang} selected={languages.includes(lang)} onClick={() => toggleLanguage(lang)}>
                      {lang}
                    </Chip>
                  ))}
                </div>
              </FormField>

              <FormField label="Care settings" htmlFor="pf-settings" error={errors.careSettings?.message}>
                <div className="flex flex-wrap gap-4 pt-1">
                  {CARE_SETTINGS.map((setting) => (
                    <label key={setting} className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-ink-soft">
                      <input
                        type="checkbox"
                        checked={careSettings.includes(setting)}
                        onChange={() => toggleSetting(setting)}
                        className="h-4 w-4 rounded border-line-strong text-primary-700 focus:ring-primary-400"
                      />
                      {setting}
                    </label>
                  ))}
                </div>
              </FormField>

              <FormField
                label="Bio"
                htmlFor="pf-bio"
                required
                error={errors.bio?.message}
                hint={`${bio?.length || 0}/80 characters minimum — families book people, not resumes.`}
              >
                <Textarea
                  id="pf-bio"
                  rows={5}
                  placeholder="ICU-trained nurse with nine years across surgical wards…"
                  error={errors.bio}
                  {...register('bio', {
                    required: 'Bio is required',
                    minLength: { value: 80, message: 'Write at least 80 characters so families get to know you' },
                  })}
                />
              </FormField>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="City" htmlFor="pf-city" required>
                  <Select id="pf-city" {...register('city')}>
                    {CITIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Area" htmlFor="pf-area" required error={errors.area?.message}>
                  <Input id="pf-area" placeholder="Powai" error={errors.area} {...register('area', { required: 'Area is required' })} />
                </FormField>
              </div>

              <div className="flex justify-end gap-2 border-t border-line pt-4">
                <Button type="submit" variant="primary" icon={Save} loading={isSubmitting}>
                  Save changes
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Verification status" subtitle="Your trust score with customers" icon={ShieldCheck} />
        <CardBody className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <StatusBadge status={caregiver?.verificationStatus || 'Pending'} />
              <span className="text-sm text-muted">
                {verifiedDocs} of {totalDocs} documents verified
              </span>
            </div>
            <Button variant="primary" size="sm" to="/caregiver/documents">
              Manage documents
            </Button>
          </div>
          <ProgressBar value={verifiedDocs} max={totalDocs} tone={verifiedDocs === totalDocs ? 'success' : 'warning'} />
          <p className="text-xs leading-relaxed text-muted">
            A Verified badge increases booking conversions dramatically. Keep documents current — expired police clearance or bank proofs
            can pause new bookings.
          </p>
        </CardBody>
      </Card>
    </div>
  )
}

export default ProfilePage
