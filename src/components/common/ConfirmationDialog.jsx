import { AlertTriangle } from 'lucide-react'
import { Modal } from './Modal'
import { Button } from './Button'
import { cn } from '@/utils/cn'

export function ConfirmationDialog({
  open,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  loading = false,
}) {
  const toneClass =
    tone === 'danger'
      ? 'bg-danger-600 hover:bg-danger-700'
      : tone === 'success'
        ? 'bg-success-600 hover:bg-success-700'
        : 'bg-primary-700 hover:bg-primary-800'

  return (
    <Modal open={open} onClose={onClose} title={title} size="sm" hideClose>
      <div className="flex gap-4">
        <span
          className={cn(
            'grid h-11 w-11 shrink-0 place-items-center rounded-full',
            tone === 'danger' ? 'bg-danger-50 text-danger-600' : 'bg-mint-100 text-primary-700',
          )}
        >
          <AlertTriangle className="h-5 w-5" />
        </span>
        <div className="text-sm leading-relaxed text-muted">{message}</div>
      </div>
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={onClose} disabled={loading}>
          {cancelLabel}
        </Button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={loading}
          className={cn(
            'inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold text-white transition disabled:opacity-60',
            toneClass,
          )}
        >
          {loading ? 'Working…' : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}

export default ConfirmationDialog
