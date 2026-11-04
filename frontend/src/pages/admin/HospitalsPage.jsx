import { useCallback, useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import {
  BedDouble,
  Building2,
  CheckCircle2,
  Clock,
  Eye,
  Mail,
  MapPin,
  Phone,
  Plus,
  RefreshCw,
  SearchX,
  ShieldAlert,
  Trash2,
} from 'lucide-react'
import { useDocumentTitle, useDebouncedValue } from '@/hooks/useUi'
import { usePagination } from '@/hooks/usePagination'
import { adminService } from '@/services/adminService'
import { KERALA_DISTRICTS } from '@/utils/constants'
import { formatDate } from '@/utils/format'
import { PageHeader } from '@/components/common/PageHeader'
import { StatCard } from '@/components/common/StatCard'
import { SearchBar } from '@/components/common/SearchBar'
import { Tabs, Chip } from '@/components/common/Tabs'
import { DataTable } from '@/components/common/DataTable'
import { Pagination } from '@/components/common/Pagination'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Modal } from '@/components/common/Modal'
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog'
import { Button } from '@/components/common/Button'
import { Card, CardBody, CardHeader } from '@/components/common/Card'
import { EmptyState } from '@/components/common/States'
import { FormField, Input, Select } from '@/components/forms/FormField'

const CONTRACT_TABS = ['All', 'Active', 'On Hold']

