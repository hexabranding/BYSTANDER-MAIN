import { useMemo, useState } from 'react'

export function usePagination(items = [], pageSize = 6) {
  const [page, setPage] = useState(1)
  const totalItems = items.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const safePage = Math.min(page, totalPages)

  const pageItems = useMemo(
    () => items.slice((safePage - 1) * pageSize, safePage * pageSize),
    [items, safePage, pageSize],
  )

  const next = () => setPage((p) => Math.min(p + 1, totalPages))
  const prev = () => setPage((p) => Math.max(p - 1, 1))
  const goto = (p) => setPage(Math.min(Math.max(1, p), totalPages))

  return {
    page: safePage,
    pageSize,
    totalPages,
    totalItems,
    pageItems,
    next,
    prev,
    goto,
    reset: () => setPage(1),
    hasNext: safePage < totalPages,
    hasPrev: safePage > 1,
  }
}
