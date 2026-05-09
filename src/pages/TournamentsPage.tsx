import {
  collection,
  onSnapshot,
  query,
  where,
  type Timestamp,
} from 'firebase/firestore'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { TournamentListingCard } from '../components/TournamentListingCard'
import { getDb } from '../firebase/config'
import { compareMatchesOperationalOrder } from '../lib/matchListSort'
import { filterMatchesCreatedByUser, filterTournamentsCreatedByUser } from '../lib/ownedByUser'
import { firstOperationalMatchRow } from '../lib/tournamentListMatchSummary'
import type { MatchDoc, TournamentDoc } from '../types/models'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Row = { id: string } & TournamentDoc

function appTournamentMetaRight(t: TournamentDoc): string {
  if (t.teamCount != null && t.teamCount > 0) return `${t.teamCount} teams`
  return t.isPublic ? 'Public' : 'Private'
}
type MatchRow = { id: string } & MatchDoc

function createdAtMs(at: TournamentDoc['createdAt']): number {
  if (!at || typeof at !== 'object') return 0
  const t = at as Timestamp
  if (typeof t.toMillis === 'function') return t.toMillis()
  return 0
}

function tournamentStartDateMs(t: TournamentDoc): number {
  const s = t.startDate
  if (s && typeof s === 'object' && 'toMillis' in s && typeof (s as Timestamp).toMillis === 'function') {
    return (s as Timestamp).toMillis()
  }
  return 0
}

export function TournamentsPage() {
  const { user } = useAuth()
  const [rows, setRows] = useState<Row[]>([])
  const [matchRows, setMatchRows] = useState<MatchRow[]>([])
  const [listenError, setListenError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    /** Equality-only query avoids a composite index; order is derived from linked matches (see sortedTournamentRows). */
    const qy = query(collection(getDb(), 'tournaments'), where('createdBy', '==', user.uid))
    return onSnapshot(
      qy,
      (snap) => {
        setListenError(null)
        const list: Row[] = []
        snap.forEach((d) => list.push({ id: d.id, ...(d.data() as TournamentDoc) }))
        setRows(filterTournamentsCreatedByUser(list, user.uid))
      },
      (err) => {
        console.error('[TournamentsPage] tournaments listener', err)
        setListenError(err.message || 'Could not load tournaments.')
        setRows([])
      },
    )
  }, [user])

  useEffect(() => {
    if (!user) return
    const qy = query(collection(getDb(), 'matches'), where('createdBy', '==', user.uid))
    return onSnapshot(
      qy,
      (snap) => {
        const list: MatchRow[] = []
        snap.forEach((d) => list.push({ id: d.id, ...(d.data() as MatchDoc) }))
        setMatchRows(filterMatchesCreatedByUser(list, user.uid))
      },
      () => setMatchRows([]),
    )
  }, [user])

  const matchesByTournamentId = useMemo(() => {
    const m = new Map<string, MatchRow[]>()
    for (const row of matchRows) {
      const tid = row.tournamentId
      if (tid == null || tid === '') continue
      const arr = m.get(tid) ?? []
      arr.push(row)
      m.set(tid, arr)
    }
    return m
  }, [matchRows])

  const sortedTournamentRows = useMemo(() => {
    const copy = [...rows]
    const lead = new Map<string, MatchRow | null>()
    for (const [tid, arr] of matchesByTournamentId) {
      lead.set(tid, firstOperationalMatchRow(arr))
    }
    copy.sort((a, b) => {
      const am = lead.get(a.id) ?? null
      const bm = lead.get(b.id) ?? null
      if (am && bm) return compareMatchesOperationalOrder(am, bm)
      if (am && !bm) return -1
      if (!am && bm) return 1
      const sa = tournamentStartDateMs(a)
      const sb = tournamentStartDateMs(b)
      if (sa !== sb) return sa - sb
      return createdAtMs(b.createdAt) - createdAtMs(a.createdAt)
    })
    return copy
  }, [rows, matchesByTournamentId])

  if (!user) return <p>Loading…</p>

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 py-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">My tournaments</h1>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-slate-500">
            Tournaments you created. Public listings are on the <strong className="font-semibold text-slate-700">Tournaments</strong>{' '}
            tab.
          </p>
        </div>
        <Link
          to="/app/tournaments/new"
          className={cn(
            buttonVariants({ variant: 'default', size: 'sm' }),
            'h-9 shrink-0 justify-center gap-1 rounded-lg px-3 font-semibold !text-primary-foreground shadow-sm hover:!no-underline',
          )}
        >
          + New tournament
        </Link>
      </div>

      {listenError && (
        <p className="text-sm text-destructive" role="alert">
          {listenError}
        </p>
      )}
      {!listenError && rows.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-200 bg-white/80 px-4 py-8 text-center text-sm text-slate-500">
          You don’t have any tournaments yet.{' '}
          <Link to="/app/tournaments/new" className="font-semibold text-primary underline-offset-2 hover:underline">
            Create a tournament
          </Link>{' '}
          to get started.
        </p>
      )}
      {sortedTournamentRows.length > 0 && (
        <ul className="space-y-4">
          {sortedTournamentRows.map((t) => (
            <li key={t.id}>
              <TournamentListingCard
                t={t}
                to={`/app/tournaments/${t.id}`}
                metaRight={appTournamentMetaRight(t)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
