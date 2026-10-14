import { useCallback, useEffect, useState } from 'react'

const resolve = (v) => (typeof v === 'function' ? v() : v)
const isPlainObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v)

export function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    const fallback = () => resolve(initialValue)
    if (typeof window === 'undefined') return fallback()
    try {
      const raw = window.localStorage.getItem(key)
      if (raw !== null) {
        const stored = JSON.parse(raw)
        // Backfill keys added to the defaults since this payload was saved, so
        // storage from an older app version can't leave new fields undefined.
        const defaults = fallback()
        if (isPlainObject(defaults) && isPlainObject(stored)) return { ...defaults, ...stored }
        return stored
      }
    } catch {
      /* corrupted payload — fall through to initial value */
    }
    return fallback()
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch {
      /* quota exceeded or private mode — ignore */
    }
  }, [key, value])

  const remove = useCallback(() => {
    try {
      window.localStorage.removeItem(key)
    } catch {
      /* ignore */
    }
  }, [key])

  return [value, setValue, remove]
}
