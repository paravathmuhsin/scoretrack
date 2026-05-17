import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from 'firebase/firestore'
import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '../auth/useAuth'
import { MatchFormCreateFields } from '../components/MatchFormCreateFields'
import { MatchTeamPickerDialogContent } from '../components/MatchTeamPickerDialogContent'
import { Spinner } from '../components/Spinner'
import { usePendingWrites } from '../hooks/usePendingWrites'
import { getDb } from '../firebase/config'
import { deleteMatchCascade } from '../lib/deleteMatchCascade'
import { fetchMatchEvents } from '../lib/matchEvents'
import { buildTournamentFixtureLabel, TOURNAMENT_ROUND_OPTIONS } from '../lib/tournamentFixtureLabel'
import { buildTournamentEntrySnapshot } from '../lib/tournamentMatchSnapshots'
import { buildSnapshotFromUserTeam } from '../lib/userTeamSnapshot'
import {
  canEditMatchPlayingConstraints,
  replayEvents,
  validatePlayingConstraintPatch,
  type ReplayConfig,
} from '../scoring/engine'
import type {
  MatchDoc,
  MatchStatus,
  MatchTeamSnapshot,
  TeamDoc,
  TournamentDoc,
  TournamentGroupDoc,
  TournamentLinkedTeamDoc,
  TournamentRoundType,
} from '../types/models'
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

const DEFAULT_SQUAD_SIZE = 11

const ROUND_TYPES = new Set<TournamentRoundType>(TOURNAMENT_ROUND_OPTIONS.map((o) => o.value))

/** Best-effort resolve saved team id when opening an older match in edit. */
function resolvePickFromStored(side: MatchTeamSnapshot, myTeams: (TeamDoc & { id: string })[]): string {
  if (side.userTeamId && myTeams.some((x) => x.id === side.userTeamId)) return side.userTeamId
  const hit = myTeams.find((x) => x.name.trim() === side.name.trim())
  if (!hit) return ''
  if (hit.players.length !== side.players.length) return ''
  const a = new Set(hit.players.map((p) => p.playerId))
  const b = new Set(side.players.map((p) => p.playerId))
  if (a.size !== b.size) return ''
  for (const id of a) if (!b.has(id)) return ''
  return hit.id
}

