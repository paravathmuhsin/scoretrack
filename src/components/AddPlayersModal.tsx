import { Info, Plus, Search, X } from 'lucide-react'
import { ModalDialogHeader } from '@/components/ModalDialogHeader'
import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { RosterPlayer } from '../types/models'
import { canSearchDirectory, searchDirectoryUsers, type DirectoryHit } from '../lib/directorySearch'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { tournamentModalFooterSinglePrimaryButtonClass } from './tournament/tournamentModalFooterButtons'

const SEARCH_LIMIT = 10
const DIRECTORY_SEARCH_HINT = `Min. 2 letters (name/email) or 4 digits (mobile). Showing up to ${SEARCH_LIMIT} matches.`
/** Max visible results height (~4 compact rows), then scroll. */
const RESULTS_SCROLL_MAX_H = 'calc(4 * 2.5rem + 1.125rem)'
const STAGED_SCROLL_MAX_H = '9rem'

function scrollNeedsBottomFade(el: HTMLElement | null): boolean {
  if (!el) return false
  const canScroll = el.scrollHeight > el.clientHeight + 2
  const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 2
  return canScroll && !atBottom
}

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
  const [searchHintOpen, setSearchHintOpen] = useState(false)
  const [resultsScrollFade, setResultsScrollFade] = useState(false)
  const [stagedScrollFade, setStagedScrollFade] = useState(false)
  const resultsScrollRef = useRef<HTMLDivElement>(null)
  const stagedScrollRef = useRef<HTMLDivElement | null>(null)
  const searchHintId = useId()

  const updateResultsScrollFade = useCallback(() => {
    setResultsScrollFade(scrollNeedsBottomFade(resultsScrollRef.current))
  }, [])

  const updateStagedScrollFade = useCallback(() => {
    setStagedScrollFade(scrollNeedsBottomFade(stagedScrollRef.current))
  }, [])

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
    updateResultsScrollFade()
  }, [hits, loading, debounced, updateResultsScrollFade])

  useEffect(() => {
    updateStagedScrollFade()
  }, [staged, updateStagedScrollFade])

  useEffect(() => {
    if (!open) {
      setQ('')
      setDebounced('')
      setHits([])
      setError(null)
      setStaged([])
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
        <ModalDialogHeader
          titleId="add-players-title"
          title="Add player from directory"
          onClose={onClose}
        />

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-5 py-4">
          {maxRosterSize !== undefined && (
            <p className="shrink-0 text-sm font-semibold text-primary">
              Roster {roster.length}/{maxRosterSize}
              {extraSlots === 0 ? ' — full' : ` — ${extraSlots} slot${extraSlots === 1 ? '' : 's'} left`}
            </p>
          )}
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
            className="relative min-h-0 shrink-0 overflow-hidden"
            style={hits.length > 0 ? ({ maxHeight: RESULTS_SCROLL_MAX_H } satisfies CSSProperties) : undefined}
          >
            <div
              ref={resultsScrollRef}
              className="h-full space-y-1.5 overflow-y-auto overscroll-contain pr-1"
              style={hits.length > 0 ? ({ maxHeight: RESULTS_SCROLL_MAX_H } satisfies CSSProperties) : undefined}
              onScroll={updateResultsScrollFade}
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
                    className="flex items-center gap-1.5 rounded-md border border-slate-100 bg-white px-2.5 py-1 shadow-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs leading-tight text-slate-900">
                        <span className="font-semibold">{h.displayName}</span>
                        {h.email ? (
                          <span className="font-normal text-slate-500"> ({h.email})</span>
                        ) : null}
                      </p>
                      {addBlocked ? (
                        <p className="mt-0.5 text-[11px] font-medium leading-tight text-amber-700">
                          Roster limit reached
                        </p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      disabled={inRoster || inStaged || addBlocked}
                      className={cn(
                        'flex size-7 shrink-0 items-center justify-center rounded-md border-2 transition-colors',
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
                      <Plus className="size-3.5" strokeWidth={2.5} />
                    </button>
                  </div>
                )
              })}
            </div>
            {resultsScrollFade ? (
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white via-white/85 to-transparent"
                aria-hidden
              />
            ) : null}
          </div>
          </div>

          <div className="relative z-10 shrink-0 border-t border-slate-200 bg-slate-50 px-5 py-3">
            <h3 className="text-sm font-bold text-slate-900">Selected players ({staged.length})</h3>
            {staged.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">Players you add will appear here.</p>
            ) : (
              <div
                className="relative mt-2 overflow-hidden"
                style={{ maxHeight: STAGED_SCROLL_MAX_H }}
              >
                <div
                  ref={stagedScrollRef}
                  className="overflow-y-auto overscroll-contain pr-1"
                  style={{ maxHeight: STAGED_SCROLL_MAX_H }}
                  onScroll={updateStagedScrollFade}
                >
                  <ul className="flex flex-wrap gap-1.5 pb-3">
                    {staged.map((p) => (
                      <li key={p.playerId} className="w-fit max-w-full">
                        <div className="flex w-fit max-w-full items-center gap-1.5 rounded-md border border-slate-100 bg-white px-2 py-0.5 shadow-sm">
                          <span className="max-w-[min(100%,18rem)] text-xs font-medium leading-tight text-slate-900 line-clamp-1">
                            {p.name}
                          </span>
                          <button
                            type="button"
                            className="inline-flex size-6 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                            aria-label={`Remove ${p.name}`}
                            onClick={() => removeStaged(p.playerId)}
                          >
                            <X className="size-3.5" strokeWidth={2.25} aria-hidden />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
                {stagedScrollFade ? (
                  <div
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-slate-50 via-slate-50/75 to-transparent"
                    aria-hidden
                  />
                ) : null}
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
