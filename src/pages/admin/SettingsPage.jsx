import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { AlertTriangle, Bell, Percent, RefreshCw, Save, Settings, ShieldCheck, UserPlus, Users } from 'lucide-react'
import { useData } from '@/context/DataContext'
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
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog'
import { PriceBreakdown } from '@/components/common/TimelinePrice'
import { CheckOption } from '@/components/common/FilterPanel'
import { FormField, Input, Select, Textarea } from '@/components/forms/FormField'

const TABS = [
  { id: 'general', label: 'General' },
  { id: 'fees', label: 'Commission & fees' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'policy', label: 'Verification policy' },
  { id: 'team', label: 'Admin team' },
  { id: 'demo', label: 'Demo data' },
]

const TIMEZONES = ['IST · UTC+05:30', 'GST · UTC+04:00', 'SGT · UTC+08:00', 'GMT · UTC+00:00']

const NOTIFICATIONS = [
  { key: 'booking', label: 'Booking alerts', hint: 'New bookings, confirmations, cancellations and reschedules.' },
  { key: 'verification', label: 'Verification queue', hint: 'Documents waiting for review and re-verification expiries.' },
  { key: 'sos', label: 'SOS alerts', hint: 'Every emergency trigger, instantly, to the ops desk.' },
  { key: 'complaint', label: 'Complaint escalations', hint: 'Complaints that move past their SLA or change stage.' },
  { key: 'digest', label: 'Daily digest', hint: 'One summary email each morning at 08:00 IST.' },
  { key: 'payout', label: 'Payout failures', hint: 'Failed or returned caregiver payout transfers.' },
]

