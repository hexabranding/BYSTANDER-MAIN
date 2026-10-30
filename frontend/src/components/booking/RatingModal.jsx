import { useEffect, useState } from 'react'
import { Star } from 'lucide-react'
import { Modal } from '@/components/common/Modal'
import { Button } from '@/components/common/Button'
import { FormField, Textarea } from '@/components/forms/FormField'
import { cn } from '@/utils/cn'

export const DEFAULT_CRITERIA = [
  { key: 'overall', label: 'Overall experience' },
]

export const CUSTOMER_CRITERIA = [
  { key: 'overall', label: 'Overall experience' },
]

export function RatingModal({
  open,
  onClose,
  onSubmit,
  title = 'Rate your experience',
  subjectName = '',
  criteria = DEFAULT_CRITERIA,
  mandatory = false,
}) {
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')

  useEffect(() => {
    if (open) {
      setRating(5)
      setComment('')
    }
  }, [open])

  const submit = () => {
    onSubmit?.({
      rating: Number(rating),
      average: Number(rating),
      criteria: { overall: Number(rating) },
      comment: comment.trim(),
    })
    onClose?.()
  }

  const getRatingLabel = (val) => {
    switch (val) {
      case 5:
        return '5.0 · Excellent'
      case 4:
        return '4.0 · Good'
      case 3:
        return '3.0 · Average'
      case 2:
        return '2.0 · Poor'
      case 1:
        return '1.0 · Very Poor'
      default:
        return `${val}.0`
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      hideClose={false}
      title={title}
      subtitle={
        subjectName
          ? `Your feedback helps ${subjectName} and keeps Bystander trustworthy.`
          : 'Your feedback keeps Bystander trustworthy.'
      }
      size="sm"
      footer={
        <div className="flex w-full items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Later
          </Button>
          <Button type="submit" form="rating-modal-form" icon={Star}>
            Submit review
          </Button>
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
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-line bg-gradient-to-b from-slate-50/80 to-white py-5 px-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Tap to rate</p>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setRating(v)}
                aria-label={`Rate ${v} star${v > 1 ? 's' : ''}`}
                className="p-1 transition hover:scale-125 focus:outline-none cursor-pointer"
              >
                <Star
                  className={cn(
                    'h-9 w-9 transition-colors',
                    v <= rating
                      ? 'fill-amber-400 text-amber-400 drop-shadow-sm'
                      : 'text-slate-200 hover:text-slate-300',
                  )}
                />
              </button>
            ))}
          </div>
          <p className="text-sm font-bold text-ink">{getRatingLabel(rating)}</p>
        </div>

        <FormField label="Comments (optional)">
          <Textarea
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Share what went well, or what we should improve…"
          />
        </FormField>
      </form>
    </Modal>
  )
}

export default RatingModal

