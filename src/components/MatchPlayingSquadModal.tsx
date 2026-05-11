import { Search, Users, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { RosterPlayer } from '../types/models'
import { SQUAD_TILE_GRID_CLASS } from '@/lib/playingSquadTiles'
import { SquadPickTile } from './PlayingSquadTiles'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type Props = {
  open: boolean
  onClose: () => void
  teamName: string
  players: RosterPlayer[]
  maxCount: number
  /** Current selection (controlled when opening). */
  selectedIds: string[]
  onConfirm: (ids: string[]) => void
}

function toggleId(list: string[], id: string, max: number): { next: string[]; blocked: boolean } {
  if (list.includes(id)) {
    return { next: list.filter((x) => x !== id), blocked: false }
  }
  if (list.length >= max) {
    return { next: list, blocked: true }
  }
  return { next: [...list, id], blocked: false }
}

export function MatchPlayingSquadModal({
  open,
  onClose,
  teamName,
  players,
  maxCount,
  selectedIds,
  onConfirm,
}: Props) {
  const [draft, setDraft] = useState(() => [...selectedIds])
  const [hint, setHint] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const filteredPlayers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return players
    return players.filter((p) => p.name.toLowerCase().includes(q))
  }, [players, searchQuery])

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
        aria-labelledby="match-squad-modal-title"
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
              className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
              aria-hidden
            >
              <Users className="size-5" strokeWidth={2} />
            </div>
            <div className="min-w-0 leading-tight">
              <h2 id="match-squad-modal-title" className="text-lg font-bold text-slate-900">
                {teamName} — playing squad
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Select up to <strong>{maxCount}</strong> players from this roster for the match.
              </p>
              <p className="mt-2 text-sm font-semibold text-primary">
                Selected {draft.length}/{maxCount}
              </p>
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="shrink-0 border-b border-slate-100 px-5 py-3">
            <div
              className={cn(
                'flex h-11 items-center gap-2 rounded-xl border-2 border-primary bg-white px-3 shadow-sm transition-shadow',
                'focus-within:ring-[3px] focus-within:ring-primary/15',
              )}
            >
              <Search className="size-4 shrink-0 text-slate-400" aria-hidden />
              <Input
                type="search"
                autoComplete="off"
                placeholder="Search players by name"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search roster"
                className="h-9 flex-1 border-0 bg-transparent px-0 py-0 text-slate-900 shadow-none placeholder:text-slate-500 focus-visible:ring-0 md:text-sm"
              />
              {searchQuery.trim() !== '' && (
                <button
                  type="button"
                  className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  aria-label="Clear search"
                  onClick={() => setSearchQuery('')}
                >
                  <X className="size-3.5" strokeWidth={2.5} />
                </button>
              )}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {hint && (
              <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                {hint}
              </p>
            )}
            {filteredPlayers.length === 0 ? (
              <p className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-8 text-center text-sm text-slate-600">
                {players.length === 0
                  ? 'No players in this roster.'
                  : `No players match “${searchQuery.trim()}”. Try another name or clear search.`}
              </p>
            ) : (
              <ul className={SQUAD_TILE_GRID_CLASS}>
                {filteredPlayers.map((p) => {
                  const selected = draft.includes(p.playerId)
                  return (
                    <SquadPickTile
                      key={p.playerId}
                      selected={selected}
                      name={p.name}
                      onToggle={() => {
                        setHint(null)
                        const { next, blocked } = toggleId(draft, p.playerId, maxCount)
                        setDraft(next)
                        if (blocked) {
                          setHint(`You can select at most ${maxCount} players.`)
                        }
                      }}
                    />
                  )
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-100 p-4 sm:flex-row">
          <Button
            type="button"
            className="order-1 h-11 w-full rounded-xl font-semibold !text-primary-foreground sm:order-2 sm:flex-1"
            onClick={() => onConfirm(draft)}
          >
            Done
          </Button>
          <Button
            type="button"
            variant="outline"
            className="order-2 h-11 w-full rounded-xl sm:order-1 sm:flex-1"
            onClick={onClose}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}
