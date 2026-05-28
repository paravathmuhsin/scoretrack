import { ChevronDown, Info, Plus, Search, X } from 'lucide-react'
import { useEffect, useId, useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

/** Match AddPlayersModal results strip height */
const RESULTS_SCROLL_MAX_H = 'calc(1.75 * 5rem)'
const GROUP_TEAMS_HINT = 'Search linked squads and add them — choose at least two for this pool.'

export type GroupTeamPickRow = {
  id: string
  label: string
}

function teamInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase()
  const w = parts[0] ?? ''
  return w.slice(0, 2).toUpperCase() || '?'
}

type Props = {
  teams: GroupTeamPickRow[]
  selectedIds: Set<string>
  onAdd: (id: string) => void
  onRemove: (id: string) => void
  disabled?: boolean
  /** When this value changes, search input clears and “selected” panel expands (e.g. dialog open or edit target id). */
  resetSignal?: string | number | boolean
  headingId?: string
  className?: string
  /** Pull the selected strip flush with modal horizontal padding (parent uses `px-5`). */
  bleedSelectedStrip?: boolean
}

export function TournamentGroupTeamsPicker({
  teams,
  selectedIds,
  onAdd,
  onRemove,
  disabled = false,
  resetSignal,
  headingId,
  className,
  bleedSelectedStrip = false,
}: Props) {
  const [q, setQ] = useState('')
  const [selectedOpen, setSelectedOpen] = useState(true)
  const [teamsHintOpen, setTeamsHintOpen] = useState(false)
  const teamsHintId = useId()

  useEffect(() => {
    setQ('')
    setSelectedOpen(true)
    setTeamsHintOpen(false)
  }, [resetSignal])

  const needle = q.trim().toLowerCase()

  const unselected = useMemo(() => teams.filter((t) => !selectedIds.has(t.id)), [teams, selectedIds])

  const available = useMemo(
    () => unselected.filter((t) => !needle || t.label.toLowerCase().includes(needle)),
    [unselected, needle],
  )

  const selectedRows = useMemo(() => {
    const rows = teams.filter((t) => selectedIds.has(t.id))
    rows.sort((a, b) => a.label.localeCompare(b.label))
    return rows
  }, [teams, selectedIds])

  const showResultsHelp =
    teams.length > 0 && available.length === 0 && unselected.length > 0 && Boolean(needle)

  const showAllAdded = teams.length > 0 && unselected.length === 0

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col gap-3 overflow-hidden', className)}>
      <div className="min-w-0 shrink-0 leading-tight">
        <div className="flex items-center gap-1">
          <p id={headingId} className="text-sm font-semibold text-slate-900">
            Add teams to this group
          </p>
          <button
            type="button"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:pointer-events-none disabled:opacity-40"
            aria-label="About adding teams to this group"
            aria-expanded={teamsHintOpen}
            aria-controls={teamsHintId}
            disabled={disabled}
            onClick={() => setTeamsHintOpen((o) => !o)}
          >
            <Info className="size-4" strokeWidth={2.2} aria-hidden />
          </button>
        </div>
        <div
          id={teamsHintId}
          role="region"
          aria-live="polite"
          hidden={!teamsHintOpen}
          className="relative mt-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5 pr-9 text-xs leading-relaxed text-slate-600"
        >
          <button
            type="button"
            className="absolute right-2 top-2 inline-flex size-5 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700"
            aria-label="Close adding teams tips"
            onClick={() => setTeamsHintOpen(false)}
          >
            <X className="size-3.5" strokeWidth={2.5} aria-hidden />
          </button>
          {GROUP_TEAMS_HINT}
        </div>
      </div>

      {teams.length === 0 ? (
        <p className="text-sm text-slate-500">Link teams on the Teams tab first.</p>
      ) : (
        <>
          <div
            className={cn(
              'flex h-11 shrink-0 items-center gap-2 rounded-xl border-2 border-primary bg-white px-3 shadow-sm transition-shadow',
              'focus-within:ring-[3px] focus-within:ring-primary/15',
              disabled && 'pointer-events-none opacity-60',
            )}
          >
            <Search className="size-4 shrink-0 text-slate-400" aria-hidden />
            <Input
              type="text"
              autoComplete="off"
              placeholder="Search team name"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search teams to add"
              disabled={disabled}
              className="h-9 flex-1 border-0 bg-transparent px-0 py-0 text-slate-900 shadow-none placeholder:text-placeholder-foreground focus-visible:ring-0 md:text-sm"
            />
            <button
              type="button"
              className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:pointer-events-none disabled:opacity-40"
              aria-label="Clear search"
              disabled={disabled || !q}
              onClick={() => setQ('')}
            >
              <X className="size-3.5" strokeWidth={2.5} />
            </button>
          </div>

          <div
            className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pr-1"
            style={available.length > 0 ? { maxHeight: RESULTS_SCROLL_MAX_H } : undefined}
          >
            {showResultsHelp && (
              <p className="py-4 text-center text-sm text-slate-500">No matching teams. Try another search.</p>
            )}
            {showAllAdded && (
              <p className="py-4 text-center text-sm text-slate-500">All linked teams are in this group.</p>
            )}
            {available.map((t) => (
              <div
                key={t.id}
                className="flex min-h-[5rem] items-center gap-3 rounded-xl border border-slate-100 bg-white px-3 py-3 shadow-sm"
              >
                <div
                  className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary"
                  aria-hidden
                >
                  {teamInitials(t.label)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-900">{t.label}</p>
                </div>
                <button
                  type="button"
                  disabled={disabled}
                  className={cn(
                    'flex size-10 shrink-0 items-center justify-center rounded-lg border-2 transition-colors',
                    disabled
                      ? 'cursor-not-allowed border-slate-200 text-slate-300'
                      : 'border-primary text-primary hover:bg-primary/5',
                  )}
                  aria-label={`Add ${t.label}`}
                  onClick={() => onAdd(t.id)}
                >
                  <Plus className="size-5" strokeWidth={2.5} />
                </button>
              </div>
            ))}
          </div>

          <div
            className={cn(
              'shrink-0 w-auto min-w-0 border-y border-slate-200 bg-slate-50/50',
              bleedSelectedStrip && '-mx-5',
            )}
          >
            <button
              type="button"
              className="flex w-full min-w-0 items-center justify-between gap-2 px-5 py-3 text-left"
              aria-expanded={selectedOpen}
              disabled={disabled}
              onClick={() => setSelectedOpen((o) => !o)}
            >
              <span className="min-w-0 text-sm font-bold text-slate-900">
                Selected teams ({selectedRows.length})
              </span>
              <ChevronDown
                className={cn('size-4 shrink-0 text-slate-500 transition-transform', selectedOpen && 'rotate-180')}
                aria-hidden
              />
            </button>
            {selectedOpen && (
              <div className="border-t border-slate-200 px-5 pb-3 pt-1">
                {selectedRows.length === 0 ? (
                  <p className="py-3 text-center text-sm text-slate-500">Teams you add will appear here.</p>
                ) : (
                  <ul className="max-h-36 space-y-2 overflow-y-auto">
                    {selectedRows.map((t) => (
                      <li
                        key={t.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-white px-2 py-2"
                      >
                        <span className="min-w-0 truncate text-sm font-medium text-slate-900">{t.label}</span>
                        <button
                          type="button"
                          className="shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:pointer-events-none disabled:opacity-40"
                          aria-label={`Remove ${t.label}`}
                          disabled={disabled}
                          onClick={() => onRemove(t.id)}
                        >
                          <X className="size-4" strokeWidth={2} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
