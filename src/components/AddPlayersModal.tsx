import { ChevronDown, Info, Plus, Search, UserPlus, X } from 'lucide-react'
import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import type { RosterPlayer } from '../types/models'
import { canSearchDirectory, searchDirectoryUsers, type DirectoryHit } from '../lib/directorySearch'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { tournamentModalFooterSinglePrimaryButtonClass } from './tournament/tournamentModalFooterButtons'

const SEARCH_LIMIT = 10
const DIRECTORY_SEARCH_HINT = `Min. 2 letters (name/email) or 4 digits (mobile). Showing up to ${SEARCH_LIMIT} matches.`
/** Max visible results height (~1.75 rows), then scroll. */
const RESULTS_SCROLL_MAX_H = 'calc(1.75 * 3.25rem)'

type Props = {
  open: boolean
  onClose: () => void
  roster: RosterPlayer[]
  onAddPlayers: (players: RosterPlayer[]) => void
  /** When set, staging new players stops at this roster total (e.g. match `squadSize`). */
  maxRosterSize?: number
}

function directoryHitLabel(h: DirectoryHit): string {
  const name = h.displayName.trim() || 'Player'
  const email = h.email?.trim()
  return email ? `${name} (${email})` : name
}

function hitToPlayer(h: DirectoryHit): RosterPlayer {
  return { playerId: h.uid, name: h.displayName }
}

