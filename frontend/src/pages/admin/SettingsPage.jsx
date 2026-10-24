import { useCallback, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import {
  AlertTriangle,
  Bell,
  Database,
  Eye,
  EyeOff,
  Lock,
  Percent,
  RefreshCw,
  Save,
  Server,
  Settings,
  ShieldCheck,
  UserPlus,
  Users,
} from 'lucide-react'
import { useDocumentTitle } from '@/hooks/useUi'
import { cn } from '@/utils/cn'
import { CITIES } from '@/utils/constants'
import { formatDateTime } from '@/utils/format'
import { PageHeader } from '@/components/common/PageHeader'
import { Tabs } from '@/components/common/Tabs'
import { Card, CardBody, CardFooter, CardHeader } from '@/components/common/Card'
import { Button } from '@/components/common/Button'
import { Avatar } from '@/components/common/Avatar'
import { Modal } from '@/components/common/Modal'
import { PriceBreakdown } from '@/components/common/TimelinePrice'
import { CheckOption } from '@/components/common/FilterPanel'
import { FormField, Input, Select, Textarea } from '@/components/forms/FormField'
import { adminService } from '@/services/adminService'

const TABS = [
  { id: 'general', label: 'General' },
  { id: 'fees', label: 'Commission & fees' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'policy', label: 'Verification policy' },
  { id: 'team', label: 'Admin team' },
  { id: 'security', label: 'Platform security' },
]

const TIMEZONES = ['IST · UTC+05:30', 'GST · UTC+04:00', 'SGT · UTC+08:00', 'GMT · UTC+00:00']

const NOTIFICATIONS = [
  { key: 'booking', label: 'Booking alerts', hint: 'New bookings, confirmations, cancellations and reschedules.' },
  { key: 'verification', label: 'Verification queue', hint: 'Documents waiting for review and re-verification expiries.' },
  { key: 'sos', label: 'SOS alerts', hint: 'Every emergency trigger, instantly, to the ops desk.' },
  { key: 'complaint', label: 'Complaint escalations', hint: 'Complaints that move past their SLA or change stage.' },
  { key: 'digest', label: 'Daily digest', hint: 'One summary email each morning at 08:00 IST.' },
  { key: 'payout', label: 'Payout failures', hint: 'Failed or returned caretaker payout transfers.' },
]

function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-4 focus:ring-primary-100',
        checked ? 'bg-primary-700' : 'bg-slate-200',
      )}
    >
      <span
        className={cn(
          'inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200',
          checked ? 'translate-x-[22px]' : 'translate-x-0.5',
        )}
      />
    </button>
  )
}

