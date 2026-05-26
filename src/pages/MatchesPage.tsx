import { collection, onSnapshot, query, where } from 'firebase/firestore'
import type { Timestamp } from 'firebase/firestore'
import { BarChart3, CalendarDays, Pencil, PlayCircle, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { Spinner } from '../components/Spinner'
import { getDb } from '../firebase/config'
import { deleteMatchCascade } from '../lib/deleteMatchCascade'
import {
  matchCanStartScoring,
  participantApprovalStatusLabel,
} from '../lib/matchParticipationInvite'
import { compareMatchesOperationalOrder } from '../lib/matchListSort'
import { usePendingWrites } from '../hooks/usePendingWrites'
import { filterMatchesCreatedByUser } from '../lib/ownedByUser'
import { formatMatchDateTime } from '../lib/tournamentFormUtils'
import type { MatchDoc, MatchStatus } from '../types/models'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Row = { id: string } & MatchDoc

const PAGE_SIZE = 15

type ListFilter = 'all' | 'live' | 'upcoming' | 'completed'

const FILTER_OPTIONS: { id: ListFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'live', label: 'Live' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'completed', label: 'Completed' },
]

function rowMatchesFilter(m: MatchDoc, f: ListFilter): boolean {
  if (f === 'all') return true
  if (f === 'live') return m.status === 'live'
  if (f === 'upcoming') return m.status === 'scheduled'
  if (f === 'completed') return m.status === 'completed' || m.status === 'abandoned'
  return true
}

function statusVisual(status: MatchStatus): {
  label: string
  bar: string
  badge: string
} {
  switch (status) {
    case 'live':
      return {
        label: 'LIVE',
        bar: 'bg-emerald-500',
        badge: 'bg-emerald-100 text-emerald-800',
      }
    case 'scheduled':
      return {
        label: 'UPCOMING',
        bar: 'bg-orange-500',
        badge: 'bg-orange-100 text-orange-800',
      }
    case 'completed':
    case 'abandoned':
      return {
        label: 'COMPLETED',
        bar: 'bg-slate-400',
        badge: 'bg-slate-100 text-slate-700',
      }
  }
}

function completedTimestamp(m: MatchDoc): Timestamp | undefined {
  return m.completedAt ?? m.startedAt ?? m.scheduledAt
}

function participantApprovalBadgeClass(
  status: MatchDoc['participantApprovalStatus'],
): string {
  switch (status) {
    case 'pending':
      return 'bg-amber-100 text-amber-800'
    case 'rejected':
      return 'bg-rose-100 text-rose-800'
    case 'expired':
      return 'bg-slate-100 text-slate-700'
    default:
      return 'bg-slate-100 text-slate-700'
  }
}

