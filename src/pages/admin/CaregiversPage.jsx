import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  BadgeCheck,
  Download,
  ExternalLink,
  Eye,
  Languages,
  SearchX,
  ShieldAlert,
  ShieldCheck,
  Star,
  Stethoscope,
  Users,
} from 'lucide-react'
import { useData } from '@/context/DataContext'
import { useDebouncedValue, useDocumentTitle } from '@/hooks/useUi'
import { usePagination } from '@/hooks/usePagination'
import { DOCUMENT_TYPES } from '@/data/verifications'
import { downloadText, formatCurrency, formatDate, toCSV } from '@/utils/format'
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
import { Avatar } from '@/components/common/Avatar'
import { RatingStars } from '@/components/common/RatingStars'
import { Card, CardBody, CardHeader } from '@/components/common/Card'
import { EmptyState } from '@/components/common/States'
import { Select } from '@/components/forms/FormField'

const STATUS_TABS = ['All', 'Verified', 'Pending', 'Rejected']
const PENDING_STATUSES = ['Pending', 'Under Review']
const SORTS = [
  { id: 'rating', label: 'Rating — high to low' },
  { id: 'experience', label: 'Experience — high to low' },
  { id: 'rate', label: 'Hourly rate — high to low' },
]

export function CaregiversPage() {
  useDocumentTitle('Caregivers')

  const navigate = useNavigate()
  const { caregivers, bookings, verifications, setVerificationStatus } = useData()

  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('All')
  const [city, setCity] = useState('All')
  const [qualification, setQualification] = useState('All')
  const [sort, setSort] = useState('rating')
  const [viewingId, setViewingId] = useState(null)
  const [approveTarget, setApproveTarget] = useState(null)
  const [suspendTarget, setSuspendTarget] = useState(null)
  const [suspended, setSuspended] = useState([])

  const debouncedSearch = useDebouncedValue(search)

  const cities = useMemo(() => [...new Set(caregivers.map((c) => c.city))].sort(), [caregivers])
  const qualifications = useMemo(() => [...new Set(caregivers.map((c) => c.qualification))].sort(), [caregivers])

  const list = useMemo(
    () => caregivers.map((c) => ({ ...c, isSuspended: suspended.includes(c.id) })),
    [caregivers, suspended],
  )

  const stats = useMemo(() => {
    const verified = caregivers.filter((c) => c.verificationStatus === 'Verified').length
    const pending = caregivers.filter((c) => PENDING_STATUSES.includes(c.verificationStatus)).length
    const avg = caregivers.length
      ? (caregivers.reduce((sum, c) => sum + (c.rating || 0), 0) / caregivers.length).toFixed(1)
      : '0.0'
    return { total: caregivers.length, verified, pending, avg }
  }, [caregivers])

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    const rows = list.filter((c) => {
      const matchesTab =
        tab === 'All' ||
        (tab === 'Verified' && c.verificationStatus === 'Verified') ||
        (tab === 'Pending' && PENDING_STATUSES.includes(c.verificationStatus)) ||
        (tab === 'Rejected' && c.verificationStatus === 'Rejected')
      const matchesCity = city === 'All' || c.city === city
      const matchesQual = qualification === 'All' || c.qualification === qualification
      const matchesSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.regNo.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q) ||
        c.services.join(' ').toLowerCase().includes(q)
      return matchesTab && matchesCity && matchesQual && matchesSearch
    })
    return [...rows].sort((a, b) => {
      if (sort === 'experience') return (b.experienceYears || 0) - (a.experienceYears || 0)
      if (sort === 'rate') return (b.hourlyRate || 0) - (a.hourlyRate || 0)
      return (b.rating || 0) - (a.rating || 0)
    })
  }, [list, debouncedSearch, tab, city, qualification, sort])

  const { page, totalPages, totalItems, pageItems, goto } = usePagination(filtered, 8)

  useEffect(() => {
    goto(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, tab, city, qualification, sort])

  const selected = viewingId ? list.find((c) => c.id === viewingId) : null

  const selectedRecord = selected ? verifications.find((v) => v.caregiverId === selected.id) : null

  const selectedBookings = useMemo(
    () =>
      selected
        ? bookings.filter((b) => b.caregiverId === selected.id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4)
        : [],
    [bookings, selected],
  )

  const handleExport = () => {
    const rows = filtered.map((c) => ({
      id: c.id,
      name: c.name,
      qualification: c.qualification,
      regNo: c.regNo,
      experienceYears: c.experienceYears,
      city: c.city,
      rating: c.rating,
      completedJobs: c.completedJobs,
      hourlyRate: c.hourlyRate,
      verificationStatus: c.verificationStatus,
      status: c.isSuspended ? 'Suspended' : 'Active',
    }))
    downloadText(`caremate-caregivers-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(rows))
    toast.success(`Exported ${rows.length} caregiver${rows.length === 1 ? '' : 's'} to CSV`)
  }

  const requestApprove = (caregiver) => {
    const record = verifications.find((v) => v.caregiverId === caregiver.id)
    if (!record) {
      toast.info(`No verification application on file for ${caregiver.name}`, {
        description: 'Ask them to upload documents from their caregiver profile.',
      })
      return
    }
    if (record.status === 'Verified') {
      toast.info(`${caregiver.name} is already verified`)
      return
    }
    setApproveTarget(caregiver)
  }

  const confirmApprove = () => {
    if (!approveTarget) return
    const record = verifications.find((v) => v.caregiverId === approveTarget.id)
    if (record) {
      setVerificationStatus(record.id, 'Verified', 'Application approved — profile marked Verified')
    }
    toast.success(`${approveTarget.name} approved`, {
      description: 'Profile marked Verified and live on the marketplace.',
    })
    setApproveTarget(null)
  }

  const confirmSuspend = () => {
    if (!suspendTarget) return
    const isSuspended = suspended.includes(suspendTarget.id)
    setSuspended((prev) => (isSuspended ? prev.filter((id) => id !== suspendTarget.id) : [...prev, suspendTarget.id]))
    toast[isSuspended ? 'success' : 'error'](
      isSuspended ? `${suspendTarget.name} reinstated` : `${suspendTarget.name} suspended`,
      { description: isSuspended ? 'Bookings and payouts resume as before.' : 'Profile hidden from customers and new jobs paused.' },
    )
    setSuspendTarget(null)
  }

  const columns = [
    {
      key: 'name',
      header: 'Caregiver',
      render: (c) => (
        <div className="flex items-center gap-3">
          <Avatar src={c.photo} name={c.name} size="sm" verified={c.verified} />
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink">{c.name}</p>
            <p className="truncate text-xs text-faint">{c.regNo}</p>
            {c.isSuspended ? (
              <span className="mt-0.5 inline-block rounded-full bg-danger-50 px-1.5 py-0.5 text-[10px] font-bold text-danger-600">
                Suspended
              </span>
            ) : null}
          </div>
        </div>
      ),
    },
    { key: 'qualification', header: 'Qualification' },
    {
      key: 'experienceYears',
      header: 'Experience',
      render: (c) => <span className="tabular-nums">{c.experienceYears} yrs</span>,
    },
    {
      key: 'services',
      header: 'Services',
      align: 'center',
      render: (c) => <span className="tabular-nums">{c.services.length}</span>,
    },
    { key: 'city', header: 'City' },
    {
      key: 'rating',
      header: 'Rating',
      render: (c) => <RatingStars value={c.rating} size={13} showValue />,
    },
    {
      key: 'completedJobs',
      header: 'Jobs done',
      align: 'right',
      render: (c) => <span className="tabular-nums">{c.completedJobs}</span>,
    },
    {
      key: 'verificationStatus',
      header: 'Verification',
      render: (c) => <StatusBadge status={c.verificationStatus} size="sm" />,
    },
    {
      key: 'action',
      header: 'Action',
      align: 'right',
      sortable: false,
      render: (c) => (
        <Button
          size="xs"
          variant="outline"
          icon={Eye}
          onClick={(e) => {
            e.stopPropagation()
            setViewingId(c.id)
          }}
        >
          View
        </Button>
      ),
    },
  ]

  const docRows = selected
    ? DOCUMENT_TYPES.map((type) => selectedRecord?.documents.find((d) => d.type === type) || { id: type, type, file: 'Not uploaded', status: 'Not Uploaded' })
    : []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Caregivers"
        subtitle="The care supply side — qualifications, verification standing and performance at a glance."
        action={
          <>
            <Button variant="outline" icon={Download} onClick={handleExport}>
              Export CSV
            </Button>
            <Button to="/admin/verifications" icon={ShieldCheck}>
              Verification queue
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Total caregivers" value={stats.total} icon={Users} tone="primary" hint="On the platform" delay={0} />
        <StatCard label="Verified" value={stats.verified} icon={ShieldCheck} tone="success" trend={7} hint="Approved to accept jobs" delay={0.05} />
        <StatCard label="Pending" value={stats.pending} icon={ShieldAlert} tone="warning" hint="Documents under review" delay={0.1} />
        <StatCard label="Average rating" value={stats.avg} icon={Star} tone="accent" trend={3} hint="Across all reviews" delay={0.15} />
      </div>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search name, reg no, city or service…"
          className="xl:max-w-sm xl:flex-1"
        />
        <Tabs
          tabs={STATUS_TABS.map((t) => ({
            id: t,
            label: t,
            count: t === 'All' ? caregivers.length : caregivers.filter((c) => (t === 'Pending' ? PENDING_STATUSES.includes(c.verificationStatus) : c.verificationStatus === t)).length,
          }))}
          active={tab}
          onChange={setTab}
          size="sm"
        />
        <div className="flex flex-col gap-3 sm:flex-row xl:ml-auto">
          <Select value={city} onChange={(e) => setCity(e.target.value)} aria-label="Filter by city">
            <option value="All">All cities</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          <Select value={qualification} onChange={(e) => setQualification(e.target.value)} aria-label="Filter by qualification">
            <option value="All">All qualifications</option>
            {qualifications.map((q) => (
              <option key={q} value={q}>
                {q}
              </option>
            ))}
          </Select>
          <Select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort caregivers">
            {SORTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-card border border-line bg-white shadow-card">
          <EmptyState
            icon={SearchX}
            title="No caregivers found"
            description="Adjust the verification tab, city, qualification or search term."
            action={
              <Button
                variant="outline"
                onClick={() => {
                  setSearch('')
                  setTab('All')
                  setCity('All')
                  setQualification('All')
                }}
              >
                Clear filters
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <DataTable
            columns={columns}
            data={pageItems}
            keyExtractor={(row) => row.id}
            onRowClick={(row) => setViewingId(row.id)}
            initialSort={{ key: 'rating', dir: 'desc' }}
            emptyTitle="No caregivers found"
            emptyIcon={Stethoscope}
          />
          <Pagination page={page} totalPages={totalPages} onPageChange={goto} totalItems={totalItems} />
        </>
      )}

      <Modal
        open={Boolean(selected)}
        onClose={() => setViewingId(null)}
        title={selected?.name || 'Caregiver'}
        subtitle={selected ? `${selected.qualification} · ${selected.regNo}` : ''}
        size="xl"
        footer={
          selected ? (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Button
                variant="outline"
                icon={ExternalLink}
                onClick={() => {
                  const id = selected.id
                  setViewingId(null)
                  navigate(`/caregivers/${id}`)
                }}
              >
                View public profile
              </Button>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  variant="dangerGhost"
                  onClick={() => setSuspendTarget(selected)}
                >
                  {selected.isSuspended ? 'Lift suspension' : 'Suspend'}
                </Button>
                <Button icon={BadgeCheck} onClick={() => requestApprove(selected)}>
                  Approve
                </Button>
              </div>
            </div>
          ) : null
        }
      >
        {selected ? (
          <div className="space-y-5">
            <div className="flex flex-col gap-4 sm:flex-row">
              <Avatar src={selected.photo} name={selected.name} size="xl" verified={selected.verified} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={selected.verificationStatus} size="sm" />
                  {selected.isSuspended ? <StatusBadge status="Inactive" size="sm" /> : null}
                  <span className="text-xs text-muted">Joined {formatDate(selected.joinedOn)}</span>
                </div>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {selected.badges.map((badge) => (
                    <Chip key={badge}>{badge}</Chip>
                  ))}
                </div>
                <p className="mt-3 text-sm leading-relaxed text-muted">{selected.bio}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: 'Trust score', value: `${selected.trustScore}/100` },
                { label: 'Response rate', value: `${selected.responseRate}%` },
                { label: 'Jobs completed', value: selected.completedJobs },
                { label: 'Hourly rate', value: formatCurrency(selected.hourlyRate) },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-line px-3.5 py-3 text-center">
                  <p className="font-display text-lg font-extrabold tabular-nums text-ink">{item.value}</p>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-faint">{item.label}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <CardHeader title="Services & languages" />
                <CardBody className="space-y-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-faint">Services offered</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selected.services.map((s) => (
                        <Chip key={s}>{s}</Chip>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-faint">Languages</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selected.languages.map((l) => (
                        <Chip key={l}>
                          <Languages className="h-3.5 w-3.5" /> {l}
                        </Chip>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted">Experience</span>
                    <span className="font-semibold text-ink">{selected.experienceYears} years</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted">Rating</span>
                    <RatingStars value={selected.rating} count={selected.reviewCount} showValue size={13} />
                  </div>
                </CardBody>
              </Card>

              <Card>
                <CardHeader
                  title="Verification documents"
                  subtitle="Submitted files — private contents stay hidden"
                  icon={ShieldCheck}
                />
                <CardBody className="divide-y divide-line p-0">
                  {docRows.map((doc) => (
                    <div key={doc.id} className="flex items-center gap-3 px-5 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink">{doc.type}</p>
                        <p className="truncate text-xs text-faint">{doc.file}</p>
                      </div>
                      <StatusBadge status={doc.status} size="sm" />
                    </div>
                  ))}
                </CardBody>
              </Card>
            </div>

            <Card>
              <CardHeader
                title="Recent bookings"
                subtitle="Latest shifts assigned to this caregiver"
                action={
                  <Button variant="link" size="sm" onClick={() => navigate('/admin/bookings')}>
                    View all
                  </Button>
                }
              />
              <CardBody className="divide-y divide-line p-0">
                {selectedBookings.length ? (
                  selectedBookings.map((b) => (
                    <div key={b.id} className="flex items-center gap-3 px-5 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-ink">
                          {b.id} · {b.service}
                        </p>
                        <p className="text-xs text-muted">
                          {formatDate(b.date)} · {b.startTime} · {b.hours} hrs
                        </p>
                      </div>
                      <span className="hidden text-sm font-semibold tabular-nums text-ink sm:block">
                        {formatCurrency(b.total)}
                      </span>
                      <StatusBadge status={b.status} size="sm" />
                    </div>
                  ))
                ) : (
                  <EmptyState
                    icon={Eye}
                    title="No bookings yet"
                    description="This caregiver has not been assigned a shift."
                    className="py-8"
                  />
                )}
              </CardBody>
            </Card>
          </div>
        ) : null}
      </Modal>

      <ConfirmationDialog
        open={Boolean(approveTarget)}
        onClose={() => setApproveTarget(null)}
        onConfirm={confirmApprove}
        tone="success"
        title="Approve this caregiver?"
        message={`${approveTarget?.name} will be marked Verified, appear in customer search results and can accept paid bookings immediately.`}
        confirmLabel="Approve application"
      />

      <ConfirmationDialog
        open={Boolean(suspendTarget)}
        onClose={() => setSuspendTarget(null)}
        onConfirm={confirmSuspend}
        tone={suspendTarget?.isSuspended ? 'success' : 'danger'}
        title={suspendTarget?.isSuspended ? 'Lift this suspension?' : 'Suspend this caregiver?'}
        message={
          suspendTarget?.isSuspended
            ? `${suspendTarget?.name} returns to customer search and can accept new jobs right away.`
            : `${suspendTarget?.name} will be hidden from customer search and cannot accept new jobs. Completed bookings and payouts are unaffected.`
        }
        confirmLabel={suspendTarget?.isSuspended ? 'Lift suspension' : 'Suspend caregiver'}
      />
    </div>
  )
}

export default CaregiversPage
