import { Clock, Plus, Trash2, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatTeamNumber } from '../../lib/teamNumber'
import { teamAvatarHue, tournTeamCardAvatarLabel } from '../../lib/teamAvatarLabel'
import type { TeamDoc, TournamentLinkedTeamDoc } from '../../types/models'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Props = {
  tournamentEnded: boolean
  teamCount: number | null | undefined
  linkedTeams: (TournamentLinkedTeamDoc & { id: string })[]
  myTeams: (TeamDoc & { id: string })[]
  currentUserUid: string
  writePending: boolean
  error: string | null
  onAddSquad: () => void
  onRemoveSquad: (payload: { id: string; label: string }) => void
}

export function TournamentTeamsTab({
  tournamentEnded,
  teamCount,
  linkedTeams,
  myTeams,
  currentUserUid,
  writePending,
  error,
  onAddSquad,
  onRemoveSquad,
}: Props) {
  const slotsFull = teamCount != null && linkedTeams.length >= teamCount
  const canAdd = !tournamentEnded && !slotsFull
  const linkedCount = linkedTeams.length
  const progressPct =
    teamCount != null && teamCount > 0 ? Math.min(100, Math.round((linkedCount / teamCount) * 100)) : null

  return (
    <div role="tabpanel" aria-labelledby="tab-teams" className="space-y-5 px-4 pt-4 sm:px-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h2 className="text-base font-bold text-slate-900">Tournament squads</h2>
          <p className="text-sm text-slate-500">
            {tournamentEnded ? (
              'Squads linked for this tournament draw.'
            ) : (
              <>
                Squads live under <Link to="/app/teams">My teams</Link>; link them here for standings and fixtures.
              </>
            )}
          </p>
        </div>
        {canAdd ? (
          <Button
            type="button"
            variant="default"
            className="h-10 shrink-0 rounded-xl px-4 shadow-sm"
            disabled={writePending}
            onClick={onAddSquad}
          >
            <Plus className="size-4" strokeWidth={2.5} aria-hidden />
            Add squad
          </Button>
        ) : null}
      </div>

      {!tournamentEnded && teamCount != null ? (
        <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="font-semibold text-slate-800">
              {linkedCount} of {teamCount} {teamCount === 1 ? 'squad' : 'squads'} linked
            </span>
            {slotsFull ? (
              <span className="text-xs font-medium text-emerald-700">All slots filled</span>
            ) : (
              <span className="text-xs text-slate-500">
                {teamCount - linkedCount} slot{teamCount - linkedCount === 1 ? '' : 's'} left
              </span>
            )}
          </div>
          <div
            className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-slate-200"
            role="progressbar"
            aria-valuenow={linkedCount}
            aria-valuemin={0}
            aria-valuemax={teamCount}
            aria-label="Squads linked"
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300"
              style={{ width: `${progressPct ?? 0}%` }}
            />
          </div>
        </div>
      ) : null}

      {linkedTeams.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-12 text-center">
          <div
            className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"
            aria-hidden
          >
            <Users className="size-7" strokeWidth={2} />
          </div>
          <p className="mt-4 text-base font-semibold text-slate-900">No squads linked yet</p>
          <p className="mt-1 max-w-sm text-sm text-slate-500">
            {tournamentEnded
              ? 'This tournament has no linked squads on record.'
              : 'Add squads from My teams to build the draw and standings.'}
          </p>
          {canAdd ? (
            <Button
              type="button"
              variant="default"
              className="mt-5 h-10 rounded-xl px-5"
              disabled={writePending}
              onClick={onAddSquad}
            >
              <Plus className="size-4" strokeWidth={2.5} aria-hidden />
              Add squad
            </Button>
          ) : null}
          {!tournamentEnded && myTeams.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">
              <Link to="/app/teams/new" className="font-semibold text-primary underline-offset-2 hover:underline">
                Create a squad
              </Link>{' '}
              in My teams first.
            </p>
          ) : null}
        </div>
      ) : (
        <ul className="m-0 list-none overflow-hidden rounded-2xl border border-slate-100 bg-white p-0 shadow-sm">
          {linkedTeams.map((l, index) => {
            const ownerUid = l.userTeamOwnerUid ?? currentUserUid
            const squad = myTeams.find((m) => m.id === l.userTeamId && ownerUid === currentUserUid)
            const label = l.teamName ?? squad?.name ?? l.userTeamId
            const shortName = squad?.shortName?.trim() || l.teamShortName?.trim()
            const hue = teamAvatarHue(label)
            const pending = l.linkApprovalStatus === 'pending'
            const isExternal = ownerUid !== currentUserUid
            const editHref = `/app/teams/${l.userTeamId}`
            const playerCount = squad?.players.length
            const metaLine = [
              l.teamNumber != null ? `ID ${formatTeamNumber(l.teamNumber)}` : null,
              playerCount != null
                ? `${playerCount} ${playerCount === 1 ? 'player' : 'players'}`
                : ownerUid !== currentUserUid
                  ? 'External squad'
                  : null,
            ]
              .filter(Boolean)
              .join(' · ')

            return (
              <li
                key={l.id}
                className={cn(index > 0 && 'border-t border-slate-100')}
              >
                <div className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:gap-4">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div
                      className="flex size-12 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white shadow-sm"
                      style={{ background: `hsl(${hue} 42% 42%)` }}
                      aria-hidden
                    >
                      {tournTeamCardAvatarLabel({ name: label, shortName })}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-base font-semibold text-slate-900">{label}</p>
                        {pending ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200/80">
                            <Clock className="size-3 shrink-0" aria-hidden />
                            Awaiting approval
                          </span>
                        ) : null}
                      </div>
                      {metaLine ? (
                        <p className="mt-0.5 text-xs text-slate-500">{metaLine}</p>
                      ) : null}
                    </div>
                  </div>

                  {!tournamentEnded ? (
                    <div className="flex shrink-0 items-center gap-2 sm:ml-auto">
                      {!isExternal ? (
                        <Link
                          to={editHref}
                          className={cn(
                            buttonVariants({ variant: 'outline', size: 'default' }),
                            'h-9 flex-1 rounded-lg border-slate-200 bg-white text-sm font-medium sm:flex-none sm:px-4',
                          )}
                        >
                          Edit roster
                        </Link>
                      ) : null}
                      <Button
                        type="button"
                        variant="outline"
                        className="h-9 rounded-lg border-slate-200 px-3 text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                        disabled={writePending}
                        aria-label={`Remove ${label}`}
                        onClick={() => onRemoveSquad({ id: l.id, label })}
                      >
                        <Trash2 className="size-4" strokeWidth={2} aria-hidden />
                      </Button>
                    </div>
                  ) : !isExternal ? (
                    <Link
                      to={editHref}
                      className={cn(
                        buttonVariants({ variant: 'outline', size: 'default' }),
                        'h-9 shrink-0 rounded-lg border-slate-200 text-sm font-medium',
                      )}
                    >
                      View squad
                    </Link>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
