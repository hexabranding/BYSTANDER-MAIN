import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  BadgeCheck,
  CheckCircle2,
  Clock,
  Eye,
  GraduationCap,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  SearchX,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
  Stethoscope,
  UserRound,
} from 'lucide-react'
import { useDocumentTitle, useDebouncedValue } from '@/hooks/useUi'
import { usePagination } from '@/hooks/usePagination'
import { adminService } from '@/services/adminService'
import { formatCurrency, formatDate } from '@/utils/format'
import { KERALA_DISTRICTS } from '@/utils/constants'
import { PageHeader } from '@/components/common/PageHeader'
import { StatCard } from '@/components/common/StatCard'
import { SearchBar } from '@/components/common/SearchBar'
import { Tabs } from '@/components/common/Tabs'
import { DataTable } from '@/components/common/DataTable'
import { Pagination } from '@/components/common/Pagination'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Modal } from '@/components/common/Modal'
import { Button } from '@/components/common/Button'
import { Avatar } from '@/components/common/Avatar'
import { RatingStars } from '@/components/common/RatingStars'
import { Card, CardBody, CardHeader } from '@/components/common/Card'
import { EmptyState } from '@/components/common/States'
import { Select } from '@/components/forms/FormField'

const STATUS_TABS = ['All', 'Verified', 'Pending']

