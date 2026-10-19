import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { downloadText, formatCurrency, formatDate, toCSV } from '@/utils/format'
import { formatDuration } from '@/utils/duration'
import { adminService } from '@/services/adminService'
import { PageHeader } from '@/components/common/PageHeader'
import { StatCard } from '@/components/common/StatCard'
import { SearchBar } from '@/components/common/SearchBar'
import { Tabs } from '@/components/common/Tabs'
import { DataTable } from '@/components/common/DataTable'
import { Pagination } from '@/components/common/Pagination'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Modal } from '@/components/common/Modal'
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog'
import { Button } from '@/components/common/Button'
import { Avatar } from '@/components/common/Avatar'
import { RatingStars } from '@/components/common/RatingStars'
import { Card, CardBody, CardHeader } from '@/components/common/Card'
import { EmptyState, ErrorState, TableSkeleton } from '@/components/common/States'
import { FormField, Select, Textarea } from '@/components/forms/FormField'

const STATUS_TABS = ['All', 'Verified', 'Pending', 'Rejected']
const PENDING_STATUSES = ['Pending', 'Under Review']
const DEFAULT_CITIES = ['All', 'Mumbai, MH', 'New Delhi, DL', 'Bengaluru, KA', 'Chennai, TN', 'Kolkata, WB', 'Hyderabad, TS', 'Pune, MH']
const DEFAULT_QUALIFICATIONS = ['All', 'GNM', 'BSc Nursing', 'nursing_student', 'ANM', 'MBBS', 'Certified Elder Care Giver', 'Paramedic', 'other']

const SORTS = [
  { id: 'rating', label: 'Rating — high to low' },
  { id: 'experience', label: 'Experience — high to low' },
  { id: 'rate', label: 'Hourly rate — high to low' },
  { id: 'newest', label: 'Recently joined' },
]

