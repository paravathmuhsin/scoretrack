import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { type ReactElement, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { LiveMatchListCard } from '../components/LiveMatchListCard'
import { PublicUpcomingMatchCard } from '../components/PublicUpcomingMatchCard'
import { Spinner } from '../components/Spinner'
import { Button } from '@/components/ui/button'
import { getDb } from '../firebase/config'
import {
  canViewMatchOnHome,
  mergeHomeMatchRows,
  type HomeMatchRow,
} from '../lib/publicHomeMatchQueries'
import type { MatchDoc } from '../types/models'

/**
 * Public home (`/`): `isPublic` matches for everyone; signed-in users also see matches
 * where they are on the squad roster or (internal) parent squad — merged without duplicates.
 */

type Row = HomeMatchRow

const PAGE_SIZE = 15

type PublicBrowseFilter = 'live' | 'upcoming' | 'completed'

function IconLive() {
  return (
    <svg className="segmented-filter-tab-icon shrink-0" viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="17" r="2.25" fill="currentColor" />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        d="M8 11c2.5-2.5 7.5-2.5 10 0"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        d="M5 8c4-4 10-4 14 0"
      />
    </svg>
  )
}

function IconCalendar() {
  return (
    <svg className="segmented-filter-tab-icon shrink-0" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        d="M7 3v3M17 3v3M4 9h16M6 5h12a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2z"
      />
    </svg>
  )
}

function IconCompleted() {
  return (
    <svg className="segmented-filter-tab-icon shrink-0" viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 12l2.5 2.5L16 9"
      />
    </svg>
  )
}

const PUBLIC_FILTER_TABS: {
  id: PublicBrowseFilter
  label: string
  Icon: () => ReactElement
}[] = [
  { id: 'live', label: 'Live', Icon: IconLive },
  { id: 'upcoming', label: 'Upcoming', Icon: IconCalendar },
  { id: 'completed', label: 'Completed', Icon: IconCompleted },
]

function parseFilter(raw: string | null): PublicBrowseFilter {
  if (raw === 'upcoming' || raw === 'completed') return raw
  return 'live'
}

function startedMs(m: MatchDoc): number {
  const t = m.startedAt
  if (t && typeof t === 'object' && 'toMillis' in t) {
    return (t as { toMillis: () => number }).toMillis()
  }
  return 0
}

function scheduledMs(m: MatchDoc): number {
  const t = m.scheduledAt
  if (t && typeof t === 'object' && 'toMillis' in t) {
    return (t as { toMillis: () => number }).toMillis()
  }
  return 0
}

function completedMs(m: MatchDoc): number {
  const t = m.completedAt ?? m.startedAt ?? m.scheduledAt
  if (t && typeof t === 'object' && 'toMillis' in t) {
    return (t as { toMillis: () => number }).toMillis()
  }
  return 0
}

function PublicMatchCardRow({ m, viewerUid }: { m: Row; viewerUid: string | undefined }) {
  const allowPrivateReplay = canViewMatchOnHome(m, viewerUid)
  if (m.status === 'live') {
    return <LiveMatchListCard match={m} allowPrivateReplay={allowPrivateReplay} />
  }
  if (m.status === 'scheduled') {
    return <PublicUpcomingMatchCard match={m} />
  }
  return (
    <LiveMatchListCard match={m} replayMode="completed" allowPrivateReplay={allowPrivateReplay} />
  )
}

export function PublicMatchesPage() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const filter = parseFilter(searchParams.get('filter'))

  const [publicOnlyRows, setPublicOnlyRows] = useState<Row[]>([])
  const [squadRows, setSquadRows] = useState<Row[]>([])
  const [parentRows, setParentRows] = useState<Row[]>([])
  const [publicReady, setPublicReady] = useState(false)
  const [squadReady, setSquadReady] = useState(false)
  const [parentReady, setParentReady] = useState(false)
  const [snapshotError, setSnapshotError] = useState<string | null>(null)

  const [pageIndex, setPageIndex] = useState(0)

  useEffect(() => {
    setPageIndex(0)
  }, [filter, user?.uid])

  useEffect(() => {
    setPublicReady(false)
    setSnapshotError(null)
    const qy = query(collection(getDb(), 'matches'), where('isPublic', '==', true))
    return onSnapshot(
      qy,
      (snap) => {
        const list: Row[] = []
        snap.forEach((d) => list.push({ id: d.id, ...(d.data() as MatchDoc) }))
        setPublicOnlyRows(list)
        setPublicReady(true)
        setSnapshotError(null)
      },
      (err) => {
        console.error('[PublicMatchesPage] public', err)
        setPublicOnlyRows([])
        setPublicReady(true)
        setSnapshotError(err.message ?? 'Could not load matches.')
      },
    )
  }, [])

  useEffect(() => {
    if (!user?.uid) {
      setSquadRows([])
      setSquadReady(true)
      return
    }
    setSquadReady(false)
    const qy = query(
      collection(getDb(), 'matches'),
      where('rosterPlayerIds', 'array-contains', user.uid),
    )
    return onSnapshot(
      qy,
      (snap) => {
        const list: Row[] = []
        snap.forEach((d) => list.push({ id: d.id, ...(d.data() as MatchDoc) }))
        setSquadRows(list)
        setSquadReady(true)
      },
      (err) => {
        console.error('[PublicMatchesPage] squad', err)
        setSquadRows([])
        setSquadReady(true)
        setSnapshotError((prev) => prev ?? err.message ?? 'Could not load matches.')
      },
    )
  }, [user?.uid])

  useEffect(() => {
    if (!user?.uid) {
      setParentRows([])
      setParentReady(true)
      return
    }
    setParentReady(false)
    const qy = query(
      collection(getDb(), 'matches'),
      where('isInternalMatch', '==', true),
      where('parentTeamMemberIds', 'array-contains', user.uid),
    )
    return onSnapshot(
      qy,
      (snap) => {
        const list: Row[] = []
        snap.forEach((d) => list.push({ id: d.id, ...(d.data() as MatchDoc) }))
        setParentRows(list)
        setParentReady(true)
      },
      (err) => {
        console.error('[PublicMatchesPage] parent', err)
        setParentRows([])
        setParentReady(true)
        setSnapshotError((prev) => prev ?? err.message ?? 'Could not load matches.')
      },
    )
  }, [user?.uid])

  const publicRows = useMemo(
    () => mergeHomeMatchRows(publicOnlyRows, squadRows, parentRows),
    [publicOnlyRows, squadRows, parentRows],
  )

  const setFilter = (f: PublicBrowseFilter) => {
    const next = new URLSearchParams(searchParams)
    next.set('filter', f)
    setSearchParams(next, { replace: true })
  }

  const liveSorted = useMemo(
    () =>
      publicRows
        .filter((m) => m.status === 'live')
        .sort((a, b) => startedMs(b) - startedMs(a)),
    [publicRows],
  )

  const upcomingSorted = useMemo(
    () =>
      publicRows
        .filter((m) => m.status === 'scheduled')
        .sort((a, b) => scheduledMs(b) - scheduledMs(a)),
    [publicRows],
  )

  const completedSorted = useMemo(
    () =>
      publicRows
        .filter((m) => m.status === 'completed' || m.status === 'abandoned')
        .sort((a, b) => completedMs(b) - completedMs(a)),
    [publicRows],
  )

  const activeList = useMemo(() => {
    switch (filter) {
      case 'live':
        return liveSorted
      case 'upcoming':
        return upcomingSorted
      case 'completed':
        return completedSorted
      default:
        return liveSorted
    }
  }, [filter, liveSorted, upcomingSorted, completedSorted])

  const pageRows = useMemo(() => {
    const start = pageIndex * PAGE_SIZE
    return activeList.slice(start, start + PAGE_SIZE)
  }, [activeList, pageIndex])

  const hasNextPage = (pageIndex + 1) * PAGE_SIZE < activeList.length
  const totalPages = Math.max(1, Math.ceil(activeList.length / PAGE_SIZE))

  const showPagination = activeList.length > PAGE_SIZE

  const rangeStart = pageRows.length === 0 ? 0 : pageIndex * PAGE_SIZE + 1
  const rangeEnd = pageIndex * PAGE_SIZE + pageRows.length

  const emptyMessage =
    filter === 'live'
      ? 'No live matches right now.'
      : filter === 'upcoming'
        ? 'No upcoming matches.'
        : 'No completed matches yet.'

  const loading = !publicReady || !squadReady || !parentReady
  const error = snapshotError

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 py-2">
      <div className="segmented-filter" role="group" aria-label="Browse public matches">
        {PUBLIC_FILTER_TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            className={
              'segmented-filter-tab' + (filter === id ? ' segmented-filter-tab--active' : '')
            }
            aria-pressed={filter === id}
            onClick={() => setFilter(id)}
          >
            <Icon />
            <span className="segmented-filter-tab-label">{label}</span>
          </button>
        ))}
      </div>

      <div className="space-y-4 pt-1">
        {loading && (
          <div
            className="flex items-center gap-2 py-6 text-muted-foreground"
            role="status"
            aria-live="polite"
          >
            <Spinner size="md" />
            <span>Loading…</span>
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        {!loading && !error && (
          <>
            <ul className="space-y-4">
              {pageRows.map((m) => (
                <li key={m.id}>
                  <PublicMatchCardRow m={m} viewerUid={user?.uid} />
                </li>
              ))}
            </ul>
            {pageRows.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">{emptyMessage}</p>
            )}
          </>
        )}
      </div>

      {showPagination && pageRows.length > 0 && !loading && !error && (
        <nav
          className="mt-6 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between"
          aria-label="Match list pages"
        >
          <span className="text-xs text-muted-foreground">
            Showing {rangeStart}–{rangeEnd}
            {activeList.length > 0 && (
              <span className="text-muted-foreground"> · {activeList.length} total</span>
            )}
          </span>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pageIndex === 0 || loading}
              onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
            >
              Previous
            </Button>
            <span className="text-xs text-muted-foreground">
              Page {pageIndex + 1}
              {totalPages > 1 ? ` / ${totalPages}` : ''}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={loading || !hasNextPage}
              onClick={() => setPageIndex((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </nav>
      )}
    </div>
  )
}