export function AddPlayersModal({ open, onClose, roster, onAddPlayers, maxRosterSize }: Props) {
  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')
  const [loading, setLoading] = useState(false)
  const [hits, setHits] = useState<DirectoryHit[]>([])
  const [error, setError] = useState<string | null>(null)
  const [staged, setStaged] = useState<RosterPlayer[]>([])
  const [selectedOpen, setSelectedOpen] = useState(false)
  const [searchHintOpen, setSearchHintOpen] = useState(false)
  const searchHintId = useId()

  const rosterIds = useMemo(() => new Set(roster.map((p) => p.playerId)), [roster])
  const stagedIds = useMemo(() => new Set(staged.map((p) => p.playerId)), [staged])

  const extraSlots = useMemo(() => {
    if (maxRosterSize === undefined) return Number.POSITIVE_INFINITY
    return Math.max(0, maxRosterSize - roster.length)
  }, [maxRosterSize, roster.length])

  const canStageMore = staged.length < extraSlots

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(q), 300)
    return () => window.clearTimeout(t)
  }, [q])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const run = async () => {
      setError(null)
      if (!canSearchDirectory(debounced)) {
        setHits([])
        setLoading(false)
        return
      }
      setLoading(true)
      try {
        const list = await searchDirectoryUsers(debounced, SEARCH_LIMIT)
        if (!cancelled) setHits(list)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Search failed')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [debounced, open])

  useEffect(() => {
    if (!open) {
      setQ('')
      setDebounced('')
      setHits([])
      setError(null)
      setStaged([])
      setSelectedOpen(false)
      setSearchHintOpen(false)
    }
  }, [open])

  const addToStaged = useCallback(
    (h: DirectoryHit) => {
      const id = h.uid
      if (rosterIds.has(id) || stagedIds.has(id)) return
      setStaged((prev) => {
        const cap =
          maxRosterSize === undefined ? Number.POSITIVE_INFINITY : Math.max(0, maxRosterSize - roster.length)
        if (prev.length >= cap) return prev
        return [...prev, hitToPlayer(h)]
      })
    },
    [maxRosterSize, roster.length, rosterIds, stagedIds],
  )

  const removeStaged = useCallback((playerId: string) => {
    setStaged((prev) => prev.filter((p) => p.playerId !== playerId))
  }, [])

  const handleDone = useCallback(() => {
    if (staged.length > 0) {
      const cap =
        maxRosterSize === undefined ? staged.length : Math.max(0, maxRosterSize - roster.length)
      onAddPlayers(staged.slice(0, cap))
    }
    onClose()
  }, [maxRosterSize, onAddPlayers, onClose, roster.length, staged])

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
        className="flex max-h-[min(90dvh,640px)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-players-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="relative border-b border-slate-100 px-5 pb-4 pt-5">
          <button
            type="button"
            className="absolute top-4 right-4 inline-flex size-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
            aria-label="Close"
            onClick={onClose}
          >
            <X className="size-4" strokeWidth={2.2} />
          </button>
          <div className="flex items-start gap-3 pr-10">
            <div
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
              aria-hidden
            >
              <UserPlus className="size-5" strokeWidth={2} />
            </div>
            <div className="min-w-0 leading-tight">
              <h2 id="add-players-title" className="text-lg font-bold text-slate-900">
                Add player from directory
              </h2>
              <p className="mt-1 text-sm text-slate-500">Search and add registered ScoreTrack users</p>
              {maxRosterSize !== undefined && (
                <p className="mt-2 text-sm font-semibold text-primary">
                  Roster {roster.length}/{maxRosterSize}
                  {extraSlots === 0
                    ? ' — full'
                    : ` — ${extraSlots} slot${extraSlots === 1 ? '' : 's'} left`}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-5 py-4">
          <div className="shrink-0 space-y-2">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  'flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border-2 border-primary bg-white px-3 shadow-sm transition-shadow',
                  'focus-within:ring-[3px] focus-within:ring-primary/15',
                )}
              >
                <Search className="size-4 shrink-0 text-slate-400" aria-hidden />
                <Input
                  type="text"
                  autoFocus
                  autoComplete="off"
                  placeholder="Name, email, or mobile"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  aria-label="Search directory"
                  className="h-9 flex-1 border-0 bg-transparent px-0 py-0 text-slate-900 shadow-none placeholder:text-placeholder-foreground focus-visible:ring-0 md:text-sm"
                />
                <button
                  type="button"
                  className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  aria-label="Clear search"
                  onClick={() => setQ('')}
                >
                  <X className="size-3.5" strokeWidth={2.5} />
                </button>
              </div>
              <button
                type="button"
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                aria-label="Directory search tips"
                aria-expanded={searchHintOpen}
                aria-controls={searchHintId}
                onClick={() => setSearchHintOpen((o) => !o)}
              >
                <Info className="size-4" strokeWidth={2.2} aria-hidden />
              </button>
            </div>
            <div
              id={searchHintId}
              role="region"
              aria-live="polite"
              hidden={!searchHintOpen}
              className="relative rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5 pr-9 text-xs leading-relaxed text-slate-600"
            >
              <button
                type="button"
                className="absolute right-2 top-2 inline-flex size-5 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700"
                aria-label="Close search tips"
                onClick={() => setSearchHintOpen(false)}
              >
                <X className="size-3.5" strokeWidth={2.5} aria-hidden />
              </button>
              {DIRECTORY_SEARCH_HINT}
            </div>
          </div>

          {maxRosterSize !== undefined && extraSlots === 0 && (
            <p className="shrink-0 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              This squad already has the maximum players allowed. Remove someone from the match squad list to add
              others.
            </p>
          )}

          {error && (
            <p className="shrink-0 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <div
            className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pr-1"
            style={hits.length > 0 ? { maxHeight: RESULTS_SCROLL_MAX_H } : undefined}
          >
            {loading && <p className="py-6 text-center text-sm text-slate-500">Searching…</p>}
            {!loading && !canSearchDirectory(debounced) && (
              <p className="py-4 text-center text-sm text-slate-500">
                Type at least two letters or four digits to search.
              </p>
            )}
            {!loading && canSearchDirectory(debounced) && hits.length === 0 && !error && (
              <p className="py-4 text-center text-sm text-slate-500">No matches. Try another spelling.</p>
            )}
            {!loading &&
              hits.map((h) => {
                const inRoster = rosterIds.has(h.uid)
                const inStaged = stagedIds.has(h.uid)
                const addBlocked = !canStageMore && !inStaged && !inRoster
                return (
                  <div
                    key={h.uid}
                    className="flex items-center gap-2 rounded-xl border border-slate-100 bg-white px-3 py-2.5 shadow-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-slate-900">
                        <span className="font-semibold">{h.displayName}</span>
                        {h.email ? (
                          <span className="font-normal text-slate-500"> ({h.email})</span>
                        ) : null}
                      </p>
                      {addBlocked ? (
                        <p className="mt-0.5 text-xs font-medium text-amber-700">Roster limit reached</p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      disabled={inRoster || inStaged || addBlocked}
                      className={cn(
                        'flex size-9 shrink-0 items-center justify-center rounded-lg border-2 transition-colors',
                        inRoster || inStaged || addBlocked
                          ? 'cursor-not-allowed border-slate-200 text-slate-300'
                          : 'border-primary text-primary hover:bg-primary/5',
                      )}
                      aria-label={
                        inStaged
                          ? 'Added'
                          : inRoster
                            ? 'Already in squad'
                            : addBlocked
                              ? 'Roster full'
                              : `Add ${directoryHitLabel(h)}`
                      }
                      onClick={() => addToStaged(h)}
                    >
                      <Plus className="size-4" strokeWidth={2.5} />
                    </button>
                  </div>
                )
              })}
          </div>

          <div className="shrink-0 -mx-5 w-auto min-w-0 border-y border-slate-200 bg-slate-50/50">
            <button
              type="button"
              className="flex w-full min-w-0 items-center justify-between gap-2 px-5 py-3 text-left"
              aria-expanded={selectedOpen}
              onClick={() => setSelectedOpen((o) => !o)}
            >
              <span className="min-w-0 text-sm font-bold text-slate-900">
                Selected players ({staged.length})
              </span>
              <ChevronDown
                className={cn('size-4 shrink-0 text-slate-500 transition-transform', selectedOpen && 'rotate-180')}
                aria-hidden
              />
            </button>
            {selectedOpen && (
              <div className="border-t border-slate-200 px-5 pb-3 pt-1">
                {staged.length === 0 ? (
                  <p className="py-3 text-center text-sm text-slate-500">Players you add will appear here.</p>
                ) : (
                  <ul className="max-h-36 space-y-2 overflow-y-auto">
                    {staged.map((p) => (
                      <li
                        key={p.playerId}
                        className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-white px-2 py-2"
                      >
                        <span className="min-w-0 truncate text-sm font-medium text-slate-900">{p.name}</span>
                        <button
                          type="button"
                          className="shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          aria-label={`Remove ${p.name}`}
                          onClick={() => removeStaged(p.playerId)}
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
        </div>

        <div className="border-t border-slate-100 p-4">
          <Button
            type="button"
            className={tournamentModalFooterSinglePrimaryButtonClass}
            onClick={handleDone}
          >
            Done
          </Button>
        </div>
      </div>
    </div>
  )
}
