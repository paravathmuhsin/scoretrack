import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import {
  ArrowLeft,
  CalendarDays,
  FileText,
  MapPin,
  Pencil,
  Settings2,
  SlidersHorizontal,
  Timer,
  Trash2,
  Users,
} from 'lucide-react'
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { PublicTournamentMatchScoreLines } from '../components/PublicTournamentMatchScoreLines'
import { ScheduleTournamentMatchDialog } from '../components/tournament/ScheduleTournamentMatchDialog'
import {
  OverviewDetailRow,
  publicTournamentMatchHeadMeta,
  publicTournamentMatchKicker,
} from '../components/tournament/tournamentPublicDisplay'
import { DeleteTournamentDialog } from '../components/tournament/DeleteTournamentDialog'
import { EndTournamentDialog } from '../components/tournament/EndTournamentDialog'
import { TournamentAddSquadDialogContent } from '../components/tournament/TournamentAddSquadDialogContent'
import { TournamentGroupsTab } from '../components/tournament/TournamentGroupsTab'
import { TournamentOutcomeOverviewCard } from '../components/tournament/TournamentOutcomeOverviewCard'
import { TournamentLeaderboardTab } from '../components/tournament/TournamentLeaderboardTab'
import { TournamentMvpTab } from '../components/tournament/TournamentMvpTab'
import { TournamentPointsPanel } from '../components/TournamentPointsPanel'
import { matchFormInputFieldShell } from '../components/MatchFormCreateFields'
import { BtnPendingLabel } from '../components/Spinner'
import { usePendingWrites } from '../hooks/usePendingWrites'
import { useTournamentDetailsDocumentTitle } from '../hooks/useTournamentDetailsDocumentTitle'
import {
  dateInputToTimestamp,
  formatMatchDateTime,
  formatTournamentDate,
  timestampToDateInput,
} from '../lib/tournamentFormUtils'
import { getDb } from '../firebase/config'
import { deleteTournamentCascade } from '../lib/deleteTournamentCascade'
import { incrementPottForPlayer } from '../lib/matchPlayerStatsPersistence'
import { compareMatchesOperationalOrder } from '../lib/matchListSort'
import { tournTeamCardAvatarLabel } from '../lib/teamAvatarLabel'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type {
  MatchDoc,
  PlayerAggRow,
  StatsDoc,
  TeamDoc,
  TournamentDoc,
  TournamentGroupDoc,
  TournamentLinkedTeamDoc,
} from '../types/models'

const TAB_IDS = ['overview', 'matches', 'teams', 'groups', 'points', 'leaderboard', 'mvp'] as const
type TabId = (typeof TAB_IDS)[number]

/** Old URLs: ?tab=tournament | schedule */
const LEGACY_TAB_MAP: Record<string, TabId> = {
  tournament: 'overview',
  schedule: 'matches',
}

/** Align edit-tournament UI with {@link TournamentNewPage}. */
const teSection =
  'rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_2px_12px_rgba(15,23,42,0.04)]'
const teInput = matchFormInputFieldShell
const teDateInput = cn(
  teInput,
  'relative pl-3 pr-10 [color-scheme:light]',
  '[&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:top-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-10 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0',
)

function AppTournamentBackLink() {
  return (
    <Link
      to="/app/tournaments"
      className={cn(
        'mb-0 mt-2 inline-flex items-center gap-1.5 text-sm font-medium no-underline hover:underline',
        '!text-primary hover:!text-primary visited:!text-primary',
      )}
    >
      <ArrowLeft className="size-4 shrink-0" strokeWidth={2.5} aria-hidden />
      My tournaments
    </Link>
  )
}

/** Stable hue for avatar background from team name */
function teamAvatarHue(name: string): number {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h + name.charCodeAt(i) * (i + 1)) % 360
  return h
}

