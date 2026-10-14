import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { cn } from '@/utils/cn'
import { EmptyState, TableSkeleton } from './States'

export function DataTable({
  columns,
  data,
  keyExtractor = (row, i) => row.id ?? i,
  onRowClick,
  loading = false,
  emptyTitle = 'No records found',
  emptyDescription = 'Try adjusting your filters or search terms.',
  emptyIcon,
  className,
  dense = false,
  initialSort,
}) {
  const [sort, setSort] = useState(initialSort || null)

  const sorted = useMemo(() => {
    if (!sort) return data
    const { key, dir } = sort
    return [...data].sort((a, b) => {
      const av = a[key]
      const bv = b[key]
      if (av === bv) return 0
      if (av === null || av === undefined) return 1
      if (bv === null || bv === undefined) return -1
      const result = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv))
      return dir === 'asc' ? result : -result
    })
  }, [data, sort])

  const toggleSort = (key) => {
    setSort((prev) => (prev?.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))
  }

  if (loading) return <TableSkeleton rows={5} cols={Math.min(columns.length, 6)} />
  if (!data?.length) return <EmptyState title={emptyTitle} description={emptyDescription} icon={emptyIcon} />

  return (
    <div className={cn('overflow-hidden rounded-card border border-line bg-white shadow-card', className)}>
      <div className="thin-scrollbar overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left">
          <thead>
            <tr className="border-b border-line bg-gradient-to-r from-mint-50 to-slate-50">
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={cn(
                    'px-4 text-xs font-bold uppercase tracking-wider text-faint',
                    dense ? 'py-2.5' : 'py-3.5',
                    col.align === 'right' && 'text-right',
                    col.align === 'center' && 'text-center',
                  )}
                  style={col.width ? { width: col.width } : undefined}
                >
                  {col.sortable === false ? (
                    col.header
                  ) : (
                    <button
                      type="button"
                      onClick={() => toggleSort(col.sortKey || col.key)}
                      className={cn(
                        'inline-flex items-center gap-1 uppercase tracking-wider transition hover:text-primary-700',
                        col.align === 'right' && 'flex-row-reverse',
                      )}
                    >
                      {col.header}
                      {sort?.key === (col.sortKey || col.key) ? (
                        sort.dir === 'asc' ? (
                          <ArrowUp className="h-3 w-3" />
                        ) : (
                          <ArrowDown className="h-3 w-3" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-40" />
                      )}
                    </button>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {sorted.map((row, index) => (
              <tr
                key={keyExtractor(row, index)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  'group bg-white transition hover:bg-mint-50/60',
                  onRowClick && 'cursor-pointer',
                )}
              >
                {columns.map((col, ci) => (
                  <td
                    key={col.key}
                    className={cn(
                      'align-middle text-sm text-ink-soft',
                      dense ? 'px-4 py-2.5' : 'px-4 py-3.5',
                      col.align === 'right' && 'text-right',
                      col.align === 'center' && 'text-center',
                      ci === 0 && 'group-hover:shadow-[inset_3px_0_0_0_var(--color-primary-500)]',
                      col.className,
                    )}
                  >
                    {col.render ? col.render(row, index) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default DataTable