export function HospitalsPage() {
  useDocumentTitle('Partner Hospitals')

  const [hospitals, setHospitals] = useState([])
  const [stats, setStats] = useState({ total: 0, active: 0, onHold: 0, beds: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('All')
  const [district, setDistrict] = useState('All')
  const [viewingId, setViewingId] = useState(null)
  const [contractTarget, setContractTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [addOpen, setAddOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const debouncedSearch = useDebouncedValue(search)

  const fetchHospitals = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await adminService.getHospitals({
        search: debouncedSearch.trim() || undefined,
        contractStatus: tab === 'All' ? undefined : tab,
        district: district === 'All' ? undefined : district,
      })
      setHospitals(res.hospitals || [])
      setStats(res.stats || { total: 0, active: 0, onHold: 0, beds: 0 })
    } catch (err) {
      setError(err?.message || 'Failed to retrieve partner hospitals from server.')
    } finally {
      setIsLoading(false)
    }
  }, [debouncedSearch, tab, district])

  useEffect(() => {
    fetchHospitals()
  }, [fetchHospitals])

  // Extract distinct districts present in the hospitals list
  const activeDistricts = useMemo(() => {
    const list = hospitals.map((h) => h.district).filter(Boolean)
    return [...new Set(list)].sort()
  }, [hospitals])

  const { page, totalPages, totalItems, pageItems, goto } = usePagination(hospitals, 8)

  useEffect(() => {
    goto(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, tab, district])

  const selected = viewingId ? hospitals.find((h) => (h._id || h.id) === viewingId) : null

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    mode: 'onTouched',
    defaultValues: {
      name: '',
      district: 'Kozhikode',
      city: '',
      address: '',
      contactPerson: '',
      phone: '',
      email: '',
      bedPartners: '20',
      icuSupport: false,
    },
  })

  const closeAdd = () => {
    setAddOpen(false)
    reset()
  }

  const onSubmit = async (values) => {
    setIsSubmitting(true)
    try {
      const payload = {
        name: values.name.trim(),
        district: values.district,
        city: values.city.trim(),
        address: values.address.trim(),
        contactPerson: values.contactPerson.trim(),
        phone: values.phone.trim(),
        email: values.email?.trim() || '',
        bedPartners: Number(values.bedPartners),
        icuSupport: Boolean(values.icuSupport),
        contractStatus: 'Active',
      }

      await adminService.createHospital(payload)
      toast.success(`${payload.name} added as a partner hospital`, {
        description: 'Facility registered and saved in database with Active referral contract.',
      })
      closeAdd()
      fetchHospitals()
    } catch (err) {
      toast.error('Failed to add hospital', {
        description: err?.message || 'Please check the required fields and try again.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const toggleContract = async () => {
    if (!contractTarget) return
    const targetId = contractTarget._id || contractTarget.id
    const nextStatus = contractTarget.contractStatus === 'Active' ? 'On Hold' : 'Active'

    try {
      await adminService.toggleHospitalContract(targetId, nextStatus)
      setHospitals((prev) =>
        prev.map((h) => ((h._id || h.id) === targetId ? { ...h, contractStatus: nextStatus } : h))
      )
      setStats((prev) => ({
        ...prev,
        active: nextStatus === 'Active' ? prev.active + 1 : prev.active - 1,
        onHold: nextStatus === 'On Hold' ? prev.onHold + 1 : prev.onHold - 1,
      }))

      toast[nextStatus === 'Active' ? 'success' : 'warning'](
        nextStatus === 'Active'
          ? `Contract with ${contractTarget.name} reactivated`
          : `Contract with ${contractTarget.name} put on hold`,
        {
          description:
            nextStatus === 'Active'
              ? 'Referrals and bed-partner bookings resume immediately.'
              : 'New bed-partner bookings are paused. Existing bookings continue.',
        }
      )
    } catch (err) {
      toast.error('Failed to update contract status', {
        description: err?.message || 'Server error occurred while updating status.',
      })
    } finally {
      setContractTarget(null)
    }
  }

  const handleDeleteHospital = async () => {
    if (!deleteTarget) return
    const targetId = deleteTarget._id || deleteTarget.id
    try {
      await adminService.deleteHospital(targetId)
      toast.success(`${deleteTarget.name} removed from partner hospitals`)
      setDeleteTarget(null)
      if (viewingId === targetId) setViewingId(null)
      fetchHospitals()
    } catch (err) {
      toast.error('Failed to delete hospital', {
        description: err?.message || 'Unable to delete hospital record.',
      })
    }
  }

  const columns = [
    {
      key: 'name',
      header: 'Hospital',
      render: (h) => (
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-mint-100 text-primary-700 shadow-xs">
            <Building2 className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink">{h.name}</p>
            <p className="truncate text-xs text-muted font-mono">{h.code || `HS-${String(h._id || h.id).slice(-4)}`}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'location',
      header: 'Location',
      render: (h) => (
        <div className="text-xs">
          <p className="font-semibold text-ink flex items-center gap-1">
            <MapPin className="h-3 w-3 text-muted" />
            {h.city}
          </p>
          <p className="text-muted pl-4">{h.district || 'Kerala'}</p>
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Contact & Phone',
      render: (h) => (
        <div className="text-xs min-w-0 max-w-[14rem]">
          <p className="truncate font-semibold text-ink">{h.contactPerson || 'Referral Desk'}</p>
          <p className="truncate text-muted font-mono">{h.phone}</p>
        </div>
      ),
    },
    {
      key: 'bedPartners',
      header: 'Partner Beds',
      align: 'right',
      render: (h) => <span className="tabular-nums font-semibold">{h.bedPartners}</span>,
    },
    {
      key: 'activeBookings',
      header: 'Active Referrals',
      align: 'right',
      render: (h) => <span className="tabular-nums font-semibold">{h.activeBookings || 0}</span>,
    },
    {
      key: 'icuSupport',
      header: 'ICU Support',
      sortable: false,
      render: (h) => (
        <Chip tone={h.icuSupport ? 'success' : 'neutral'}>
          {h.icuSupport ? 'ICU ready' : 'Ward only'}
        </Chip>
      ),
    },
    {
      key: 'contractStatus',
      header: 'Contract',
      render: (h) => <StatusBadge status={h.contractStatus} size="sm" />,
    },
    {
      key: 'createdAt',
      header: 'Joined',
      render: (h) => <span className="whitespace-nowrap text-xs text-muted">{formatDate(h.createdAt || h.joinedOn)}</span>,
    },
    {
      key: 'action',
      header: 'Action',
      align: 'right',
      sortable: false,
      render: (h) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            size="xs"
            variant="outline"
            icon={Eye}
            onClick={(e) => {
              e.stopPropagation()
              setViewingId(h._id || h.id)
            }}
          >
            View
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Partner Hospitals"
        subtitle="Institutional hospital tie-ups across Kerala routing post-operative patient referrals and bed-partner bystander care."
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" icon={RefreshCw} onClick={fetchHospitals} disabled={isLoading}>
              Refresh
            </Button>
            <Button icon={Plus} onClick={() => setAddOpen(true)}>
              Add hospital
            </Button>
          </div>
        }
      />

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          label="Partner hospitals"
          value={stats.total}
          icon={Building2}
          tone="primary"
          hint="Verified Kerala medical centers"
          delay={0}
        />
        <StatCard
          label="Active contracts"
          value={stats.active}
          icon={CheckCircle2}
          tone="success"
          hint="Routing care referrals"
          delay={0.05}
        />
        <StatCard
          label="On hold"
          value={stats.onHold}
          icon={Clock}
          tone="warning"
          hint="Temporarily paused"
          delay={0.1}
        />
        <StatCard
          label="Beds covered"
          value={stats.beds}
          icon={BedDouble}
          tone="accent"
          hint="Partner beds under Bystander care"
          delay={0.15}
        />
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search by hospital name, city, district, or phone…"
          className="lg:max-w-md lg:flex-1"
        />

        <Tabs
          tabs={CONTRACT_TABS.map((t) => ({
            id: t,
            label: t,
            count:
              t === 'All'
                ? stats.total
                : t === 'Active'
                ? stats.active
                : stats.onHold,
          }))}
          active={tab}
          onChange={setTab}
          size="sm"
        />

        <div className="lg:ml-auto lg:w-56">
          <Select
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            aria-label="Filter by district"
          >
            <option value="All">All districts</option>
            {activeDistricts.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
            {KERALA_DISTRICTS.filter((d) => !activeDistricts.includes(d)).map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* Data Table */}
      {error ? (
        <div className="rounded-2xl border border-danger-200 bg-danger-50/50 p-6 text-center">
          <p className="font-bold text-danger-700">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchHospitals} className="mt-3">
            Retry Loading
          </Button>
        </div>
      ) : hospitals.length === 0 ? (
        <div className="rounded-2xl border border-line bg-white p-8 shadow-xs">
          <EmptyState
            icon={SearchX}
            title={isLoading ? 'Loading hospitals…' : 'No partner hospitals found'}
            description={
              isLoading
                ? 'Retrieving verified partner hospital records from database…'
                : 'No partner hospitals match your search query or selected district filter.'
            }
            action={
              !isLoading && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearch('')
                    setTab('All')
                    setDistrict('All')
                  }}
                >
                  Clear filters
                </Button>
              )
            }
          />
        </div>
      ) : (
        <>
          <DataTable
            columns={columns}
            data={pageItems}
            keyExtractor={(row) => row._id || row.id}
            onRowClick={(row) => setViewingId(row._id || row.id)}
            emptyTitle="No partner hospitals found"
            emptyIcon={Building2}
          />
          <Pagination page={page} totalPages={totalPages} onPageChange={goto} totalItems={totalItems} />
        </>
      )}

      {/* Hospital Dossier Drawer / Modal */}
      <Modal
        open={Boolean(selected)}
        onClose={() => setViewingId(null)}
        title={selected?.name || 'Hospital Details'}
        subtitle={
          selected
            ? `${selected.city}, ${selected.district || 'Kerala'} · Partner since ${formatDate(selected.createdAt || selected.joinedOn, { long: true })}`
            : ''
        }
        size="lg"
        footer={
          selected ? (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between w-full">
              <Button
                variant="ghost"
                icon={Trash2}
                className="text-danger-600 hover:text-danger-700 hover:bg-danger-50"
                onClick={() => setDeleteTarget(selected)}
              >
                Delete Hospital
              </Button>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => setViewingId(null)}>
                  Close
                </Button>
                <Button
                  variant={selected.contractStatus === 'Active' ? 'dangerGhost' : 'secondary'}
                  onClick={() => setContractTarget(selected)}
                >
                  {selected.contractStatus === 'Active' ? 'Put Contract on Hold' : 'Reactivate Contract'}
                </Button>
              </div>
            </div>
          ) : null
        }
      >
        {selected ? (
          <div className="space-y-5">
            <div className="flex items-center gap-4 rounded-2xl border border-line bg-gradient-to-br from-slate-50 to-white p-4">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-mint-100 text-primary-700 shadow-xs">
                <Building2 className="h-7 w-7" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-display text-lg font-bold text-ink">{selected.name}</h3>
                  <StatusBadge status={selected.contractStatus} size="sm" />
                  <Chip tone={selected.icuSupport ? 'success' : 'neutral'}>
                    {selected.icuSupport ? 'ICU ready' : 'Ward only'}
                  </Chip>
                </div>
                <p className="mt-1 text-xs text-muted flex items-center gap-1.5 font-mono">
                  <span>{selected.code || `HS-${String(selected._id || selected.id).slice(-4)}`}</span>
                  <span>· {selected.city}, {selected.district}</span>
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: 'Bed partners', value: selected.bedPartners },
                { label: 'Active referrals', value: selected.activeBookings || 0 },
                { label: 'ICU support', value: selected.icuSupport ? 'Available' : 'Ward Only' },
                { label: 'Joined', value: formatDate(selected.createdAt || selected.joinedOn) },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl border border-line bg-gradient-to-br from-slate-50 to-white px-3 py-3 text-center"
                >
                  <p className="font-display text-base font-extrabold tabular-nums text-ink">{item.value}</p>
                  <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-muted">{item.label}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <CardHeader title="Contact & Address" icon={MapPin} />
                <CardBody className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted">Contact Person</span>
                    <span className="font-semibold text-ink">{selected.contactPerson || 'Referral Desk'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5" /> Phone
                    </span>
                    <span className="font-semibold text-ink font-mono">{selected.phone}</span>
                  </div>
                  {selected.email ? (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted flex items-center gap-1">
                        <Mail className="h-3.5 w-3.5" /> Email
                      </span>
                      <span className="font-semibold text-ink">{selected.email}</span>
                    </div>
                  ) : null}
                  <div className="flex items-start justify-between gap-2 pt-1">
                    <span className="text-xs text-muted">Street Address</span>
                    <span className="font-semibold text-ink text-right max-w-[65%]">
                      {selected.address || `${selected.city}, ${selected.district}`}
                    </span>
                  </div>
                </CardBody>
              </Card>

              <Card>
                <CardHeader title="Contract Protocol" icon={CheckCircle2} />
                <CardBody className="space-y-3 text-sm">
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-xs text-muted">Referral Flow</span>
                    <span className="max-w-[65%] text-right font-semibold text-ink">
                      Discharged patients route directly to Bystander verified care takers.
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted">Bed Coverage</span>
                    <span className="font-semibold tabular-nums text-ink">{selected.bedPartners} beds</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted">Contract Status</span>
                    <StatusBadge status={selected.contractStatus} size="sm" />
                  </div>
                </CardBody>
              </Card>
            </div>

            {selected.notes ? (
              <div className="rounded-xl border border-line bg-slate-50 p-3.5 text-xs text-muted">
                <span className="font-bold text-ink block mb-0.5">Administrative Notes:</span>
                {selected.notes}
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>

      {/* Add Partner Hospital Modal */}
      <Modal
        open={addOpen}
        onClose={closeAdd}
        title="Add a Partner Hospital"
        subtitle="Register the healthcare facility and its allocated bed-partner referral capacity in Kerala."
        size="md"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={closeAdd}>
              Cancel
            </Button>
            <Button type="submit" form="add-hospital-form" disabled={isSubmitting}>
              {isSubmitting ? 'Registering…' : 'Add Hospital'}
            </Button>
          </div>
        }
      >
        <form id="add-hospital-form" onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <FormField label="Hospital Name" htmlFor="hp-name" required error={errors.name?.message}>
            <Input
              id="hp-name"
              placeholder="e.g. Baby Memorial Hospital"
              error={errors.name?.message}
              {...register('name', {
                required: 'Hospital name is required',
                minLength: { value: 3, message: 'Enter the full hospital name' },
              })}
            />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="District" htmlFor="hp-district" required error={errors.district?.message}>
              <Select id="hp-district" {...register('district', { required: 'Choose a district' })}>
                {KERALA_DISTRICTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="City / Locality" htmlFor="hp-city" required error={errors.city?.message}>
              <Input
                id="hp-city"
                placeholder="e.g. Arayidathupalam"
                error={errors.city?.message}
                {...register('city', { required: 'City / Locality is required' })}
              />
            </FormField>
          </div>

          <FormField label="Full Street Address" htmlFor="hp-address">
            <Input
              id="hp-address"
              placeholder="e.g. Indira Gandhi Road, Kozhikode, Kerala 673004"
              {...register('address')}
            />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Contact Person" htmlFor="hp-contact">
              <Input
                id="hp-contact"
                placeholder="e.g. Dr. K. Narayanan (Referral Desk)"
                {...register('contactPerson')}
              />
            </FormField>

            <FormField label="Contact Phone" htmlFor="hp-phone" required error={errors.phone?.message}>
              <Input
                id="hp-phone"
                type="tel"
                placeholder="+91 495 277 7777"
                error={errors.phone?.message}
                {...register('phone', {
                  required: 'Add a valid contact number',
                  minLength: { value: 7, message: 'Enter a valid phone number' },
                })}
              />
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Email (Optional)" htmlFor="hp-email">
              <Input
                id="hp-email"
                type="email"
                placeholder="referrals@hospital.org"
                {...register('email')}
              />
            </FormField>

            <FormField label="Partner Beds" htmlFor="hp-beds" required error={errors.bedPartners?.message}>
              <Input
                id="hp-beds"
                type="number"
                min="0"
                placeholder="e.g. 25"
                error={errors.bedPartners?.message}
                {...register('bedPartners', {
                  required: 'Enter the number of partner beds',
                  min: { value: 0, message: 'Cannot be negative' },
                })}
              />
            </FormField>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line px-4 py-3 transition hover:border-primary-200">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-line-strong accent-[#0F766E]"
              {...register('icuSupport')}
            />
            <span>
              <span className="block text-sm font-semibold text-ink">ICU & Critical Care Support Available</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-muted">
                Tick this if the facility provides ICU bed-partners and accepts high-dependency post-surgical cases.
              </span>
            </span>
          </label>
        </form>
      </Modal>

      {/* Confirmation Dialog for Toggling Contract */}
      <ConfirmationDialog
        open={Boolean(contractTarget)}
        onClose={() => setContractTarget(null)}
        onConfirm={toggleContract}
        tone={contractTarget?.contractStatus === 'Active' ? 'danger' : 'success'}
        title={contractTarget?.contractStatus === 'Active' ? 'Suspend this contract?' : 'Reactivate this contract?'}
        message={
          contractTarget?.contractStatus === 'Active'
            ? `${contractTarget?.name} will stop routing new bed-partner referrals until you reactivate.`
            : `${contractTarget?.name} will immediately resume bed-partner referrals and patient care taking.`
        }
        confirmLabel={contractTarget?.contractStatus === 'Active' ? 'Suspend Contract' : 'Reactivate Contract'}
      />

      {/* Confirmation Dialog for Deleting Hospital */}
      <ConfirmationDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteHospital}
        tone="danger"
        title={`Delete ${deleteTarget?.name}?`}
        message="This will permanently remove this hospital from your partner directory. This action cannot be undone."
        confirmLabel="Delete Hospital"
      />
    </div>
  )
}

export default HospitalsPage