export function CaregiversPage() {
  useDocumentTitle('Caretakers')

  const navigate = useNavigate()
  const { bookings, verifications } = useData()

  const [caregivers, setCaregivers] = useState([])
  const [stats, setStats] = useState({ total: 0, verified: 0, pending: 0, avg: '5.0' })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('All')
  const [city, setCity] = useState('All')
  const [qualification, setQualification] = useState('All')
  const [sort, setSort] = useState('rating')
  const [viewingId, setViewingId] = useState(null)

  // Status mutation state
  const [suspendTarget, setSuspendTarget] = useState(null)
  const [suspendReason, setSuspendReason] = useState('')
  const [reasonError, setReasonError] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)

  // Quick verification target
  const [approveTarget, setApproveTarget] = useState(null)

  const debouncedSearch = useDebouncedValue(search)

  const fetchCaregivers = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      let verificationFilter = undefined
      if (tab === 'Verified') verificationFilter = 'verified'
      else if (tab === 'Pending') verificationFilter = 'pending'
      else if (tab === 'Rejected') verificationFilter = 'rejected'

      const query = {
        search: debouncedSearch.trim() || undefined,
        verificationStatus: verificationFilter,
        city: city === 'All' ? undefined : city,
        qualification: qualification === 'All' ? undefined : qualification,
        sort,
      }

      const result = await adminService.getCaregivers(query)
      setCaregivers(result.caregivers || [])

      const total = result.stats?.total ?? result.caregivers.length
      const verified = result.stats?.verified ?? result.caregivers.filter((c) => c.verificationStatus === 'Verified').length
      const pending = result.stats?.pending ?? result.caregivers.filter((c) => PENDING_STATUSES.includes(c.verificationStatus)).length
      const avg = result.caregivers.length
        ? (result.caregivers.reduce((sum, c) => sum + (c.rating || 0), 0) / result.caregivers.length).toFixed(1)
        : '5.0'

      setStats({ total, verified, pending, avg })
    } catch (err) {
      setError(err.message || 'Failed to retrieve caretakers from server.')
    } finally {
      setIsLoading(false)
    }
  }, [debouncedSearch, tab, city, qualification, sort])

  useEffect(() => {
    fetchCaregivers()
  }, [fetchCaregivers])

  const cities = useMemo(() => {
    const fromData = caregivers.map((c) => c.city).filter((c) => c && c !== '—')
    return [...new Set([...DEFAULT_CITIES.slice(1), ...fromData])].sort()
  }, [caregivers])

  const qualifications = useMemo(() => {
    const fromData = caregivers.map((c) => c.qualification).filter(Boolean)
    return [...new Set([...DEFAULT_QUALIFICATIONS.slice(1), ...fromData])].sort()
  }, [caregivers])

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    return caregivers.filter((c) => {
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
        (c.regNo && c.regNo.toLowerCase().includes(q)) ||
        (c.city && c.city.toLowerCase().includes(q)) ||
        c.services.join(' ').toLowerCase().includes(q)
      return matchesTab && matchesCity && matchesQual && matchesSearch
    })
  }, [caregivers, debouncedSearch, tab, city, qualification])

  const { page, totalPages, totalItems, pageItems, goto } = usePagination(filtered, 8)

  useEffect(() => {
    goto(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, tab, city, qualification, sort])

  const selected = viewingId ? caregivers.find((c) => c.id === viewingId) : null

  const selectedRecord = selected ? verifications.find((v) => v.caregiverId === selected.id) : null

  const selectedBookings = useMemo(
    () =>
      selected
        ? bookings.filter((b) => b.caregiverId === selected.id).sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 4)
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
    toast.success(`Exported ${rows.length} caretaker${rows.length === 1 ? '' : 's'} to CSV`)
  }

  const handleOpenSuspend = (caregiver) => {
    setSuspendTarget(caregiver)
    setSuspendReason('')
    setReasonError('')
  }

  const confirmSuspend = async () => {
    if (!suspendTarget) return
    const trimmedReason = suspendReason.trim()
    if (trimmedReason.length < 3) {
      setReasonError('An auditable reason of at least 3 characters is mandatory.')
      return
    }

    setIsUpdating(true)
    const isCurrentlySuspended = suspendTarget.isSuspended
    const nextStatus = isCurrentlySuspended ? 'active' : 'suspended'
    const targetUserId = suspendTarget.userId || suspendTarget.id

    try {
      await adminService.updateUserStatus(targetUserId, {
        status: nextStatus,
        reason: trimmedReason,
      })

      // Update local state with server-confirmed status
      setCaregivers((prev) =>
        prev.map((c) =>
          c.id === suspendTarget.id
            ? {
                ...c,
                isSuspended: nextStatus === 'suspended',
                status: nextStatus === 'suspended' ? 'Suspended' : 'Active',
                accountStatus: nextStatus,
                statusReason: trimmedReason,
                statusUpdatedAt: new Date().toISOString(),
              }
            : c,
        ),
      )

      toast.success(
        isCurrentlySuspended
          ? `${suspendTarget.name} reinstated`
          : `${suspendTarget.name} suspended`,
        {
          description: isCurrentlySuspended
            ? 'Bookings and active availability resume as before.'
            : 'Profile hidden from customers and new bookings paused.',
        },
      )
      setSuspendTarget(null)
      setSuspendReason('')
    } catch (err) {
      toast.error(err.message || 'Failed to update caretaker account status', {
        description: 'Server rejected the status transition.',
      })
    } finally {
      setIsUpdating(false)
    }
  }

  const requestApprove = (caregiver) => {
    if (caregiver.verificationStatus === 'Verified') {
      toast.info(`${caregiver.name} is already verified`)
      return
    }
    setApproveTarget(caregiver)
  }

  const confirmApprove = async () => {
    if (!approveTarget) return
    try {
      await adminService.updateCaregiverVerificationStatus(approveTarget.id, {
        status: 'verified',
        reason: 'Application approved via admin caretakers directory review',
        trustScore: 85,
      })

      setCaregivers((prev) =>
        prev.map((c) =>
          c.id === approveTarget.id
            ? { ...c, verificationStatus: 'Verified', verified: true, trustScore: 85 }
            : c,
        ),
      )

      toast.success(`${approveTarget.name} approved`, {
        description: 'Profile marked Verified and live on the marketplace.',
      })
      setApproveTarget(null)
    } catch (err) {
      toast.error(err.message || 'Failed to approve caretaker verification', {
        description: 'Please review documents directly under Verifications.',
      })
    }
  }

  const columns = [
    {
      key: 'name',
      header: 'Caretaker',
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
      render: (c) => <span className="tabular-nums">{c.services?.length || 0}</span>,
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
        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          <Button size="xs" variant="outline" icon={Eye} onClick={() => setViewingId(c.id)}>
            View
          </Button>
          {c.verificationStatus !== 'Verified' ? (
            <Button size="xs" variant="primary" icon={BadgeCheck} onClick={() => requestApprove(c)}>
              Approve
            </Button>
          ) : (
            <Button
              size="xs"
              variant={c.isSuspended ? 'outline' : 'dangerGhost'}
              onClick={() => handleOpenSuspend(c)}
            >
              {c.isSuspended ? 'Reinstate' : 'Suspend'}
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Caretakers"
        subtitle="Manage registered nurses, bedside attendants and verification statuses."
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" icon={Download} onClick={handleExport}>
              Export CSV
            </Button>
            <Button to="/admin/verifications" variant="primary" icon={ShieldCheck}>
              Verification queue
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Total caretakers" value={stats.total} icon={Users} tone="primary" hint="Onboarded records" delay={0} />
        <StatCard label="Verified" value={stats.verified} icon={ShieldCheck} tone="success" trend={12} hint="Live on directory" delay={0.05} />
        <StatCard label="Pending review" value={stats.pending} icon={ShieldAlert} tone="warning" hint="Awaiting review" delay={0.1} />
        <StatCard label="Average rating" value={`${stats.avg} / 5`} icon={Star} tone="accent" hint="Across rated shifts" delay={0.15} />
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search by name, reg number, city or service…"
          className="lg:max-w-md lg:flex-1"
        />
        <Tabs
          tabs={STATUS_TABS.map((t) => ({
            id: t,
            label: t,
            count:
              t === 'All'
                ? caregivers.length
                : t === 'Verified'
                  ? caregivers.filter((c) => c.verificationStatus === 'Verified').length
                  : t === 'Pending'
                    ? caregivers.filter((c) => PENDING_STATUSES.includes(c.verificationStatus)).length
                    : caregivers.filter((c) => c.verificationStatus === 'Rejected').length,
          }))}
          active={tab}
          onChange={setTab}
          size="sm"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="w-44">
          <Select value={city} onChange={(e) => setCity(e.target.value)} aria-label="Filter by city">
            <option value="All">All cities</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>

        <div className="w-52">
          <Select
            value={qualification}
            onChange={(e) => setQualification(e.target.value)}
            aria-label="Filter by qualification"
          >
            <option value="All">All qualifications</option>
            {qualifications.map((q) => (
              <option key={q} value={q}>
                {q}
              </option>
            ))}
          </Select>
        </div>

        <div className="ml-auto w-56">
          <Select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort caretakers">
            {SORTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-card border border-line bg-white p-6 shadow-card">
          <TableSkeleton rows={6} cols={6} />
        </div>
      ) : error ? (
        <div className="rounded-card border border-line bg-white shadow-card">
          <ErrorState
            title="Unable to load caretakers"
            description={error}
            onRetry={fetchCaregivers}
          />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-card border border-line bg-white shadow-card">
          <EmptyState
            icon={SearchX}
            title="No caretakers match your filters"
            description="Try clearing the search query or adjusting your city and qualification filters."
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
                Reset filters
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
            emptyTitle="No caretakers found"
            emptyIcon={Users}
          />
          <Pagination page={page} totalPages={totalPages} onPageChange={goto} totalItems={totalItems} />
        </>
      )}

      {/* Caretaker Dossier Drawer */}
      <Modal
        open={Boolean(selected)}
        onClose={() => setViewingId(null)}
        title={selected?.name || 'Caretaker details'}
        subtitle={selected ? `${selected.qualification} · ${selected.city}` : ''}
        size="xl"
        footer={
          selected ? (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Button
                variant={selected.isSuspended ? 'outline' : 'dangerGhost'}
                onClick={() => handleOpenSuspend(selected)}
              >
                {selected.isSuspended ? 'Reinstate account' : 'Suspend account'}
              </Button>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  variant="outline"
                  icon={ExternalLink}
                  onClick={() => navigate(`/caregivers/${selected.id}`)}
                >
                  Public profile
                </Button>
                {selected.verificationStatus !== 'Verified' ? (
                  <Button
                    variant="primary"
                    icon={BadgeCheck}
                    onClick={() => {
                      setViewingId(null)
                      navigate('/admin/verifications')
                    }}
                  >
                    Open in Verifications
                  </Button>
                ) : null}
                <Button onClick={() => setViewingId(null)}>Done</Button>
              </div>
            </div>
          ) : null
        }
      >
        {selected ? (
          <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <Avatar src={selected.photo} name={selected.name} size="xl" verified={selected.verified} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-display text-lg font-bold text-ink">{selected.name}</h3>
                  <StatusBadge status={selected.verificationStatus} size="sm" />
                  {selected.isSuspended ? (
                    <span className="rounded-full bg-danger-50 px-2 py-0.5 text-xs font-bold text-danger-600">
                      Suspended
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-muted">
                  Council Reg: <span className="font-mono font-medium text-ink">{selected.regNo}</span> · {selected.city}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                  <RatingStars value={selected.rating} size={14} showValue />
                  <span className="text-muted">·</span>
                  <span className="font-semibold tabular-nums text-ink">{selected.completedJobs} shifts done</span>
                  <span className="text-muted">·</span>
                  <span className="font-semibold tabular-nums text-primary-700">
                    {formatCurrency(selected.hourlyRate)}/hr
                  </span>
                </div>
                {selected.statusReason ? (
                  <p className="mt-2 text-xs italic text-amber-700">
                    Account Status Note: "{selected.statusReason}" {selected.statusUpdatedAt ? `(${formatDate(selected.statusUpdatedAt)})` : ''}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <CardHeader title="Professional details" subtitle="Clinical registration" />
                <CardBody className="space-y-3 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-muted">Qualification</span>
                    <span className="font-semibold text-ink">{selected.qualification}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted">Experience</span>
                    <span className="font-semibold tabular-nums text-ink">{selected.experienceYears} years</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted">Care settings</span>
                    <span className="text-right font-semibold text-ink">
                      {selected.careSettings?.join(', ') || 'Home Care'}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted">Availability</span>
                    <span className="font-semibold text-ink">{selected.availabilityStatus}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted">Trust score</span>
                    <span className="font-semibold tabular-nums text-primary-700">{selected.trustScore} / 100</span>
                  </div>
                </CardBody>
              </Card>

              <Card>
                <CardHeader title="Services offered" subtitle={`${selected.services?.length || 0} care competencies`} />
                <CardBody className="space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {selected.services && selected.services.length ? (
                      selected.services.map((svc) => (
                        <span
                          key={svc}
                          className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
                        >
                          {svc}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-muted">No services listed</span>
                    )}
                  </div>
                </CardBody>
              </Card>
            </div>

            <Card>
              <CardHeader
                title="Recent bookings"
                subtitle="Latest shifts assigned to this caretaker"
                action={
                  <Button variant="link" size="sm" onClick={() => navigate('/admin/bookings')}>
                    View all
                  </Button>
                }
              />
              <CardBody className="divide-y divide-line p-0">
                {selectedBookings.length ? (
                  selectedBookings.map((b) => (
                    <div key={b.id} className="flex items-center gap-3 px-5 py-3 transition hover:bg-mint-50/60">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-ink">
                          {b.id} · {b.service}
                        </p>
                        <p className="text-xs text-muted">
                          {formatDate(b.date)} · {b.startTime} · {formatDuration(b.hours, { short: true })}
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
                    description="This caretaker has not been assigned a shift."
                    className="py-8"
                  />
                )}
              </CardBody>
            </Card>
          </div>
        ) : null}
      </Modal>

      {/* Quick Approve Dialog */}
      <ConfirmationDialog
        open={Boolean(approveTarget)}
        onClose={() => setApproveTarget(null)}
        onConfirm={confirmApprove}
        tone="success"
        title="Approve this caretaker?"
        message={`${approveTarget?.name} will be marked Verified, appear in customer search results and can accept paid bookings immediately.`}
        confirmLabel="Approve application"
      />

      {/* Suspend / Reinstate Dialog with Mandatory Reason */}
      <Modal
        open={Boolean(suspendTarget)}
        onClose={() => {
          if (!isUpdating) {
            setSuspendTarget(null)
            setSuspendReason('')
            setReasonError('')
          }
        }}
        title={suspendTarget?.isSuspended ? 'Reinstate Caretaker Account' : 'Suspend Caretaker Account'}
        description={
          suspendTarget?.isSuspended
            ? `Reinstate ${suspendTarget?.name}. Their profile will reappear in search and they can accept new bookings.`
            : `Suspend ${suspendTarget?.name}. They will be hidden from customer discovery and cannot accept new bookings.`
        }
      >
        <div className="space-y-4">
          <FormField
            label="Reason for status change *"
            error={reasonError}
            hint="An auditable reason is required for caretaker status transitions (min 3 characters)."
          >
            <Textarea
              value={suspendReason}
              onChange={(e) => {
                setSuspendReason(e.target.value)
                if (e.target.value.trim().length >= 3) setReasonError('')
              }}
              placeholder="e.g. Disciplinary suspension due to complaint / Reinstated following review..."
              rows={3}
              disabled={isUpdating}
            />
          </FormField>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setSuspendTarget(null)
                setSuspendReason('')
                setReasonError('')
              }}
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button
              variant={suspendTarget?.isSuspended ? 'primary' : 'danger'}
              onClick={confirmSuspend}
              disabled={isUpdating || suspendReason.trim().length < 3}
            >
              {isUpdating
                ? 'Updating…'
                : suspendTarget?.isSuspended
                  ? 'Reinstate Caretaker'
                  : 'Suspend Caretaker'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default CaregiversPage
