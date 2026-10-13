import { useRef, useState } from 'react'
import { FileText, Image as ImageIcon, Trash2, UploadCloud, CheckCircle2 } from 'lucide-react'
import { cn } from '@/utils/cn'

const MAX_SIZE = 5 * 1024 * 1024
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp']

export function FileUpload({
  id,
  label,
  hint,
  accept = 'image/*,application/pdf',
  value,
  onChange,
  error,
  required,
}) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [localError, setLocalError] = useState('')

  const handleFiles = (files) => {
    const file = files?.[0]
    if (!file) return
    setLocalError('')
    if (file.size > MAX_SIZE) {
      setLocalError(`"${file.name}" is ${Math.round(file.size / (1024 * 1024))} MB — the limit is 5 MB.`)
      return
    }
    if (file.type && !ALLOWED_TYPES.includes(file.type)) {
      setLocalError('Unsupported format — please upload a PDF, JPG or PNG file.')
      return
    }
    onChange?.({
      name: file.name,
      size: file.size,
      type: file.type,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
    })
  }

  const displayError = error || localError
  const isImage = value?.preview

  return (
    <div className="space-y-1.5">
      {label ? (
        <label htmlFor={id} className="flex items-center gap-1 text-sm font-semibold text-ink-soft">
          {label}
          {required ? <span className="text-danger-500">*</span> : null}
        </label>
      ) : null}

      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {value ? (
        <div className="flex items-center gap-3 rounded-xl border border-line bg-white p-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-mint-100 text-primary-700">
            {isImage ? (
              <img src={value.preview} alt="" className="h-full w-full object-cover" />
            ) : value.type?.includes('pdf') ? (
              <FileText className="h-5 w-5" />
            ) : (
              <ImageIcon className="h-5 w-5" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">{value.name}</p>
            <p className="flex items-center gap-1 text-xs text-muted">
              <CheckCircle2 className="h-3.5 w-3.5 text-success-500" />
              Uploaded · {Math.max(1, Math.round((value.size || 0) / 1024))} KB
            </p>
          </div>
          <button
            type="button"
            onClick={() => onChange?.(null)}
            className="grid h-9 w-9 place-items-center rounded-lg text-muted transition hover:bg-danger-50 hover:text-danger-600"
            aria-label="Remove file"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            handleFiles(e.dataTransfer.files)
          }}
          className={cn(
            'flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-6 text-center transition',
            dragging ? 'border-primary-400 bg-mint-50' : 'border-line-strong bg-slate-50 hover:border-primary-300 hover:bg-mint-50',
            displayError && 'border-danger-300 bg-danger-50',
          )}
        >
          <UploadCloud className="h-6 w-6 text-primary-600" />
          <span className="text-sm font-semibold text-ink">Click or drop a file here</span>
          <span className="text-xs text-muted">PDF, JPG or PNG · max 5 MB</span>
        </button>
      )}

      {displayError ? (
        <p className="text-xs font-medium text-danger-600" role="alert">
          {displayError}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  )
}

export default FileUpload