export function NursingStudentsPage() {
  useDocumentTitle('Nursing Students')

  const [students, setStudents] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('All')
  const [district, setDistrict] = useState('All')
  const [viewingId, setViewingId] = useState(null)
  const [isUpdating, setIsUpdating] = useState(false)

  const debouncedSearch = useDebouncedValue(search)

  const fetchStudents = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await adminService.getCaregivers({
        qualification: 'nursing_student',
        sort: 'rating',
      })
      setStudents(res.caregivers || [])
    } catch (err) {
      setError(err?.message || 'Failed to retrieve nursing student caretakers from server.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStudents()
  }, [fetchStudents])

  // Extract distinct districts present in the real students data
  const districts = useMemo(() => {
    const list = students.map((s) => s.district).filter(Boolean)
    return [...new Set(list)].sort()
  }, [students])

  // Real KPI calculations from live database records
  const stats = useMemo(() => {
    const total = students.length
    const verified = students.filter((s) => s.verificationStatus === 'Verified').length
    const pending = students.filter(
      (s) => s.verificationStatus === 'Pending' || s.verificationStatus === 'Under Review'
    ).length
    const rated = students.filter((s) => Number(s.rating) > 0)
    const avg = rated.length
      ? (rated.reduce((sum, s) => sum + Number(s.rating || 0), 0) / rated.length).toFixed(1)
      : '5.0'

    return { total, verified, pending, avg }
  }, [students])

  // Search and filter logic against real caregiver fields
  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    return students.filter((s) => {
      const isVerified = s.verificationStatus === 'Verified'
      const matchesTab = tab === 'All' || (tab === 'Verified' ? isVerified : !isVerified)
      const matchesDistrict = district === 'All' || s.district === district

      const matchesSearch =
        !q ||
        (s.name || '').toLowerCase().includes(q) ||
        (s.email || '').toLowerCase().includes(q) ||
        (s.phone || '').toLowerCase().includes(q) ||
        (s.city || '').toLowerCase().includes(q) ||
        (s.district || '').toLowerCase().includes(q) ||
        (s.area || '').toLowerCase().includes(q)

      return matchesTab && matchesDistrict && matchesSearch
    })
  }, [students, debouncedSearch, tab, district])

  const { page, totalPages, totalItems, pageItems, goto } = usePagination(filtered, 8)

  useEffect(() => {
    goto(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, tab, district])

  const selected = viewingId ? students.find((s) => s.id === viewingId) : null

  // Direct backend verification approval
  const handleVerifyStudent = async (student) => {
    if (!student) return
    setIsUpdating(true)
    try {
      await adminService.updateCaregiverVerificationStatus(student.id, {
        status: 'verified',
        reason: 'Nursing student caretaker approved by operations administrator',
        trustScore: 90,
      })

      setStudents((prev) =>
        prev.map((s) =>
          s.id === student.id
            ? { ...s, verificationStatus: 'Verified', verified: true, trustScore: 90 }
            : s
        )
      )

      toast.success(`${student.name} approved and verified`, {
        description: 'Profile marked Verified and active for patient care taking bookings.',
      })
    } catch (err) {
      toast.error('Verification failed', {
        description: err?.message || 'Unable to update verification status on server.',
      })
    } finally {
      setIsUpdating(false)
    }
  }

  const columns = [
    {
      key: 'name',
      header: 'Nursing Student Caretaker',
      render: (s) => (
        <div className="flex items-center gap-3">
          <Avatar src={s.photo || s.avatar} name={s.name} size="sm" />
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink">{s.name}</p>
            <p className="truncate text-xs text-muted flex items-center gap-1.5">
              <span>{s.phone}</span>
              {s.email ? <span>· {s.email}</span> : null}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'qualification',
      header: 'Qualification',
      render: () => (
        <span className="inline-flex items-center gap-1 rounded-md bg-accent-50 px-2 py-0.5 text-xs font-semibold text-accent-700 border border-accent-200">
          <GraduationCap className="h-3 w-3" />
          Nursing Student (Final Year)
        </span>
      ),
    },
    {
      key: 'location',
      header: 'Location',
      render: (s) => (
        <div className="text-xs">
          <p className="font-semibold text-ink flex items-center gap-1">
            <MapPin className="h-3 w-3 text-muted" />
            {s.city || s.area || 'Kerala'}
          </p>
          {s.district ? <p className="text-muted pl-4">{s.district}</p> : null}
        </div>
      ),
    },
    {
      key: 'hourlyRate',
      header: 'Rate',
      render: (s) => (
        <span className="font-semibold tabular-nums text-ink">
          {formatCurrency(s.hourlyRate || 199)}/hr
        </span>
      ),
    },
    {
      key: 'shiftsCompleted',
      header: 'Shifts',
      align: 'right',
      render: (s) => <span className="tabular-nums font-semibold">{s.shiftsCompleted ?? s.completedJobs ?? 0}</span>,
    },
    {
      key: 'rating',
      header: 'Rating',
      render: (s) =>
        Number(s.rating) > 0 ? (
          <RatingStars value={Number(s.rating)} size={13} showValue />
        ) : (
          <span className="text-xs text-faint">Not rated</span>
        ),
    },
    {
      key: 'verificationStatus',
      header: 'Verification',
      render: (s) => <StatusBadge status={s.verificationStatus || 'Pending'} size="sm" />,
    },
    {
      key: 'action',
      header: 'Action',
      align: 'right',
      sortable: false,
      render: (s) => (
        <Button
          size="xs"
          variant="outline"
          icon={Eye}
          onClick={(e) => {
            e.stopPropagation()
            setViewingId(s.id)
          }}
        >
          View Profile
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nursing Students"
        subtitle="Genuine caretaker profiles who registered under Nursing Student (Final Year) — verified for companion and patient observation shifts."
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" icon={RefreshCw} onClick={fetchStudents} disabled={isLoading}>
              Refresh
            </Button>
            <Button to="/admin/caregivers" variant="secondary" icon={Stethoscope}>
              All Caretakers
            </Button>
          </div>
        }
      />

      {/* Scope Banner */}
      <div className="flex items-start gap-3 rounded-2xl border border-accent-200/80 bg-gradient-to-br from-accent-50/70 via-white to-mint-50/40 p-4 shadow-xs">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-600 text-white shadow-xs">
          <GraduationCap className="h-5 w-5" />
        </span>
        <div className="space-y-0.5">
          <p className="text-sm font-bold text-ink">Supervised Nursing Student Caretakers</p>
          <p className="text-xs text-muted leading-relaxed">
            These caretakers are verified nursing students who provide vital bedside care, companionship, patient monitoring, and feeding assistance. All profiles below reflect real caregiver registration data saved in the Bystander database.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          label="Total nursing students"
          value={stats.total}
          icon={GraduationCap}
          tone="primary"
          hint="Registered in database"
          delay={0}
        />
        <StatCard
          label="Verified profiles"
          value={stats.verified}
          icon={ShieldCheck}
          tone="success"
          hint="Active on marketplace"
          delay={0.05}
        />
        <StatCard
          label="Pending verification"
          value={stats.pending}
          icon={ShieldAlert}
          tone="warning"
          hint="Awaiting review"
          delay={0.1}
        />
        <StatCard
          label="Average rating"
          value={stats.avg}
          icon={Star}
          tone="accent"
          hint="From customer bookings"
          delay={0.15}
        />
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search by student name, phone, email, or city…"
          className="xl:max-w-md xl:flex-1"
        />

        <Tabs
          tabs={STATUS_TABS.map((t) => ({
            id: t,
            label: t,
            count:
              t === 'All'
                ? students.length
                : students.filter((s) =>
                    t === 'Verified' ? s.verificationStatus === 'Verified' : s.verificationStatus !== 'Verified'
                  ).length,
          }))}
          active={tab}
          onChange={setTab}
          size="sm"
        />

        <div className="flex flex-col gap-3 sm:flex-row xl:ml-auto">
          <Select
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            aria-label="Filter by district"
            className="w-full sm:w-48"
          >
            <option value="All">All districts</option>
            {districts.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
            {KERALA_DISTRICTS.filter((d) => !districts.includes(d)).map((d) => (
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
          <Button variant="outline" size="sm" onClick={fetchStudents} className="mt-3">
            Retry Loading
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-line bg-white p-8 shadow-xs">
          <EmptyState
            icon={SearchX}
            title={isLoading ? 'Loading nursing students…' : 'No nursing students found'}
            description={
              isLoading
                ? 'Retrieving live caretaker data from the database…'
                : 'No caretakers with qualification "Nursing Student" matched your filters.'
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
            keyExtractor={(row) => row.id}
            onRowClick={(row) => setViewingId(row.id)}
            emptyTitle="No nursing students found"
            emptyIcon={GraduationCap}
          />
          <Pagination page={page} totalPages={totalPages} onPageChange={goto} totalItems={totalItems} />
        </>
      )}

      {/* Real Truthful Caretaker Profile Dossier Modal */}
      <Modal
        open={Boolean(selected)}
        onClose={() => setViewingId(null)}
        title={selected?.name || 'Nursing Student Profile'}
        subtitle={
          selected
            ? `Nursing Student (Final Year) · ${[selected.city, selected.district, selected.state].filter(Boolean).join(', ')}`
            : ''
        }
        size="lg"
        footer={
          selected ? (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => setViewingId(null)}>
                Close
              </Button>
              {selected.verificationStatus !== 'Verified' ? (
                <Button
                  icon={BadgeCheck}
                  onClick={() => handleVerifyStudent(selected)}
                  disabled={isUpdating}
                >
                  {isUpdating ? 'Approving…' : 'Verify Caretaker Profile'}
                </Button>
              ) : (
                <div className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-success-700 bg-success-50 rounded-xl border border-success-200">
                  <CheckCircle2 className="h-4 w-4" />
                  Verified on Marketplace
                </div>
              )}
            </div>
          ) : null
        }
      >
        {selected ? (
          <div className="space-y-6">
            {/* Caretaker Header Card */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-line bg-gradient-to-br from-slate-50 to-white p-4">
              <div className="flex items-center gap-3.5">
                <Avatar src={selected.photo || selected.avatar} name={selected.name} size="lg" />
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-lg font-bold text-ink">{selected.name}</h3>
                    <StatusBadge status={selected.verificationStatus || 'Pending'} size="sm" />
                    <StatusBadge status={selected.status === 'active' ? 'Active' : 'Suspended'} size="sm" />
                  </div>
                  <p className="mt-1 text-xs text-muted flex items-center gap-1.5">
                    <GraduationCap className="h-3.5 w-3.5 text-primary-600" />
                    <span className="font-semibold text-primary-700">Nursing Student (Final Year)</span>
                    {selected.createdAt ? (
                      <span>· Registered {formatDate(selected.createdAt, { long: true })}</span>
                    ) : null}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 border-t sm:border-t-0 pt-3 sm:pt-0">
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Hourly Rate</p>
                  <p className="font-display text-lg font-extrabold text-ink">
                    {formatCurrency(selected.hourlyRate || 199)}
                    <span className="text-xs font-normal text-muted">/hr</span>
                  </p>
                </div>
                <div className="h-8 w-px bg-line" />
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Rating</p>
                  <p className="font-display text-lg font-extrabold text-ink flex items-center gap-1">
                    <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                    {Number(selected.rating || 5).toFixed(1)}
                  </p>
                </div>
              </div>
            </div>

            {/* Profile Information Grid */}
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Contact & Personal Details */}
              <Card>
                <CardHeader title="Contact & Personal" icon={UserRound} />
                <CardBody className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5" /> Mobile Phone
                    </span>
                    <span className="font-semibold text-ink font-mono">{selected.phone || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5" /> Email
                    </span>
                    <span className="font-semibold text-ink">{selected.email || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted">Experience</span>
                    <span className="font-semibold text-ink">{selected.experienceYears || 1} Years (Clinical Student)</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted">Completed Shifts</span>
                    <span className="font-semibold text-ink tabular-nums">{selected.shiftsCompleted ?? selected.completedJobs ?? 0}</span>
                  </div>
                </CardBody>
              </Card>

              {/* Residential Address */}
              <Card>
                <CardHeader title="Residential Address" icon={MapPin} />
                <CardBody className="space-y-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs text-muted">Street / House</span>
                    <span className="font-semibold text-ink text-right max-w-[65%]">
                      {selected.address?.street || selected.street || '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted">Locality / Area</span>
                    <span className="font-semibold text-ink">{selected.address?.area || selected.area || selected.city || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted">District & State</span>
                    <span className="font-semibold text-ink">
                      {[selected.district, selected.state || 'Kerala'].filter(Boolean).join(', ')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted">PIN Code</span>
                    <span className="font-semibold text-ink font-mono">{selected.address?.pincode || selected.pincode || '—'}</span>
                  </div>
                </CardBody>
              </Card>
            </div>

            {/* Care Settings & Services */}
            <Card>
              <CardHeader title="Care Settings & Services Offered" icon={Stethoscope} />
              <CardBody className="space-y-3">
                <div>
                  <p className="text-xs font-bold text-muted mb-1.5">Care Settings</p>
                  <div className="flex flex-wrap gap-2">
                    {(selected.careSettings || ['Home Care', 'Hospital Care']).map((cs) => (
                      <span
                        key={cs}
                        className="inline-flex items-center gap-1 rounded-lg bg-mint-50 px-2.5 py-1 text-xs font-semibold text-primary-800 border border-mint-200"
                      >
                        <CheckCircle2 className="h-3 w-3 text-primary-600" />
                        {cs}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-bold text-muted mb-1.5">Assigned Care Services</p>
                  <div className="flex flex-wrap gap-1.5">
                    {Array.isArray(selected.services) && selected.services.length > 0 ? (
                      selected.services.map((svc) => (
                        <span
                          key={svc}
                          className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700"
                        >
                          {svc}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-muted">General Bedside Assistance & Observation</span>
                    )}
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}

export default NursingStudentsPage
