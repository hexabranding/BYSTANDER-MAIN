import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Ban, Briefcase, Lock, Plus, SearchX, Trash2, Users } from 'lucide-react'
import { useData } from '@/context/DataContext'
import { useDebouncedValue, useDocumentTitle } from '@/hooks/useUi'
import { usePagination } from '@/hooks/usePagination'
import { formatDate } from '@/utils/format'
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
import { EmptyState } from '@/components/common/States'
import { FormField, Input, Select, Textarea } from '@/components/forms/FormField'

const TYPE_TABS = ['All', 'Caregivers', 'Customers']

export function BlacklistPage() {
  useDocumentTitle('Blacklist')

  const { blacklist, addBlacklist, removeBlacklist } = useData()

  const [search, setSearch] = useState('')
  const [type, setType] = useState('All')
  const [selectedId, setSelectedId] = useState(null)
  const [removeOpen, setRemoveOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const debouncedSearch = useDebouncedValue(search)

  const selected = blacklist.find((b) => b.id === selectedId) || null

  const stats = useMemo(
    () => ({
      total: blacklist.length,
      caregivers: blacklist.filter((b) => b.type === 'Caretaker').length,
      customers: blacklist.filter((b) => b.type === 'Customer').length,
      permanent: blacklist.filter((b) => String(b.reviewAfter).toLowerCase() === 'permanent').length,
    }),
    [blacklist],
  )

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    return blacklist.filter((b) => {
      const matchesType =
        type === 'All' || (type === 'Caregivers' && b.type === 'Caretaker') || (type === 'Customers' && b.type === 'Customer')
      const matchesSearch =
        !q || [b.id, b.name, b.type, b.reason, b.addedBy].join(' ').toLowerCase().includes(q)
      return matchesType && matchesSearch
    })
  }, [blacklist, debouncedSearch, type])

  const { page, totalPages, totalItems, pageItems, goto } = usePagination(filtered, 8)
  useEffect(() => {
    goto(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, type])

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    mode: 'onTouched',
    defaultValues: { name: '', type: 'Caretaker', reason: '', reviewAfter: '' },
  })

  const closeAdd = () => {
    setAddOpen(false)
    reset()
  }

  const onAdd = (values) => {
    addBlacklist({
      name: values.name.trim(),
      type: values.type,
      reason: values.reason.trim(),
      addedOn: new Date().toISOString().slice(0, 10),
      addedBy: 'Kavya Raman',
      reviewAfter: values.reviewAfter || 'Permanent',
    })
    toast.success(`${values.name.trim()} added to the blacklist`, {
      description: 'The entry is logged in the demo audit trail.',
    })
    closeAdd()
  }

  const handleRemove = () => {
    if (!selected) return
    removeBlacklist(selected.id)
    toast.success(`${selected.name} removed from the blacklist`, {
      description: 'Removal is recorded in the demo audit trail.',
    })
    setRemoveOpen(false)
    setSelectedId(null)
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
            setSelectedId(b.id)
            setRemoveOpen(true)
          }}
        >
          Remove
        </Button>
      ),
    },
  ]

  if (!blacklist.length) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Blacklist"
          subtitle="Accounts banned from booking or accepting work on CareMate."
          action={
            <Button icon={Plus} onClick={() => setAddOpen(true)}>
              Add to blacklist
            </Button>
          }
        />
        <div className="rounded-card border border-line bg-white shadow-card">
          <EmptyState
            icon={Ban}
            title="The blacklist is empty"
            description="Nobody is currently banned. Add an entry when a serious policy breach is confirmed."
            action={
              <Button icon={Plus} onClick={() => setAddOpen(true)}>
                Add to blacklist
              </Button>
            }
          />
        </div>
        <AddModal
          open={addOpen}
          onClose={closeAdd}
          onSubmit={handleSubmit(onAdd)}
          register={register}
          errors={errors}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Blacklist"
        subtitle="Accounts banned from booking or accepting work on CareMate."
        action={
          <Button icon={Plus} onClick={() => setAddOpen(true)}>
            Add to blacklist
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Total entries" value={stats.total} icon={Ban} tone="primary" hint="All time" delay={0} />
        <StatCard label="Caretakers" value={stats.caregivers} icon={Briefcase} tone="accent" hint="Banned from taking jobs" delay={0.05} />
        <StatCard label="Customers" value={stats.customers} icon={Users} tone="info" hint="Banned from booking" delay={0.1} />
        <StatCard label="Permanent bans" value={stats.permanent} icon={Lock} tone="danger" hint="No automatic review date" delay={0.15} />
      </div>

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
                ? blacklist.length
                : blacklist.filter((b) => b.type === (t === 'Caregivers' ? 'Caretaker' : 'Customer')).length,
          }))}
          active={type}
          onChange={setType}
          size="sm"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-card border border-line bg-white shadow-card">
          <EmptyState
            icon={SearchX}
            title="No blacklist entries match"
            description="Try another search term or switch the account type tab."
            action={
              <Button
                variant="outline"
                onClick={() => {
                  setSearch('')
                  setType('All')
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
            onRowClick={(row) => setSelectedId(row.id)}
            initialSort={{ key: 'addedOn', dir: 'desc' }}
            emptyTitle="No blacklist entries found"
            emptyIcon={Ban}
          />
          <Pagination page={page} totalPages={totalPages} onPageChange={goto} totalItems={totalItems} />
        </>
      )}

      <p className="text-xs leading-relaxed text-muted">
        Blacklist additions and removals are logged in the demo audit trail with the acting admin and timestamp.
      </p>

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

      <ConfirmationDialog
        open={removeOpen}
        onClose={() => setRemoveOpen(false)}
        onConfirm={handleRemove}
        tone="danger"
        title="Remove from blacklist?"
        message={
          selected
            ? `${selected.name} will be able to ${selected.type === 'Caretaker' ? 'accept jobs again' : 'book services again'} immediately. The removal is written to the demo audit trail.`
            : ''
        }
        confirmLabel="Remove entry"
      />

      <AddModal
        open={addOpen}
        onClose={closeAdd}
        onSubmit={handleSubmit(onAdd)}
        register={register}
        errors={errors}
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

function AddModal({ open, onClose, onSubmit, register, errors }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add to blacklist"
      subtitle="Bans the account from CareMate until the review date."
      size="md"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" type="submit" form="blacklist-add-form">
            Add to blacklist
          </Button>
        </div>
      }
    >
      <form id="blacklist-add-form" onSubmit={onSubmit} noValidate className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Full name" htmlFor="bl-name" required error={errors.name?.message}>
            <Input
              id="bl-name"
              placeholder="e.g. Deepak Yadav"
              error={errors.name?.message}
              {...register('name', {
                required: 'Enter the account name',
                minLength: { value: 3, message: 'Name should be at least 3 characters' },
              })}
            />
          </FormField>

          <FormField label="Account type" htmlFor="bl-type" required error={errors.type?.message}>
            <Select id="bl-type" error={errors.type?.message} {...register('type')}>
              <option value="Caretaker">Caretaker</option>
              <option value="Customer">Customer</option>
            </Select>
          </FormField>
        </div>

        <FormField
          label="Reason"
          htmlFor="bl-reason"
          required
          error={errors.reason?.message}
          hint="Be specific — this text is shown to other admins during review."
        >
          <Textarea
            id="bl-reason"
            rows={4}
            placeholder="e.g. Verified no-show pattern across 4 bookings; abandoned shifts after escrow lock."
            error={errors.reason?.message}
            {...register('reason', {
              required: 'A reason is required',
              minLength: { value: 15, message: 'Please write at least 15 characters' },
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
          Blacklist actions are logged in the demo audit trail with your admin name and timestamp.
        </p>
      </form>
    </Modal>
  )
}

export default BlacklistPage