export function MatchFormPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const [searchParams] = useSearchParams()
  const tournamentIdFromUrl = searchParams.get('tournamentId')
  const roundFromUrl = searchParams.get('round')
  const groupFromUrl = searchParams.get('groupId') ?? ''
  const { user } = useAuth()
  const nav = useNavigate()
  const pickerDialogRef = useRef<HTMLDialogElement>(null)
  const pickerSearchInputRef = useRef<HTMLInputElement>(null)
  const squadPickerTitleId = useId()

  const [editTournamentId, setEditTournamentId] = useState<string | null>(null)
  const tournamentId = isEdit ? editTournamentId : tournamentIdFromUrl

  const [tournamentName, setTournamentName] = useState<string | null>(null)
  const [tournamentDescription, setTournamentDescription] = useState<string | null>(null)
  const [myTeams, setMyTeams] = useState<(TeamDoc & { id: string })[]>([])

  const [pickA, setPickA] = useState('')
  const [pickB, setPickB] = useState('')
  const [pickerSide, setPickerSide] = useState<'A' | 'B' | null>(null)
  const [pickerSearch, setPickerSearch] = useState('')

  const [squadSize, setSquadSize] = useState(DEFAULT_SQUAD_SIZE)
  const [oversLimit, setOversLimit] = useState(20)
  const [oversPerBowler, setOversPerBowler] = useState(4)
  const [scheduleMode, setScheduleMode] = useState<'now' | 'later'>(() => 'later')
  const [scheduledAt, setScheduledAt] = useState(() => {
    const d = new Date()
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
    return d.toISOString().slice(0, 16)
  })
  const [isPublic, setIsPublic] = useState(true)
  const [freeHitOnNoBall, setFreeHitOnNoBall] = useState(false)
  const [venue, setVenue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [fixtureMode, setFixtureMode] = useState<MatchStatus | 'loading' | null>(null)
  const [deleteMatchDialogOpen, setDeleteMatchDialogOpen] = useState(false)
  const { writePending, run } = usePendingWrites()

  const [linkedForTournament, setLinkedForTournament] = useState<(TournamentLinkedTeamDoc & { id: string })[]>([])
  const [groupsForTournament, setGroupsForTournament] = useState<(TournamentGroupDoc & { id: string })[]>([])
  const [tournamentRound, setTournamentRound] = useState<TournamentRoundType | ''>(() =>
    roundFromUrl && ROUND_TYPES.has(roundFromUrl as TournamentRoundType)
      ? (roundFromUrl as TournamentRoundType)
      : '',
  )
  const [tournamentGroupId, setTournamentGroupId] = useState(groupFromUrl)


  useEffect(() => {
    if (!tournamentId) return
    let cancelled = false
    void (async () => {
      const snap = await getDoc(doc(getDb(), 'tournaments', tournamentId))
      if (cancelled) return
      if (!snap.exists()) {
        setTournamentName(null)
        setTournamentDescription(null)
        return
      }
      const tournament = snap.data() as TournamentDoc
      setTournamentName(tournament.name)
      setTournamentDescription(tournament.description?.trim() || null)
    })()
    return () => {
      cancelled = true
    }
  }, [tournamentId])

  /** Tournament scheduling uses the modal on the tournament page; keep old URLs working. */
  useEffect(() => {
    if (isEdit || !tournamentIdFromUrl) return
    nav(`/app/tournaments/${tournamentIdFromUrl}?tab=matches&schedule=1`, { replace: true })
  }, [isEdit, tournamentIdFromUrl, nav])

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
    if (!tournamentId || !user?.uid) {
      setLinkedForTournament([])
      setGroupsForTournament([])
      return
    }
    const db = getDb()
    const u1 = onSnapshot(collection(db, 'tournaments', tournamentId, 'linkedTeams'), (snap) => {
      const list: (TournamentLinkedTeamDoc & { id: string })[] = []
      snap.forEach((d) => list.push({ id: d.id, ...(d.data() as TournamentLinkedTeamDoc) }))
      list.sort((a, b) => (a.teamName ?? '').localeCompare(b.teamName ?? '') || a.userTeamId.localeCompare(b.userTeamId))
      setLinkedForTournament(list)
    })
    const u2 = onSnapshot(collection(db, 'tournaments', tournamentId, 'groups'), (snap) => {
      const list: (TournamentGroupDoc & { id: string })[] = []
      snap.forEach((d) => list.push({ id: d.id, ...(d.data() as TournamentGroupDoc) }))
      list.sort((a, b) => a.name.localeCompare(b.name))
      setGroupsForTournament(list)
    })
    return () => {
      u1()
      u2()
    }
  }, [tournamentId, user?.uid])

  useEffect(() => {
    if (!isEdit || !id) {
      if (!isEdit) {
        setFixtureMode(null)
      }
      return
    }
    setFixtureMode('loading')
    void (async () => {
      const snap = await getDoc(doc(getDb(), 'matches', id))
      if (!snap.exists()) {
        setFixtureMode(null)
        return
      }
      const m = snap.data() as MatchDoc
      setFixtureMode(m.status)
      setEditTournamentId(m.tournamentId)
      setSquadSize(m.squadSize)
      setOversLimit(m.oversLimit)
      setOversPerBowler(m.oversPerBowler ?? 4)
      setIsPublic(m.isPublic)
      setFreeHitOnNoBall(m.freeHitOnNoBall === true)
      setVenue(typeof m.venue === 'string' ? m.venue : '')
      if (m.scheduledAt && 'toDate' in m.scheduledAt) {
        const d = m.scheduledAt.toDate()
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
        setScheduledAt(d.toISOString().slice(0, 16))
      }
      setScheduleMode('later')
      setTournamentRound((m.tournamentRound as TournamentRoundType) ?? '')
      setTournamentGroupId(typeof m.tournamentGroupId === 'string' ? m.tournamentGroupId : '')
    })()
  }, [id, isEdit])

  useEffect(() => {
    if (!isEdit || !id || myTeams.length === 0) return
    void (async () => {
      const snap = await getDoc(doc(getDb(), 'matches', id))
      if (!snap.exists()) return
      const m = snap.data() as MatchDoc
      setPickA(resolvePickFromStored(m.home, myTeams))
      setPickB(resolvePickFromStored(m.away, myTeams))
    })()
  }, [id, isEdit, myTeams])

  useEffect(() => {
    if (!pickerSide) return
    pickerSearchInputRef.current?.focus()
  }, [pickerSide])

  function openPicker(side: 'A' | 'B') {
    if (isEdit) {
      nav('/app/teams')
      return
    }
    setPickerSearch('')
    setPickerSide(side)
    pickerDialogRef.current?.showModal()
  }

  function closePicker() {
    pickerDialogRef.current?.close()
    setPickerSide(null)
    setPickerSearch('')
  }

  function onPickerDialogClose() {
    setPickerSide(null)
    setPickerSearch('')
  }

  function selectTeam(teamId: string) {
    if (pickerSide === 'A') setPickA(teamId)
    if (pickerSide === 'B') setPickB(teamId)
    closePicker()
  }

  const previewA = pickA ? myTeams.find((t) => t.id === pickA) : undefined
  const previewB = pickB ? myTeams.find((t) => t.id === pickB) : undefined

  const excludeId = pickerSide === 'A' ? pickB : pickA
  const pickerOptions = useMemo(() => {
    let list = myTeams.filter((t) => t.id !== excludeId)
    if (tournamentId && linkedForTournament.length > 0) {
      const allow = new Set(linkedForTournament.map((l) => l.userTeamId))
      list = list.filter((t) => allow.has(t.id))
    }
    return list
  }, [myTeams, excludeId, tournamentId, linkedForTournament])

  const filteredPickerOptions = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase()
    if (!q) return pickerOptions
    return pickerOptions.filter((t) => t.name.toLowerCase().includes(q))
  }, [pickerOptions, pickerSearch])

  const matchDisplayTitle = useMemo(() => {
    if (previewA && previewB) return `${previewA.name} vs ${previewB.name}`
    return 'this match'
  }, [previewA, previewB])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    setError(null)

    try {
      if (isEdit && id) {
        const ref = doc(getDb(), 'matches', id)
        const cur = await getDoc(ref)
        const m = cur.data() as MatchDoc | undefined
        if (!m) {
          setError('Match not found.')
          return
        }
        if (m.status === 'live') {
          if (squadSize < 2 || squadSize > 15) {
            setError('Players per team must be between 2 and 15.')
            return
          }
          if (oversLimit < 1 || oversLimit > 400) {
            setError('Overs limit must be between 1 and 400.')
            return
          }
          if (!m.lineup) {
            setError('Start the match from the score page before changing playing conditions.')
            return
          }
          const events = await fetchMatchEvents(id)
          const cfgCurrent: ReplayConfig = {
            squadSize: m.squadSize,
            oversLimit: m.oversLimit,
            ballsPerOver: m.ballsPerOver ?? 6,
            oversPerBowler: m.oversPerBowler ?? null,
            lineup: m.lineup,
            homeName: m.home.name,
            awayName: m.away.name,
          }
          const st = replayEvents(cfgCurrent, events)
          const constraintsOk = canEditMatchPlayingConstraints(cfgCurrent, st)
          if (
            !constraintsOk &&
            (squadSize !== m.squadSize ||
              oversLimit !== m.oversLimit ||
              oversPerBowler !== (m.oversPerBowler ?? 4))
          ) {
            setError('XI size and overs can only be changed until the first innings ends.')
            return
          }
          const v = validatePlayingConstraintPatch(cfgCurrent, st, {
            squadSize,
            oversLimit,
            oversPerBowler,
          })
          if (v) {
            setError(v)
            return
          }
          if (!m.tournamentId && !venue.trim()) {
            setError('Venue / location is required.')
            return
          }
          const venueField = m.tournamentId ? null : venue.trim() || null
          const payload: {
            isPublic: boolean
            venue: string | null
            freeHitOnNoBall: boolean
            squadSize?: number
            oversLimit?: number
            oversPerBowler?: number
          } = { isPublic, venue: venueField, freeHitOnNoBall }
          if (constraintsOk) {
            payload.squadSize = squadSize
            payload.oversLimit = oversLimit
            payload.oversPerBowler = oversPerBowler
          }
          await run(() => updateDoc(ref, payload))
          nav(`/app/matches/${id}/score`)
          return
        }
        if (m.status === 'completed' || m.status === 'abandoned') {
          if (!m.tournamentId && !venue.trim()) {
            setError('Venue / location is required.')
            return
          }
          const venueField = m.tournamentId ? null : venue.trim() || null
          await run(() => updateDoc(ref, { isPublic, venue: venueField, freeHitOnNoBall }))
          nav(`/app/matches/${id}/score`)
          return
        }
        if (m.status !== 'scheduled') {
          setError('This match cannot be edited here.')
          return
        }
      }

      if (!pickA || !pickB) {
        setError(null)
        toast.warning('Choose home team and away team from My teams.')
        return
      }
      if (pickA === pickB) {
        setError('Home team and away team must be different squads.')
        return
      }

      const ta = myTeams.find((t) => t.id === pickA)
      const tb = myTeams.find((t) => t.id === pickB)
      if (!ta || !tb) {
        setError('Selected teams are no longer available. Refresh and pick again.')
        return
      }

      if (tournamentId) {
        if (!tournamentRound) {
          setError('Select a round / stage for this tournament match.')
          return
        }
        if (tournamentRound === 'league' && !tournamentGroupId) {
          setError('League matches need a group. Add one under Tournament → Groups.')
          return
        }
      }

      const linkIdA = tournamentId ? linkedForTournament.find((l) => l.userTeamId === pickA)?.id : undefined
      const linkIdB = tournamentId ? linkedForTournament.find((l) => l.userTeamId === pickB)?.id : undefined
      if (tournamentId && (!linkIdA || !linkIdB)) {
        setError('Both squads must be linked to this tournament (Tournament → Teams).')
        return
      }

      const groupName =
        tournamentRound === 'league' && tournamentGroupId
          ? groupsForTournament.find((g) => g.id === tournamentGroupId)?.name
          : undefined
      const fixtureLabel =
        tournamentId && tournamentRound
          ? buildTournamentFixtureLabel(ta.name, tb.name, tournamentRound, groupName)
          : undefined

      let home: MatchTeamSnapshot
      let away: MatchTeamSnapshot
      if (tournamentId && linkIdA && linkIdB) {
        home = buildTournamentEntrySnapshot(ta, linkIdA)
        away = buildTournamentEntrySnapshot(tb, linkIdB)
      } else {
        home = buildSnapshotFromUserTeam(ta)
        away = buildSnapshotFromUserTeam(tb)
      }

      if (squadSize < 2 || squadSize > 15) {
        setError('Players per team must be between 2 and 15.')
        return
      }

      const scheduled = scheduleMode === 'now' ? new Date() : new Date(scheduledAt)
      if (scheduleMode === 'later' && Number.isNaN(scheduled.getTime())) {
        setError('Pick a valid start date and time.')
        return
      }
      if (scheduleMode === 'later' && scheduled.getTime() <= Date.now()) {
        setError('Start date and time must be in the future.')
        return
      }

      if (!tournamentId && !venue.trim()) {
        setError('Venue / location is required.')
        return
      }

      const tournamentMeta =
        tournamentId && tournamentRound
          ? {
              tournamentRound,
              tournamentGroupId: tournamentRound === 'league' ? tournamentGroupId || null : null,
              tournamentFixtureLabel: fixtureLabel ?? null,
            }
          : null

      const venueField = tournamentId ? null : venue.trim() || null

      if (isEdit && id) {
        const ref = doc(getDb(), 'matches', id)
        await run(() =>
          updateDoc(ref, {
            tournamentId,
            home,
            away,
            squadSize,
            oversLimit,
            oversPerBowler,
            ballsPerOver: 6,
            scheduledAt: Timestamp.fromDate(scheduled),
            isPublic,
            freeHitOnNoBall,
            venue: venueField,
            ...(tournamentMeta ?? {}),
          }),
        )
      } else {
        const publicId = crypto.randomUUID()
        const docRef = await run(() =>
          addDoc(collection(getDb(), 'matches'), {
            tournamentId,
            home,
            away,
            squadSize,
            oversLimit,
            oversPerBowler,
            ballsPerOver: 6,
            scheduledAt: Timestamp.fromDate(scheduled),
            status: 'scheduled',
            createdBy: user.uid,
            isPublic,
            freeHitOnNoBall,
            publicId,
            lastEventSeq: 0,
            createdAt: serverTimestamp(),
            venue: venueField,
            ...(tournamentMeta ?? {}),
          }),
        )
        if (scheduleMode === 'now') {
          nav(`/app/matches/${docRef.id}/score`)
        } else {
          nav(tournamentId ? `/app/tournaments/${tournamentId}?tab=matches` : '/app/matches')
        }
        return
      }
      nav('/app/matches')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    }
  }

  const backLink = tournamentId ? `/app/tournaments/${tournamentId}?tab=matches` : '/app/matches'
  const scheduleFormActive = !isEdit || fixtureMode === 'scheduled'
  const tournamentMetaOk =
    !tournamentId ||
    (Boolean(tournamentRound) && (tournamentRound !== 'league' || Boolean(tournamentGroupId)))
  const linkedSquadsOk = !tournamentId || linkedForTournament.length >= 2
  const canSubmit =
    isEdit && fixtureMode === 'loading'
      ? false
      : scheduleFormActive
        ? (tournamentId ? linkedSquadsOk && tournamentMetaOk : myTeams.length >= 2)
        : true

  const tournamentStageRoundLabel = useMemo(() => {
    if (!tournamentRound) return null
    return TOURNAMENT_ROUND_OPTIONS.find((o) => o.value === tournamentRound)?.label ?? tournamentRound
  }, [tournamentRound])

  const tournamentStageGroupLabel = useMemo(() => {
    if (tournamentRound !== 'league' || !tournamentGroupId) return null
    return groupsForTournament.find((g) => g.id === tournamentGroupId)?.name ?? null
  }, [tournamentRound, tournamentGroupId, groupsForTournament])

  if (!isEdit && tournamentIdFromUrl) {
    return (
      <div className="match-form">
        <p className="muted">Opening tournament scheduler…</p>
      </div>
    )
  }

  if (isEdit && fixtureMode === 'loading') {
    return (
      <div className="match-form">
        <header className="match-form-head">
          <Link
            to={backLink}
            className="inline-flex items-center gap-1.5 text-sm font-medium no-underline !text-primary hover:underline hover:!text-primary visited:!text-primary"
          >
            <ArrowLeft className="size-4 shrink-0" strokeWidth={2.5} aria-hidden />
            {tournamentId ? 'Tournament' : 'My matches'}
          </Link>
          <h1 className="match-form-title">Edit match</h1>
        </header>
        <p className="muted">Loading…</p>
      </div>
    )
  }

  if (!isEdit) {
    return (
      <div className="mx-auto w-full max-w-[640px] pb-2">
        <header className="mb-1">
          <Link to="/app/matches" className="text-sm font-semibold !text-primary hover:underline">
            ← My matches
          </Link>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Create a match</h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Set up your match details and start scoring.
          </p>
        </header>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <MatchFormCreateFields
            pickA={pickA}
            pickB={pickB}
            previewA={previewA}
            previewB={previewB}
            openPicker={openPicker}
            squadSize={squadSize}
            setSquadSize={setSquadSize}
            oversLimit={oversLimit}
            setOversLimit={setOversLimit}
            oversPerBowler={oversPerBowler}
            setOversPerBowler={setOversPerBowler}
            scheduleMode={scheduleMode}
            setScheduleMode={setScheduleMode}
            scheduledAt={scheduledAt}
            setScheduledAt={setScheduledAt}
            isPublic={isPublic}
            setIsPublic={setIsPublic}
            freeHitOnNoBall={freeHitOnNoBall}
            setFreeHitOnNoBall={setFreeHitOnNoBall}
            canSubmit={canSubmit}
            writePending={writePending}
            error={error}
            teamSelectionDisabled={isEdit}
            friendlyVenue={venue}
            setFriendlyVenue={setVenue}
            showFriendlyVenue={!tournamentId}
          />
        </form>

        <dialog
          ref={pickerDialogRef}
          className="team-picker-dialog team-picker-dialog--squad"
          aria-labelledby={squadPickerTitleId}
          onClose={onPickerDialogClose}
        >
          <MatchTeamPickerDialogContent
            titleId={squadPickerTitleId}
            pickerSide={pickerSide}
            pickerSearch={pickerSearch}
            onPickerSearchChange={setPickerSearch}
            searchInputRef={pickerSearchInputRef}
            pickerOptions={pickerOptions}
            filteredPickerOptions={filteredPickerOptions}
            excludeId={excludeId}
            tournamentId={tournamentId}
            onSelectTeam={selectTeam}
            onClose={() => closePicker()}
          />
        </dialog>
      </div>
    )
  }

  return (
    <div className="match-form">
      <AlertDialog open={deleteMatchDialogOpen} onOpenChange={setDeleteMatchDialogOpen}>
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
              <span className="font-semibold text-slate-700">{matchDisplayTitle}</span>? All score events and innings
              data will be removed. This cannot be undone.
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
              disabled={writePending || !id}
              onClick={() => {
                void (async () => {
                  if (!id) return
                  await run(() => deleteMatchCascade(getDb(), id))
                  setDeleteMatchDialogOpen(false)
                  nav(backLink)
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

      <header className="match-form-head">
        <Link
          to={backLink}
          className="inline-flex items-center gap-1.5 text-sm font-medium no-underline !text-primary hover:underline hover:!text-primary visited:!text-primary"
        >
          <ArrowLeft className="size-4 shrink-0" strokeWidth={2.5} aria-hidden />
          {tournamentId ? 'Tournament' : 'My matches'}
        </Link>
        <h1 className="match-form-title">
          {fixtureMode === 'live'
            ? 'Match settings'
            : fixtureMode === 'completed' || fixtureMode === 'abandoned'
              ? 'Match'
              : 'Edit match'}
        </h1>
      </header>
      {isEdit && fixtureMode === 'live' && id && (
        <p className="mb-3">
          <Link to={`/app/matches/${id}/score`}>← Back to score</Link>
        </p>
      )}

      {tournamentId && (
        <div className="card match-form-tournament-banner" style={{ marginBottom: '1rem' }}>
          <span className="match-form-tournament-label">Tournament</span>
          <strong className="match-form-tournament-name">{tournamentName ?? '…'}</strong>
          {tournamentDescription ? (
            <p className="muted small" style={{ margin: '0.5rem 0 0', whiteSpace: 'pre-wrap' }}>
              {tournamentDescription}
            </p>
          ) : null}
          {tournamentStageRoundLabel ? (
            <p style={{ margin: '0.5rem 0 0' }}>
              <strong>{tournamentStageRoundLabel}</strong>
              {tournamentStageGroupLabel ? (
                <span className="muted small" style={{ display: 'block', marginTop: '0.25rem' }}>
                  Group: {tournamentStageGroupLabel}
                </span>
              ) : null}
            </p>
          ) : (
            <p className="muted small" style={{ margin: '0.5rem 0 0' }}>
              Stage: Not set on this match.
            </p>
          )}
        </div>
      )}

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <MatchFormCreateFields
          pickA={pickA}
          pickB={pickB}
          previewA={previewA}
          previewB={previewB}
          openPicker={openPicker}
          squadSize={squadSize}
          setSquadSize={setSquadSize}
          oversLimit={oversLimit}
          setOversLimit={setOversLimit}
          oversPerBowler={oversPerBowler}
          setOversPerBowler={setOversPerBowler}
          scheduleMode={scheduleMode}
          setScheduleMode={setScheduleMode}
          scheduledAt={scheduledAt}
          setScheduledAt={setScheduledAt}
          isPublic={isPublic}
          setIsPublic={setIsPublic}
          freeHitOnNoBall={freeHitOnNoBall}
          setFreeHitOnNoBall={setFreeHitOnNoBall}
          canSubmit={canSubmit}
          writePending={writePending}
          error={error}
          submitIdleLabel="Save changes"
          teamSelectionDisabled={isEdit}
          matchStartFieldsLocked={
            isEdit &&
            (fixtureMode === 'live' || fixtureMode === 'completed' || fixtureMode === 'abandoned')
          }
          friendlyVenue={venue}
          setFriendlyVenue={setVenue}
          showFriendlyVenue={!tournamentId}
        />
      </form>

      {isEdit && id && fixtureMode !== null && fixtureMode !== 'loading' && (
        <section
          className="mt-4 rounded-2xl border border-rose-200/80 bg-rose-50/60 p-4 shadow-[0_2px_12px_rgba(15,23,42,0.04)] sm:p-5"
          aria-labelledby="delete-match-heading"
        >
          <h2 id="delete-match-heading" className="text-base font-bold text-slate-900">
            Delete match permanently
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Removes this fixture and all ball-by-ball events from ScoreTrack. Tournament links and public URLs will stop
            working.
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={writePending}
            className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 border-destructive/55 bg-white text-destructive hover:bg-destructive/5"
            onClick={() => setDeleteMatchDialogOpen(true)}
          >
            <Trash2 className="size-4 shrink-0" strokeWidth={2} aria-hidden />
            Delete match
          </Button>
        </section>
      )}

      <dialog
        ref={pickerDialogRef}
        className="team-picker-dialog team-picker-dialog--squad"
        aria-labelledby={squadPickerTitleId}
        onClose={onPickerDialogClose}
      >
        <MatchTeamPickerDialogContent
          titleId={squadPickerTitleId}
          pickerSide={pickerSide}
          pickerSearch={pickerSearch}
          onPickerSearchChange={setPickerSearch}
          searchInputRef={pickerSearchInputRef}
          pickerOptions={pickerOptions}
          filteredPickerOptions={filteredPickerOptions}
          excludeId={excludeId}
          tournamentId={tournamentId}
          onSelectTeam={selectTeam}
          onClose={() => closePicker()}
        />
      </dialog>
    </div>
  )
}