function MyMatchCard({ m, onRequestDelete }: { m: Row; onRequestDelete?: () => void }) {
  const visual = statusVisual(m.status)
  const title = `${m.home.name} vs ${m.away.name}`
  const showListDelete = m.status !== 'scheduled' && Boolean(onRequestDelete)
  const approvalLabel = participantApprovalStatusLabel(m.participantApprovalStatus)
  const canStart = matchCanStartScoring(m)

  return (
    <li
      className={cn(
        'relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white',
        'shadow-[0_2px_12px_rgba(15,23,42,0.06)]',
      )}
    >
      <div
        className={cn('absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl', visual.bar)}
        aria-hidden
      />
      <div className="flex gap-3 py-3.5 pl-4 pr-3 sm:items-stretch">
        <div className="min-w-0 flex-1 space-y-2">
          <span
            className={cn(
              'inline-block rounded-md px-2 py-0.5 text-[0.65rem] font-bold tracking-wide',
              visual.badge,
            )}
          >
            {visual.label}
          </span>
          <p className="text-base font-bold leading-tight text-slate-900">{title}</p>

          {m.status === 'scheduled' && (
            <p className="flex items-center gap-1.5 text-sm text-slate-500">
              <CalendarDays className="size-4 shrink-0 text-slate-400" aria-hidden />
              <span>Scheduled {formatMatchDateTime(m.scheduledAt)}</span>
            </p>
          )}
          {m.status === 'live' && (
            <p className="flex items-center gap-1.5 text-sm text-slate-500">
              <CalendarDays className="size-4 shrink-0 text-slate-400" aria-hidden />
              <span>
                {m.startedAt
                  ? `Started ${formatMatchDateTime(m.startedAt)}`
                  : 'Match in progress'}
              </span>
            </p>
          )}
          {(m.status === 'completed' || m.status === 'abandoned') && (
            <p className="flex items-center gap-1.5 text-sm text-slate-500">
              <CalendarDays className="size-4 shrink-0 text-slate-400" aria-hidden />
              <span>
                Completed {formatMatchDateTime(completedTimestamp(m)) || '—'}
              </span>
            </p>
          )}

          {m.status === 'live' && m.publicId && (
            <Link
              to={`/live/${m.publicId}`}
              className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold !text-emerald-600 hover:!text-emerald-700 hover:underline"
            >
              <BarChart3 className="size-4 shrink-0" strokeWidth={2.2} aria-hidden />
              Scorecard
            </Link>
          )}
        </div>

        <div className="flex shrink-0 flex-col justify-center gap-2 self-stretch sm:min-w-[7.5rem]">
          {m.status === 'scheduled' && (
            <>
              <Link
                to={`/app/matches/${m.id}/edit`}
                className={cn(
                  buttonVariants({ variant: 'outline', size: 'sm' }),
                  'h-9 w-full justify-center gap-1.5 border-slate-300 bg-white font-semibold !text-slate-800 shadow-none hover:bg-slate-50 hover:!no-underline',
                )}
              >
                <Pencil className="size-3.5" strokeWidth={2.2} aria-hidden />
                Edit
              </Link>
              {canStart ? (
                <Link
                  to={`/app/matches/${m.id}/score`}
                  className={cn(
                    buttonVariants({ variant: 'default', size: 'sm' }),
                    'h-9 w-full justify-center gap-1.5 font-semibold !text-primary-foreground shadow-sm hover:!no-underline',
                  )}
                >
                  <PlayCircle className="size-3.5" strokeWidth={2.2} aria-hidden />
                  Start Match
                </Link>
              ) : approvalLabel ? (
                <div className="flex w-full items-center justify-center px-1">
                  <span
                    className={cn(
                      'inline-block rounded-md px-2 py-0.5 text-[0.65rem] font-bold tracking-wide',
                      participantApprovalBadgeClass(m.participantApprovalStatus),
                    )}
                    role="status"
                  >
                    {approvalLabel.toUpperCase()}
                  </span>
                </div>
              ) : null}
            </>
          )}
          {m.status === 'live' && (
            <>
              <Link
                to={`/app/matches/${m.id}/score`}
                className={cn(
                  buttonVariants({ variant: 'outline', size: 'sm' }),
                  'h-9 w-full justify-center gap-1.5 border-2 border-emerald-600 bg-emerald-600 font-semibold !text-white shadow-sm hover:border-emerald-700 hover:bg-emerald-700 hover:!text-white hover:!no-underline active:bg-emerald-800',
                )}
              >
                <PlayCircle className="size-3.5" strokeWidth={2.2} aria-hidden />
                Resume
              </Link>
              {showListDelete && (
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 w-full justify-center gap-1.5 border-destructive/55 bg-white font-semibold text-destructive hover:bg-destructive/5"
                  onClick={() => onRequestDelete?.()}
                >
                  <Trash2 className="size-3.5 shrink-0" strokeWidth={2.2} aria-hidden />
                  Delete
                </Button>
              )}
            </>
          )}
          {(m.status === 'completed' || m.status === 'abandoned') && (
            <>
              {m.publicId ? (
                <Link
                  to={`/live/${m.publicId}`}
                  className={cn(
                    buttonVariants({ variant: 'outline', size: 'sm' }),
                    'h-9 w-full justify-center gap-1.5 border-2 border-primary bg-white font-semibold !text-primary shadow-none hover:bg-primary/5 hover:!no-underline',
                  )}
                >
                  <BarChart3 className="size-3.5" strokeWidth={2.2} aria-hidden />
                  View Scorecard
                </Link>
              ) : null}
              {showListDelete && (
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 w-full justify-center gap-1.5 border-destructive/55 bg-white font-semibold text-destructive hover:bg-destructive/5"
                  onClick={() => onRequestDelete?.()}
                >
                  <Trash2 className="size-3.5 shrink-0" strokeWidth={2.2} aria-hidden />
                  Delete
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </li>
  )
}

export function MatchesPage() {
  const { user } = useAuth()
  const { writePending, run } = usePendingWrites()
  const [rows, setRows] = useState<Row[]>([])
  const [queryError, setQueryError] = useState<string | null>(null)
  const [pageIndex, setPageIndex] = useState(0)
  const [listFilter, setListFilter] = useState<ListFilter>('all')
  const [matchToDelete, setMatchToDelete] = useState<{ id: string; title: string } | null>(null)

  useEffect(() => {
    setPageIndex(0)
  }, [user?.uid, listFilter])

  const sortedRows = useMemo(() => {
    const copy = [...rows]
    copy.sort(compareMatchesOperationalOrder)
    return copy
  }, [rows])

  const filteredRows = useMemo(
    () => sortedRows.filter((m) => rowMatchesFilter(m, listFilter)),
    [sortedRows, listFilter],
  )

  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(filteredRows.length / PAGE_SIZE) - 1)
    setPageIndex((p) => Math.min(p, maxPage))
  }, [filteredRows.length])

  useEffect(() => {
    if (!user) return
    setQueryError(null)
    const qy = query(collection(getDb(), 'matches'), where('createdBy', '==', user.uid))
    return onSnapshot(
      qy,
      (snap) => {
        const list: Row[] = []
        snap.forEach((d) => list.push({ id: d.id, ...(d.data() as MatchDoc) }))
        setRows(filterMatchesCreatedByUser(list, user.uid))
        setQueryError(null)
      },
      (err) => {
        console.error('[MatchesPage]', err)
        setRows([])
        setQueryError(err.message ?? 'Could not load matches. Check Firestore rules and console.')
      },
    )
  }, [user])

  const pageRows = useMemo(
    () => filteredRows.slice(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE),
    [filteredRows, pageIndex],
  )
  const hasNextPage = (pageIndex + 1) * PAGE_SIZE < filteredRows.length
  const showPagination = filteredRows.length > PAGE_SIZE
  const rangeStart = filteredRows.length === 0 ? 0 : pageIndex * PAGE_SIZE + 1
  const rangeEnd = pageIndex * PAGE_SIZE + pageRows.length

  return (
    <div className="space-y-4">
      <AlertDialog open={matchToDelete != null} onOpenChange={(open) => !open && setMatchToDelete(null)}>
        <AlertDialogContent
          size="sm"
          className="max-w-[min(100vw-2rem,22rem)] gap-0 border border-slate-100 p-6 shadow-xl sm:max-w-md"
        >
          <AlertDialogHeader className="flex flex-col items-center justify-center space-y-0 text-center">
            <div
              className="mb-4 flex size-14 shrink-0 items-center justify-center rounded-full bg-rose-100 text-primary"
              aria-hidden
            >
              <Trash2 className="size-7" strokeWidth={2.2} />
            </div>
            <AlertDialogTitle className="text-center text-lg font-bold text-slate-900">Delete match?</AlertDialogTitle>
            <AlertDialogDescription className="mt-2 px-0.5 text-center text-sm leading-relaxed text-slate-500">
              Are you sure you want to delete{' '}
              {matchToDelete ? (
                <span className="font-semibold text-slate-700">{matchToDelete.title}</span>
              ) : (
                'this match'
              )}
              ? All score events and innings data will be removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 grid grid-cols-2 gap-3 border-0 bg-transparent p-0 sm:flex sm:flex-row sm:justify-stretch">
            <AlertDialogCancel className="h-10 w-full border-slate-200 bg-white text-slate-900 shadow-sm hover:bg-slate-50 sm:flex-1">
              Cancel
            </AlertDialogCancel>
            <Button
              type="button"
              variant="default"
              className="h-10 w-full !text-primary-foreground no-underline hover:!text-primary-foreground sm:flex-1"
              disabled={writePending || !matchToDelete}
              onClick={() => {
                void (async () => {
                  if (!matchToDelete) return
                  await run(() => deleteMatchCascade(getDb(), matchToDelete.id))
                  setMatchToDelete(null)
                })()
              }}
            >
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {writePending && (
        <div className="write-pending-overlay" role="status" aria-live="polite">
          <div className="write-pending-card">
            <Spinner size="md" />
            <span>Working…</span>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">My matches</h1>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-slate-500">
            Fixtures you scheduled under your account (including tournament matches you organise). Browse all public games
            from the <strong className="font-semibold text-slate-700">Matches</strong> tab.
          </p>
        </div>
        <Link
          to="/app/matches/new"
          className={cn(
            buttonVariants({ variant: 'default', size: 'sm' }),
            'h-9 shrink-0 justify-center gap-1 rounded-lg px-3 font-semibold !text-primary-foreground shadow-sm hover:!no-underline',
          )}
        >
          + New match
        </Link>
      </div>

      {queryError && (
        <p className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {queryError}
        </p>
      )}

      {!queryError && rows.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-200 bg-white/80 px-4 py-8 text-center text-sm text-slate-500">
          No matches yet. Tap <span className="font-semibold text-slate-700">+ New match</span> to
          create one.
        </p>
      )}

      {!queryError && rows.length > 0 && (
        <div className="segmented-filter" role="group" aria-label="Filter my matches">
          {FILTER_OPTIONS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              className={
                'segmented-filter-tab' + (listFilter === id ? ' segmented-filter-tab--active' : '')
              }
              aria-pressed={listFilter === id}
              onClick={() => setListFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {!queryError && rows.length > 0 && filteredRows.length === 0 && (
        <p className="text-center text-sm text-slate-500">No matches in this filter.</p>
      )}

      <ul className="space-y-3">
        {pageRows.map((m) => (
          <MyMatchCard
            key={m.id}
            m={m}
            onRequestDelete={
              m.status === 'scheduled'
                ? undefined
                : () =>
                    setMatchToDelete({
                      id: m.id,
                      title: `${m.home.name} vs ${m.away.name}`,
                    })
            }
          />
        ))}
      </ul>

      {!queryError && showPagination && pageRows.length > 0 && (
        <nav
          className="flex flex-col gap-3 border-t border-slate-200/90 pt-4 sm:flex-row sm:items-center sm:justify-between"
          aria-label="Match list pages"
        >
          <span className="text-xs text-slate-500">
            Showing {rangeStart}–{rangeEnd} of {filteredRows.length}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pageIndex === 0}
              onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
            >
              Previous
            </Button>
            <span className="text-xs text-slate-500">Page {pageIndex + 1}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!hasNextPage}
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
