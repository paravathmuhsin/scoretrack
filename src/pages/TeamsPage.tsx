import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { CalendarDays, MapPin, Pencil, Plus, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { getDb } from '../firebase/config'
import { filterMyTeamsDocPath } from '../lib/ownedByUser'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { TeamDoc } from '../types/models'

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

export function TeamsPage() {
  const { user } = useAuth()
  const [teams, setTeams] = useState<(TeamDoc & { id: string })[]>([])

  useEffect(() => {
    if (!user) return
    const qy = query(collection(getDb(), 'users', user.uid, 'teams'), orderBy('name'))
    return onSnapshot(
      qy,
      (snap) => {
        const list: (TeamDoc & { id: string })[] = []
        snap.forEach((d) => list.push({ id: d.id, ...(d.data() as TeamDoc) }))
        setTeams(filterMyTeamsDocPath(list, user.uid))
      },
      () => setTeams([]),
    )
  }, [user])

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
              // Global `a { color: #2563eb }` in index.css wins over some theme utilities on `<a>`.
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
        Only <strong className="font-semibold text-slate-600">your</strong> squads appear here — each one is saved under
        your account. Link them from a tournament to build draws, standings, and knockouts.
      </p>

      <ul className="m-0 list-none space-y-3 p-0">
        {teams.length === 0 && (
          <li className="rounded-2xl border border-dashed border-slate-200 bg-white/80 px-4 py-8 text-center text-sm text-slate-500">
            You haven&apos;t created any teams yet. Use <span className="font-medium text-slate-700">Create team</span>{' '}
            to add one.
          </li>
        )}
        {teams.map((team) => (
          <li
            key={team.id}
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
                  to={`/app/teams/${team.id}`}
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
