import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Props = {
  titleId?: string
  title: ReactNode
  onClose?: () => void
  closeDisabled?: boolean
  shrink?: boolean
  className?: string
}

export function ModalDialogHeader({ titleId, title, onClose, closeDisabled, shrink, className }: Props) {
  return (
    <div
      className={cn(
        'relative border-b border-slate-100 px-5 pb-4 pt-5',
        shrink && 'shrink-0',
        className,
      )}
    >
      {onClose ? (
        <button
          type="button"
          className="absolute top-4 right-4 inline-flex size-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50"
          aria-label="Close"
          disabled={closeDisabled}
          onClick={onClose}
        >
          <X className="size-4" strokeWidth={2.2} aria-hidden />
        </button>
      ) : null}
      {typeof title === 'string' ? (
        <h2 id={titleId} className="pr-10 text-lg font-bold tracking-tight text-slate-900">
          {title}
        </h2>
      ) : (
        <div className={cn(onClose && 'pr-10')}>{title}</div>
      )}
    </div>
  )
}
