import { Loader2, Plus, Search, Users, X } from 'lucide-react'
import type { RefObject } from 'react'
import { Link } from 'react-router-dom'
import type { TeamDoc } from '../../types/models'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { tournamentModalFooterSinglePrimaryButtonClass } from './tournamentModalFooterButtons'

/** Match AddPlayersModal / squad picker results scroll cap */
const RESULTS_SCROLL_MAX_H = 'calc(1.75 * 5rem)'

function teamInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase()
  const s = parts[0] ?? '?'
  return s.slice(0, 2).toUpperCase()
}

export type TournamentAddSquadDialogContentProps = {
  titleId: string
  search: string
  onSearchChange: (v: string) => void
  searchInputRef: RefObject<HTMLInputElement | null>
  linkableTeams: (TeamDoc & { id: string })[]
  filteredLinkableTeams: (TeamDoc & { id: string })[]
  hasAnySquads: boolean
  /** When set, how many more squads can be linked before the tournament limit. */
  teamSlotsRemaining: number | null
  writePending: boolean
  linkingSquadId: string | null
  error: string | null
  onSelectSquad: (teamId: string) => void
  onClose: () => void
}

export function TournamentAddSquadDialogContent({
  titleId,
  search,
  onSearchChange,
  searchInputRef,
  linkableTeams,
  filteredLinkableTeams,
  hasAnySquads,
  teamSlotsRemaining,
  writePending,
  linkingSquadId,
  error,
  onSelectSquad,
  onClose,
}: TournamentAddSquadDialogContentProps) {
  const subtitle =
    teamSlotsRemaining != null
      ? teamSlotsRemaining === 0
        ? 'This tournament has no open squad slots.'
        : `Tap squads to add them (${teamSlotsRemaining} slot${teamSlotsRemaining === 1 ? '' : 's'} left). Close when finished.`
      : 'Tap squads to add them. You can add several without closing this dialog.'
  const createSquadFooter = (
    <div className="border-t border-slate-100 px-5 py-4">
      <Link
        to="/app/teams/new"
        className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-3 transition-colors hover:bg-slate-100/80"
        onClick={onClose}
      >
        <span
          className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
          aria-hidden
        >
          <Plus className="size-6" strokeWidth={2.5} />
        </span>
        <span className="min-w-0">
          <span className="block font-bold text-slate-900">Need a new squad?</span>
          <span className="mt-0.5 block text-sm text-slate-500">Create one, then open this dialog again</span>
        </span>
      </Link>
    </div>
  )

  const emptyNoSquads = (
    <div className="flex flex-col gap-4 px-5 py-4">
      <p className="text-sm leading-relaxed text-slate-600">
        You have no squads yet. Create one in{' '}
        <Link
          to="/app/teams/new"
          className="font-semibold text-primary underline-offset-2 hover:underline"
          onClick={onClose}
        >
          My teams
        </Link>
        , then return here to link it to this tournament.
      </p>
    </div>
  )

  const emptyAllLinked = (
    <div className="flex flex-col gap-4 px-5 py-4">
      <p className="text-sm leading-relaxed text-slate-600">
        All of your squads are already linked to this tournament. Remove one from the grid to swap in a different squad.
      </p>
    </div>
  )

  return (
    <div className="flex max-h-[min(90dvh,640px)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-2xl outline-none">
      <div className="relative border-b border-slate-100 px-5 pb-4 pt-5">
        <button
          type="button"
          className="absolute top-4 right-4 inline-flex size-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
          aria-label="Close"
          onClick={onClose}
        >
          <X className="size-4" strokeWidth={2.2} aria-hidden />
        </button>
        <div className="flex items-start gap-3 pr-10">
          <div
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
            aria-hidden
          >
            <Users className="size-5" strokeWidth={2} />
          </div>
          <div className="min-w-0 leading-tight">
            <h2 id={titleId} className="text-lg font-bold tracking-tight text-slate-900">
              Add squad to tournament
            </h2>
            <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          </div>
        </div>
      </div>

      {!hasAnySquads ? (
        <>
          {emptyNoSquads}
          {createSquadFooter}
        </>
      ) : linkableTeams.length === 0 ? (
        <>
          {emptyAllLinked}
          {createSquadFooter}
        </>
      ) : (
        <>
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-5 py-4">
            <div
              className={cn(
                'flex h-11 shrink-0 items-center gap-2 rounded-xl border-2 border-primary bg-white px-3 shadow-sm transition-shadow',
                'focus-within:ring-[3px] focus-within:ring-primary/15',
              )}
            >
              <Search className="size-4 shrink-0 text-slate-400" aria-hidden />
              <Input
                ref={searchInputRef}
                type="search"
                autoComplete="off"
                autoFocus
                placeholder="Search your squads by name…"
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                aria-label="Search squads"
                className="h-9 flex-1 border-0 bg-transparent px-0 py-0 text-slate-900 shadow-none placeholder:text-slate-500 focus-visible:ring-0 md:text-sm"
              />
              {search ? (
                <button
                  type="button"
                  className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  aria-label="Clear search"
                  onClick={() => onSearchChange('')}
                >
                  <X className="size-3.5" strokeWidth={2.5} />
                </button>
              ) : null}
            </div>

            <p className="shrink-0 text-xs text-slate-400">Type to filter, then tap each squad to add it.</p>

            <p className="shrink-0 text-xs font-bold uppercase tracking-wider text-slate-400">Your squads</p>

            <div
              className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pr-1"
              role="listbox"
              aria-labelledby={titleId}
              style={filteredLinkableTeams.length > 0 ? { maxHeight: RESULTS_SCROLL_MAX_H } : undefined}
            >
              {filteredLinkableTeams.length === 0 ? (
                <p className="py-4 text-center text-sm text-slate-500">No squads match your search.</p>
              ) : (
                <ul className="m-0 list-none space-y-2 p-0">
                  {filteredLinkableTeams.map((s) => {
                    const isLinking = linkingSquadId === s.id
                    return (
                    <li key={s.id} role="presentation">
                      <button
                        type="button"
                        className={cn(
                          'flex min-h-[5rem] w-full items-center gap-3 rounded-xl border border-slate-100 bg-white px-3 py-3 text-left shadow-sm transition-colors hover:bg-slate-50/90 disabled:opacity-55',
                          isLinking && 'border-primary/30 bg-primary/5',
                        )}
                        disabled={writePending}
                        aria-busy={isLinking}
                        onClick={() => onSelectSquad(s.id)}
                      >
                        <div
                          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary"
                          aria-hidden
                        >
                          {teamInitials(s.name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-slate-900">{s.name}</p>
                          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                            {isLinking ? (
                              <>
                                <Loader2 className="size-3 shrink-0 animate-spin text-primary" aria-hidden />
                                Adding…
                              </>
                            ) : (
                              <>
                                <Users className="size-3 shrink-0 text-slate-400" aria-hidden />
                                {s.players.length} {s.players.length === 1 ? 'player' : 'players'}
                              </>
                            )}
                          </p>
                        </div>
                        <span
                          className={cn(
                            'flex size-9 shrink-0 items-center justify-center rounded-full',
                            isLinking ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-500',
                          )}
                          aria-hidden
                        >
                          {isLinking ? (
                            <Loader2 className="size-4 animate-spin" strokeWidth={2.2} />
                          ) : (
                            <Plus className="size-4" strokeWidth={2.5} />
                          )}
                        </span>
                      </button>
                    </li>
                    )
                  })}
                </ul>
              )}
            </div>

            {error ? (
              <p className="shrink-0 text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
          </div>

          <div className="border-t border-slate-100 px-5 py-4">
            <Button
              type="button"
              variant="default"
              className={tournamentModalFooterSinglePrimaryButtonClass}
              disabled={writePending}
              onClick={onClose}
            >
              Done
            </Button>
          </div>

          {createSquadFooter}
        </>
      )}
    </div>
  )
}