const INITIAL_TEAM = [
  { id: 'ad-1', name: 'Kavya Raman', role: 'Operations lead', lastActive: '2026-10-10T09:12:00' },
  { id: 'ad-2', name: 'Rohit Sharma', role: 'Trust & safety', lastActive: '2026-10-09T18:40:00' },
  { id: 'ad-3', name: 'Sandeep K.', role: 'Support specialist', lastActive: '2026-10-10T07:55:00' },
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

  const { resetDemoData } = useData()

  const [tab, setTab] = useState('general')
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
  const [team, setTeam] = useState(INITIAL_TEAM)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)

  const general = useForm({
    mode: 'onTouched',
    defaultValues: {
      platformName: 'CareMate',
      supportEmail: 'support@caremate.in',
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
    defaultValues: { name: '', email: '', role: 'Support specialist' },
  })

  const commissionPct = Number(fees.watch('commission')) || 0
  const platformFee = Number(fees.watch('platformFee')) || 0
  const gstPct = Number(fees.watch('gst')) || 0

  const exampleBase = 5000
  const exampleCommission = Math.round((exampleBase * commissionPct) / 100)
  const exampleTax = Math.round(((exampleBase + platformFee) * gstPct) / 100)
  const exampleTotal = exampleBase + platformFee + exampleTax

  const saveGeneral = (values) => {
    toast.success('Settings saved', { description: `${values.platformName} profile updated for the demo session.` })
  }

  const saveFees = (values) => {
    toast.success('Commission & fees saved', {
      description: `${values.commission}% commission · ₹${values.platformFee} platform fee · ${values.gst}% GST.`,
    })
  }

  const onInvite = (values) => {
    setTeam((prev) => [
      ...prev,
      {
        id: `ad-${prev.length + 1}`,
        name: values.name.trim(),
        role: values.role,
        lastActive: '2026-10-10T10:00:00',
        pending: true,
      },
    ])
    toast.success(`Invitation sent to ${values.email.trim()}`, {
      description: 'They will appear as pending until they accept.',
    })
    setInviteOpen(false)
    invite.reset()
  }

  const handleReset = () => {
    resetDemoData()
    setResetOpen(false)
    toast.success('Demo data reset', { description: 'Bookings, complaints, SOS, payouts and blacklist are back to seed values.' })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        subtitle="Platform configuration, fees, notification rules and the admin team."
        meta={<span className="text-sm text-muted">Changes apply to this demo session only</span>}
      />

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === 'general' ? (
        <Card>
          <CardHeader
            title="General settings"
            subtitle="Platform identity and the contact details customers see"
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
            <Button type="submit" form="settings-general" icon={Save}>
              Save changes
            </Button>
          </CardFooter>
        </Card>
      ) : null}

      {tab === 'fees' ? (
        <Card>
          <CardHeader
            title="Commission & fees"
            subtitle="Revenue settings applied to every booking on the platform"
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
                  hint="Deducted from caregiver earnings at payout time."
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
                  hint="Flat handling charge added to every invoice."
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
                  hint="Applied on the service value plus platform fee."
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
                  currencyNote={`Recomputes live from your settings: ${commissionPct}% commission, ₹${platformFee} platform fee and ${gstPct}% GST.`}
                />
              </div>
            </div>
          </CardBody>
          <CardFooter className="flex justify-end">
            <Button type="submit" form="settings-fees" icon={Save}>
              Save changes
            </Button>
          </CardFooter>
        </Card>
      ) : null}

      {tab === 'notifications' ? (
        <Card>
          <CardHeader title="Notifications" subtitle="Choose which events alert the operations team" icon={Bell} />
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
            <Button icon={Save} onClick={() => toast.success('Notification preferences saved')}>
              Save changes
            </Button>
          </CardFooter>
        </Card>
      ) : null}

      {tab === 'policy' ? (
        <Card>
          <CardHeader
            title="Verification policy"
            subtitle="Documents and checks every caregiver must clear before going live"
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
                  label="Allow nursing students to take jobs"
                />
              </div>

              <div className="space-y-4">
                <FormField
                  label="Document validity period"
                  htmlFor="policy-validity"
                  hint="Documents older than this are rejected on upload."
                >
                  <Select id="policy-validity" value={validity} onChange={(e) => setValidity(e.target.value)}>
                    {['6 months', '12 months', '18 months', '24 months'].map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </Select>
                </FormField>

                <div className="rounded-xl border border-line bg-white p-4 text-xs leading-relaxed text-muted">
                  <p className="font-semibold text-ink">Current policy in effect</p>
                  <p className="mt-1.5">
                    Police clearance {policy.police ? 'required' : 'optional'} · Bank verification{' '}
                    {policy.bank ? 'required' : 'optional'} · Face check {policy.autoFace ? 'auto-approved' : 'manually reviewed'} ·
                    Nursing students {policy.students ? 'allowed' : 'blocked'} · Documents valid for {validity}.
                  </p>
                </div>
              </div>
            </div>
          </CardBody>
          <CardFooter className="flex justify-end">
            <Button icon={Save} onClick={() => toast.success('Verification policy saved')}>
              Save changes
            </Button>
          </CardFooter>
        </Card>
      ) : null}

      {tab === 'team' ? (
        <Card>
          <CardHeader
            title="Admin team"
            subtitle="People with access to this dashboard"
            icon={Users}
            action={
              <Button size="sm" icon={UserPlus} onClick={() => setInviteOpen(true)}>
                Invite admin
              </Button>
            }
          />
          <CardBody className="divide-y divide-line p-0">
            {team.map((member) => (
              <div key={member.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                <Avatar name={member.name} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-sm font-bold text-ink">{member.name}</p>
                  <p className="truncate text-xs text-muted">{member.role}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-faint">Last active</p>
                  <p className="text-xs tabular-nums text-muted">{formatDateTime(member.lastActive)}</p>
                </div>
                {member.pending ? (
                  <span className="rounded-full bg-warning-50 px-2.5 py-1 text-[11px] font-semibold text-warning-700 ring-1 ring-inset ring-warning-500/40">
                    Invite pending
                  </span>
                ) : (
                  <span className="rounded-full bg-success-50 px-2.5 py-1 text-[11px] font-semibold text-success-700 ring-1 ring-inset ring-success-500/40">
                    Active
                  </span>
                )}
              </div>
            ))}
          </CardBody>
        </Card>
      ) : null}

      {tab === 'demo' ? (
        <Card className="border-danger-200">
          <CardHeader
            title="Demo data"
            subtitle="Reset everything back to the seeded CareMate dataset"
            icon={AlertTriangle}
            className="border-danger-100"
          />
          <CardBody className="space-y-4">
            <div className="rounded-xl border border-danger-100 bg-danger-50 p-4">
              <p className="text-sm font-bold text-danger-700">What is stored in your browser</p>
              <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">
                CareMate saves demo state in <code className="rounded bg-white px-1.5 py-0.5 text-[11px]">localStorage</code> under
                the key <code className="rounded bg-white px-1.5 py-0.5 text-[11px]">caremate.store</code> — bookings, complaints,
                SOS incidents, verification documents, payout requests, blacklist entries, fraud alerts, messages,
                reviews and notifications. Nothing leaves this device and no real payment or identity data is ever
                written.
              </p>
            </div>

            <p className="text-xs leading-relaxed text-muted">
              Resetting clears that key, so every list returns to the original sample dataset. Any bookings, notes or
              status changes you made during this session will be lost.
            </p>

            <Button variant="danger" icon={RefreshCw} onClick={() => setResetOpen(true)}>
              Reset demo data
            </Button>
          </CardBody>
        </Card>
      ) : null}

      <Modal
        open={inviteOpen}
        onClose={() => {
          setInviteOpen(false)
          invite.reset()
        }}
        title="Invite admin"
        subtitle="They receive an email invitation to join the CareMate dashboard."
        size="md"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="ghost"
              onClick={() => {
                setInviteOpen(false)
                invite.reset()
              }}
            >
              Cancel
            </Button>
            <Button type="submit" form="invite-admin-form" icon={UserPlus}>
              Send invitation
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
                minLength: { value: 3, message: 'Name should be at least 3 characters' },
              })}
            />
          </FormField>

          <FormField label="Work email" htmlFor="invite-email" required error={invite.formState.errors.email?.message}>
            <Input
              id="invite-email"
              type="email"
              placeholder="name@caremate.in"
              error={invite.formState.errors.email?.message}
              {...invite.register('email', {
                required: 'Email is required',
                pattern: { value: /^\S+@\S+\.\S+$/, message: 'Enter a valid email address' },
              })}
            />
          </FormField>

          <FormField label="Role" htmlFor="invite-role" required error={invite.formState.errors.role?.message}>
            <Select id="invite-role" error={invite.formState.errors.role?.message} {...invite.register('role')}>
              {['Operations lead', 'Trust & safety', 'Support specialist', 'Finance analyst'].map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Message (optional)" htmlFor="invite-message">
            <Textarea
              id="invite-message"
              rows={3}
              placeholder="Welcome to CareMate ops — your access starts with the complaints queue."
              {...invite.register('message')}
            />
          </FormField>
        </form>
      </Modal>

      <ConfirmationDialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        onConfirm={handleReset}
        tone="danger"
        title="Reset all demo data?"
        message="This clears the local caremate.store key and restores the original seed dataset. Bookings, complaints, SOS updates, blacklist changes and notes from this session will be lost."
        confirmLabel="Reset demo data"
      />
    </div>
  )
}

export default SettingsPage
