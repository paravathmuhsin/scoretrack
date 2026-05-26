import { Pencil, Plus, Users, CalendarDays, MapPin } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { getDb } from '../firebase/config'
import { useSelectableUserTeams } from '../hooks/useSelectableUserTeams'
import { ensureTeamNumber, formatTeamNumber } from '../lib/teamNumber'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const TEAM_AVATAR_STYLES = [
  'bg-red-100 text-red-800',
  'bg-sky-100 text-sky-800',
  'bg-emerald-100 text-emerald-800',
  'bg-violet-100 text-violet-800',
] as const

function teamAvatarClass(teamId: string): string {
  let s = 0
  for (let i = 0; i < teamId.length; i++) s += teamId.charCodeAt(i)
  return TEAM_AVATAR_STYLES[s % TEAM_AVATAR_STYLES.length]!
}

function teamInitialsLabel(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase()
  const w = parts[0] ?? '?'
  return w.slice(0, 2).toUpperCase()
}

function teamEditHref(teamId: string, ownerUid: string): string {
  const base = `/app/teams/${teamId}`
  return ownerUid ? `${base}?owner=${encodeURIComponent(ownerUid)}` : base
}

export function TeamsPage() {
  const { user } = useAuth()
  const { teams, loading } = useSelectableUserTeams()
  const backfillStarted = useRef(false)

  useEffect(() => {
    if (!user || loading || backfillStarted.current) return
    const ownedMissing = teams.filter((t) => !t.isCoOwned && t.teamNumber == null)
    if (ownedMissing.length === 0) return
    backfillStarted.current = true
    void (async () => {
      for (const t of ownedMissing) {
        try {
          await ensureTeamNumber(getDb(), user.uid, t.id)
        } catch {
          /* ignore per-team failures */
        }
      }
    })()
  }, [user, loading, teams])

  if (!user) return null

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-3 flex flex-nowrap items-center justify-between gap-2">
        <h1 className="min-w-0 flex-1 truncate text-base font-bold tracking-tight text-slate-900 sm:text-xl">
          My teams
        </h1>
        <div className="flex shrink-0 flex-nowrap items-center gap-1 sm:gap-2">
          <Link
            to="/app/teams/new"
            className={cn(
              buttonVariants({ variant: 'default', size: 'default' }),
              'h-8 gap-1 whitespace-nowrap rounded-lg px-2.5 text-xs shadow-sm sm:h-9 sm:gap-2 sm:rounded-xl sm:px-4 sm:text-sm !text-primary-foreground no-underline hover:!text-primary-foreground hover:no-underline visited:!text-primary-foreground [&_svg]:!text-primary-foreground',
            )}
          >
            <Plus className="size-3.5 sm:size-4" strokeWidth={2.5} aria-hidden />
            Create team
          </Link>
          <Link
            to="/app/matches/new"
            className={cn(
              buttonVariants({ variant: 'outline', size: 'default' }),
              'h-8 gap-1 whitespace-nowrap rounded-lg border-slate-300 bg-white px-2.5 text-xs !text-slate-900 shadow-sm hover:bg-slate-50 hover:!text-slate-900 hover:no-underline visited:!text-slate-900 sm:h-9 sm:gap-2 sm:rounded-xl sm:px-4 sm:text-sm',
            )}
          >
            <CalendarDays className="size-3.5 !text-slate-700 sm:size-4" strokeWidth={2} aria-hidden />
            New match
          </Link>
        </div>
      </div>

      <p className="mb-4 text-sm leading-relaxed text-slate-500">
        Squads you created and squads you <strong className="font-semibold text-slate-600">co-own</strong> appear here.
        Link owned squads from a tournament to build draws, standings, and knockouts.
      </p>

      <ul className="m-0 list-none space-y-3 p-0">
        {loading && teams.length === 0 && (
          <li className="rounded-2xl border border-dashed border-slate-200 bg-white/80 px-4 py-8 text-center text-sm text-slate-500">
            Loading teams…
          </li>
        )}
        {!loading && teams.length === 0 && (
          <li className="rounded-2xl border border-dashed border-slate-200 bg-white/80 px-4 py-8 text-center text-sm text-slate-500">
            You haven&apos;t created any teams yet. Use <span className="font-medium text-slate-700">Create team</span>{' '}
            to add one.
          </li>
        )}
        {teams.map((team) => (
          <li
            key={`${team.ownerUid}_${team.id}`}
            className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_14px_rgba(15,23,42,0.06)]"
          >
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div
                  className={cn(
                    'flex size-14 shrink-0 items-center justify-center rounded-xl text-base font-bold tracking-tight',
                    teamAvatarClass(team.id),
                  )}
                  aria-hidden
                >
                  {teamInitialsLabel(team.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-slate-900">{team.name}</p>
                  {team.teamNumber != null ? (
                    <p className="mt-0.5 text-xs font-medium text-slate-500">
                      Team ID{' '}
                      <span className="font-mono font-semibold text-slate-700">
                        {formatTeamNumber(team.teamNumber)}
                      </span>
                    </p>
                  ) : null}
                  {team.isCoOwned ? (
                    <p className="mt-0.5">
                      <span className="inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                        Co-owner
                      </span>
                    </p>
                  ) : null}
                  {team.location ? (
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                      <MapPin className="size-3.5 shrink-0 text-slate-400" aria-hidden />
                      <span className="truncate">{team.location}</span>
                    </p>
                  ) : null}
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                    <Users className="size-3.5 shrink-0 text-slate-400" aria-hidden />
                    {team.players.length} {team.players.length === 1 ? 'player' : 'players'}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center">
                <Link
                  to={teamEditHref(team.id, team.isCoOwned ? team.ownerUid : '')}
                  className={cn(
                    buttonVariants({ variant: 'outline', size: 'sm' }),
                    'inline-flex h-8 min-w-[5.5rem] justify-center gap-1.5 rounded-lg border-slate-200 bg-white px-3 text-slate-900 hover:bg-slate-50',
                  )}
                >
                  <Pencil className="size-3.5" strokeWidth={2} aria-hidden />
                  Edit
                </Link>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
