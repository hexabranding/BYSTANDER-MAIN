import { useCallback, useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Ban, Briefcase, Lock, Plus, RefreshCw, SearchX, Trash2, Users } from 'lucide-react'
import { useDebouncedValue, useDocumentTitle } from '@/hooks/useUi'
import { usePagination } from '@/hooks/usePagination'
import { formatDate } from '@/utils/format'
import { adminService } from '@/services/adminService'
import { PageHeader } from '@/components/common/PageHeader'
import { StatCard } from '@/components/common/StatCard'
import { Button } from '@/components/common/Button'
import { SearchBar } from '@/components/common/SearchBar'
import { Tabs } from '@/components/common/Tabs'
import { DataTable } from '@/components/common/DataTable'
import { Pagination } from '@/components/common/Pagination'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Modal } from '@/components/common/Modal'
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog'
import { EmptyState, ErrorState, TableSkeleton } from '@/components/common/States'
import { FormField, Input, Select, Textarea } from '@/components/forms/FormField'

const TYPE_TABS = ['All', 'Caregivers', 'Customers']

export function BlacklistPage() {
  useDocumentTitle('Blacklist')

  const [entries, setEntries] = useState([])
  const [stats, setStats] = useState({ total: 0, caregivers: 0, customers: 0, permanent: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [search, setSearch] = useState('')
  const [type, setType] = useState('All')
  const [selectedId, setSelectedId] = useState(null)
  const [removeOpen, setRemoveOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [candidates, setCandidates] = useState([])
  const [candidatesLoading, setCandidatesLoading] = useState(false)

  const debouncedSearch = useDebouncedValue(search, 300)

  // Fetch blacklist records from MongoDB via adminService
  const fetchBlacklist = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await adminService.getAdminBlacklist({
        search: debouncedSearch.trim() || undefined,
        type: type === 'All' ? undefined : type,
      })
      setEntries(result.entries || [])
      setStats(result.stats || { total: 0, caregivers: 0, customers: 0, permanent: 0 })
    } catch (err) {
      setError(err.message || 'Failed to retrieve blacklist from server.')
    } finally {
      setIsLoading(false)
    }
  }, [debouncedSearch, type])

  useEffect(() => {
    fetchBlacklist()
  }, [fetchBlacklist])

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm({
    mode: 'onTouched',
    defaultValues: { name: '', type: 'Caretaker', reason: '', reviewAfter: '', userId: '' },
  })

  const [candidateSearch, setCandidateSearch] = useState('')
  const debouncedCandidateSearch = useDebouncedValue(candidateSearch, 250)

  // Load registered candidates when Add modal opens or candidate search query changes
  useEffect(() => {
    if (addOpen) {
      setCandidatesLoading(true)
      adminService
        .getBlacklistCandidates(debouncedCandidateSearch.trim())
        .then((data) => {
          const list = Array.isArray(data) ? data : []
          setCandidates(list)
        })
        .catch(() => setCandidates([]))
        .finally(() => setCandidatesLoading(false))
    }
  }, [addOpen, debouncedCandidateSearch])

  const openAddModal = () => {
    setCandidateSearch('')
    reset({ name: '', type: 'Caretaker', reason: '', reviewAfter: '', userId: '' })
    setAddOpen(true)
  }

  const selected = entries.find((b) => b.id === selectedId || b._id === selectedId) || null

  const { page, totalPages, totalItems, pageItems, goto } = usePagination(entries, 8)

  useEffect(() => {
    goto(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, type])

  const selectedCandidateId = watch('userId')

  // When candidate selection changes, autofill name & type
  const handleCandidateChange = (e) => {
    const uId = e.target.value
    setValue('userId', uId)
    const match = candidates.find((c) => c.id === uId)
    if (match) {
      setValue('name', match.name)
      setValue('type', match.type)
    } else {
      setValue('name', '')
      setValue('type', 'Caretaker')
    }
  }

  const handleSelectCandidate = (cand) => {
    if (cand) {
      setValue('userId', cand.id)
      setValue('name', cand.name)
      setValue('type', cand.type)
    } else {
      setValue('userId', '')
      setValue('name', '')
      setValue('type', 'Caretaker')
    }
  }

  const closeAdd = () => {
    setAddOpen(false)
    setCandidateSearch('')
    reset()
  }

  // Handle addition: Saves to MongoDB and blocks user account
  const onAdd = async (values) => {
    const nameTrim = values.name.trim()
    const duplicate = entries.find(
      (e) => e.name.toLowerCase() === nameTrim.toLowerCase() && e.type === values.type
    )
    if (duplicate) {
      toast.error('Duplicate entry prevented', {
        description: `"${nameTrim}" is already on the blacklist (${duplicate.id}).`,
      })
      return
    }

    setIsSubmitting(true)
    try {
      await adminService.addToBlacklist({
        name: nameTrim,
        type: values.type,
        reason: values.reason.trim(),
        reviewAfter: values.reviewAfter || 'Permanent',
        userId: values.userId || undefined,
      })
      toast.success(`${nameTrim} added to the blacklist`, {
        description: 'The ban and security audit record are permanently recorded in MongoDB.',
      })
      closeAdd()
      fetchBlacklist()
    } catch (err) {
      toast.error('Failed to add to blacklist', {
        description: err.message || 'Could not save blacklist entry to server.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle removal: Unblocks user in MongoDB and marks entry as removed
  const handleRemove = async () => {
    if (!selected) return
    setIsSubmitting(true)
    try {
      await adminService.removeFromBlacklist(selected.id || selected._id, {
        reason: 'Unblocked by operations administrator',
      })
      toast.success(`${selected.name} removed from the blacklist`, {
        description: 'Account unblocked and removal recorded in the security audit ledger.',
      })
      setRemoveOpen(false)
      setSelectedId(null)
      fetchBlacklist()
    } catch (err) {
      toast.error('Failed to remove from blacklist', {
        description: err.message || 'Could not unblock entry on server.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const columns = [
    {
      key: 'id',
      header: 'Entry ID',
      render: (b) => <span className="font-display text-sm font-bold text-ink">{b.id}</span>,
    },
    { key: 'name', header: 'Name', render: (b) => <span className="font-semibold text-ink">{b.name}</span> },
    {
      key: 'type',
      header: 'Type',
      render: (b) => (
        <span className="inline-flex items-center gap-1.5 text-sm text-ink-soft">
          {b.type === 'Caretaker' ? <Briefcase className="h-3.5 w-3.5 text-primary-700" /> : <Users className="h-3.5 w-3.5 text-accent-500" />}
          {b.type}
        </span>
      ),
    },
    {
      key: 'reason',
      header: 'Reason',
      render: (b) => <p className="max-w-[20rem] truncate text-ink-soft">{b.reason}</p>,
    },
    {
      key: 'addedOn',
      header: 'Added on',
      render: (b) => <span className="whitespace-nowrap tabular-nums">{formatDate(b.addedOn, { long: true })}</span>,
    },
    { key: 'addedBy', header: 'Added by' },
    {
      key: 'reviewAfter',
      header: 'Review after',
      render: (b) =>
        String(b.reviewAfter).toLowerCase() === 'permanent' ? (
          <StatusBadge status="Blacklisted" size="sm" />
        ) : (
          <span className="tabular-nums">{formatDate(b.reviewAfter)}</span>
        ),
    },
    {
      key: 'action',
      header: 'Action',
      align: 'right',
      sortable: false,
      render: (b) => (
        <Button
          size="xs"
          variant="dangerGhost"
          icon={Trash2}
          onClick={(e) => {
            e.stopPropagation()
            setSelectedId(b.id || b._id)
            setRemoveOpen(true)
          }}
        >
          Remove
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Blacklist"
        subtitle="Accounts banned from booking or accepting work on Bystander."
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={RefreshCw}
              onClick={fetchBlacklist}
              loading={isLoading}
              title="Refresh from server"
            >
              Refresh
            </Button>
            <Button icon={Plus} onClick={openAddModal}>
              Add to blacklist
            </Button>
          </div>
        }
      />

      {/* Authoritative Live KPI Stat Cards */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Total entries" value={stats.total} icon={Ban} tone="primary" hint="All time" delay={0} />
        <StatCard label="Caretakers" value={stats.caregivers} icon={Briefcase} tone="accent" hint="Banned from taking jobs" delay={0.05} />
        <StatCard label="Customers" value={stats.customers} icon={Users} tone="info" hint="Banned from booking" delay={0.1} />
        <StatCard label="Permanent bans" value={stats.permanent} icon={Lock} tone="danger" hint="No automatic review date" delay={0.15} />
      </div>

      {/* Search and Tabs */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search name, reason or admin…"
          className="sm:max-w-sm sm:flex-1"
        />
        <Tabs
          tabs={TYPE_TABS.map((t) => ({
            id: t,
            label: t === 'Caregivers' ? 'Caretakers' : t,
            count:
              t === 'All'
                ? stats.total
                : t === 'Caregivers'
                  ? stats.caregivers
                  : stats.customers,
          }))}
          active={type}
          onChange={setType}
          size="sm"
        />
      </div>

      {/* Main Content Area: Loading / Error / Empty / Table */}
      {isLoading && entries.length === 0 ? (
        <TableSkeleton rows={5} />
      ) : error ? (
        <div className="rounded-card border border-line bg-white shadow-card">
          <ErrorState
            title="Failed to load blacklist"
            description={error}
            onRetry={fetchBlacklist}
          />
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-card border border-line bg-white shadow-card">
          <EmptyState
            icon={search ? SearchX : Ban}
            title={search ? 'No blacklist entries match' : 'The blacklist is empty'}
            description={
              search
                ? 'Try another search term or switch the account type tab.'
                : 'Nobody is currently banned in MongoDB. Add an entry when a serious policy breach is confirmed.'
            }
            action={
              search ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearch('')
                    setType('All')
                  }}
                >
                  Clear filters
                </Button>
              ) : (
                <Button icon={Plus} onClick={openAddModal}>
                  Add to blacklist
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
            keyExtractor={(row) => row.id || row._id}
            onRowClick={(row) => setSelectedId(row.id || row._id)}
            initialSort={{ key: 'addedOn', dir: 'desc' }}
            emptyTitle="No blacklist entries found"
            emptyIcon={Ban}
          />
          <Pagination page={page} totalPages={totalPages} onPageChange={goto} totalItems={totalItems} />
        </>
      )}

      <p className="text-xs leading-relaxed text-muted">
        Blacklist additions and removals are permanently recorded in the administrative security audit ledger in MongoDB.
      </p>

      {/* Details Modal */}
      <Modal
        open={Boolean(selected)}
        onClose={() => setSelectedId(null)}
        title={selected ? `${selected.id} · ${selected.name}` : 'Blacklist entry'}
        subtitle={selected ? `${selected.type} account · added ${formatDate(selected.addedOn, { long: true })}` : ''}
        size="md"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setSelectedId(null)}>
              Close
            </Button>
            <Button variant="danger" icon={Trash2} onClick={() => setRemoveOpen(true)}>
              Remove from blacklist
            </Button>
          </div>
        }
      >
        {selected ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status="Blacklisted" />
              <span className="rounded-full border border-line-strong bg-slate-50 px-3 py-1 text-xs font-semibold text-muted">
                {selected.type}
              </span>
            </div>

            <div className="rounded-card border border-danger-100 bg-gradient-to-br from-danger-50 to-white p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-danger-600">Reason for the ban</p>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{selected.reason}</p>
            </div>

            <dl className="grid gap-x-6 sm:grid-cols-2">
              <Detail label="Entry ID" value={selected.id} />
              <Detail label="Account type" value={selected.type} />
              <Detail label="Added on" value={formatDate(selected.addedOn, { long: true })} />
              <Detail label="Added by" value={selected.addedBy} />
              <Detail
                label="Review after"
                value={
                  String(selected.reviewAfter).toLowerCase() === 'permanent'
                    ? 'Permanent — no review'
                    : formatDate(selected.reviewAfter, { long: true })
                }
              />
              <Detail label="Enforced scope" value={selected.type === 'Caretaker' ? 'Job matching + payouts' : 'Bookings + sign-in'} />
            </dl>
          </div>
        ) : null}
      </Modal>

      {/* Confirmation Dialog to Unblock */}
      <ConfirmationDialog
        open={removeOpen}
        onClose={() => setRemoveOpen(false)}
        onConfirm={handleRemove}
        tone="danger"
        title="Remove from blacklist?"
        message={
          selected
            ? `${selected.name} will be unblocked and able to ${selected.type === 'Caretaker' ? 'accept jobs again' : 'book services again'} immediately. The action is recorded in the platform security audit ledger.`
            : ''
        }
        confirmLabel={isSubmitting ? 'Removing…' : 'Remove entry'}
      />

      {/* Add Modal */}
      <AddModal
        open={addOpen}
        onClose={closeAdd}
        onSubmit={handleSubmit(onAdd)}
        register={register}
        errors={errors}
        candidates={candidates}
        candidatesLoading={candidatesLoading}
        candidateSearch={candidateSearch}
        onCandidateSearchChange={setCandidateSearch}
        selectedCandidateId={selectedCandidateId}
        onCandidateChange={handleCandidateChange}
        onSelectCandidate={handleSelectCandidate}
        isSubmitting={isSubmitting}
      />
    </div>
  )
}

function Detail({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line py-2.5">
      <dt className="text-xs font-semibold uppercase tracking-wider text-faint">{label}</dt>
      <dd className="text-right text-sm font-semibold text-ink">{value}</dd>
    </div>
  )
}

function AddModal({
  open,
  onClose,
  onSubmit,
  register,
  errors,
  candidates = [],
  candidatesLoading = false,
  candidateSearch = '',
  onCandidateSearchChange,
  selectedCandidateId,
  onCandidateChange,
  onSelectCandidate,
  isSubmitting,
}) {
  const selectedCandidate = candidates.find((c) => c.id === selectedCandidateId) || null

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add to blacklist"
      subtitle="Bans the account from Bystander and enforces an immediate platform-wide block in MongoDB."
      size="md"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="danger"
            type="submit"
            form="blacklist-add-form"
            loading={isSubmitting}
            disabled={isSubmitting || candidatesLoading || !selectedCandidate}
          >
            Add to blacklist
          </Button>
        </div>
      }
    >
      <form id="blacklist-add-form" onSubmit={onSubmit} noValidate className="space-y-4">
        {/* Hidden inputs to pass selected user details to form */}
        <input type="hidden" {...register('name', { required: 'Please select a registered user' })} />
        <input type="hidden" {...register('type', { required: true })} />
        <input type="hidden" {...register('userId', { required: 'Please select a registered user' })} />

        {/* Search registered user input */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="bl-user-search" className="text-xs font-semibold uppercase tracking-wider text-faint">
              Search candidate
            </label>
            {candidateSearch ? (
              <span className="text-[11px] text-muted">
                {candidates.length} match{candidates.length === 1 ? '' : 'es'}
              </span>
            ) : null}
          </div>
          <SearchBar
            id="bl-user-search"
            value={candidateSearch}
            onChange={onCandidateSearchChange}
            placeholder="Search by name, phone or email…"
            size="sm"
            className="w-full"
          />
        </div>

        {/* Quick match suggestion pills when typing search */}
        {candidateSearch.trim() && candidates.length > 0 && !selectedCandidate ? (
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <span className="text-[11px] font-semibold text-faint">Suggestions:</span>
            {candidates.slice(0, 4).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onSelectCandidate(c)}
                className="inline-flex items-center gap-1 rounded-md border border-primary-200 bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-900 transition hover:bg-primary-100 hover:border-primary-300"
              >
                <span className="font-semibold">{c.name}</span>
                <span className="text-[10px] text-primary-700">({c.type})</span>
              </button>
            ))}
          </div>
        ) : null}

        <FormField
          label="Select registered user"
          htmlFor="bl-candidate"
          required
          error={errors.userId?.message || errors.name?.message}
          hint="Active registered platform users eligible to be blocked."
        >
          <Select
            id="bl-candidate"
            value={selectedCandidateId || ''}
            onChange={onCandidateChange}
            disabled={candidatesLoading}
          >
            {candidatesLoading ? (
              <option value="">Searching platform users…</option>
            ) : candidates.length === 0 ? (
              <option value="">
                {candidateSearch.trim()
                  ? `No users match "${candidateSearch}"`
                  : 'No registered users available to blacklist'}
              </option>
            ) : (
              <>
                <option value="">
                  {candidateSearch.trim()
                    ? `-- Select from ${candidates.length} match${candidates.length === 1 ? '' : 'es'} --`
                    : `-- Select a registered user (${candidates.length} available) --`}
                </option>
                {candidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.type}) — {c.phone || c.email || 'No contact'}
                  </option>
                ))}
              </>
            )}
          </Select>
        </FormField>

        {/* Selected User Info Card: only shown when a user is chosen */}
        {selectedCandidate ? (
          <div className="rounded-xl border border-line bg-slate-50 p-3.5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Account to block</p>
                <p className="mt-0.5 text-base font-bold text-ink">{selectedCandidate.name}</p>
                <p className="text-xs text-ink-soft">
                  {selectedCandidate.phone || selectedCandidate.email || 'Registered platform user'}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-white px-3 py-1 text-xs font-semibold text-ink">
                  {selectedCandidate.type === 'Caretaker' ? (
                    <Briefcase className="h-3.5 w-3.5 text-primary-700" />
                  ) : (
                    <Users className="h-3.5 w-3.5 text-accent-500" />
                  )}
                  {selectedCandidate.type}
                </span>
                <button
                  type="button"
                  onClick={() => onSelectCandidate(null)}
                  className="text-[11px] font-medium text-danger-600 transition hover:text-danger-700 hover:underline"
                >
                  Change user
                </button>
              </div>
            </div>
          </div>
        ) : !candidatesLoading && candidates.length === 0 && !candidateSearch ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-800">
            No registered users are currently eligible for blacklisting. All platform accounts are either already blacklisted or in good standing.
          </div>
        ) : null}

        <FormField
          label="Reason"
          htmlFor="bl-reason"
          required
          error={errors.reason?.message}
          hint="Be specific — this text is permanently recorded in the security audit ledger."
        >
          <Textarea
            id="bl-reason"
            rows={4}
            placeholder="e.g. Verified no-show pattern across 4 bookings; abandoned shifts after escrow lock."
            error={errors.reason?.message}
            {...register('reason', {
              required: 'A reason is required',
              minLength: { value: 3, message: 'Please write at least 3 characters' },
            })}
          />
        </FormField>

        <FormField
          label="Review after"
          htmlFor="bl-review"
          error={errors.reviewAfter?.message}
          hint="Leave empty for a permanent ban."
        >
          <Input id="bl-review" type="date" error={errors.reviewAfter?.message} {...register('reviewAfter')} />
        </FormField>

        <p className="rounded-xl bg-mint-50 px-3.5 py-3 text-xs leading-relaxed text-primary-900">
          Blacklist actions are permanently recorded in MongoDB with your admin actor attribution and prevent login or job acceptance.
        </p>
      </form>
    </Modal>
  )
}

export default BlacklistPage
