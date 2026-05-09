import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore'
import { type ReactElement, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { LiveMatchListCard } from '../components/LiveMatchListCard'
import { PublicUpcomingMatchCard } from '../components/PublicUpcomingMatchCard'
import { Spinner } from '../components/Spinner'
import { Button } from '@/components/ui/button'
import { getDb } from '../firebase/config'
import type { MatchDoc } from '../types/models'

/**
 * Public home match browser (`/`): lists all **`isPublic === true`** fixtures by status.
 * No sign-in required; queries do **not** filter by `createdBy` — see `ownedByUser.ts` for app-only filters.
 */

type Row = { id: string } & MatchDoc

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

export function PublicMatchesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const filter = parseFilter(searchParams.get('filter'))

  /** Live tab: full list from snapshot (real-time), paginated client-side. */
  const [liveRows, setLiveRows] = useState<Row[]>([])
  const [liveError, setLiveError] = useState<string | null>(null)

  /** Upcoming / completed: one public snapshot, filter/sort/paginate client-side (no composite index required). */
  const [nonLiveRows, setNonLiveRows] = useState<Row[]>([])
  const [pageIndex, setPageIndex] = useState(0)
  const [pageLoading, setPageLoading] = useState(false)
  const [pageError, setPageError] = useState<string | null>(null)

  useEffect(() => {
    setPageIndex(0)
  }, [filter])

  const setFilter = (f: PublicBrowseFilter) => {
    const next = new URLSearchParams(searchParams)
    next.set('filter', f)
    setSearchParams(next, { replace: true })
  }

  useEffect(() => {
    if (filter !== 'live') return
    setLiveError(null)
    const qy = query(
      collection(getDb(), 'matches'),
      where('isPublic', '==', true),
      where('status', '==', 'live'),
      orderBy('startedAt', 'desc'),
    )
    return onSnapshot(
      qy,
      (snap) => {
        const list: Row[] = []
        snap.forEach((d) => list.push({ id: d.id, ...(d.data() as MatchDoc) }))
        list.sort((a, b) => startedMs(b) - startedMs(a))
        setLiveRows(list)
        setLiveError(null)
      },
      (err) => {
        console.error('[PublicMatchesPage live]', err)
        setLiveRows([])
        setLiveError(err.message ?? 'Could not load live matches.')
      },
    )
  }, [filter])

  useEffect(() => {
    if (filter === 'live') {
      setPageLoading(false)
      setPageError(null)
      setNonLiveRows([])
      return
    }
    setPageLoading(true)
    setPageError(null)
    const qy = query(collection(getDb(), 'matches'), where('isPublic', '==', true))
    return onSnapshot(
      qy,
      (snap) => {
        const list: Row[] = []
        snap.forEach((d) => list.push({ id: d.id, ...(d.data() as MatchDoc) }))
        setNonLiveRows(list)
        setPageError(null)
        setPageLoading(false)
      },
      (e) => {
        console.error('[PublicMatchesPage]', e)
        setNonLiveRows([])
        setPageError(e instanceof Error ? e.message : 'Could not load matches.')
        setPageLoading(false)
      },
    )
  }, [filter])

  const nonLiveSortedRows = useMemo(() => {
    const list =
      filter === 'upcoming'
        ? nonLiveRows.filter((m) => m.status === 'scheduled')
        : nonLiveRows.filter((m) => m.status === 'completed' || m.status === 'abandoned')
    list.sort((a, b) => (filter === 'upcoming' ? scheduledMs(b) - scheduledMs(a) : completedMs(b) - completedMs(a)))
    return list
  }, [filter, nonLiveRows])

  const pageRows = useMemo(() => {
    if (filter === 'live') return []
    const start = pageIndex * PAGE_SIZE
    return nonLiveSortedRows.slice(start, start + PAGE_SIZE)
  }, [filter, pageIndex, nonLiveSortedRows])

  const nonLiveHasNextPage = (pageIndex + 1) * PAGE_SIZE < nonLiveSortedRows.length

  const livePageRows = useMemo(() => {
    const start = pageIndex * PAGE_SIZE
    return liveRows.slice(start, start + PAGE_SIZE)
  }, [liveRows, pageIndex])

  const liveHasNextPage = (pageIndex + 1) * PAGE_SIZE < liveRows.length
  const liveTotalPages = Math.max(1, Math.ceil(liveRows.length / PAGE_SIZE))

  const displayRows = filter === 'live' ? livePageRows : pageRows
  const displayLoading = filter === 'live' ? false : pageLoading

  const showPagination =
    filter === 'live'
      ? liveRows.length > PAGE_SIZE
      : nonLiveSortedRows.length > PAGE_SIZE

  const rangeStart =
    displayRows.length === 0 ? 0 : pageIndex * PAGE_SIZE + 1
  const rangeEnd = pageIndex * PAGE_SIZE + displayRows.length

  const emptyMessage =
    filter === 'live'
      ? 'No live public matches.'
      : filter === 'upcoming'
        ? 'No upcoming public matches.'
        : 'No completed public matches yet.'

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
        {filter === 'live' && (
          <>
            {liveError && (
              <p className="text-sm text-destructive" role="alert">
                {liveError}
              </p>
            )}
            {!liveError && (
              <ul className="space-y-4">
                {livePageRows.map((m) => (
                  <li key={m.id}>
                    <LiveMatchListCard match={m} />
                  </li>
                ))}
              </ul>
            )}
            {!liveError && livePageRows.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">{emptyMessage}</p>
            )}
          </>
        )}

        {filter === 'upcoming' && (
          <>
            {pageLoading && (
              <div
                className="flex items-center gap-2 py-6 text-muted-foreground"
                role="status"
                aria-live="polite"
              >
                <Spinner size="md" />
                <span>Loading…</span>
              </div>
            )}
            {!pageLoading && pageError && (
              <p className="text-sm text-destructive" role="alert">
                {pageError}
              </p>
            )}
            {!pageLoading && !pageError && (
              <ul className="space-y-4">
                {pageRows.map((m) => (
                  <li key={m.id}>
                    <PublicUpcomingMatchCard match={m} />
                  </li>
                ))}
              </ul>
            )}
            {!pageLoading && !pageError && pageRows.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">{emptyMessage}</p>
            )}
          </>
        )}

        {filter === 'completed' && (
          <>
            {pageLoading && (
              <div
                className="flex items-center gap-2 py-6 text-muted-foreground"
                role="status"
                aria-live="polite"
              >
                <Spinner size="md" />
                <span>Loading…</span>
              </div>
            )}
            {!pageLoading && pageError && (
              <p className="text-sm text-destructive" role="alert">
                {pageError}
              </p>
            )}
            {!pageLoading && !pageError && (
              <ul className="space-y-4">
                {pageRows.map((m) => (
                  <li key={m.id}>
                    <LiveMatchListCard match={m} replayMode="completed" />
                  </li>
                ))}
              </ul>
            )}
            {!pageLoading && !pageError && pageRows.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">{emptyMessage}</p>
            )}
          </>
        )}
      </div>

      {showPagination && displayRows.length > 0 && (
        <nav
          className="mt-6 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between"
          aria-label="Match list pages"
        >
          <span className="text-xs text-muted-foreground">
            Showing {rangeStart}–{rangeEnd}
            {filter === 'live' && liveRows.length > 0 && (
              <span className="text-muted-foreground"> · {liveRows.length} total</span>
            )}
          </span>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pageIndex === 0 || displayLoading}
              onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
            >
              Previous
            </Button>
            <span className="text-xs text-muted-foreground">
              Page {pageIndex + 1}
              {filter === 'live' && liveTotalPages > 1 ? ` / ${liveTotalPages}` : ''}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={
                displayLoading || (filter === 'live' ? !liveHasNextPage : !nonLiveHasNextPage)
              }
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