export function TournamentDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuth()
  const [t, setT] = useState<(TournamentDoc & { id: string }) | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editLocation, setEditLocation] = useState('')
  const [editStart, setEditStart] = useState('')
  const [editEnd, setEditEnd] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editIsPublic, setEditIsPublic] = useState(true)
  const [editDefaultSquadSize, setEditDefaultSquadSize] = useState(11)
  const [editDefaultOversLimit, setEditDefaultOversLimit] = useState(20)
  const [editDefaultOversPerBowler, setEditDefaultOversPerBowler] = useState(4)
  const [detailsError, setDetailsError] = useState<string | null>(null)
  const [linkedMatchCount, setLinkedMatchCount] = useState<number | null>(null)
  const [myTeams, setMyTeams] = useState<(TeamDoc & { id: string })[]>([])
  const [linkedTeams, setLinkedTeams] = useState<(TournamentLinkedTeamDoc & { id: string })[]>([])
  const [tournamentGroups, setTournamentGroups] = useState<(TournamentGroupDoc & { id: string })[]>([])
  const [linkedTeamToRemove, setLinkedTeamToRemove] = useState<{ id: string; label: string } | null>(null)
  const [addTeamSearch, setAddTeamSearch] = useState('')
  const [linkingSquadId, setLinkingSquadId] = useState<string | null>(null)
  const addTeamDialogTitleId = useId()
  const addTeamDialogRef = useRef<HTMLDialogElement>(null)
  const addTeamSearchInputRef = useRef<HTMLInputElement>(null)
  const [deleteTournamentOpen, setDeleteTournamentOpen] = useState(false)
  const [endTournamentOpen, setEndTournamentOpen] = useState(false)
  const [endTournamentWinnerId, setEndTournamentWinnerId] = useState('')
  const [endTournamentRunnerId, setEndTournamentRunnerId] = useState('')
  const [endTournamentPotKey, setEndTournamentPotKey] = useState('')
  const [statsPlayersForPot, setStatsPlayersForPot] = useState<PlayerAggRow[]>([])
  const [endTournamentError, setEndTournamentError] = useState<string | null>(null)
  const [scheduleMatchOpen, setScheduleMatchOpen] = useState(false)
  const [scheduleDialogNonce, setScheduleDialogNonce] = useState(0)
  const [tournamentMatches, setTournamentMatches] = useState<(MatchDoc & { id: string })[]>([])
  const [tournamentMatchesError, setTournamentMatchesError] = useState<string | null>(null)
  const tabsNavRef = useRef<HTMLDivElement>(null)
  const [tabScroll, setTabScroll] = useState({ hintLeft: false, hintRight: false, overflow: false })
  const { writePending, run } = usePendingWrites()

  const tournamentMatchesSorted = useMemo(() => {
    const c = [...tournamentMatches]
    c.sort(compareMatchesOperationalOrder)
    return c
  }, [tournamentMatches])

  useEffect(() => {
    if (!id || !user) return
    const ref = doc(getDb(), 'tournaments', id)
    return onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        setT(null)
        return
      }
      setT({ id: snap.id, ...(snap.data() as TournamentDoc) })
    })
  }, [id, user])

  useTournamentDetailsDocumentTitle(t)

  useEffect(() => {
    if (!t) return
    setEditName(t.name)
    setEditLocation(t.location ?? '')
    setEditStart(timestampToDateInput(t.startDate))
    setEditEnd(timestampToDateInput(t.endDate))
    setEditDescription(t.description ?? '')
    setEditIsPublic(t.isPublic)
    setEditDefaultSquadSize(t.defaultSquadSize ?? 11)
    setEditDefaultOversLimit(t.defaultOversLimit ?? 20)
    setEditDefaultOversPerBowler(t.defaultOversPerBowler ?? 4)
  }, [t])

  useEffect(() => {
    if (!id || !user || t?.createdBy !== user.uid) return
    let cancelled = false
    void (async () => {
      try {
        const snap = await getCountFromServer(
          query(collection(getDb(), 'matches'), where('tournamentId', '==', id)),
        )
        if (!cancelled) setLinkedMatchCount(snap.data().count)
      } catch {
        if (!cancelled) setLinkedMatchCount(-1)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id, user, t?.createdBy])

  useEffect(() => {
    if (!id || !user) return
    setTournamentMatchesError(null)
    const qy = query(collection(getDb(), 'matches'), where('tournamentId', '==', id))
    return onSnapshot(
      qy,
      (snap) => {
        const list: (MatchDoc & { id: string })[] = []
        snap.forEach((d) => list.push({ id: d.id, ...(d.data() as MatchDoc) }))
        setTournamentMatches(list)
        setTournamentMatchesError(null)
      },
      (err) => {
        console.error('[TournamentDetailPage] tournament matches', err)
        setTournamentMatches([])
        setTournamentMatchesError(err.message ?? 'Could not load tournament matches.')
      },
    )
  }, [id, user])

  useEffect(() => {
    if (!user) return
    const qy = query(collection(getDb(), 'users', user.uid, 'teams'), orderBy('name'))
    return onSnapshot(
      qy,
      (snap) => {
        const list: (TeamDoc & { id: string })[] = []
        snap.forEach((d) => list.push({ id: d.id, ...(d.data() as TeamDoc) }))
        setMyTeams(list)
      },
      () => setMyTeams([]),
    )
  }, [user])

  useEffect(() => {
    if (!id || !user) return
    const qy = query(collection(getDb(), 'tournaments', id, 'linkedTeams'))
    return onSnapshot(qy, (snap) => {
      const list: (TournamentLinkedTeamDoc & { id: string })[] = []
      snap.forEach((d) => list.push({ id: d.id, ...(d.data() as TournamentLinkedTeamDoc) }))
      list.sort((a, b) => {
        const na = (a.teamName ?? '').toLowerCase()
        const nb = (b.teamName ?? '').toLowerCase()
        if (na !== nb) return na.localeCompare(nb)
        return a.userTeamId.localeCompare(b.userTeamId)
      })
      setLinkedTeams(list)
    })
  }, [id, user])

  useEffect(() => {
    if (!id || !user) return
    const col = collection(getDb(), 'tournaments', id, 'groups')
    return onSnapshot(col, (snap) => {
      const list: (TournamentGroupDoc & { id: string })[] = []
      snap.forEach((d) => list.push({ id: d.id, ...(d.data() as TournamentGroupDoc) }))
      list.sort((a, b) => a.name.localeCompare(b.name))
      setTournamentGroups(list)
    })
  }, [id, user])

  useEffect(() => {
    if (searchParams.get('schedule') !== '1') return
    if (!t) return
    const required = Math.max(2, t.teamCount ?? 0)
    if (linkedTeams.length >= required && tournamentGroups.length > 0) {
      setScheduleDialogNonce((n) => n + 1)
      window.setTimeout(() => setScheduleMatchOpen(true), 0)
    }
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        p.delete('schedule')
        p.set('tab', 'matches')
        return p
      },
      { replace: true },
    )
  }, [searchParams, setSearchParams, t, linkedTeams.length, tournamentGroups.length])

  const rawTab = searchParams.get('tab')
  const normalizedTab = rawTab ? (LEGACY_TAB_MAP[rawTab] ?? rawTab) : 'overview'
  const activeTab: TabId = TAB_IDS.includes(normalizedTab as TabId) ? (normalizedTab as TabId) : 'overview'
  const editOverview = searchParams.get('edit') === '1'

  function setTab(next: TabId) {
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        if (next === 'overview') {
          p.delete('tab')
        } else {
          p.set('tab', next)
        }
        p.delete('edit')
        return p
      },
      { replace: true },
    )
  }

  function openOverviewEdit() {
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        p.delete('tab')
        p.set('edit', '1')
        return p
      },
      { replace: true },
    )
  }

  function closeOverviewEdit() {
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        p.delete('edit')
        return p
      },
      { replace: true },
    )
  }

  const updateTabScrollHints = useCallback(() => {
    const el = tabsNavRef.current
    if (!el) return
    const { scrollLeft, scrollWidth, clientWidth } = el
    const overflow = scrollWidth > clientWidth + 1
    const maxScroll = Math.max(0, scrollWidth - clientWidth)
    const hintLeft = overflow && scrollLeft > 4
    const hintRight = overflow && scrollLeft < maxScroll - 4
    setTabScroll({ hintLeft, hintRight, overflow })
  }, [])

  useLayoutEffect(() => {
    const el = tabsNavRef.current
    if (!el) return
    const activeBtn = el.querySelector<HTMLElement>(`#tab-${activeTab}`)
    activeBtn?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    updateTabScrollHints()
  }, [activeTab, updateTabScrollHints])

  useLayoutEffect(() => {
    const el = tabsNavRef.current
    if (!el) return
    const ro = new ResizeObserver(() => updateTabScrollHints())
    ro.observe(el)
    window.addEventListener('resize', updateTabScrollHints)
    updateTabScrollHints()
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', updateTabScrollHints)
    }
  }, [updateTabScrollHints, id])

  const linkableTeams = useMemo(
    () => myTeams.filter((s) => !linkedTeams.some((l) => l.userTeamId === s.id)),
    [myTeams, linkedTeams],
  )

  const filteredLinkableTeams = useMemo(() => {
    const q = addTeamSearch.trim().toLowerCase()
    if (!q) return linkableTeams
    return linkableTeams.filter((s) => s.name.toLowerCase().includes(q))
  }, [linkableTeams, addTeamSearch])

  const teamSlotsRemaining = useMemo(() => {
    if (!t || t.teamCount == null) return null
    return Math.max(0, t.teamCount - linkedTeams.length)
  }, [t, linkedTeams.length])

  const deleteDialogMatchBullet = useMemo(() => {
    if (linkedMatchCount === null) {
      return 'All matches linked to this tournament, including ball-by-ball events and innings'
    }
    if (linkedMatchCount < 0) {
      return 'All matches linked to this tournament (could not load exact count), including ball-by-ball events and innings'
    }
    return `${linkedMatchCount} match${linkedMatchCount === 1 ? '' : 'es'} linked to this tournament, including ball-by-ball events and innings`
  }, [linkedMatchCount])

  async function saveTournamentDetails(e: FormEvent) {
    e.preventDefault()
    if (!id || !t) return
    setDetailsError(null)
    if (!editStart.trim() || !editEnd.trim()) {
      setDetailsError('Start date and end date are required.')
      return
    }
    // Past calendar dates are allowed here (unlike new tournament, which requires a future start).
    if (editEnd < editStart) {
      setDetailsError('End date must be on or after the start date.')
      return
    }
    if (editDefaultSquadSize < 2 || editDefaultSquadSize > 15) {
      setDetailsError('Players per team must be between 2 and 15.')
      return
    }
    if (editDefaultOversLimit < 1 || editDefaultOversLimit > 400) {
      setDetailsError('Overs limit must be between 1 and 400.')
      return
    }
    if (editDefaultOversPerBowler < 1 || editDefaultOversPerBowler > 100) {
      setDetailsError('Overs per bowler must be between 1 and 100.')
      return
    }
    try {
      await run(() =>
        updateDoc(doc(getDb(), 'tournaments', id), {
          name: editName.trim(),
          location: editLocation.trim() || null,
          startDate: dateInputToTimestamp(editStart),
          endDate: dateInputToTimestamp(editEnd),
          description: editDescription.trim(),
          isPublic: editIsPublic,
          defaultSquadSize: editDefaultSquadSize,
          defaultOversLimit: editDefaultOversLimit,
          defaultOversPerBowler: editDefaultOversPerBowler,
        }),
      )
      closeOverviewEdit()
    } catch (err) {
      setDetailsError(err instanceof Error ? err.message : 'Could not save tournament')
    }
  }

  function openDeleteTournamentDialog() {
    setError(null)
    setDeleteTournamentOpen(true)
  }

  function closeDeleteTournamentDialog() {
    setDeleteTournamentOpen(false)
    setError(null)
  }

  async function confirmDeleteTournament() {
    if (!id || !t || t.createdBy !== user?.uid) return
    setError(null)
    try {
      await run(() => deleteTournamentCascade(getDb(), id))
      closeDeleteTournamentDialog()
      navigate('/app/tournaments')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete tournament')
    }
  }

  const POT_KEY_SEP = '\x1f'

  async function openEndTournamentDialog() {
    if (!id || !t || t.createdBy !== user?.uid) return
    setEndTournamentError(null)
    setEndTournamentWinnerId('')
    setEndTournamentRunnerId('')
    setEndTournamentPotKey('')
    setStatsPlayersForPot([])
    try {
      const snap = await getDoc(doc(getDb(), 'tournaments', id, 'stats', 'summary'))
      const rows = snap.exists() ? ((snap.data() as StatsDoc).players ?? []) : []
      setStatsPlayersForPot(rows)
      const sorted = [...rows].sort(
        (a, b) =>
          b.mvpScore - a.mvpScore ||
          b.runs - a.runs ||
          b.wickets - a.wickets ||
          a.playerId.localeCompare(b.playerId),
      )
      const best = sorted[0]
      if (best) setEndTournamentPotKey(`${best.teamId}${POT_KEY_SEP}${best.playerId}`)
    } catch {
      setStatsPlayersForPot([])
    }
    setEndTournamentOpen(true)
  }

  function closeEndTournamentDialog() {
    setEndTournamentOpen(false)
    setEndTournamentError(null)
  }

  async function confirmEndTournament() {
    if (!id || !t || t.createdBy !== user?.uid) return
    if (!endTournamentWinnerId || !endTournamentRunnerId) {
      setEndTournamentError('Choose winner and runner-up.')
      return
    }
    if (endTournamentWinnerId === endTournamentRunnerId) {
      setEndTournamentError('Runner-up must be a different team than the winner.')
      return
    }
    if (!endTournamentPotKey.includes(POT_KEY_SEP)) {
      setEndTournamentError('Choose Player of the tournament.')
      return
    }
    const [potTeamId, potPlayerId] = endTournamentPotKey.split(POT_KEY_SEP)
    const potRow = statsPlayersForPot.find((p) => p.teamId === potTeamId && p.playerId === potPlayerId)
    if (!potRow) {
      setEndTournamentError('Could not resolve Player of the tournament.')
      return
    }
    const sortedDefault = [...statsPlayersForPot].sort(
      (a, b) =>
        b.mvpScore - a.mvpScore ||
        b.runs - a.runs ||
        b.wickets - a.wickets ||
        a.playerId.localeCompare(b.playerId),
    )
    const defaultKey = sortedDefault[0]
      ? `${sortedDefault[0]!.teamId}${POT_KEY_SEP}${sortedDefault[0]!.playerId}`
      : ''
    const potManual = Boolean(statsPlayersForPot.length && endTournamentPotKey !== defaultKey)
    setEndTournamentError(null)
    try {
      await run(async () => {
        await updateDoc(doc(getDb(), 'tournaments', id), {
          tournamentOutcome: {
            endedAt: serverTimestamp(),
            winnerLinkedTeamId: endTournamentWinnerId,
            runnerUpLinkedTeamId: endTournamentRunnerId,
            playerOfTheTournament: {
              playerId: potRow.playerId,
              name: potRow.name,
              teamId: potRow.teamId,
              source: potManual ? 'manual' : 'default',
            },
          },
        })
        await incrementPottForPlayer(getDb(), potRow.playerId, id, t.isPublic === true, potRow.name)
      })
      closeEndTournamentDialog()
    } catch (err) {
      setEndTournamentError(err instanceof Error ? err.message : 'Could not end tournament')
    }
  }

  function openAddTeamModal() {
    setAddTeamSearch('')
    setError(null)
    addTeamDialogRef.current?.showModal()
    queueMicrotask(() => addTeamSearchInputRef.current?.focus())
  }

  function closeAddTeamModal() {
    addTeamDialogRef.current?.close()
    setAddTeamSearch('')
    setLinkingSquadId(null)
  }

  async function linkSquad(userTeamId: string) {
    if (!id || !user?.uid || !t) return
    setError(null)
    const squad = myTeams.find((x) => x.id === userTeamId)
    if (!squad) return
    if (linkedTeams.some((l) => l.userTeamId === userTeamId)) {
      setError('That squad is already linked.')
      return
    }
    if (t.teamCount != null && linkedTeams.length >= t.teamCount) {
      setError(
        `This tournament is limited to ${t.teamCount} ${t.teamCount === 1 ? 'squad' : 'squads'}. Remove one before adding another.`,
      )
      return
    }
    setLinkingSquadId(userTeamId)
    try {
      await run(() =>
        addDoc(collection(getDb(), 'tournaments', id, 'linkedTeams'), {
          userTeamId,
          teamName: squad.name,
          ...(squad.shortName?.trim() ? { teamShortName: squad.shortName.trim() } : {}),
        } satisfies TournamentLinkedTeamDoc),
      )
      setError(null)
      if (t.teamCount != null && linkedTeams.length + 1 >= t.teamCount) {
        closeAddTeamModal()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not link team')
    } finally {
      setLinkingSquadId(null)
    }
  }

  async function confirmRemoveLinkedTeam() {
    if (!id || !linkedTeamToRemove) return
    const { id: linkDocId } = linkedTeamToRemove
    setError(null)
    try {
      await run(() => deleteDoc(doc(getDb(), 'tournaments', id, 'linkedTeams', linkDocId)))
      setLinkedTeamToRemove(null)
    } catch {
      setError('Could not remove link.')
      setLinkedTeamToRemove(null)
    }
  }

  const shellClass = 'public-tournament-detail mx-auto w-full max-w-3xl space-y-4'

  if (!id) {
    return (
      <div className={shellClass}>
        <p className="text-sm text-muted-foreground">Missing tournament.</p>
      </div>
    )
  }
  if (!user) {
    return (
      <div className={shellClass}>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    )
  }
  if (t === null) {
    return (
      <div className={shellClass}>
        <div className="space-y-2">
          <AppTournamentBackLink />
          <p className="mb-0 text-sm text-muted-foreground">Tournament not found.</p>
        </div>
      </div>
    )
  }
  if (t.createdBy !== user.uid) {
    return (
      <div className={shellClass}>
        <div className="space-y-1">
          <AppTournamentBackLink />
          <header className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Not authorized</h1>
            <p className="text-sm text-muted-foreground">You don’t manage this tournament.</p>
          </header>
        </div>
      </div>
    )
  }

  /** Every planned squad must be linked on Teams before scheduling (legacy tournaments without teamCount: at least two). */
  const squadsRequiredToSchedule = Math.max(2, t.teamCount ?? 0)
  const canScheduleMatches = linkedTeams.length >= squadsRequiredToSchedule
  const hasSchedulingGroups = tournamentGroups.length > 0
  const canOpenScheduleModal = canScheduleMatches && hasSchedulingGroups
  const tournamentEnded = Boolean(t.tournamentOutcome)

  function linkedTeamDisplayName(linkDocId: string): string {
    const row = linkedTeams.find((l) => l.id === linkDocId)
    if (!row) return linkDocId
    return row.teamName ?? myTeams.find((m) => m.id === row.userTeamId)?.name ?? row.userTeamId
  }

  function openScheduleMatchModal() {
    setScheduleDialogNonce((n) => n + 1)
    setScheduleMatchOpen(true)
  }

  return (
    <>
      <div className={shellClass}>
        <div className="space-y-1">
          <AppTournamentBackLink />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <header className="min-w-0 flex-1 space-y-1">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t.name}</h1>
              <p className="text-sm text-muted-foreground">
                {tournamentEnded
                  ? 'Final standings and results.'
                  : "You're the organiser — edit details, squads, fixtures, and standings here."}
              </p>
            </header>
            {!editOverview && !tournamentEnded && (
              <Button
                type="button"
                variant="outline"
                className="shrink-0"
                onClick={() => openOverviewEdit()}
                aria-label="Edit tournament details"
              >
                <Pencil strokeWidth={2} aria-hidden />
                Edit
              </Button>
            )}
          </div>
        </div>

        {tabScroll.overflow ? (
          <p id="tournament-tabs-scroll-hint-app" className="sr-only">
            This row scrolls horizontally; swipe or drag to see all sections.
          </p>
        ) : null}
        <div
          className={cn(
            'public-tournament-tabs-scroll-wrap',
            tabScroll.overflow && 'public-tournament-tabs-scroll-wrap--scrollable',
            tabScroll.overflow && tabScroll.hintLeft && 'public-tournament-tabs-scroll-wrap--hint-left',
            tabScroll.overflow && tabScroll.hintRight && 'public-tournament-tabs-scroll-wrap--hint-right',
          )}
        >
          <div
            ref={tabsNavRef}
            className="tabs-nav public-tournament-tabs-scroll-inner"
            role="tablist"
            aria-label="Tournament sections"
            aria-describedby={tabScroll.overflow ? 'tournament-tabs-scroll-hint-app' : undefined}
            onScroll={updateTabScrollHints}
          >
            {(
              [
                ['overview', 'Overview'],
                ['matches', 'Matches'],
                ['teams', 'Teams'],
                ['groups', 'Groups'],
                ['points', 'Point table'],
                ['leaderboard', 'Leaderboard'],
                ['mvp', 'MVP'],
              ] as const
            ).map(([tid, label]) => (
              <button
                key={tid}
                type="button"
                role="tab"
                aria-selected={activeTab === tid}
                id={`tab-${tid}`}
                className={`tabs-nav-item ${activeTab === tid ? 'tabs-nav-item--active' : ''}`}
                onClick={() => setTab(tid)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'overview' && (
          <div className="space-y-3" role="tabpanel" aria-labelledby="tab-overview">
            {tournamentEnded && t.tournamentOutcome && (
              <TournamentOutcomeOverviewCard
                outcome={t.tournamentOutcome}
                teamLabel={linkedTeamDisplayName}
                headingId="app-tournament-outcome-heading"
              />
            )}

            {!editOverview && (
              <>
                {(t.teamCount != null ||
                  t.location ||
                  t.startDate ||
                  t.endDate ||
                  t.description?.trim()) && (
                  <section
                    className="public-tournament-surface public-tournament-overview-card"
                    aria-labelledby={
                      t.teamCount != null || t.location || t.startDate || t.endDate
                        ? 'app-overview-details-heading'
                        : 'app-overview-about-heading'
                    }
                  >
                    {t.teamCount != null || t.location || t.startDate || t.endDate ? (
                      <>
                        <h3 id="app-overview-details-heading" className="public-tournament-overview-section-title">
                          Tournament details
                        </h3>
                        <div className="public-tournament-overview-rows">
                          {t.teamCount != null ? (
                            <OverviewDetailRow icon={Users} label="Teams">
                              {t.teamCount}
                            </OverviewDetailRow>
                          ) : null}
                          {t.location ? (
                            <OverviewDetailRow icon={MapPin} label="Location">
                              {t.location}
                            </OverviewDetailRow>
                          ) : null}
                          {(t.startDate || t.endDate) && (
                            <OverviewDetailRow icon={CalendarDays} label="Dates">
                              {t.startDate && t.endDate
                                ? `${formatTournamentDate(t.startDate)} — ${formatTournamentDate(t.endDate)}`
                                : t.startDate
                                  ? `Starts ${formatTournamentDate(t.startDate)}`
                                  : `Ends ${formatTournamentDate(t.endDate)}`}
                            </OverviewDetailRow>
                          )}
                        </div>
                      </>
                    ) : null}
                    {t.description?.trim() ? (
                      <div
                        className={cn(
                          'public-tournament-overview-about',
                          !(t.teamCount != null || t.location || t.startDate || t.endDate) &&
                            'public-tournament-overview-about--solo',
                        )}
                      >
                        <h4
                          id="app-overview-about-heading"
                          className="public-tournament-overview-about-heading"
                        >
                          <FileText className="public-tournament-overview-about-heading-icon" strokeWidth={2} aria-hidden />
                          About
                        </h4>
                        <div className="public-tournament-overview-about-body">{t.description}</div>
                      </div>
                    ) : null}
                  </section>
                )}
                <section
                  className="public-tournament-surface public-tournament-overview-card public-tournament-overview-defaults"
                  aria-labelledby="app-overview-defaults-heading"
                >
                  <h3 id="app-overview-defaults-heading" className="public-tournament-overview-defaults-title">
                    <Settings2 className="public-tournament-overview-defaults-title-icon" strokeWidth={2} aria-hidden />
                    Default match settings
                  </h3>
                  <div className="public-tournament-overview-rows">
                    <OverviewDetailRow icon={Users} label="Squad size">
                      {t.defaultSquadSize ?? 11} players per team
                    </OverviewDetailRow>
                    <OverviewDetailRow icon={Timer} label="Innings overs">
                      {t.defaultOversLimit ?? 20} overs
                    </OverviewDetailRow>
                    <OverviewDetailRow icon={SlidersHorizontal} label="Bowling limit">
                      {t.defaultOversPerBowler ?? 4} overs per bowler
                    </OverviewDetailRow>
                  </div>
                </section>
              </>
            )}

            {editOverview && (
              <form onSubmit={saveTournamentDetails} className="space-y-4" noValidate>
                <h2 className="text-lg font-bold tracking-tight text-slate-900">Edit tournament</h2>

                <section className={cn(teSection, 'space-y-4')}>
                  <div className="space-y-2">
                    <label htmlFor="edit-tournament-name" className="block text-sm font-semibold text-slate-900">
                      Name
                    </label>
                    <input
                      id="edit-tournament-name"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      required
                      disabled={writePending}
                      autoComplete="off"
                      className={teInput}
                    />
                  </div>
                  {t.teamCount != null && (
                    <p className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                      Number of teams: <strong>{t.teamCount}</strong> (set when the tournament was created)
                    </p>
                  )}
                </section>

                <section className={cn(teSection, 'space-y-5')}>
                  <div className="space-y-2">
                    <label htmlFor="edit-tournament-squad" className="block text-sm font-semibold text-slate-900">
                      Players per team
                    </label>
                    <input
                      id="edit-tournament-squad"
                      type="number"
                      min={2}
                      max={15}
                      step={1}
                      value={editDefaultSquadSize}
                      onChange={(e) => setEditDefaultSquadSize(Number(e.target.value))}
                      disabled={writePending}
                      className={teInput}
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="edit-tournament-overs" className="block text-sm font-semibold text-slate-900">
                      Overs limit (per innings)
                    </label>
                    <input
                      id="edit-tournament-overs"
                      type="number"
                      min={1}
                      max={400}
                      step={1}
                      value={editDefaultOversLimit}
                      onChange={(e) => setEditDefaultOversLimit(Number(e.target.value))}
                      disabled={writePending}
                      className={teInput}
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="edit-tournament-opb" className="block text-sm font-semibold text-slate-900">
                      Overs per bowler
                    </label>
                    <input
                      id="edit-tournament-opb"
                      type="number"
                      min={1}
                      max={100}
                      step={1}
                      value={editDefaultOversPerBowler}
                      onChange={(e) => setEditDefaultOversPerBowler(Number(e.target.value))}
                      disabled={writePending}
                      className={teInput}
                    />
                  </div>
                </section>

                <section className={teSection}>
                  <div className="flex items-start gap-2">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={2.2} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <label htmlFor="edit-tournament-location" className="text-sm font-semibold text-slate-900">
                        Venue / location
                      </label>
                      <p className="mt-1 text-xs leading-snug text-slate-500">
                        Shown on public listings and tournament detail.
                      </p>
                      <input
                        id="edit-tournament-location"
                        type="text"
                        value={editLocation}
                        onChange={(e) => setEditLocation(e.target.value)}
                        placeholder="e.g. Central Park Oval"
                        autoComplete="off"
                        disabled={writePending}
                        className={cn(teInput, 'mt-2')}
                      />
                    </div>
                  </div>
                </section>

                <section className={cn(teSection, 'space-y-4')}>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label htmlFor="edit-tournament-start" className="block text-sm font-semibold text-slate-900">
                        Start date
                      </label>
                      <div className="relative w-full">
                        {/* No min: editing may correct past or in-progress dates. Future-only start is enforced on TournamentNewPage only. */}
                        <input
                          id="edit-tournament-start"
                          type="date"
                          value={editStart}
                          onChange={(e) => {
                            const v = e.target.value
                            setEditStart(v)
                            if (editEnd && v && editEnd < v) setEditEnd('')
                          }}
                          required
                          disabled={writePending}
                          className={teDateInput}
                        />
                        <CalendarDays
                          className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-primary"
                          strokeWidth={2.2}
                          aria-hidden
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="edit-tournament-end" className="block text-sm font-semibold text-slate-900">
                        End date
                      </label>
                      <div className="relative w-full">
                        <input
                          id="edit-tournament-end"
                          type="date"
                          min={editStart || undefined}
                          value={editEnd}
                          onChange={(e) => setEditEnd(e.target.value)}
                          required
                          disabled={writePending}
                          className={teDateInput}
                        />
                        <CalendarDays
                          className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-primary"
                          strokeWidth={2.2}
                          aria-hidden
                        />
                      </div>
                    </div>
                  </div>
                </section>

                <section className={cn(teSection, 'space-y-2')}>
                  <label htmlFor="edit-tournament-description" className="block text-sm font-semibold text-slate-900">
                    Description
                  </label>
                  <textarea
                    id="edit-tournament-description"
                    rows={4}
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Format, notes, contact…"
                    disabled={writePending}
                    className={cn(teInput, 'min-h-[6.5rem] resize-y py-2.5')}
                  />
                </section>

                <section className={teSection}>
                  <label className="flex !flex-row flex-nowrap cursor-pointer items-center !gap-6 rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-[0_1px_3px_rgba(15,23,42,0.06)] transition-colors hover:border-slate-300 focus-within:ring-2 focus-within:ring-primary/25 focus-within:ring-offset-2">
                    <input
                      type="checkbox"
                      checked={editIsPublic}
                      onChange={(e) => setEditIsPublic(e.target.checked)}
                      disabled={writePending}
                      className="sr-only"
                    />
                    <span
                      aria-hidden
                      className={cn(
                        'relative inline-flex h-[30px] w-[52px] shrink-0 rounded-full p-[3px] transition-colors duration-200',
                        editIsPublic ? 'bg-rose-100' : 'bg-slate-200',
                      )}
                    >
                      <span
                        className={cn(
                          'absolute top-1/2 size-[22px] -translate-y-1/2 rounded-full shadow-md ring-1 ring-black/5 transition-all duration-200 ease-out',
                          editIsPublic ? 'right-[3px] bg-primary' : 'left-[3px] bg-white',
                        )}
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold text-slate-900">Public tournament</span>
                      <span className="mt-0.5 block text-sm font-normal text-slate-500">
                        Standings and discovery visible without login.
                      </span>
                    </span>
                  </label>
                </section>

                {detailsError ? (
                  <p
                    className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive"
                    role="alert"
                  >
                    {detailsError}
                  </p>
                ) : null}

                <Button
                  type="submit"
                  variant="default"
                  disabled={writePending}
                  className="h-12 w-full rounded-xl text-base font-bold !text-primary-foreground shadow-md disabled:opacity-60"
                >
                  <BtnPendingLabel pending={writePending} idle="Save details" />
                </Button>
                <div className="flex justify-center pt-1">
                  <Button type="button" variant="ghost" disabled={writePending} onClick={() => closeOverviewEdit()}>
                    Cancel
                  </Button>
                </div>
              </form>
            )}

          {!tournamentEnded && (
          <section
            className="public-tournament-surface public-tournament-overview-card"
            aria-labelledby="app-end-tournament-heading"
          >
            <h2 id="app-end-tournament-heading" className="public-tournament-overview-section-title">
              End tournament
            </h2>
            <p className="text-sm text-muted-foreground" style={{ marginTop: 0 }}>
              Record winner, runner-up, and Player of the tournament.
            </p>
            <button
              type="button"
              className="btn"
              style={{ marginTop: '0.65rem' }}
              disabled={writePending}
              onClick={() => void openEndTournamentDialog()}
            >
              End tournament…
            </button>
          </section>
          )}

          <section
            className="public-tournament-surface public-tournament-overview-card"
            style={{ borderColor: 'var(--destructive, #c0392b)' }}
            aria-labelledby="app-delete-tournament-heading"
          >
            <h2 id="app-delete-tournament-heading" className="public-tournament-overview-section-title">
              Delete tournament
            </h2>
            <p className="text-sm text-muted-foreground" style={{ marginTop: 0 }}>
              {linkedMatchCount === null
                ? 'Loading linked match count…'
                : linkedMatchCount < 0
                  ? 'Could not load how many matches are linked; delete still removes all matches with this tournament.'
                  : `${linkedMatchCount} linked match${linkedMatchCount === 1 ? '' : 'es'} will be removed with all ball-by-ball data.`}{' '}
              Standings and stats summaries for this tournament will be deleted. Team rosters are kept (same Firestore paths).
            </p>
            <button
              type="button"
              className="btn danger"
              style={{ marginTop: '0.65rem' }}
              disabled={writePending}
              onClick={() => openDeleteTournamentDialog()}
            >
              Delete tournament permanently
            </button>
          </section>
          </div>
        )}

      {activeTab === 'teams' && (
        <div role="tabpanel" aria-labelledby="tab-teams">
          {!tournamentEnded && (
            <p className="text-sm text-muted-foreground">
              Squads live under <Link to="/app/teams">My teams</Link>; link them here for standings and the fixture draw.
            </p>
          )}

          {!tournamentEnded && t.teamCount != null && linkedTeams.length >= t.teamCount && (
            <p className="muted small" style={{ marginTop: '0.75rem' }}>
              All {t.teamCount} squads for this tournament are linked. Remove a squad to add a different one.
            </p>
          )}

          {!tournamentEnded && !(t.teamCount != null && linkedTeams.length >= t.teamCount) && (
            <div className="tourn-team-or" aria-hidden="true">
              <span className="tourn-team-or-line" />
              <span className="tourn-team-or-text">OR</span>
              <span className="tourn-team-or-line" />
            </div>
          )}

          <div className="tourn-team-grid">
            {!tournamentEnded && !(t.teamCount != null && linkedTeams.length >= t.teamCount) && (
              <div className="tourn-team-card tourn-team-card--add">
                <button
                  type="button"
                  className="tourn-team-card-visual tourn-team-card-visual--add tourn-team-card-plus-btn"
                  aria-label="Open add team dialog"
                  disabled={writePending}
                  onClick={() => openAddTeamModal()}
                >
                  +
                </button>
                <div className="tourn-team-card-footer">
                  <span className="tourn-team-card-kicker">Add teams</span>
                  <p className="tourn-team-card-hint muted small">
                    Click <strong>+</strong> to search squads from My teams and add them to this tournament.
                  </p>
                  {myTeams.length === 0 && (
                    <p className="tourn-team-card-hint muted small">
                      No squads yet — <Link to="/app/teams/new">create one</Link> first.
                    </p>
                  )}
                </div>
              </div>
            )}

            {linkedTeams.map((l) => {
              const squad = myTeams.find((m) => m.id === l.userTeamId)
              const label = l.teamName ?? squad?.name ?? l.userTeamId
              const shortName = squad?.shortName?.trim() || l.teamShortName?.trim()
              const hue = teamAvatarHue(label)
              return (
                <article key={l.id} className="tourn-team-card">
                  <div
                    className="tourn-team-card-visual"
                    style={{ background: `hsl(${hue} 32% 38%)` }}
                    aria-hidden="true"
                  >
                    <span className="tourn-team-card-initials">
                      {tournTeamCardAvatarLabel({ name: label, shortName })}
                    </span>
                  </div>
                  <div className="tourn-team-card-footer">
                    <strong className="tourn-team-card-title">{label}</strong>
                    {!tournamentEnded ? (
                      <div className="tourn-team-card-actions">
                        <Link className="tourn-team-card-link" to={`/app/teams/${l.userTeamId}`}>
                          Edit roster
                        </Link>
                        <button
                          type="button"
                          className="tourn-team-card-remove"
                          disabled={writePending}
                          onClick={() => setLinkedTeamToRemove({ id: l.id, label })}
                        >
                          Remove
                        </button>
                      </div>
                    ) : null}
                  </div>
                </article>
              )
            })}
          </div>
          {error && (
            <p className="error" style={{ marginTop: '1rem' }}>
              {error}
            </p>
          )}
        </div>
      )}

      {activeTab === 'matches' && (
        <div role="tabpanel" aria-labelledby="tab-matches">
          {!tournamentEnded && (
            <p className="text-sm text-muted-foreground">
              Link every squad on <strong className="font-semibold text-slate-700">Teams</strong>, add groups on{' '}
              <strong className="font-semibold text-slate-700">Groups</strong>, then use{' '}
              <strong className="font-semibold text-slate-700">Schedule match</strong>.
              {t.teamCount != null ? (
                <>
                  {' '}
                  ({linkedTeams.length} of {t.teamCount} squads linked
                  {tournamentGroups.length > 0 ? ` · ${tournamentGroups.length} group${tournamentGroups.length === 1 ? '' : 's'}` : ' · no groups yet'}).
                </>
              ) : (
                <>
                  {' '}
                  (at least two squads{hasSchedulingGroups ? '' : '; at least one group required'}).
                </>
              )}
            </p>
          )}
          {!tournamentEnded && (
            <div className="flex flex-wrap items-center gap-2 gap-y-2" style={{ marginTop: '0.75rem', marginBottom: '1rem' }}>
              <Button
                type="button"
                variant="default"
                className="font-semibold shadow-sm"
                disabled={writePending || !canOpenScheduleModal}
                onClick={() => openScheduleMatchModal()}
                title={
                  !canScheduleMatches
                    ? t.teamCount != null
                      ? `Link all ${t.teamCount} squads on the Teams tab (${linkedTeams.length} linked so far)`
                      : 'Link every squad on the Teams tab before scheduling (need at least two)'
                    : !hasSchedulingGroups
                      ? 'Create at least one group on the Groups tab before scheduling matches'
                      : undefined
                }
              >
                Schedule match
              </Button>
              {!canScheduleMatches && (
                <span className="text-sm text-muted-foreground">
                  {t.teamCount != null ? (
                    <>
                      Link all {t.teamCount} squads on <strong className="font-semibold text-slate-700">Teams</strong> first ({linkedTeams.length}{' '}
                      of {t.teamCount} linked).
                    </>
                  ) : (
                    <>
                      Link every squad on <strong className="font-semibold text-slate-700">Teams</strong> first (need at least two).
                    </>
                  )}
                </span>
              )}
              {canScheduleMatches && !hasSchedulingGroups && (
                <span className="text-sm text-muted-foreground">
                  Create at least one group on <strong className="font-semibold text-slate-700">Groups</strong> before scheduling.
                </span>
              )}
            </div>
          )}

          {tournamentMatchesError && (
            <p className="text-sm text-destructive" role="alert">
              {tournamentMatchesError}
            </p>
          )}
          {!tournamentMatchesError && tournamentMatches.length === 0 && (
            <p className="text-sm text-muted-foreground">No matches in this tournament yet.</p>
          )}
          {!tournamentMatchesError && tournamentMatches.length > 0 && (
            <ul className="public-tournament-match-list">
              {tournamentMatchesSorted.map((m) => {
                const headMeta = publicTournamentMatchHeadMeta(m, t.location)
                return (
                  <li key={m.id} className="public-tournament-match-item">
                    <article className="match-scorecard match-scorecard--listing public-tournament-match-scorecard">
                      <div className="match-scorecard-head">
                        <span className="match-scorecard-kicker-group">
                          {m.status === 'live' ? <span className="match-scorecard-live-dot" aria-hidden /> : null}
                          <span
                            className={cn(
                              'match-scorecard-kicker',
                              m.status === 'live'
                                ? 'match-scorecard-kicker--live'
                                : 'match-scorecard-kicker--result',
                            )}
                          >
                            {publicTournamentMatchKicker(m.status)}
                          </span>
                        </span>
                        {headMeta ? (
                          <span className="match-scorecard-meta match-scorecard-meta--listing">{headMeta}</span>
                        ) : null}
                      </div>

                      <div className="public-tournament-match-body">
                        {m.status === 'scheduled' && (
                          <p className="public-tournament-match-teams-line">
                            <span className="match-scorecard-teamname">{m.home.name}</span>
                            <span className="public-tournament-match-vs" aria-hidden>
                              vs
                            </span>
                            <span className="match-scorecard-teamname">{m.away.name}</span>
                          </p>
                        )}
                        <PublicTournamentMatchScoreLines match={m} allowPrivateReplay />
                      </div>

                      <div className="match-scorecard-upcoming-footer public-tournament-match-card-footer">
                        <div className="public-tournament-match-footer-inner">
                          {m.status === 'scheduled' && (
                            <p className="public-tournament-match-foot-note">
                              Scheduled {formatMatchDateTime(m.scheduledAt)}
                            </p>
                          )}
                          {m.status === 'live' && m.startedAt && (
                            <p className="public-tournament-match-foot-note">
                              Started {formatMatchDateTime(m.startedAt)}
                            </p>
                          )}
                          <div className="flex flex-wrap gap-x-3 gap-y-1">
                            {m.status === 'scheduled' && (
                              <Link className="public-tournament-match-foot-link" to={`/app/matches/${m.id}/edit`}>
                                Edit fixture
                              </Link>
                            )}
                            {(m.status === 'scheduled' || m.status === 'live') && (
                              <Link className="public-tournament-match-foot-link" to={`/app/matches/${m.id}/score`}>
                                {m.status === 'scheduled' ? 'Start match' : 'Resume scoring'}
                              </Link>
                            )}
                            {m.status !== 'scheduled' && (
                              <Link
                                className="public-tournament-match-foot-link"
                                to={`/live/${m.publicId}`}
                              >
                                View scorecard
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                    </article>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      {activeTab === 'groups' && (
        <div className="space-y-3" role="tabpanel" aria-labelledby="tab-groups">
          <TournamentGroupsTab
            tournamentId={id!}
            linkedTeams={linkedTeams}
            writePending={writePending}
            run={run}
            readOnly={tournamentEnded}
          />
        </div>
      )}

      {activeTab === 'points' && (
        <div role="tabpanel" aria-labelledby="tab-points">
          <TournamentPointsPanel tournamentId={id!} variant="public" />
        </div>
      )}

      {activeTab === 'leaderboard' && (
        <div role="tabpanel" aria-labelledby="tab-leaderboard">
          <TournamentLeaderboardTab
            tournamentId={id!}
            tournament={t}
            teamLabel={linkedTeamDisplayName}
            publicListing
          />
        </div>
      )}

      {activeTab === 'mvp' && (
        <div role="tabpanel" aria-labelledby="tab-mvp">
          <TournamentMvpTab tournamentId={id!} tournament={t} teamLabel={linkedTeamDisplayName} publicListing />
        </div>
      )}
      </div>

      <EndTournamentDialog
        open={endTournamentOpen}
        onClose={() => closeEndTournamentDialog()}
        tournamentName={t.name}
        teamOptions={linkedTeams.map((l) => ({ id: l.id, label: linkedTeamDisplayName(l.id) }))}
        statsPlayers={statsPlayersForPot}
        potKeySep={POT_KEY_SEP}
        winnerId={endTournamentWinnerId}
        onWinnerChange={setEndTournamentWinnerId}
        runnerId={endTournamentRunnerId}
        onRunnerChange={setEndTournamentRunnerId}
        potKey={endTournamentPotKey}
        onPotKeyChange={setEndTournamentPotKey}
        error={endTournamentError}
        writePending={writePending}
        onSubmit={() => void confirmEndTournament()}
      />

      <DeleteTournamentDialog
        open={deleteTournamentOpen}
        onClose={() => closeDeleteTournamentDialog()}
        tournamentName={t.name}
        matchBullet={deleteDialogMatchBullet}
        error={error}
        writePending={writePending}
        onConfirm={() => void confirmDeleteTournament()}
      />

      <ScheduleTournamentMatchDialog
        open={scheduleMatchOpen}
        onClose={() => setScheduleMatchOpen(false)}
        openNonce={scheduleDialogNonce}
        tournamentId={id}
        tournament={t}
        linkedTeams={linkedTeams}
        myTeams={myTeams}
        organiserUid={user.uid}
        writePending={writePending}
        run={run}
        onGoToGroupsTab={() => setTab('groups')}
      />

      <AlertDialog open={linkedTeamToRemove != null} onOpenChange={(open) => !open && setLinkedTeamToRemove(null)}>
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
            <AlertDialogTitle className="text-center text-lg font-bold text-slate-900">
              Remove squad from tournament?
            </AlertDialogTitle>
            <AlertDialogDescription className="mt-2 px-0.5 text-center text-sm leading-relaxed text-slate-500">
              Remove{' '}
              {linkedTeamToRemove ? (
                <span className="font-semibold text-slate-700">{linkedTeamToRemove.label}</span>
              ) : (
                'this squad'
              )}{' '}
              from the tournament draw? Standings and scheduled fixtures that use this squad are not deleted, but the
              squad will no longer appear in this tournament.
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
              disabled={writePending}
              onClick={() => void confirmRemoveLinkedTeam()}
            >
              Remove
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <dialog
        ref={addTeamDialogRef}
        className="team-picker-dialog team-picker-dialog--squad"
        aria-labelledby={addTeamDialogTitleId}
        onClose={() => setAddTeamSearch('')}
      >
        <TournamentAddSquadDialogContent
          titleId={addTeamDialogTitleId}
          search={addTeamSearch}
          onSearchChange={setAddTeamSearch}
          searchInputRef={addTeamSearchInputRef}
          linkableTeams={linkableTeams}
          filteredLinkableTeams={filteredLinkableTeams}
          hasAnySquads={myTeams.length > 0}
          teamSlotsRemaining={teamSlotsRemaining}
          writePending={writePending}
          linkingSquadId={linkingSquadId}
          error={error}
          onSelectSquad={(teamId) => void linkSquad(teamId)}
          onClose={() => closeAddTeamModal()}
        />
      </dialog>
    </>
  )
}
