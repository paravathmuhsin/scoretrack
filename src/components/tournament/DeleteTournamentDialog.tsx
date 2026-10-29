import { ModalDialogHeader } from '@/components/ModalDialogHeader'
import { useEffect, useId } from 'react'
import { BtnPendingLabel } from '../Spinner'
import { tournamentModalFooterOutlineButtonClass } from './tournamentModalFooterButtons'
import { Button } from '@/components/ui/button'

type Props = {
  open: boolean
  onClose: () => void
  tournamentName: string
  matchBullet: string
  error: string | null
  writePending: boolean
  onConfirm: () => void
}

export function DeleteTournamentDialog({
  open,
  onClose,
  tournamentName,
  matchBullet,
  error,
  writePending,
  onConfirm,
}: Props) {
  const fieldId = useId()

  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="flex max-h-[min(90dvh,720px)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-2xl"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`${fieldId}-delete-tournament-title`}
        aria-describedby={`${fieldId}-delete-tournament-desc`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <ModalDialogHeader
          shrink
          titleId={`${fieldId}-delete-tournament-title`}
          title="Delete this tournament?"
          onClose={() => onClose()}
        />

        <div
          id={`${fieldId}-delete-tournament-desc`}
          className="space-y-3 overflow-y-auto px-5 py-4 text-sm leading-relaxed text-slate-600"
        >
          <p className="m-0 text-center">
            Permanently delete <span className="font-semibold text-slate-800">{tournamentName}</span>?
          </p>
          <p className="m-0">
            This cannot be undone. The following will be <strong className="font-semibold text-slate-800">permanently removed</strong>:
          </p>
          <ul className="m-0 list-disc space-y-1.5 pl-5 text-slate-600">
            <li>{matchBullet}</li>
            <li>Tournament standings and stats summaries</li>
          </ul>
          <p className="m-0 text-xs text-slate-500">
            Team rosters you opened from this tournament are not deleted; you can still use each squad from My teams.
          </p>
          {error ? (
            <p className="m-0 text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <div className="shrink-0 border-t border-slate-100 p-4">
          <div className="flex flex-col gap-2.5 sm:flex-row-reverse sm:gap-3">
            <Button
              type="button"
              variant="destructive"
              disabled={writePending}
              className="min-h-[48px] h-12 max-sm:h-14 w-full rounded-full px-5 text-base font-semibold shadow-md sm:min-w-0 sm:flex-1"
              onClick={() => onConfirm()}
            >
              <BtnPendingLabel pending={writePending} idle="Delete permanently" />
            </Button>
            <Button
              type="button"
              variant="outline"
              className={tournamentModalFooterOutlineButtonClass}
              disabled={writePending}
              onClick={() => onClose()}
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