export function SettingsPage() {
  useDocumentTitle('Settings')

  const [tab, setTab] = useState('general')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isInviting, setIsInviting] = useState(false)
  const [telemetry, setTelemetry] = useState(null)

  const [notif, setNotif] = useState({
    booking: true,
    verification: true,
    sos: true,
    complaint: true,
    digest: false,
    payout: true,
  })

  const [policy, setPolicy] = useState({
    police: true,
    bank: true,
    autoFace: false,
    students: true,
  })

  const [validity, setValidity] = useState('12 months')
  const [team, setTeam] = useState([])
  const [inviteOpen, setInviteOpen] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const general = useForm({
    mode: 'onTouched',
    defaultValues: {
      platformName: 'Bystander',
      supportEmail: 'support@bystander.care',
      supportPhone: '+91 22 4890 1122',
      defaultCity: CITIES[0],
      timezone: TIMEZONES[0],
    },
  })

  const fees = useForm({
    mode: 'onTouched',
    defaultValues: { commission: 12, platformFee: 49, gst: 18 },
  })

  const invite = useForm({
    mode: 'onTouched',
    defaultValues: { name: '', email: '', role: 'Operations lead', password: '', confirmPassword: '' },
  })

  const closeInviteModal = () => {
    setInviteOpen(false)
    invite.reset({ name: '', email: '', role: 'Operations lead', password: '', confirmPassword: '' })
    setShowPassword(false)
    setShowConfirmPassword(false)
  }


  const commissionPct = Number(fees.watch('commission')) || 0
  const platformFee = Number(fees.watch('platformFee')) || 0
  const gstPct = Number(fees.watch('gst')) || 0

  const exampleBase = 5000
  const exampleCommission = Math.round((exampleBase * commissionPct) / 100)
  const exampleTax = Math.round(((exampleBase + platformFee) * gstPct) / 100)
  const exampleTotal = exampleBase + platformFee + exampleTax

  // Fetch live settings and admin team from MongoDB
  const loadSettings = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setIsLoading(true)
    try {
      const res = await adminService.getAdminSettings()
      const bundle = res?.data || res

      if (bundle?.settings) {
        if (bundle.settings.general) {
          general.reset({
            platformName: bundle.settings.general.platformName || 'Bystander',
            supportEmail: bundle.settings.general.supportEmail || 'support@bystander.care',
            supportPhone: bundle.settings.general.supportPhone || '+91 22 4890 1122',
            defaultCity: bundle.settings.general.defaultCity || CITIES[0],
            timezone: bundle.settings.general.timezone || TIMEZONES[0],
          })
        }

        if (bundle.settings.fees) {
          fees.reset({
            commission: bundle.settings.fees.commission ?? 12,
            platformFee: bundle.settings.fees.platformFee ?? 49,
            gst: bundle.settings.fees.gst ?? 18,
          })
        }

        if (bundle.settings.notifications) {
          setNotif((prev) => ({ ...prev, ...bundle.settings.notifications }))
        }

        if (bundle.settings.policy) {
          setPolicy((prev) => ({
            ...prev,
            police: bundle.settings.policy.police ?? true,
            bank: bundle.settings.policy.bank ?? true,
            autoFace: bundle.settings.policy.autoFace ?? false,
            students: bundle.settings.policy.students ?? true,
          }))
          if (bundle.settings.policy.validity) {
            setValidity(bundle.settings.policy.validity)
          }
        }
      }

      if (Array.isArray(bundle?.team)) {
        setTeam(bundle.team)
      }

      if (bundle?.telemetry) {
        setTelemetry(bundle.telemetry)
      }

      if (isRefresh) {
        toast.success('Settings synchronized with MongoDB')
      }
    } catch (err) {
      toast.error('Unable to retrieve settings from server', {
        description: err?.message || 'Please check backend connection.',
      })
    } finally {
      setIsLoading(false)
    }
  }, [general, fees])

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  // Save General settings to MongoDB
  const saveGeneral = async (values) => {
    setIsSaving(true)
    try {
      await adminService.updateAdminSettings({ general: values })
      toast.success('Settings saved', {
        description: `${values.platformName} platform configuration updated in MongoDB.`,
      })
    } catch (err) {
      toast.error('Failed to save settings', { description: err.message })
    } finally {
      setIsSaving(false)
    }
  }

  // Save Commission & Fees to MongoDB
  const saveFees = async (values) => {
    setIsSaving(true)
    try {
      await adminService.updateAdminSettings({ fees: values })
      toast.success('Commission & fees saved', {
        description: `${values.commission}% commission · ₹${values.platformFee} platform fee · ${values.gst}% GST saved in MongoDB.`,
      })
    } catch (err) {
      toast.error('Failed to save fees', { description: err.message })
    } finally {
      setIsSaving(false)
    }
  }

  // Save Notification preferences to MongoDB
  const saveNotifications = async () => {
    setIsSaving(true)
    try {
      await adminService.updateAdminSettings({ notifications: notif })
      toast.success('Notification preferences saved', {
        description: 'Operations alert routing rules updated in MongoDB.',
      })
    } catch (err) {
      toast.error('Failed to save notification preferences', { description: err.message })
    } finally {
      setIsSaving(false)
    }
  }

  // Save Verification Policy to MongoDB
  const savePolicy = async () => {
    setIsSaving(true)
    try {
      await adminService.updateAdminSettings({ policy: { ...policy, validity } })
      toast.success('Verification policy saved', {
        description: 'Caretaker verification requirements updated in MongoDB.',
      })
    } catch (err) {
      toast.error('Failed to save verification policy', { description: err.message })
    } finally {
      setIsSaving(false)
    }
  }

  // Invite Admin member into MongoDB
  const onInvite = async (values) => {
    setIsInviting(true)
    try {
      const res = await adminService.inviteAdminMember({
        name: values.name,
        email: values.email,
        role: values.role,
        password: values.password,
        message: values.message,
      })
      const bundle = res?.data || res
      if (Array.isArray(bundle?.team)) {
        setTeam(bundle.team)
      } else if (bundle?.member) {
        setTeam((prev) => [...prev, bundle.member])
      }
      toast.success(`Admin registered: ${values.name}`, {
        description: `${values.email} can now sign in using the password you set.`,
      })
      closeInviteModal()
    } catch (err) {
      toast.error('Failed to add administrator', {
        description: err?.message || 'Could not register administrator account.',
      })
    } finally {
      setIsInviting(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        subtitle="Live platform configuration, fees, notification rules and administrative team."
        actions={
          <Button
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            onClick={() => loadSettings(true)}
            disabled={isLoading}
          >
            Sync with server
          </Button>
        }
        meta={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-500/30">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            Live MongoDB Connected
          </span>
        }
      />

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {/* ---------------- 1. GENERAL TAB ---------------- */}
      {tab === 'general' ? (
        <Card>
          <CardHeader
            title="General settings"
            subtitle="Platform identity and the contact details customers and caregivers see"
            icon={Settings}
          />
          <CardBody>
            <form
              id="settings-general"
              onSubmit={general.handleSubmit(saveGeneral)}
              noValidate
              className="grid max-w-3xl gap-4 sm:grid-cols-2"
            >
              <FormField label="Platform name" htmlFor="set-name" required error={general.formState.errors.platformName?.message}>
                <Input
                  id="set-name"
                  error={general.formState.errors.platformName?.message}
                  {...general.register('platformName', { required: 'Platform name is required' })}
                />
              </FormField>

              <FormField label="Support email" htmlFor="set-email" required error={general.formState.errors.supportEmail?.message}>
                <Input
                  id="set-email"
                  type="email"
                  error={general.formState.errors.supportEmail?.message}
                  {...general.register('supportEmail', {
                    required: 'Support email is required',
                    pattern: { value: /^\S+@\S+\.\S+$/, message: 'Enter a valid email address' },
                  })}
                />
              </FormField>

              <FormField label="Support phone" htmlFor="set-phone" required error={general.formState.errors.supportPhone?.message}>
                <Input
                  id="set-phone"
                  error={general.formState.errors.supportPhone?.message}
                  {...general.register('supportPhone', { required: 'Support phone is required' })}
                />
              </FormField>

              <FormField label="Default city" htmlFor="set-city">
                <Select id="set-city" {...general.register('defaultCity')}>
                  {CITIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField label="Timezone" htmlFor="set-timezone" hint="Used for reports, digests and SLA clocks.">
                <Select id="set-timezone" {...general.register('timezone')}>
                  {TIMEZONES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
              </FormField>
            </form>
          </CardBody>
          <CardFooter className="flex justify-end">
            <Button type="submit" form="settings-general" icon={Save} loading={isSaving}>
              Save changes to database
            </Button>
          </CardFooter>
        </Card>
      ) : null}

      {/* ---------------- 2. FEES TAB ---------------- */}
      {tab === 'fees' ? (
        <Card>
          <CardHeader
            title="Commission & fees"
            subtitle="Authoritative platform rates applied to booking escrow and payouts"
            icon={Percent}
          />
          <CardBody>
            <div className="grid gap-6 lg:grid-cols-2">
              <form
                id="settings-fees"
                onSubmit={fees.handleSubmit(saveFees)}
                noValidate
                className="space-y-4"
              >
                <FormField
                  label="Platform commission (%)"
                  htmlFor="set-commission"
                  required
                  error={fees.formState.errors.commission?.message}
                  hint="Deducted from caretaker earnings at payout calculation time."
                >
                  <Input
                    id="set-commission"
                    type="number"
                    min="0"
                    max="50"
                    step="0.5"
                    error={fees.formState.errors.commission?.message}
                    {...fees.register('commission', {
                      required: 'Enter a commission rate',
                      min: { value: 0, message: 'Cannot be negative' },
                      max: { value: 50, message: 'Maximum 50%' },
                    })}
                  />
                </FormField>

                <FormField
                  label="Platform fee per booking (₹)"
                  htmlFor="set-fee"
                  required
                  error={fees.formState.errors.platformFee?.message}
                  hint="Flat handling charge added to every tax invoice."
                >
                  <Input
                    id="set-fee"
                    type="number"
                    min="0"
                    step="1"
                    error={fees.formState.errors.platformFee?.message}
                    {...fees.register('platformFee', {
                      required: 'Enter a platform fee',
                      min: { value: 0, message: 'Cannot be negative' },
                    })}
                  />
                </FormField>

                <FormField
                  label="GST rate (%)"
                  htmlFor="set-gst"
                  required
                  error={fees.formState.errors.gst?.message}
                  hint="Applied on the care service value plus platform handling fee."
                >
                  <Input
                    id="set-gst"
                    type="number"
                    min="0"
                    max="28"
                    step="0.5"
                    error={fees.formState.errors.gst?.message}
                    {...fees.register('gst', {
                      required: 'Enter a GST rate',
                      min: { value: 0, message: 'Cannot be negative' },
                      max: { value: 28, message: 'Maximum 28%' },
                    })}
                  />
                </FormField>
              </form>

              <div className="space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-faint">
                  Live preview · ₹5,000 example booking
                </p>
                <PriceBreakdown
                  items={[
                    { label: 'Care charges', meta: 'Example booking base value', amount: exampleBase },
                  ]}
                  subtotal={exampleBase}
                  platformFee={platformFee}
                  tax={exampleTax}
                  commission={exampleCommission}
                  total={exampleTotal}
                  currencyNote={`Recomputes live from active settings: ${commissionPct}% commission, ₹${platformFee} platform fee and ${gstPct}% GST.`}
                />
              </div>
            </div>
          </CardBody>
          <CardFooter className="flex justify-end">
            <Button type="submit" form="settings-fees" icon={Save} loading={isSaving}>
              Save rates to database
            </Button>
          </CardFooter>
        </Card>
      ) : null}

      {/* ---------------- 3. NOTIFICATIONS TAB ---------------- */}
      {tab === 'notifications' ? (
        <Card>
          <CardHeader title="Notifications" subtitle="Configure event triggers for operations desk alerts" icon={Bell} />
          <CardBody className="space-y-1">
            {NOTIFICATIONS.map((n) => (
              <div
                key={n.key}
                className="flex items-start justify-between gap-4 border-b border-line py-4 last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold text-ink">{n.label}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted">{n.hint}</p>
                </div>
                <Toggle
                  label={n.label}
                  checked={notif[n.key]}
                  onChange={() => setNotif((prev) => ({ ...prev, [n.key]: !prev[n.key] }))}
                />
              </div>
            ))}
          </CardBody>
          <CardFooter className="flex justify-end">
            <Button icon={Save} onClick={saveNotifications} loading={isSaving}>
              Save notification preferences
            </Button>
          </CardFooter>
        </Card>
      ) : null}

      {/* ---------------- 4. POLICY TAB ---------------- */}
      {tab === 'policy' ? (
        <Card>
          <CardHeader
            title="Verification policy"
            subtitle="Compliance policies enforced on every caretaker prior to document approval"
            icon={ShieldCheck}
          />
          <CardBody className="space-y-5">
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-3 rounded-card border border-line bg-slate-50/60 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-faint">Required checks</p>
                <CheckOption
                  checked={policy.police}
                  onChange={() => setPolicy((p) => ({ ...p, police: !p.police }))}
                  label="Require police clearance certificate"
                />
                <CheckOption
                  checked={policy.bank}
                  onChange={() => setPolicy((p) => ({ ...p, bank: !p.bank }))}
                  label="Require bank account verification"
                />
                <CheckOption
                  checked={policy.autoFace}
                  onChange={() => setPolicy((p) => ({ ...p, autoFace: !p.autoFace }))}
                  label="Auto-approve face verification"
                />
                <CheckOption
                  checked={policy.students}
                  onChange={() => setPolicy((p) => ({ ...p, students: !p.students }))}
                  label="Allow nursing students to accept shifts"
                />
              </div>

              <div className="space-y-4">
                <FormField
                  label="Document validity period"
                  htmlFor="policy-validity"
                  hint="Documents issued earlier than this duration will require re-verification."
                >
                  <Select id="policy-validity" value={validity} onChange={(e) => setValidity(e.target.value)}>
                    {['6 months', '12 months', '18 months', '24 months'].map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </Select>
                </FormField>

                <div className="rounded-xl border border-line bg-white p-4 text-xs leading-relaxed text-muted shadow-sm">
                  <p className="font-semibold text-ink">Active MongoDB Policy in Effect</p>
                  <p className="mt-1.5">
                    Police clearance {policy.police ? 'strictly required' : 'optional'} · Bank verification{' '}
                    {policy.bank ? 'strictly required' : 'optional'} · Face check {policy.autoFace ? 'auto-approved' : 'manually reviewed'} ·
                    Nursing students {policy.students ? 'permitted' : 'disallowed'} · Document validity window: {validity}.
                  </p>
                </div>
              </div>
            </div>
          </CardBody>
          <CardFooter className="flex justify-end">
            <Button icon={Save} onClick={savePolicy} loading={isSaving}>
              Save verification policy
            </Button>
          </CardFooter>
        </Card>
      ) : null}

      {/* ---------------- 5. TEAM TAB ---------------- */}
      {tab === 'team' ? (
        <Card>
          <CardHeader
            title="Admin team"
            subtitle="Registered administrator accounts from MongoDB with dashboard credentials"
            icon={Users}
            action={
              <Button size="sm" icon={UserPlus} onClick={() => setInviteOpen(true)}>
                Add administrator
              </Button>
            }
          />
          <CardBody className="divide-y divide-line p-0">
            {team.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted">No admin accounts found in database.</div>
            ) : (
              team.map((member) => (
                <div key={member.id} className="flex flex-wrap items-center gap-4 px-5 py-4 transition hover:bg-mint-50/60">
                  <Avatar name={member.name} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-display text-sm font-bold text-ink">{member.name}</p>
                      <span className="font-mono text-[11px] text-muted">({member.email})</span>
                    </div>
                    <p className="truncate text-xs text-muted mt-0.5">{member.role}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-faint">Last active</p>
                    <p className="text-xs tabular-nums text-muted">{formatDateTime(member.lastActive)}</p>
                  </div>
                  {member.pending ? (
                    <span className="rounded-full bg-warning-50 px-2.5 py-1 text-[11px] font-semibold text-warning-700 ring-1 ring-inset ring-warning-500/40">
                      Pending review
                    </span>
                  ) : (
                    <span className="rounded-full bg-success-50 px-2.5 py-1 text-[11px] font-semibold text-success-700 ring-1 ring-inset ring-success-500/40">
                      Active
                    </span>
                  )}
                </div>
              ))
            )}
          </CardBody>
        </Card>
      ) : null}

      {/* ---------------- 6. SECURITY TAB ---------------- */}
      {tab === 'security' ? (
        <Card>
          <CardHeader
            title="Platform security & compliance"
            subtitle="Live database telemetry, cryptographic controls, and audit integrity"
            icon={ShieldCheck}
          />
          <CardBody className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-line bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-ink">MongoDB Database Connection</p>
                  <Database className="h-4 w-4 text-primary-600" />
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  Live state: <strong className="text-ink">{telemetry?.databaseStatus || 'Connected & Operational'}</strong>
                </p>
                <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  MongoDB Replica Active
                </span>
              </div>

              <div className="rounded-xl border border-line bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-ink">Encryption Standard</p>
                  <Lock className="h-4 w-4 text-primary-600" />
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  {telemetry?.encryptionStandard || 'AES-256 (Data at Rest) & TLS 1.3 (In Transit)'}
                </p>
                <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-300">
                  Active &amp; Enforced
                </span>
              </div>

              <div className="rounded-xl border border-line bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-ink">Authentication &amp; JWT Protection</p>
                  <ShieldCheck className="h-4 w-4 text-primary-600" />
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  {telemetry?.jwtProtection || 'HS-256 (HttpOnly Secure Cookie)'} with {telemetry?.passwordAlgorithm || 'Bcrypt (Salt Rounds: 12)'}
                </p>
                <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-300">
                  Protected Session
                </span>
              </div>

              <div className="rounded-xl border border-line bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-ink">Server Uptime &amp; Audit Trail</p>
                  <Server className="h-4 w-4 text-primary-600" />
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  Uptime: <strong className="text-ink">{telemetry?.uptime || 'Active'}</strong> · {telemetry?.auditRetention || '8-Year Continuous Append-Only Log'}
                </p>
                <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-300">
                  Operational
                </span>
              </div>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {/* ---------------- INVITE ADMIN MODAL ---------------- */}
      <Modal
        open={inviteOpen}
        onClose={closeInviteModal}
        title="Add administrator"
        subtitle="Registers an administrator account directly in MongoDB with dashboard privileges."
        size="md"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="ghost"
              onClick={closeInviteModal}
              disabled={isInviting}
            >
              Cancel
            </Button>
            <Button type="submit" form="invite-admin-form" icon={UserPlus} loading={isInviting}>
              Register administrator
            </Button>
          </div>
        }
      >
        <form id="invite-admin-form" onSubmit={invite.handleSubmit(onInvite)} noValidate className="space-y-4">
          <FormField label="Full name" htmlFor="invite-name" required error={invite.formState.errors.name?.message}>
            <Input
              id="invite-name"
              placeholder="e.g. Meera Iyer"
              error={invite.formState.errors.name?.message}
              {...invite.register('name', {
                required: 'Enter their name',
                minLength: { value: 2, message: 'Name should be at least 2 characters' },
              })}
            />
          </FormField>

          <FormField label="Work email" htmlFor="invite-email" required error={invite.formState.errors.email?.message}>
            <Input
              id="invite-email"
              type="email"
              placeholder="name@bystander.care"
              error={invite.formState.errors.email?.message}
              {...invite.register('email', {
                required: 'Email is required',
                pattern: { value: /^\S+@\S+\.\S+$/, message: 'Enter a valid email address' },
              })}
            />
          </FormField>

          <FormField label="Role / Department" htmlFor="invite-role" required error={invite.formState.errors.role?.message}>
            <Select id="invite-role" error={invite.formState.errors.role?.message} {...invite.register('role')}>
              {['Operations lead', 'Trust & safety', 'Support specialist', 'Finance analyst', 'Platform administrator'].map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Create password" htmlFor="invite-password" required error={invite.formState.errors.password?.message}>
              <div className="relative">
                <Input
                  id="invite-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Min. 6 characters"
                  error={invite.formState.errors.password?.message}
                  {...invite.register('password', {
                    required: 'Password is required',
                    minLength: { value: 6, message: 'Password must be at least 6 characters' },
                  })}
                  className="pr-10"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink focus:outline-none"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </FormField>

            <FormField label="Re-enter password" htmlFor="invite-confirm-password" required error={invite.formState.errors.confirmPassword?.message}>
              <div className="relative">
                <Input
                  id="invite-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Re-type password"
                  error={invite.formState.errors.confirmPassword?.message}
                  {...invite.register('confirmPassword', {
                    required: 'Please confirm password',
                    validate: (val) => val === invite.watch('password') || 'Passwords do not match',
                  })}
                  className="pr-10"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink focus:outline-none"
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </FormField>
          </div>

          <FormField label="Notes (optional)" htmlFor="invite-message">
            <Textarea
              id="invite-message"
              rows={2}
              placeholder="Operational responsibilities and desk assignment."
              {...invite.register('message')}
            />
          </FormField>
        </form>
      </Modal>
    </div>
  )
}

export default SettingsPage
