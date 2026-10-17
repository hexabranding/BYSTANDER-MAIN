import { useEffect, useState } from 'react'
import { Star } from 'lucide-react'
import { Modal } from '@/components/common/Modal'
import { Button } from '@/components/common/Button'
import { FormField, Textarea } from '@/components/forms/FormField'
import { cn } from '@/utils/cn'

export const DEFAULT_CRITERIA = [
  { key: 'serviceQuality', label: 'Service quality' },
  { key: 'behaviour', label: 'Behaviour' },
  { key: 'punctuality', label: 'Punctuality' },
  { key: 'overall', label: 'Overall experience' },
]

function StarRow({ value, onChange, label }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm font-medium text-ink-soft">{label}</span>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${label}: ${n} star${n > 1 ? 's' : ''}`}
            onClick={() => onChange(n)}
            className="rounded p-0.5 transition hover:scale-110"
          >
            <Star
              className={cn(
                'h-5 w-5 transition',
                n <= value ? 'fill-amber-400 text-amber-400' : 'text-line-strong',
              )}
            />
          </button>
        ))}
      </div>
    </div>
  )
}

export function RatingModal({
  open,
  onClose,
  onSubmit,
  title = 'Rate your experience',
  subjectName = '',
  criteria = DEFAULT_CRITERIA,
}) {
  const initial = () => criteria.reduce((acc, c) => ({ ...acc, [c.key]: 0 }), { comment: '' })
  const [form, setForm] = useState(initial)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setForm(initial())
      setError('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }))

  const scores = criteria.map((c) => form[c.key] || 0)
  const allRated = scores.every((s) => s >= 1)
  const average = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : '0.0'

  const submit = () => {
    if (!allRated) {
      setError('Please tap a star for every criterion.')
      return
    }
    onSubmit?.({
      criteria: criteria.reduce((acc, c) => ({ ...acc, [c.key]: form[c.key] }), {}),
      average: Number(average),
      comment: form.comment.trim(),
    })
    onClose?.()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      subtitle={subjectName ? `Your feedback helps ${subjectName} and keeps CareMate trustworthy.` : 'Your feedback keeps CareMate trustworthy.'}
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <span className="text-sm text-muted">
            Average <span className="font-bold text-ink">{average}</span> / 5
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Later
            </Button>
            <Button type="submit" form="rating-modal-form" disabled={!allRated}>
              Submit review
            </Button>
          </div>
        </div>
      }
    >
      <form
        id="rating-modal-form"
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
        className="space-y-4"
      >
        <div className="space-y-3">
          {criteria.map((c) => (
            <StarRow key={c.key} label={c.label} value={form[c.key] || 0} onChange={(v) => set(c.key, v)} />
          ))}
        </div>
        <FormField label="Comments (optional)">
          <Textarea
            rows={3}
            value={form.comment}
            onChange={(e) => set('comment', e.target.value)}
            placeholder="Share what went well, or what we should improve…"
          />
        </FormField>
        {error ? <p className="text-xs font-semibold text-danger-600">{error}</p> : null}
      </form>
    </Modal>
  )
}

export default RatingModal
