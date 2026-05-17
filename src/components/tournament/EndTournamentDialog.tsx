import { ChevronDown, Trophy, X } from 'lucide-react'
import { useEffect, useId, type ComponentProps, type FormEvent, type ReactNode } from 'react'
import { BtnPendingLabel } from '../Spinner'
import { matchFormSelectClass } from '../MatchFormCreateFields'
import {
  tournamentModalFooterOutlineButtonClass,
  tournamentModalFooterPrimaryButtonClass,
} from './tournamentModalFooterButtons'
import { Button } from '@/components/ui/button'
import type { PlayerAggRow } from '../../types/models'

type Props = {
  open: boolean
  onClose: () => void
  tournamentName: string
  teamOptions: { id: string; label: string }[]
  statsPlayers: PlayerAggRow[]
  potKeySep: string
  winnerId: string
  onWinnerChange: (id: string) => void
  runnerId: string
  onRunnerChange: (id: string) => void
  potKey: string
  onPotKeyChange: (key: string) => void
  error: string | null
  writePending: boolean
  onSubmit: () => void
}

function EndTournamentFieldSelect({
  id,
  label,
  disabled,
  placeholder,
  children,
  ...rest
}: Omit<ComponentProps<'select'>, 'className'> & {
  id: string
  label: string
  placeholder?: string
  children: ReactNode
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-semibold text-slate-900">
        {label}
      </label>
      <div className="relative w-full">
        <select id={id} className={matchFormSelectClass} disabled={disabled} {...rest}>
          {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
          {children}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-primary"
          strokeWidth={2.2}
          aria-hidden
        />
      </div>
    </div>
  )
}

export function EndTournamentDialog({
  open,
  onClose,
  tournamentName,
  teamOptions,
  statsPlayers,
  potKeySep,
  winnerId,
  onWinnerChange,
  runnerId,
  onRunnerChange,
  potKey,
  onPotKeyChange,
  error,
  writePending,
  onSubmit,
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

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    onSubmit()
  }

  if (!open) return null

  const hasStats = statsPlayers.length > 0

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="flex min-h-0 max-h-[min(90dvh,720px)] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${fieldId}-end-tournament-title`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="relative shrink-0 border-b border-slate-100 px-5 pb-4 pt-5">
          <button
            type="button"
            className="absolute right-4 top-4 inline-flex size-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
            aria-label="Close"
            onClick={() => onClose()}
          >
            <X className="size-4" strokeWidth={2.2} aria-hidden />
          </button>
          <div className="flex items-start gap-3 pr-10">
            <div
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
              aria-hidden
            >
              <Trophy className="size-5" strokeWidth={2} />
            </div>
            <div className="min-w-0 leading-tight">
              <h2 id={`${fieldId}-end-tournament-title`} className="text-lg font-bold text-slate-900">
                End tournament
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Confirm final standings for <span className="font-semibold text-slate-800">{tournamentName}</span>.
                Player of the tournament defaults to the MVP leader (you can change it).
              </p>
            </div>
          </div>
        </div>

        <form noValidate onSubmit={(e) => void handleSubmit(e)} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
            <EndTournamentFieldSelect
              id={`${fieldId}-winner`}
              label="Winner"
              placeholder="Select team"
              value={winnerId}
              onChange={(e) => onWinnerChange(e.target.value)}
              disabled={writePending}
            >
              {teamOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </EndTournamentFieldSelect>

            <EndTournamentFieldSelect
              id={`${fieldId}-runner`}
              label="Runner-up"
              placeholder="Select team"
              value={runnerId}
              onChange={(e) => onRunnerChange(e.target.value)}
              disabled={writePending}
            >
              {teamOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </EndTournamentFieldSelect>

            <EndTournamentFieldSelect
              id={`${fieldId}-pot`}
              label="Player of the tournament"
              placeholder={hasStats ? 'Select player' : undefined}
              value={potKey}
              onChange={(e) => onPotKeyChange(e.target.value)}
              disabled={writePending || !hasStats}
            >
              {!hasStats ? (
                <option value="">No stats summary yet — play completed matches first</option>
              ) : (
                statsPlayers.map((p) => {
                  const key = `${p.teamId}${potKeySep}${p.playerId}`
                  return (
                    <option key={key} value={key}>
                      {p.name} · {p.teamId} · MVP {p.mvpScore.toFixed(0)}
                    </option>
                  )
                })
              )}
            </EndTournamentFieldSelect>

            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
          </div>

          <div className="shrink-0 border-t border-slate-100 p-4">
            <div className="flex flex-col gap-2.5 sm:flex-row-reverse sm:gap-3">
              <Button
                type="submit"
                variant="default"
                disabled={writePending || !hasStats}
                className={tournamentModalFooterPrimaryButtonClass}
              >
                <BtnPendingLabel pending={writePending} idle="Save & end" />
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
        </form>
      </div>
    </div>
  )
}
