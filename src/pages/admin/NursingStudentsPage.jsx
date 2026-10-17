import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { BadgeCheck, BookOpen, Check, Eye, GraduationCap, SearchX, Send, ShieldAlert, ShieldCheck, Star } from 'lucide-react'
import { useDocumentTitle, useDebouncedValue } from '@/hooks/useUi'
import { usePagination } from '@/hooks/usePagination'
import { NURSING_STUDENTS } from '@/data/verifications'
import { formatDate } from '@/utils/format'
import { cn } from '@/utils/cn'
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

const CHECKLIST = [
  'College identity card',
  'Bonafide student certificate',
  'Supervisor consent letter',
  'Government photo ID',
  'Address proof',
]

const PARTIAL_CHECKS = ['Government photo ID']

export function NursingStudentsPage() {
  useDocumentTitle('Nursing students')

  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('All')
  const [college, setCollege] = useState('All')
  const [course, setCourse] = useState('All')
  const [viewingId, setViewingId] = useState(null)
  const [verifiedOverrides, setVerifiedOverrides] = useState({})
  const [checks, setChecks] = useState({})

  const debouncedSearch = useDebouncedValue(search)

  const colleges = useMemo(() => [...new Set(NURSING_STUDENTS.map((s) => s.college))].sort(), [])
  const courses = useMemo(() => [...new Set(NURSING_STUDENTS.map((s) => s.course))].sort(), [])

  const students = useMemo(
    () => NURSING_STUDENTS.map((s) => ({ ...s, verified: verifiedOverrides[s.id] ?? s.verified })),
    [verifiedOverrides],
  )

  const stats = useMemo(() => {
    const verified = students.filter((s) => s.verified).length
    const rated = students.filter((s) => s.rating > 0)
    const avg = rated.length ? (rated.reduce((sum, s) => sum + s.rating, 0) / rated.length).toFixed(1) : '0.0'
    return { total: students.length, verified, pending: students.length - verified, avg }
  }, [students])

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    return students.filter((s) => {
      const matchesTab = tab === 'All' || (tab === 'Verified' ? s.verified : !s.verified)
      const matchesCollege = college === 'All' || s.college === college
      const matchesCourse = course === 'All' || s.course === course
      const matchesSearch =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.college.toLowerCase().includes(q) ||
        s.regNo.toLowerCase().includes(q) ||
        s.city.toLowerCase().includes(q)
      return matchesTab && matchesCollege && matchesCourse && matchesSearch
    })
  }, [students, debouncedSearch, tab, college, course])

  const { page, totalPages, totalItems, pageItems, goto } = usePagination(filtered, 6)

  useEffect(() => {
    goto(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, tab, college, course])

  const selected = viewingId ? students.find((s) => s.id === viewingId) : null

  const checksFor = (s) => checks[s.id] ?? (s.verified ? CHECKLIST : PARTIAL_CHECKS)

  const toggleCheck = (s, label) => {
    setChecks((prev) => {
      const current = prev[s.id] ?? (s.verified ? CHECKLIST : PARTIAL_CHECKS)
      const next = current.includes(label) ? current.filter((l) => l !== label) : [...current, label]
      return { ...prev, [s.id]: next }
    })
  }

  const approveStudent = () => {
    if (!selected) return
    setChecks((prev) => ({ ...prev, [selected.id]: CHECKLIST }))
    setVerifiedOverrides((prev) => ({ ...prev, [selected.id]: true }))
    toast.success(`${selected.name} verified`, {
      description: 'Cleared for supervised, non-critical care taking shifts.',
    })
  }

  const requestDocument = () => {
    if (!selected) return
    toast.info(`Document requested from ${selected.name}`, {
      description: 'They have 72 hours to re-upload from the caretaker profile.',
    })
  }

  const columns = [
    {
      key: 'name',
      header: 'Student',
      render: (s) => (
        <div className="flex items-center gap-3">
          <Avatar src={s.avatar} name={s.name} size="sm" />
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink">{s.name}</p>
            <p className="truncate text-xs text-faint">{s.regNo}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'college',
      header: 'College',
      render: (s) => <span className="block max-w-[14rem] truncate">{s.college}</span>,
    },
    { key: 'course', header: 'Course' },
    { key: 'regNo', header: 'Reg no', sortable: false },
    { key: 'city', header: 'City' },
    {
      key: 'supervisor',
      header: 'Supervisor',
      render: (s) => <span className="block max-w-[10rem] truncate">{s.supervisor}</span>,
    },
    { key: 'jobsCompleted', header: 'Jobs', align: 'right', render: (s) => <span className="tabular-nums">{s.jobsCompleted}</span> },
    {
      key: 'rating',
      header: 'Rating',
      render: (s) =>
        s.rating > 0 ? <RatingStars value={s.rating} size={13} showValue /> : <span className="text-xs text-faint">Not rated</span>,
    },
    { key: 'verified', header: 'Verified', sortable: false, render: (s) => <StatusBadge status={s.verified ? 'Verified' : 'Pending'} size="sm" /> },
    { key: 'joinedOn', header: 'Joined', render: (s) => <span className="whitespace-nowrap">{formatDate(s.joinedOn)}</span> },
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
          View
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nursing students"
        subtitle="Students placed on CareMate under a supervising faculty member — tracked separately from licensed caretakers."
        action={
          <Button to="/admin/caregivers" variant="outline" icon={GraduationCap}>
            Caretaker directory
          </Button>
        }
      />

      <div className="flex items-start gap-3 rounded-card border border-accent-200 bg-gradient-to-br from-accent-50 to-white px-4 py-3.5">
        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white text-accent-600 shadow-card">
          <BookOpen className="h-4 w-4" />
        </span>
        <p className="text-sm leading-relaxed text-ink-soft">
          <span className="font-bold text-ink">Supervised scope of practice.</span> Nursing students only take
          non-critical, companionship and observation shifts that their supervisor has signed off on. They cannot be
          assigned medication administration, catheter care or unsupervised night duty, and every shift is capped at
          eight hours.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Total students" value={stats.total} icon={GraduationCap} tone="primary" hint="Enrolled on CareMate" delay={0} />
        <StatCard label="Verified" value={stats.verified} icon={ShieldCheck} tone="success" hint="Cleared for supervised shifts" delay={0.05} />
        <StatCard label="Pending" value={stats.pending} icon={ShieldAlert} tone="warning" hint="Awaiting document review" delay={0.1} />
        <StatCard label="Average rating" value={stats.avg} icon={Star} tone="accent" hint="From completed shifts" delay={0.15} />
      </div>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search student, college or reg no…"
          className="xl:max-w-sm xl:flex-1"
        />
        <Tabs
          tabs={STATUS_TABS.map((t) => ({
            id: t,
            label: t,
            count: t === 'All' ? students.length : students.filter((s) => (t === 'Verified' ? s.verified : !s.verified)).length,
          }))}
          active={tab}
          onChange={setTab}
          size="sm"
        />
        <div className="flex flex-col gap-3 sm:flex-row xl:ml-auto">
          <Select value={college} onChange={(e) => setCollege(e.target.value)} aria-label="Filter by college">
            <option value="All">All colleges</option>
            {colleges.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          <Select value={course} onChange={(e) => setCourse(e.target.value)} aria-label="Filter by course">
            <option value="All">All courses</option>
            {courses.map((c) => (
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
            title="No students found"
            description="Try another college, course or clear the search."
            action={
              <Button
                variant="outline"
                onClick={() => {
                  setSearch('')
                  setTab('All')
                  setCollege('All')
                  setCourse('All')
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
            initialSort={{ key: 'joinedOn', dir: 'desc' }}
            emptyTitle="No students found"
            emptyIcon={GraduationCap}
          />
          <Pagination page={page} totalPages={totalPages} onPageChange={goto} totalItems={totalItems} />
        </>
      )}

      <Modal
        open={Boolean(selected)}
        onClose={() => setViewingId(null)}
        title={selected?.name || 'Student'}
        subtitle={selected ? `${selected.course} · ${selected.regNo}` : ''}
        size="lg"
        footer={
          selected ? (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => setViewingId(null)}>
                Close
              </Button>
              <Button variant="secondary" icon={Send} onClick={requestDocument}>
                Request document
              </Button>
              <Button icon={BadgeCheck} onClick={approveStudent} disabled={selected.verified}>
                {selected.verified ? 'Already verified' : 'Approve'}
              </Button>
            </div>
          ) : null
        }
      >
        {selected ? (
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <Avatar src={selected.avatar} name={selected.name} size="lg" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={selected.verified ? 'Verified' : 'Pending'} size="sm" />
                  <span className="text-xs text-muted">Joined {formatDate(selected.joinedOn, { long: true })}</span>
                </div>
                <p className="mt-1 text-sm text-muted">{selected.city}</p>
              </div>
              <div className="hidden shrink-0 text-right sm:block">
                <p className="font-display text-2xl font-extrabold tabular-nums text-ink">{selected.jobsCompleted}</p>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-faint">Jobs done</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <CardHeader title="Course details" icon={GraduationCap} />
                <CardBody className="space-y-3 text-sm">
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-muted">College</span>
                    <span className="max-w-[65%] text-right font-semibold text-ink">{selected.college}</span>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-muted">Course</span>
                    <span className="font-semibold text-ink">{selected.course}</span>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-muted">Registration no.</span>
                    <span className="font-semibold text-ink">{selected.regNo}</span>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-muted">City</span>
                    <span className="font-semibold text-ink">{selected.city}</span>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-muted">Rating</span>
                    {selected.rating > 0 ? (
                      <RatingStars value={selected.rating} size={13} showValue />
                    ) : (
                      <span className="text-faint">Not rated yet</span>
                    )}
                  </div>
                </CardBody>
              </Card>

              <Card>
                <CardHeader title="Supervision" icon={ShieldCheck} />
                <CardBody className="space-y-3 text-sm">
                  <div className="rounded-xl border border-line bg-gradient-to-br from-slate-50 to-white px-3.5 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-faint">Faculty supervisor</p>
                    <p className="mt-1 font-semibold text-ink">{selected.supervisor}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted">
                      Signs off every shift before it is confirmed. Escalations route to the supervisor first.
                    </p>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted">Shift approvals</span>
                    <span className="font-semibold tabular-nums text-ink">{selected.jobsCompleted}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted">Scope</span>
                    <span className="font-semibold text-ink">Supervised, non-critical</span>
                  </div>
                </CardBody>
              </Card>
            </div>

            <Card>
              <CardHeader
                title="Verification checklist"
                subtitle="Tick off each item as the document is confirmed"
                icon={BadgeCheck}
                action={<StatusBadge status={selected.verified ? 'Verified' : 'Pending'} size="sm" />}
              />
              <CardBody className="space-y-2">
                {CHECKLIST.map((label) => {
                  const done = checksFor(selected).includes(label)
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => toggleCheck(selected, label)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left text-sm transition',
                        done
                          ? 'border-success-500/40 bg-success-50 text-success-700'
                          : 'border-line bg-white text-muted hover:border-primary-200 hover:text-ink',
                      )}
                    >
                      <span
                        className={cn(
                          'grid h-5 w-5 shrink-0 place-items-center rounded-md border',
                          done ? 'border-success-500 bg-success-500 text-white' : 'border-line-strong bg-white',
                        )}
                      >
                        {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : null}
                      </span>
                      <span className="flex-1 font-semibold">{label}</span>
                      <span className="text-[11px] font-bold uppercase tracking-wider">{done ? 'Verified' : 'Missing'}</span>
                    </button>
                  )
                })}
                <p className="pt-1 text-xs leading-relaxed text-muted">
                  Approval marks the student verified for supervised shifts only. Anything outside the signed scope
                  requires the supervisor to re-approve the booking.
                </p>
              </CardBody>
            </Card>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}

export default NursingStudentsPage
