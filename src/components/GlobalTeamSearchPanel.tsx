import { Hash, Loader2, Search } from 'lucide-react'
import { useState } from 'react'
import { getDb } from '../firebase/config'
import type { SelectableUserTeam } from '../hooks/useSelectableUserTeams'
import {
  formatTeamNumber,
  lookupTeamByNumber,
  parseTeamNumberInput,
} from '../lib/teamNumber'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type Props = {
  onSelect: (team: SelectableUserTeam) => void
  disabled?: boolean
  className?: string
  /** `section` — bordered block separated from local squad search; `link` — compact text trigger. */
  variant?: 'link' | 'section'
  /** When `variant="section"`, show an “or” rule above (hide if nothing is listed above). */
  showDivider?: boolean
  /** When true, the result row is disabled and shows `alreadyLinkedLabel` instead of Select. */
  isTeamAlreadyLinked?: (team: SelectableUserTeam) => boolean
  alreadyLinkedLabel?: string
}

export function GlobalTeamSearchPanel({
  onSelect,
  disabled = false,
  className,
  variant = 'link',
  showDivider = true,
  isTeamAlreadyLinked,
  alreadyLinkedLabel = 'Added',
}: Props) {
  const isSection = variant === 'section'
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<SelectableUserTeam | null>(null)

  const expanded = isSection || open

  function clearSearch() {
    setInput('')
    setError(null)
    setResult(null)
  }

  function closePanel() {
    setOpen(false)
    clearSearch()
  }

  async function runSearch() {
    setError(null)
    setResult(null)
    const num = parseTeamNumberInput(input)
    if (num == null) {
      setError('Enter a valid 6-digit team ID (100000–999999).')
      return
    }
    setSearching(true)
    try {
      const hit = await lookupTeamByNumber(getDb(), num)
      if (!hit) {
        setError('No team found with that ID.')
        return
      }
      if (hit.team.teamNumber == null) {
        setError('That squad does not have a team ID yet.')
        return
      }
      const selectable: SelectableUserTeam = {
        ...hit.team,
        ownerUid: hit.ownerUid,
        isCoOwned: false,
      }
      setResult(selectable)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed.')
    } finally {
      setSearching(false)
    }
  }

  const resultAlreadyLinked = result != null && (isTeamAlreadyLinked?.(result) ?? false)

  const searchForm = (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        void runSearch()
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Search by team ID</p>
        {isSection ? (
          input || error || result ? (
            <button
              type="button"
              disabled={disabled || searching}
              className="shrink-0 text-xs font-semibold text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
              onClick={clearSearch}
            >
              Clear
            </button>
          ) : null
        ) : (
          <button
            type="button"
            disabled={disabled || searching}
            className="shrink-0 text-xs font-semibold text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
            onClick={closePanel}
          >
            Cancel
          </button>
        )}
      </div>
      <div className="flex gap-2">
        <div
          className={cn(
            'flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border-2 bg-white px-3',
            isSection ? 'border-slate-300' : 'border-slate-200',
            'focus-within:border-primary focus-within:ring-[3px] focus-within:ring-primary/15',
          )}
        >
          <Hash className="size-4 shrink-0 text-slate-400" aria-hidden />
          <Input
            type="text"
            inputMode="numeric"
            maxLength={6}
            autoComplete="off"
            placeholder="6-digit ID"
            value={input}
            disabled={disabled || searching}
            autoFocus={expanded}
            onChange={(e) => {
              setInput(e.target.value.replace(/\D/g, '').slice(0, 6))
              setError(null)
              setResult(null)
            }}
            aria-label="Team ID"
            aria-invalid={error != null}
            aria-describedby={error ? 'global-team-search-error' : undefined}
            className="h-9 flex-1 border-0 bg-transparent px-0 py-0 font-mono text-slate-900 shadow-none focus-visible:ring-0 md:text-sm"
          />
        </div>
        <Button
          type="submit"
          variant="default"
          className="h-11 shrink-0 rounded-xl px-4"
          disabled={disabled || searching}
        >
          {searching ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <>
              <Search className="size-4" aria-hidden />
              <span className="sr-only">Search</span>
            </>
          )}
        </Button>
      </div>
      {error ? (
        <p id="global-team-search-error" className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {result ? (
        <button
          type="button"
          disabled={disabled || resultAlreadyLinked}
          className={cn(
            'flex w-full items-center gap-3 rounded-xl border bg-white px-3 py-3 text-left shadow-sm transition-colors',
            resultAlreadyLinked
              ? 'cursor-not-allowed border-slate-200 opacity-60'
              : 'border-primary/30 hover:bg-primary/5',
          )}
          onClick={() => onSelect(result)}
        >
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-slate-900">{result.name}</p>
            <p className="mt-0.5 text-xs text-slate-500">
              ID {formatTeamNumber(result.teamNumber!)} · {result.players.length} players
              {result.location ? ` · ${result.location}` : ''}
            </p>
          </div>
          <span
            className={cn(
              'text-xs font-semibold',
              resultAlreadyLinked ? 'text-slate-500' : 'text-primary',
            )}
          >
            {resultAlreadyLinked ? alreadyLinkedLabel : 'Select'}
          </span>
        </button>
      ) : null}
    </form>
  )

  if (!expanded) {
    return (
      <div className={className}>
        <button
          type="button"
          disabled={disabled}
          className="text-sm font-semibold text-primary underline-offset-2 hover:underline disabled:opacity-50"
          onClick={() => setOpen(true)}
        >
          Search by team ID
        </button>
      </div>
    )
  }

  if (isSection) {
    return (
      <div className={cn('shrink-0 space-y-4', className)}>
        {showDivider ? (
          <div className="relative" aria-hidden>
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                or
              </span>
            </div>
          </div>
        ) : null}
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-3">
          {searchForm}
        </div>
      </div>
    )
  }

  return (
    <div className={cn('space-y-3 rounded-xl border border-slate-100 bg-slate-50/80 p-3', className)}>
      {searchForm}
    </div>
  )
}
