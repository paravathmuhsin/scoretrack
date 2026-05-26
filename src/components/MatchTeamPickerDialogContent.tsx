import { CalendarDays, ChevronRight, House, Plus, Search, Users, X } from 'lucide-react'
import type { RefObject } from 'react'
import { Link } from 'react-router-dom'
import type { SelectableUserTeam } from '../hooks/useSelectableUserTeams'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

/** Match AddPlayersModal results area scroll cap */
const RESULTS_SCROLL_MAX_H = 'calc(1.75 * 5rem)'

function teamInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase()
  const s = parts[0] ?? '?'
  return s.slice(0, 2).toUpperCase()
}

export type MatchTeamPickerDialogContentProps = {
  titleId: string
  pickerSide: 'A' | 'B' | null
  pickerSearch: string
  onPickerSearchChange: (v: string) => void
  searchInputRef: RefObject<HTMLInputElement | null>
  pickerOptions: SelectableUserTeam[]
  filteredPickerOptions: SelectableUserTeam[]
  excludeId: string
  tournamentId: string | null | undefined
  onSelectTeam: (teamId: string) => void
  onClose: () => void
}

export function MatchTeamPickerDialogContent({
  titleId,
  pickerSide,
  pickerSearch,
  onPickerSearchChange,
  searchInputRef,
  pickerOptions,
  filteredPickerOptions,
  excludeId,
  tournamentId,
  onSelectTeam,
  onClose,
}: MatchTeamPickerDialogContentProps) {
  const title =
    pickerSide === 'A' ? 'SELECT HOME TEAM' : pickerSide === 'B' ? 'SELECT AWAY TEAM' : 'SELECT TEAM'
  const subtitle =
    pickerSide === 'A'
      ? 'Choose a team to play as the home team.'
      : pickerSide === 'B'
        ? 'Choose a team to play as the away team.'
        : 'Choose a squad for this match.'

  const HeaderIcon = pickerSide === 'B' ? CalendarDays : House

  const emptyBody = (
    <div className="flex flex-col gap-4 px-5 py-4">
      <p className="text-sm leading-relaxed text-slate-600">
        No squads available{excludeId ? ' (other side already uses that squad)' : ''}.{' '}
        {tournamentId ? (
          <>
            Link squads on <strong>Tournament → Teams</strong> or open{' '}
            <Link
              to="/app/teams"
              className="font-semibold text-primary underline-offset-2 hover:underline"
              onClick={onClose}
            >
              My teams
            </Link>
            .
          </>
        ) : (
          <Link
            to="/app/teams"
            className="font-semibold text-primary underline-offset-2 hover:underline"
            onClick={onClose}
          >
            Add squads in My teams
          </Link>
        )}
      </p>
    </div>
  )

  const addTeamFooter = (
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
          <span className="block font-bold text-slate-900">Can&apos;t find your team?</span>
          <span className="mt-0.5 block text-sm text-slate-500">Add a new team to continue</span>
        </span>
      </Link>
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
            <HeaderIcon className="size-5" strokeWidth={2} />
          </div>
          <div className="min-w-0 leading-tight">
            <h2 id={titleId} className="text-lg font-bold tracking-tight text-slate-900">
              {title}
            </h2>
            <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          </div>
        </div>
      </div>

      {pickerOptions.length === 0 ? (
        <>
          {emptyBody}
          {addTeamFooter}
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
                type="text"
                autoComplete="off"
                placeholder="Search teams..."
                value={pickerSearch}
                onChange={(e) => onPickerSearchChange(e.target.value)}
                aria-label="Search teams"
                className="h-9 flex-1 border-0 bg-transparent px-0 py-0 text-slate-900 shadow-none placeholder:text-placeholder-foreground focus-visible:ring-0 md:text-sm"
              />
            </div>

            <p className="shrink-0 text-xs text-slate-400">Type to filter your squads by name.</p>

            <p className="shrink-0 text-xs font-bold uppercase tracking-wider text-slate-400">All teams</p>

            <div
              className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pr-1"
              style={filteredPickerOptions.length > 0 ? { maxHeight: RESULTS_SCROLL_MAX_H } : undefined}
            >
              {filteredPickerOptions.length === 0 ? (
                <p className="py-4 text-center text-sm text-slate-500">No squads match your search.</p>
              ) : (
                <ul className="m-0 list-none space-y-2 p-0">
                  {filteredPickerOptions.map((t) => (
                    <li key={`${t.ownerUid}_${t.id}`}>
                      <button
                        type="button"
                        className="flex min-h-[5rem] w-full items-center gap-3 rounded-xl border border-slate-100 bg-white px-3 py-3 text-left shadow-sm transition-colors hover:bg-slate-50/90"
                        onClick={() => onSelectTeam(t.id)}
                      >
                        <div
                          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary"
                          aria-hidden
                        >
                          {teamInitials(t.name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-slate-900">{t.name}</p>
                          {t.isCoOwned ? (
                            <p className="mt-0.5">
                              <span className="inline-flex rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                                Co-owner
                              </span>
                            </p>
                          ) : null}
                          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                            <Users className="size-3 shrink-0 text-slate-400" aria-hidden />
                            {t.players.length} {t.players.length === 1 ? 'player' : 'players'}
                          </p>
                        </div>
                        <ChevronRight className="size-5 shrink-0 text-slate-400" strokeWidth={2} aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {addTeamFooter}
        </>
      )}
    </div>
  )
}
