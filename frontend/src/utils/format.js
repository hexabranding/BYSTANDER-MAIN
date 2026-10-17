const currencyFmt = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

const currencyFmtPaise = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatCurrency(amount, { decimals = false } = {}) {
  const value = Number(amount || 0)
  return decimals ? currencyFmtPaise.format(value) : currencyFmt.format(value)
}

export function formatCompactCurrency(amount) {
  const value = Number(amount || 0)
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)} Cr`
  if (value >= 100000) return `₹${(value / 100000).toFixed(2)} L`
  if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`
  return currencyFmt.format(value)
}

export function formatNumber(value) {
  return new Intl.NumberFormat('en-IN').format(Number(value || 0))
}

export function formatDate(input, { long = false } = {}) {
  if (!input) return '—'
  const date = new Date(input)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: long ? 'long' : 'short',
    year: 'numeric',
  })
}

export function formatTime(input) {
  if (!input) return '—'
  const date = new Date(input)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
}

export function formatDateTime(input) {
  if (!input) return '—'
  return `${formatDate(input)} · ${formatTime(input)}`
}

export function relativeTime(input) {
  const date = new Date(input)
  if (Number.isNaN(date.getTime())) return '—'
  const diff = date.getTime() - Date.now()
  const abs = Math.abs(diff)
  const mins = Math.round(abs / 60000)
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  if (mins < 1) return rtf.format(0, 'minute')
  if (mins < 60) return rtf.format(Math.sign(diff) * mins, 'minute')
  const hours = Math.round(mins / 60)
  if (hours < 24) return rtf.format(Math.sign(diff) * hours, 'hour')
  const days = Math.round(hours / 24)
  if (days < 30) return rtf.format(Math.sign(diff) * days, 'day')
  const months = Math.round(days / 30)
  if (months < 12) return rtf.format(Math.sign(diff) * months, 'month')
  return rtf.format(Math.sign(diff) * Math.round(months / 12), 'year')
}

export function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

export function maskEmail(email = '') {
  const [user, domain] = email.split('@')
  if (!domain) return email
  const head = user.slice(0, 2)
  return `${head}${'*'.repeat(Math.max(user.length - 2, 1))}@${domain}`
}

export function maskPhone(phone = '') {
  const digits = String(phone).replace(/\D/g, '')
  if (digits.length < 4) return digits
  return `${'*'.repeat(Math.max(digits.length - 4, 0))}${digits.slice(-4)}`
}

export function uid(prefix = 'ID') {
  return `${prefix}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`
}

export function bookingRef() {
  const n = Math.floor(100000 + Math.random() * 899999)
  return `CM-${n}`
}

export function toCSV(rows) {
  if (!rows?.length) return ''
  const headers = Object.keys(rows[0])
  const escape = (v) => {
    const s = String(v ?? '')
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))].join('\n')
}

export function downloadText(filename, content, type = 'text/csv') {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
