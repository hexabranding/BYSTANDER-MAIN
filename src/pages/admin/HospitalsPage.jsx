import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { BedDouble, Building2, CheckCircle2, Clock, Eye, Plus, SearchX } from 'lucide-react'
import { useDocumentTitle, useDebouncedValue } from '@/hooks/useUi'
import { HOSPITALS } from '@/data/verifications'
import { CITIES } from '@/utils/constants'
import { formatDate, uid } from '@/utils/format'
import { PageHeader } from '@/components/common/PageHeader'
import { StatCard } from '@/components/common/StatCard'
import { SearchBar } from '@/components/common/SearchBar'
import { Tabs, Chip } from '@/components/common/Tabs'
import { DataTable } from '@/components/common/DataTable'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Modal } from '@/components/common/Modal'
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog'
import { Button } from '@/components/common/Button'
import { Card, CardBody, CardHeader } from '@/components/common/Card'
import { EmptyState } from '@/components/common/States'
import { FormField, Input, Select } from '@/components/forms/FormField'

const CONTRACT_TABS = ['All', 'Active', 'On Hold']

export function HospitalsPage() {
  useDocumentTitle('Hospitals')

  const [hospitals, setHospitals] = useState(HOSPITALS)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('All')
  const [city, setCity] = useState('All')
  const [viewingId, setViewingId] = useState(null)
  const [contractTarget, setContractTarget] = useState(null)
  const [addOpen, setAddOpen] = useState(false)

  const debouncedSearch = useDebouncedValue(search)

  const cities = useMemo(() => [...new Set(hospitals.map((h) => h.city))].sort(), [hospitals])

  const stats = useMemo(() => {
    const active = hospitals.filter((h) => h.contractStatus === 'Active').length
    const onHold = hospitals.filter((h) => h.contractStatus === 'On Hold').length
    const beds = hospitals.reduce((sum, h) => sum + (h.bedPartners || 0), 0)
    return { total: hospitals.length, active, onHold, beds }
  }, [hospitals])

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    return hospitals.filter((h) => {
      const matchesTab = tab === 'All' || h.contractStatus === tab
      const matchesCity = city === 'All' || h.city === city
      const matchesSearch = !q || `${h.name} ${h.city} ${h.contact}`.toLowerCase().includes(q)
      return matchesTab && matchesCity && matchesSearch
    })
  }, [hospitals, debouncedSearch, tab, city])

  const selected = viewingId ? hospitals.find((h) => h.id === viewingId) : null

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    mode: 'onTouched',
    defaultValues: { name: '', city: CITIES[0], contact: '', phone: '', bedPartners: '', icu: false },
  })

  const closeAdd = () => {
    setAddOpen(false)
    reset()
  }

  const onSubmit = (values) => {
    const hospital = {
      id: uid('HS'),
      name: values.name.trim(),
      city: values.city,
      contact: `${values.contact.trim()} · ${values.phone.trim()}`,
      bedPartners: Number(values.bedPartners),
      activeBookings: 0,
      contractStatus: 'Active',
      joinedOn: new Date().toISOString().slice(0, 10),
      icuSupport: Boolean(values.icu),
    }
    setHospitals((prev) => [hospital, ...prev])
    toast.success(`${hospital.name} added as a partner hospital`, {
      description: 'Their contract starts as Active — assign bed partners to begin referrals.',
    })
    closeAdd()
  }

  const toggleContract = () => {
    if (!contractTarget) return
    const next = contractTarget.contractStatus === 'Active' ? 'On Hold' : 'Active'
    setHospitals((prev) => prev.map((h) => (h.id === contractTarget.id ? { ...h, contractStatus: next } : h)))
    toast[next === 'Active' ? 'success' : 'warning'](
      next === 'Active' ? `Contract with ${contractTarget.name} reactivated` : `Contract with ${contractTarget.name} put on hold`,
      {
        description:
          next === 'Active'
            ? 'Referrals and bed-partner bookings resume immediately.'
            : 'New bed-partner bookings are paused. Existing bookings continue.',
      },
    )
    setContractTarget(null)
  }

  const columns = [
    {
      key: 'name',
      header: 'Hospital',
      render: (h) => (
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-mint-100 text-primary-700">
            <Building2 className="h-4.5 w-4.5" size={18} />
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink">{h.name}</p>
            <p className="truncate text-xs text-faint">{h.id}</p>
          </div>
        </div>
      ),
    },
    { key: 'city', header: 'City' },
    {
      key: 'contact',
      header: 'Contact',
      render: (h) => <span className="block max-w-[16rem] truncate">{h.contact}</span>,
    },
    { key: 'bedPartners', header: 'Bed partners', align: 'right', render: (h) => <span className="tabular-nums">{h.bedPartners}</span> },
    {
      key: 'activeBookings',
      header: 'Active bookings',
      align: 'right',
      render: (h) => <span className="tabular-nums">{h.activeBookings}</span>,
    },
    {
      key: 'icuSupport',
      header: 'ICU support',
      sortable: false,
      render: (h) => <Chip>{h.icuSupport ? 'ICU ready' : 'Ward only'}</Chip>,
    },
    {
      key: 'contractStatus',
      header: 'Contract',
      render: (h) => <StatusBadge status={h.contractStatus} size="sm" />,
    },
    { key: 'joinedOn', header: 'Joined', render: (h) => <span className="whitespace-nowrap">{formatDate(h.joinedOn)}</span> },
    {
      key: 'action',
      header: 'Action',
      align: 'right',
      sortable: false,
      render: (h) => (
        <Button
          size="xs"
          variant="outline"
          icon={Eye}
          onClick={(e) => {
            e.stopPropagation()
            setViewingId(h.id)
          }}
        >
          View
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Partner hospitals"
        subtitle="Institutional tie-ups that route discharged patients and bed-partner referrals to CareMate."
        action={
          <Button icon={Plus} onClick={() => setAddOpen(true)}>
            Add hospital
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Partner hospitals" value={stats.total} icon={Building2} tone="primary" hint="Across all cities" delay={0} />
        <StatCard label="Active contracts" value={stats.active} icon={CheckCircle2} tone="success" trend={5} hint="Sending referrals" delay={0.05} />
        <StatCard label="On hold" value={stats.onHold} icon={Clock} tone="warning" hint="Temporarily paused" delay={0.1} />
        <StatCard label="Beds covered" value={stats.beds} icon={BedDouble} tone="accent" hint="Partner beds under CareMate care" delay={0.15} />
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search hospital, city or contact…"
          className="lg:max-w-sm lg:flex-1"
        />
        <Tabs
          tabs={CONTRACT_TABS.map((t) => ({
            id: t,
            label: t,
            count: t === 'All' ? hospitals.length : hospitals.filter((h) => h.contractStatus === t).length,
          }))}
          active={tab}
          onChange={setTab}
          size="sm"
        />
        <div className="lg:ml-auto lg:w-52">
          <Select value={city} onChange={(e) => setCity(e.target.value)} aria-label="Filter by city">
            <option value="All">All cities</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-card border border-line bg-white shadow-card">
          <EmptyState
            icon={SearchX}
            title="No hospitals found"
            description="Adjust the contract status, city or search term."
            action={
              <Button
                variant="outline"
                onClick={() => {
                  setSearch('')
                  setTab('All')
                  setCity('All')
                }}
              >
                Clear filters
              </Button>
            }
          />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          keyExtractor={(row) => row.id}
          onRowClick={(row) => setViewingId(row.id)}
          initialSort={{ key: 'name', dir: 'asc' }}
          emptyTitle="No hospitals found"
          emptyIcon={Building2}
        />
      )}

      <Modal
        open={Boolean(selected)}
        onClose={() => setViewingId(null)}
        title={selected?.name || 'Hospital'}
        subtitle={selected ? `${selected.city} · Partner since ${formatDate(selected.joinedOn, { long: true })}` : ''}
        size="lg"
        footer={
          selected ? (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              <Button variant="outline" onClick={() => setViewingId(null)}>
                Close
              </Button>
              <Button
                variant={selected.contractStatus === 'Active' ? 'dangerGhost' : 'secondary'}
                onClick={() => setContractTarget(selected)}
              >
                {selected.contractStatus === 'Active' ? 'Suspend contract' : 'Reactivate contract'}
              </Button>
            </div>
          ) : null
        }
      >
        {selected ? (
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-mint-100 text-primary-700">
                <Building2 className="h-6 w-6" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={selected.contractStatus} size="sm" />
                  <Chip>{selected.icuSupport ? 'ICU ready' : 'Ward only'}</Chip>
                </div>
                <p className="mt-1.5 text-sm text-muted">{selected.contact}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: 'Bed partners', value: selected.bedPartners },
                { label: 'Active bookings', value: selected.activeBookings },
                { label: 'ICU support', value: selected.icuSupport ? 'Yes' : 'No' },
                { label: 'Joined', value: formatDate(selected.joinedOn) },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-line bg-gradient-to-br from-slate-50 to-white px-3 py-3 text-center">
                  <p className="font-display text-base font-extrabold tabular-nums text-ink">{item.value}</p>
                  <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-faint">{item.label}</p>
                </div>
              ))}
            </div>

            <Card>
              <CardHeader title="Contract notes" subtitle="How this partnership works" />
              <CardBody className="space-y-3 text-sm">
                <div className="flex items-start justify-between gap-4">
                  <span className="text-muted">Referral flow</span>
                  <span className="max-w-[60%] text-right font-semibold text-ink">
                    Discharged patients receive a CareMate referral within 24 hours of discharge.
                  </span>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <span className="text-muted">Bed-partner coverage</span>
                  <span className="font-semibold tabular-nums text-ink">{selected.bedPartners} beds</span>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <span className="text-muted">Critical care</span>
                  <span className="font-semibold text-ink">
                    {selected.icuSupport ? 'ICU-level cases accepted' : 'Non-critical, ward-level cases only'}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <span className="text-muted">Contract status</span>
                  <span className="font-semibold text-ink">{selected.contractStatus}</span>
                </div>
              </CardBody>
            </Card>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={addOpen}
        onClose={closeAdd}
        title="Add a partner hospital"
        subtitle="Register the facility and its bed-partner capacity."
        size="md"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={closeAdd}>
              Cancel
            </Button>
            <Button type="submit" form="add-hospital-form">
              Add hospital
            </Button>
          </div>
        }
      >
        <form id="add-hospital-form" onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <FormField label="Hospital name" htmlFor="hp-name" required error={errors.name?.message}>
            <Input
              id="hp-name"
              placeholder="e.g. Kokilaben Dhirubhai Ambani Hospital"
              error={errors.name?.message}
              {...register('name', {
                required: 'Hospital name is required',
                minLength: { value: 4, message: 'Enter the full hospital name' },
              })}
            />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="City" htmlFor="hp-city" required error={errors.city?.message}>
              <Select id="hp-city" {...register('city')}>
                {CITIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Partner beds" htmlFor="hp-beds" required error={errors.bedPartners?.message}>
              <Input
                id="hp-beds"
                type="number"
                min="1"
                placeholder="e.g. 24"
                error={errors.bedPartners?.message}
                {...register('bedPartners', {
                  required: 'Enter the number of partner beds',
                  min: { value: 1, message: 'At least 1 bed is required' },
                })}
              />
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Contact person" htmlFor="hp-contact" required error={errors.contact?.message}>
              <Input
                id="hp-contact"
                placeholder="e.g. Mrs. Anita Rao"
                error={errors.contact?.message}
                {...register('contact', { required: 'Add a contact person' })}
              />
            </FormField>

            <FormField label="Phone" htmlFor="hp-phone" required error={errors.phone?.message}>
              <Input
                id="hp-phone"
                type="tel"
                placeholder="+91 22 2675 1000"
                error={errors.phone?.message}
                {...register('phone', {
                  required: 'Add a contact number',
                  pattern: { value: /^[0-9+\s-]{8,16}$/, message: 'Enter a valid phone number' },
                })}
              />
            </FormField>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line px-4 py-3 transition hover:border-primary-200">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-line-strong accent-[#0F766E]"
              {...register('icu')}
            />
            <span>
              <span className="block text-sm font-semibold text-ink">ICU-level support available</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-muted">
                Tick this if the facility has an ICU and accepts critical post-operative cases.
              </span>
            </span>
          </label>

          <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
        </form>
      </Modal>

      <ConfirmationDialog
        open={Boolean(contractTarget)}
        onClose={() => setContractTarget(null)}
        onConfirm={toggleContract}
        tone={contractTarget?.contractStatus === 'Active' ? 'danger' : 'success'}
        title={contractTarget?.contractStatus === 'Active' ? 'Suspend this contract?' : 'Reactivate this contract?'}
        message={
          contractTarget?.contractStatus === 'Active'
            ? `${contractTarget?.name} will stop receiving new referrals and bed-partner bookings until you reactivate. Existing bookings continue as scheduled.`
            : `${contractTarget?.name} resumes referrals and can accept new bed-partner bookings right away.`
        }
        confirmLabel={contractTarget?.contractStatus === 'Active' ? 'Suspend contract' : 'Reactivate contract'}
      />
    </div>
  )
}

export default HospitalsPage
