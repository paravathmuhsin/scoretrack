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
}

export function GlobalTeamSearchPanel({ onSelect, disabled = false, className }: Props) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<SelectableUserTeam | null>(null)

  function closePanel() {
    setOpen(false)
    setInput('')
    setError(null)
    setResult(null)
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

  if (!open) {
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

  return (
    <div className={cn('space-y-3 rounded-xl border border-slate-100 bg-slate-50/80 p-3', className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Search by team ID</p>
        <button
          type="button"
          disabled={disabled || searching}
          className="shrink-0 text-xs font-semibold text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
          onClick={closePanel}
        >
          Cancel
        </button>
      </div>
      <div className="flex gap-2">
        <div
          className={cn(
            'flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-3',
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
            autoFocus
            onChange={(e) => {
              setInput(e.target.value.replace(/\D/g, '').slice(0, 6))
              setError(null)
              setResult(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void runSearch()
              }
            }}
            aria-label="Team ID"
            className="h-9 flex-1 border-0 bg-transparent px-0 py-0 font-mono text-slate-900 shadow-none focus-visible:ring-0 md:text-sm"
          />
        </div>
        <Button
          type="button"
          variant="default"
          className="h-11 shrink-0 rounded-xl px-4"
          disabled={disabled || searching}
          onClick={() => void runSearch()}
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
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {result ? (
        <button
          type="button"
          disabled={disabled}
          className="flex w-full items-center gap-3 rounded-xl border border-primary/30 bg-white px-3 py-3 text-left shadow-sm transition-colors hover:bg-primary/5"
          onClick={() => onSelect(result)}
        >
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-slate-900">{result.name}</p>
            <p className="mt-0.5 text-xs text-slate-500">
              ID {formatTeamNumber(result.teamNumber!)} · {result.players.length} players
              {result.location ? ` · ${result.location}` : ''}
            </p>
          </div>
          <span className="text-xs font-semibold text-primary">Select</span>
        </button>
      ) : null}
    </div>
  )
}
