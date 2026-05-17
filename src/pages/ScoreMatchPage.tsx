import {
  collection,
  deleteField,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  CircleDot,
  CircleMinus,
  Copy,
  ExternalLink,
  Flag,
  Info,
  Monitor,
  PanelsTopLeft,
  PlayCircle,
  Plus,
  RefreshCw,
  Settings,
  Shirt,
  Trophy,
  User,
  UserMinus,
  UserPlus,
  Users,
  UserX,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '../auth/useAuth'
import { matchFormSelectClass } from '../components/MatchFormCreateFields'
import { ByesIcon, CricketBatIcon, KeeperGlovesIcon, LegByesIcon } from '../components/CricketDecorIcons'
import { MatchPlayingSquadModal } from '../components/MatchPlayingSquadModal'
import { SquadSummaryTile } from '../components/PlayingSquadTiles'
import { SQUAD_SUMMARY_TILE_LIST_CLASS } from '@/lib/playingSquadTiles'
import { cn } from '@/lib/utils'
import { PlayerRoleMarkers } from '../components/PlayerRoleMarkers'
import { BtnPendingLabel, Spinner } from '../components/Spinner'
import { useMatchDetailsDocumentTitle } from '../hooks/useMatchDetailsDocumentTitle'
import { usePendingWrites } from '../hooks/usePendingWrites'
import {
  appendBallEvent,
  appendChangeBowler,
  appendEndInnings,
  appendOverthrow,
  appendSecondInningsStart,
  appendSwapEnds,
  appendUndo,
  scoreEventFromFirestore,
} from '../lib/matchEvents'
import {
  freeHitPendingBeforeNextBall,
  lastScoredBallForInningsSide,
} from '../lib/overlayScoreBarCue'
import { humanizeResultForMatch } from '../lib/humanizeResultText'
import { matchCompleteHeadline, matchCompleteScoreLines } from '../lib/matchSummaryText'
import { scoreLinePartsForSide } from '../lib/scoreLineFormat'
import { computeMatchMvp } from '../lib/mvpMatch'
import {
  applyMatchCompletionStatsToBatch,
  buildPlayerOfTheMatchResult,
  fetchCareerRollupsForXi,
  syncPotmChangeAfterComplete,
} from '../lib/matchPlayerStatsPersistence'
import { matchTeamShortLabel, teamAvatarLabel } from '../lib/teamAvatarLabel'
import { advanceKnockoutFixture } from '../lib/advanceKnockoutFixture'
import { recomputeTournament } from '../lib/recomputeTournament'
import { getDb } from '../firebase/config'
import { ensureMatchPublicId } from '../lib/ensureMatchPublicId'
import { buildSnapshotFromUserTeam } from '../lib/userTeamSnapshot'
import {
  battersYetToPlayIds,
  bowlingStatsPerInnings,
  bowlerLegalBallsThisInnings,
  canBowlerDeliverMore,
  currentInnings,
  isInningsOver,
  lastEventSeqForUndo,
  maxBallsPerBowlerPerInnings,
  maxWicketsForBattingSide,
  needsNewBowlerBeforeNextBall,
  opp,
  oversQuotaRemainingLabel,
  oversString,
  replayEvents,
  symbolsThisOver,
  type InningsSnapshot,
  type ReplayConfig,
  type ReplayState,
  type ScoreEvent,
} from '../scoring/engine'
import type { BallEventPayload, MatchDoc, MatchLineup, RosterPlayer, Side, TeamDoc, TossInfo } from '../types/models'
import { Button } from '@/components/ui/button'

/** Dismissal kinds for the Fall of wicket sheet (order matches scorer dropdown). */
type WicketFallKind = 'Bowled' | 'Catch out' | 'Run out' | 'Stumping' | 'LBW' | 'Hit wicket'

const WICKET_FALL_OPTIONS: WicketFallKind[] = [
  'Bowled',
  'Catch out',
  'Run out',
  'Stumping',
  'LBW',
  'Hit wicket',
]

/** Scheduled match start wizard (shown one step at a time). */
const START_MATCH_STEP_LABELS = ['Toss', 'Playing squad', 'Captains & keepers', 'Opening players'] as const

/** Same outline primary styling as squad “Select players” (`Button variant="outline"` overrides). */
const MY_TEAMS_OUTLINE_PRIMARY_CLASS =
  'h-9 shrink-0 rounded-lg border-primary bg-white px-2.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/5 sm:px-3 sm:text-sm'

const MY_TEAMS_TOOLBAR_EDIT_LINK_CLASS = cn(
  'inline-flex items-center justify-center no-underline',
  MY_TEAMS_OUTLINE_PRIMARY_CLASS,
)

const MY_TEAMS_TOOLBAR_REFRESH_CLASS = cn(
  'inline-flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-60',
  MY_TEAMS_OUTLINE_PRIMARY_CLASS,
)

/** Fall of wicket / retired hurt modal — label and control on one row */
const FOW_FORM_ROW = 'flex flex-row flex-wrap items-center gap-x-3 gap-y-2'
const FOW_FORM_LABEL =
  'w-[40%] shrink-0 text-sm font-semibold leading-snug text-slate-900 sm:w-44 sm:min-w-[11rem]'
const FOW_FORM_CONTROL = 'relative min-w-0 flex-1'

function dismissedDefaultForFallKind(inn: InningsSnapshot, _kind: WicketFallKind): string {
  return inn.strikerId
}

function fallKindShowsFielder(kind: WicketFallKind): boolean {
  return kind === 'Catch out' || kind === 'Run out' || kind === 'Stumping'
}

function fallKindShowsWhoGotOut(kind: WicketFallKind): boolean {
  return kind === 'Run out'
}

function buildScoreWicketPayload(
  match: MatchDoc,
  fallKind: WicketFallKind,
  dismissedId: string,
  newBatsmanId: string,
  fielderId: string,
): NonNullable<BallEventPayload['wicket']> {
  const w: NonNullable<BallEventPayload['wicket']> = {
    dismissedId,
    howOut: fallKind,
  }
  if (newBatsmanId) w.newBatsmanId = newBatsmanId
  if (fielderId) {
    w.fielderId = fielderId
    w.fielderName = nameFor(match, fielderId)
  }
  return w
}

const MIN_STANDALONE_PLAYING_SQUAD = 2

/** Tournament fixtures require exactly `squadSize` per side; standalone matches allow `squadSize` as a cap with a minimum of 2. */
function playingSquadSelectionError(
  tournamentId: string | null,
  squadSize: number,
  homeLen: number,
  awayLen: number,
): string | null {
  if (tournamentId) {
    if (homeLen !== squadSize || awayLen !== squadSize) {
      return `Select exactly ${squadSize} players for each team.`
    }
    return null
  }
  if (homeLen < MIN_STANDALONE_PLAYING_SQUAD || awayLen < MIN_STANDALONE_PLAYING_SQUAD) {
    return `Select at least ${MIN_STANDALONE_PLAYING_SQUAD} players for each team.`
  }
  if (homeLen > squadSize || awayLen > squadSize) {
    return `Select at most ${squadSize} players for each team.`
  }
  return null
}

function StartMatchSquadSection({
  teamName,
  players,
  pick,
  squadSize,
  onSelectClick,
  onRemovePlayer,
}: {
  teamName: string
  players: RosterPlayer[]
  pick: string[]
  squadSize: number
  onSelectClick: () => void
  onRemovePlayer: (playerId: string) => void
}) {
  const selectedPlayers = pick
    .map((id) => players.find((p) => p.playerId === id))
    .filter((p): p is RosterPlayer => Boolean(p))

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-1 items-center gap-3 pr-1">
          <div
            className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
            aria-hidden
          >
            <Users className="size-5" strokeWidth={2} />
          </div>
          <div className="min-w-0 leading-tight">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{teamName} squad</p>
            <p className="mt-1 text-sm text-slate-600">
              Choose who plays this match (up to {squadSize} players)
            </p>
          </div>
        </div>
        {players.length > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 shrink-0 gap-1.5 rounded-lg border-primary bg-white px-2.5 text-xs font-semibold text-primary hover:bg-primary/5 sm:px-3 sm:text-sm"
            onClick={onSelectClick}
          >
            <Plus className="size-3.5 sm:size-4" strokeWidth={2.5} aria-hidden />
            Select players
          </Button>
        )}
      </div>

      <p className="mt-3 text-sm font-semibold text-slate-600">
        Selected {pick.length}/{squadSize}
      </p>

      {players.length === 0 ? (
        <div className="mt-5 flex min-h-[120px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/40 px-4 py-6 text-center">
          <Users className="mb-2 size-8 text-slate-300" strokeWidth={1.75} aria-hidden />
          <p className="font-semibold text-slate-900">No players in roster</p>
          <p className="mt-2 max-w-[280px] text-sm leading-relaxed text-slate-500">
            Refresh from My teams above if you have linked squads, or edit the match roster.
          </p>
        </div>
      ) : pick.length === 0 ? (
        <div className="mt-5 flex min-h-[120px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/40 px-4 py-6 text-center">
          <div
            className="mb-3 flex size-14 items-center justify-center rounded-full bg-slate-100 text-slate-400"
            aria-hidden
          >
            <Users className="size-7" strokeWidth={1.75} />
          </div>
          <p className="font-semibold text-slate-900">No players selected yet</p>
          <p className="mt-2 max-w-[280px] text-sm leading-relaxed text-slate-500">
            Tap Select players to choose up to {squadSize} from this roster.
          </p>
        </div>
      ) : (
        <ul className={`mt-3 list-none pl-0 ${SQUAD_SUMMARY_TILE_LIST_CLASS}`}>
          {selectedPlayers.map((p) => (
            <SquadSummaryTile key={p.playerId} name={p.name} onRemove={() => onRemovePlayer(p.playerId)} />
          ))}
        </ul>
      )}
    </div>
  )
}

export function ScoreMatchPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const [match, setMatch] = useState<(MatchDoc & { id: string }) | null>(null)
  const [events, setEvents] = useState<ScoreEvent[]>([])
  const [error, setError] = useState<string | null>(null)
  const { writePending, run } = usePendingWrites()

  const [tossWinner, setTossWinner] = useState<Side>('home')
  const [tossElected, setTossElected] = useState<'bat' | 'field'>('bat')
  const [homePick, setHomePick] = useState<string[]>([])
  const [awayPick, setAwayPick] = useState<string[]>([])
  const [squadPickerSide, setSquadPickerSide] = useState<'home' | 'away' | null>(null)
  const [strikerId, setStrikerId] = useState('')
  const [nonStrikerId, setNonStrikerId] = useState('')
  const [bowlerId, setBowlerId] = useState('')
  const [homeCaptainId, setHomeCaptainId] = useState('')
  const [homeKeeperId, setHomeKeeperId] = useState('')
  const [awayCaptainId, setAwayCaptainId] = useState('')
  const [awayKeeperId, setAwayKeeperId] = useState('')
  const [startMatchWizardStep, setStartMatchWizardStep] = useState(0)

  const [i2striker, setI2striker] = useState('')
  const [i2non, setI2non] = useState('')
  const [i2bowler, setI2bowler] = useState('')
  const [secondInningsModalError, setSecondInningsModalError] = useState<string | null>(null)

  const [nextBowlerId, setNextBowlerId] = useState('')
  const [wicketOpen, setWicketOpen] = useState(false)
  const [wDismiss, setWDismiss] = useState('')
  const [wNew, setWNew] = useState('')
  const [wFallKind, setWFallKind] = useState<WicketFallKind>('Bowled')
  /** Fielding XI player id for catch / run out / stumping. */
  const [wFielderId, setWFielderId] = useState('')
  /** Inline validation for Fall of wicket / Retired hurt modals (visible above Done). */
  const [wicketModalError, setWicketModalError] = useState<string | null>(null)

  // Prefill keeper for stumping when the dismissal type is selected.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to `wFallKind`, not live snapshot ticks
  useEffect(() => {
    if (wFallKind !== 'Stumping' || !wicketOpen || wicketModalMode !== 'score' || !match?.lineup || !state)
      return
    const inn = currentInnings(state)
    const fielding = opp(inn.battingSide)
    const keeperId =
      fielding === 'home' ? match.lineup.homeKeeperId : match.lineup.awayKeeperId
    if (keeperId) setWFielderId(keeperId)
  }, [wFallKind])

  const [chkWide, setChkWide] = useState(false)
  const [chkNoBall, setChkNoBall] = useState(false)
  const [chkByes, setChkByes] = useState(false)
  const [chkLegByes, setChkLegByes] = useState(false)
  const [chkWicket, setChkWicket] = useState(false)
  const [pendingRunsFromPad, setPendingRunsFromPad] = useState<number | null>(null)
  const [wicketModalMode, setWicketModalMode] = useState<'retire' | 'score' | null>(null)
  const [overthrowOpen, setOverthrowOpen] = useState(false)
  const [overthrowStr, setOverthrowStr] = useState('')
  const [overthrowFieldError, setOverthrowFieldError] = useState<string | null>(null)
  const [endInningsOpen, setEndInningsOpen] = useState(false)
  const [endInningsReason, setEndInningsReason] = useState<'declared' | 'all_out'>('declared')

  const [inningsBreakPopup, setInningsBreakPopup] = useState<{
    teamName: string
    runsNeeded: number
    oversLimit: number
    rpo: string
  } | null>(null)
  const [matchCompletePopup, setMatchCompletePopup] = useState<{
    summary: string
    scoreLines: string[]
  } | null>(null)
  const [goLiveConfirmOpen, setGoLiveConfirmOpen] = useState(false)
  const [endMatchModalOpen, setEndMatchModalOpen] = useState(false)
  const [endMatchReason, setEndMatchReason] = useState('')
  const [endMatchModalError, setEndMatchModalError] = useState<string | null>(null)
  const [endMatchFinishKind, setEndMatchFinishKind] = useState<'completed' | 'abandoned'>('completed')
  const [endMatchCompletedOutcome, setEndMatchCompletedOutcome] = useState<
    'tie' | 'home_win' | 'away_win' | null
  >(null)
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false)
  const [overlayLinkModalOpen, setOverlayLinkModalOpen] = useState(false)
  /** Until Firestore snapshot catches up after assigning `publicId`. */
  const [optimisticOverlayPublicId, setOptimisticOverlayPublicId] = useState<string | null>(null)
  const [overlayPublicIdBusy, setOverlayPublicIdBusy] = useState(false)
  /** '' = automatic MVP pick; else XI player id (synced from match doc). */
  const [potmDraft, setPotmDraft] = useState('')

  useEffect(() => {
    setStartMatchWizardStep(0)
  }, [id])

  const inn1PopupInitRef = useRef(false)
  const prevInn1DoneRef = useRef(false)
  const matchEndPopupInitRef = useRef(false)
  const prevMatchCompleteRef = useRef(false)

  useEffect(() => {
    inn1PopupInitRef.current = false
    prevInn1DoneRef.current = false
    matchEndPopupInitRef.current = false
    prevMatchCompleteRef.current = false
    setInningsBreakPopup(null)
    setMatchCompletePopup(null)
    setGoLiveConfirmOpen(false)
    setEndMatchModalOpen(false)
    setOverlayLinkModalOpen(false)
    setOptimisticOverlayPublicId(null)
    setOverlayPublicIdBusy(false)
    setSettingsMenuOpen(false)
    setEndMatchReason('')
    setEndMatchModalError(null)
    setPotmDraft('')
  }, [id])

  useEffect(() => {
    if (!id) return
    const ref = doc(getDb(), 'matches', id)
    return onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        setMatch(null)
        return
      }
      setMatch({ id: snap.id, ...(snap.data() as MatchDoc) })
    })
  }, [id])

  useEffect(() => {
    if (!id) return
    const qy = query(collection(getDb(), 'matches', id, 'events'), orderBy('seq', 'asc'))
    return onSnapshot(qy, (snap) => {
      const out: ScoreEvent[] = []
      snap.forEach((d) => {
        const ev = scoreEventFromFirestore(d.data() as Parameters<typeof scoreEventFromFirestore>[0])
        if (ev) out.push(ev)
      })
      setEvents(out)
    })
  }, [id])

  useEffect(() => {
    setPotmDraft(match?.playerOfTheMatchPlayerId ?? '')
  }, [match?.playerOfTheMatchPlayerId])

  useMatchDetailsDocumentTitle(match)

  const cfg: ReplayConfig | null = useMemo(() => {
    if (!match?.lineup) return null
    return {
      squadSize: match.squadSize,
      oversLimit: match.oversLimit,
      ballsPerOver: match.ballsPerOver ?? 6,
      oversPerBowler: match.oversPerBowler ?? null,
      lineup: match.lineup,
      homeName: match.home.name,
      awayName: match.away.name,
    }
  }, [match])

  const state = useMemo(() => {
    if (!cfg) return null
    return replayEvents(cfg, events)
  }, [cfg, events])

  const pendingFreeHitNextDelivery = useMemo(() => {
    if (!match?.freeHitOnNoBall || match.status !== 'live' || !state || !cfg) return false
    const inn = currentInnings(state)
    return freeHitPendingBeforeNextBall(events, inn.innings, inn.battingSide, match.freeHitOnNoBall === true)
  }, [match?.freeHitOnNoBall, match?.status, state, cfg, events])

  /** Fall-of-wicket modal: only Run out when free-hit applies or any runs scored on this ball (> 0). */
  const wicketFallOnlyRunOut = useMemo(() => {
    const runs = pendingRunsFromPad ?? 0
    return pendingFreeHitNextDelivery || runs > 0
  }, [pendingFreeHitNextDelivery, pendingRunsFromPad])

  /** Wide + wicket (and not run-out-only mode): only Run out or Stumping. */
  const wideWicketRunOutOrStumpingOnly = useMemo(
    () => chkWide && chkWicket && !wicketFallOnlyRunOut,
    [chkWide, chkWicket, wicketFallOnlyRunOut],
  )

  /** Warn once per scored wide/no-ball while free-hit is still pending (until a legal delivery). */
  const lastFreeHitWarningBallSeqRef = useRef<number | null>(null)
  useEffect(() => {
    if (!match?.freeHitOnNoBall || match.status !== 'live' || !state || !cfg) {
      lastFreeHitWarningBallSeqRef.current = null
      return
    }
    const inn = currentInnings(state)
    const pending = freeHitPendingBeforeNextBall(
      events,
      inn.innings,
      inn.battingSide,
      match.freeHitOnNoBall === true,
    )
    if (!pending) {
      lastFreeHitWarningBallSeqRef.current = null
      return
    }
    const meta = lastScoredBallForInningsSide(events, inn.innings, inn.battingSide)
    if (!meta || (meta.delivery !== 'wide' && meta.delivery !== 'noball')) return
    if (lastFreeHitWarningBallSeqRef.current === meta.seq) return
    lastFreeHitWarningBallSeqRef.current = meta.seq
    toast.warning('Free hit', { duration: 4000 })
  }, [match, state, cfg, events])

  /** Keep dismissal type valid: run-out-only, or wide+wicket → Run out / Stumping only. */
  useEffect(() => {
    if (!wicketOpen || wicketModalMode !== 'score' || !state) return
    const inn = currentInnings(state)
    if (wicketFallOnlyRunOut) {
      if (wFallKind === 'Run out') return
      setWFallKind('Run out')
      setWDismiss(dismissedDefaultForFallKind(inn, 'Run out'))
      return
    }
    if (wideWicketRunOutOrStumpingOnly) {
      if (wFallKind === 'Run out' || wFallKind === 'Stumping') return
      setWFallKind('Stumping')
      setWDismiss(dismissedDefaultForFallKind(inn, 'Stumping'))
    }
  }, [
    wicketOpen,
    wicketModalMode,
    wicketFallOnlyRunOut,
    wideWicketRunOutOrStumpingOnly,
    state,
    wFallKind,
  ])

  const thisOverSymbols = useMemo(() => {
    if (!cfg) return []
    return symbolsThisOver(cfg, events)
  }, [cfg, events])

  const bowlingSplit = useMemo(() => {
    if (!cfg) return null
    return bowlingStatsPerInnings(cfg, events)
  }, [cfg, events])

  const mvpForPotm = useMemo(() => {
    if (!match || !cfg || !state || !state.matchComplete || !state.innings2) return null
    return computeMatchMvp(match, cfg, events, state)
  }, [match, cfg, state, events])

  const potmSelectOptions = useMemo(() => {
    if (!match?.lineup) return []
    const xi = match.lineup
    const mvpTotal = (pid: string) => {
      const row = mvpForPotm?.rows.find((r) => r.playerId === pid)
      return row != null ? Number(row.total.toFixed(0)) : null
    }
    const labelWithMvp = (pid: string, teamShort: string) => {
      const base = `${nameFor(match, pid)} (${teamShort})`
      const pts = mvpTotal(pid)
      return pts != null ? `${base} (${pts})` : base
    }
    const opts: { id: string; label: string }[] = []
    for (const pid of xi.homeXI) {
      opts.push({
        id: pid,
        label: labelWithMvp(pid, matchTeamShortLabel(match.home)),
      })
    }
    for (const pid of xi.awayXI) {
      opts.push({
        id: pid,
        label: labelWithMvp(pid, matchTeamShortLabel(match.away)),
      })
    }
    return opts
  }, [match, mvpForPotm])

  const inn1Done =
    state && cfg && !state.innings2 && isInningsOver(cfg, state.innings1, state) && match?.status === 'live'

  useEffect(() => {
    if (!inn1Done) setSecondInningsModalError(null)
  }, [inn1Done])

  const needsNextBowlerConfirm =
    Boolean(match?.status === 'live' && cfg && state && needsNewBowlerBeforeNextBall(cfg, state))

  const batFirstSide: Side | null = useMemo(() => {
    if (!match || match.status !== 'scheduled') return null
    const elected = tossElected
    return elected === 'bat' ? tossWinner : opp(tossWinner)
  }, [match, tossElected, tossWinner])

  /** Used for Go live enabled state and shared with submit validation. */
  const startMatchBlockingReason = useMemo(() => {
    if (!match || match.status !== 'scheduled') return null
    const squadErr = playingSquadSelectionError(
      match.tournamentId,
      match.squadSize,
      homePick.length,
      awayPick.length,
    )
    if (squadErr) return squadErr
    if (!homeCaptainId || !homeKeeperId || !awayCaptainId || !awayKeeperId) {
      return 'Choose captain and wicket-keeper for both teams.'
    }
    if (!strikerId || !nonStrikerId || !bowlerId) {
      return 'All three are required: choose striker, non-striker, and opening bowler.'
    }
    if (!batFirstSide) {
      return 'Set toss and elected option.'
    }
    const batPool = batFirstSide === 'home' ? homePick : awayPick
    const fieldPool = batFirstSide === 'home' ? awayPick : homePick
    if (!batPool.includes(strikerId) || !batPool.includes(nonStrikerId)) {
      return 'Striker and non-striker must be from the team batting first.'
    }
    if (!fieldPool.includes(bowlerId)) {
      return 'Opening bowler must be from the fielding side.'
    }
    if (strikerId === nonStrikerId) {
      return 'Striker and non-striker must be different players.'
    }
    return null
  }, [
    match,
    homePick,
    awayPick,
    homeCaptainId,
    homeKeeperId,
    awayCaptainId,
    awayKeeperId,
    strikerId,
    nonStrikerId,
    bowlerId,
    batFirstSide,
  ])

  useEffect(() => {
    if (!match || !state || !cfg) return
    if (match.status !== 'live') {
      inn1PopupInitRef.current = false
      prevInn1DoneRef.current = false
      return
    }
    if (!inn1PopupInitRef.current) {
      inn1PopupInitRef.current = true
      prevInn1DoneRef.current = Boolean(inn1Done)
      return
    }
    const was = prevInn1DoneRef.current
    const now = Boolean(inn1Done)
    if (!was && now) {
      const chaseSide = opp(state.innings1.battingSide)
      const teamName = chaseSide === 'home' ? match.home.name : match.away.name
      const runsNeeded = state.innings1.runs + 1
      const oversLimit = cfg.oversLimit
      const rpo = oversLimit > 0 ? (runsNeeded / oversLimit).toFixed(2) : '—'
      setInningsBreakPopup({ teamName, runsNeeded, oversLimit, rpo })
    }
    prevInn1DoneRef.current = now
  }, [inn1Done, match, state, cfg])

  useEffect(() => {
    if (!match || !state || !cfg) return
    if (match.status !== 'live' && match.status !== 'completed') {
      matchEndPopupInitRef.current = false
      prevMatchCompleteRef.current = false
      return
    }
    if (!matchEndPopupInitRef.current) {
      matchEndPopupInitRef.current = true
      prevMatchCompleteRef.current = state.matchComplete
      return
    }
    const was = prevMatchCompleteRef.current
    const now = state.matchComplete
    if (!was && now) {
      setMatchCompletePopup({
        summary: matchCompleteHeadline(state, match),
        scoreLines: matchCompleteScoreLines(state, cfg, match),
      })
    }
    prevMatchCompleteRef.current = now
  }, [match, state, cfg])

  useEffect(() => {
    if (state && !state.matchComplete) {
      setMatchCompletePopup(null)
    }
  }, [state?.matchComplete, state])

  useEffect(() => {
    if (match?.status === 'completed') {
      setMatchCompletePopup(null)
    }
  }, [match?.status])

  async function refreshRostersFromMyTeams() {
    if (!id || !match || !user) return
    if (match.createdBy !== user.uid) return
    const hid = match.home.userTeamId
    const aid = match.away.userTeamId
    if (!hid && !aid) {
      setError('This match has no squads linked to My teams.')
      return
    }
    setError(null)
    try {
      await run(async () => {
        const updates: Partial<Pick<MatchDoc, 'home' | 'away'>> = {}
        if (hid) {
          const snap = await getDoc(doc(getDb(), 'users', user.uid, 'teams', hid))
          if (snap.exists()) {
            updates.home = buildSnapshotFromUserTeam({ id: snap.id, ...(snap.data() as TeamDoc) })
          }
        }
        if (aid) {
          const snap = await getDoc(doc(getDb(), 'users', user.uid, 'teams', aid))
          if (snap.exists()) {
            updates.away = buildSnapshotFromUserTeam({ id: snap.id, ...(snap.data() as TeamDoc) })
          }
        }
        if (Object.keys(updates).length === 0) {
          setError('Could not load squads from My teams.')
          return
        }
        await updateDoc(doc(getDb(), 'matches', id), updates)
        setHomePick([])
        setAwayPick([])
        setStrikerId('')
        setNonStrikerId('')
        setBowlerId('')
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not refresh squads')
    }
  }

  function requestStartMatch(e: FormEvent) {
    e.preventDefault()
    if (!match) return
    setError(null)
    if (startMatchBlockingReason) {
      toast.error(startMatchBlockingReason)
      setError(startMatchBlockingReason)
      return
    }
    setGoLiveConfirmOpen(true)
  }

  function handleStartWizardNext() {
    setError(null)
    if (!match) return
    if (startMatchWizardStep === 1) {
      const squadErr = playingSquadSelectionError(
        match.tournamentId,
        match.squadSize,
        homePick.length,
        awayPick.length,
      )
      if (squadErr) {
        toast.error(squadErr)
        return
      }
    }
    if (startMatchWizardStep === 2) {
      if (!homeCaptainId || !homeKeeperId || !awayCaptainId || !awayKeeperId) {
        toast.error('Choose captain and wicket-keeper for both teams.')
        return
      }
    }
    setStartMatchWizardStep((s) => Math.min(s + 1, 3))
  }

  async function executeStartMatch() {
    if (!id || !match) return
    setError(null)
    const toss: TossInfo = { winnerSide: tossWinner, elected: tossElected }
    const innings1BattingSide: Side = toss.elected === 'bat' ? toss.winnerSide : opp(toss.winnerSide)
    const lineup: MatchLineup = {
      innings1BattingSide,
      homeXI: homePick,
      awayXI: awayPick,
      strikerId,
      nonStrikerId,
      bowlerId,
      homeCaptainId,
      homeKeeperId,
      awayCaptainId,
      awayKeeperId,
    }
    try {
      await run(() =>
        updateDoc(doc(getDb(), 'matches', id), {
          toss,
          lineup,
          status: 'live',
          startedAt: serverTimestamp(),
        }),
      )
      setGoLiveConfirmOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start')
    }
  }

  async function sendBall(b: BallEventPayload): Promise<boolean> {
    if (!id) return false
    setError(null)
    try {
      await run(() => appendBallEvent(id, b))
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record ball')
      return false
    }
  }

  function clearDeliveryCheckboxes() {
    setChkWide(false)
    setChkNoBall(false)
    setChkByes(false)
    setChkLegByes(false)
    setChkWicket(false)
  }

  async function submitOverthrow(runs: number) {
    if (!id || runs <= 0) return
    setError(null)
    try {
      await run(() => appendOverthrow(id, runs))
      setOverthrowOpen(false)
      setOverthrowStr('')
      setOverthrowFieldError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add overthrow')
    }
  }

  function parseOverthrowRuns(value: string): number | null {
    const trimmed = value.trim()
    if (!trimmed) {
      setOverthrowFieldError('Runs is required.')
      return null
    }
    const runs = Number.parseInt(trimmed, 10)
    if (Number.isNaN(runs) || runs < 1 || runs > 36) {
      setOverthrowFieldError('Enter a valid number between 1 and 36.')
      return null
    }
    setOverthrowFieldError(null)
    return runs
  }

  async function sendDigit(runs: number) {
    if (!state || !cfg || !id) return
    if (chkByes && chkLegByes) {
      setError('Choose either Byes or Leg byes, not both.')
      return
    }
    if (chkWicket) {
      setPendingRunsFromPad(runs)
      setWicketModalMode('score')
      const inn = currentInnings(state)
      const initialKind: WicketFallKind =
        pendingFreeHitNextDelivery || runs > 0
          ? 'Run out'
          : chkWide
            ? 'Stumping'
            : 'Bowled'
      setWFallKind(initialKind)
      setWFielderId('')
      setWDismiss(dismissedDefaultForFallKind(inn, initialKind))
      setWNew('')
      setWicketModalError(null)
      setWicketOpen(true)
      return
    }
    setError(null)
    const delivery = chkWide ? 'wide' : chkNoBall ? 'noball' : 'legal'
    const alloc = buildRunsAllocation(chkWide, chkNoBall, chkByes, chkLegByes, runs)
    const ok = await sendBall(makeBall(state, { delivery, ...alloc }))
    if (ok) clearDeliveryCheckboxes()
  }

  async function sendSwapEndsEvent() {
    if (!id) return
    setError(null)
    try {
      await run(() => appendSwapEnds(id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not swap ends')
    }
  }

  function closeWicketModal() {
    setWicketOpen(false)
    setWDismiss('')
    setWNew('')
    setPendingRunsFromPad(null)
    setWicketModalMode(null)
    setWFallKind('Bowled')
    setWFielderId('')
    setWicketModalError(null)
  }

  function openRetire() {
    if (!state) return
    setWDismiss(currentInnings(state).strikerId)
    setWNew('')
    setWFallKind('Bowled')
    setWFielderId('')
    setWicketModalMode('retire')
    setPendingRunsFromPad(null)
    setWicketModalError(null)
    setWicketOpen(true)
  }

  async function undo() {
    if (!id) return
    const lastSeq = lastEventSeqForUndo(events)
    if (!lastSeq) return
    try {
      await run(() => appendUndo(id, lastSeq))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Undo failed')
    }
  }

  async function confirmNextBowler(e: FormEvent) {
    e.preventDefault()
    if (!id || !nextBowlerId || !cfg || !state) return
    const inn = currentInnings(state)
    if (!canBowlerDeliverMore(cfg, inn, nextBowlerId)) {
      setError('That bowler cannot bowl more this innings (overs limit).')
      return
    }
    if (nextBowlerId === inn.bowlerId) {
      setError('Pick a different bowler than the one who just finished the over.')
      return
    }
    setError(null)
    try {
      await run(() => appendChangeBowler(id, nextBowlerId))
      setNextBowlerId('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not set bowler')
    }
  }

  async function startSecond(e: FormEvent) {
    e.preventDefault()
    if (!id || !match || !state || !cfg) return
    const chaseSide = opp(state.innings1.battingSide)
    const chaseXi = xiPlayers(match, chaseSide)
    const fieldXi = xiPlayers(match, state.innings1.battingSide)
    const chaseIds = new Set(chaseXi.map((p) => p.playerId))
    const fieldIds = new Set(fieldXi.map((p) => p.playerId))

    const missing: string[] = []
    if (!i2striker || !chaseIds.has(i2striker)) missing.push('Striker')
    if (!i2non || !chaseIds.has(i2non)) missing.push('Non-striker')
    if (i2striker && i2non && i2striker === i2non) {
      setSecondInningsModalError('Striker and non-striker must be different players.')
      return
    }
    if (!i2bowler || !fieldIds.has(i2bowler)) missing.push('Opening bowler')

    if (missing.length > 0) {
      setSecondInningsModalError(
        missing.length === 1
          ? `Fill in: ${missing[0]}`
          : `Fill in: ${missing.join(' · ')}`,
      )
      return
    }

    setSecondInningsModalError(null)
    try {
      await run(() =>
        appendSecondInningsStart(id, {
          battingSide: chaseSide,
          strikerId: i2striker,
          nonStrikerId: i2non,
          bowlerId: i2bowler,
        }),
      )
    } catch (err) {
      setSecondInningsModalError(
        err instanceof Error ? err.message : 'Could not start 2nd innings',
      )
    }
  }

  /** Writes `completed` to Firestore + result summary (Match over popup, or End match with optional reason). */
  async function persistMatchComplete(opts?: { endReason?: string }) {
    if (!id || !match || !state || !cfg) return
    if (match.status !== 'live') return
    const text = state.resultText ?? 'Completed'
    const winner = state.winner
    const endReason = opts?.endReason?.trim()
    setError(null)
    await run(async () => {
      const mvp = computeMatchMvp(match, cfg, events, state)
      const potmResult = buildPlayerOfTheMatchResult(mvp)
      const existingCareer = await fetchCareerRollupsForXi(getDb(), { ...match, id })
      const batch = writeBatch(getDb())
      const mref = doc(getDb(), 'matches', id)
      batch.update(mref, {
        status: 'completed',
        completedAt: serverTimestamp(),
        resultSummary: {
          winnerSide: winner,
          text,
          ...(endReason ? { endReason } : {}),
        },
        ...(potmResult ? { playerOfTheMatchResult: potmResult } : {}),
      })
      applyMatchCompletionStatsToBatch(
        batch,
        getDb(),
        { ...match, id },
        cfg,
        state,
        events,
        potmResult,
        existingCareer,
      )
      await batch.commit()
      if (match.tournamentId) {
        await recomputeTournament(match.tournamentId)
        await advanceKnockoutFixture(id)
      }
    })
  }

  /** Organiser ends early: abandoned (no result) or completed with declared W/T/L for the points table. */
  async function persistOrganiserEndMatch(opts: {
    finishKind: 'abandoned' | 'completed'
    completedOutcome: 'tie' | 'home_win' | 'away_win' | null
    endReason: string
  }) {
    if (!id || !match || !state || !cfg) return
    if (match.status !== 'live') return
    const endReason = opts.endReason.trim()
    setError(null)
    await run(async () => {
      if (opts.finishKind === 'abandoned') {
        await updateDoc(doc(getDb(), 'matches', id), {
          status: 'abandoned',
          completedAt: serverTimestamp(),
          resultSummary: {
            winnerSide: null,
            text: 'No result (abandoned)',
            endReason,
            pointsOutcome: 'no_result',
          },
        })
      } else {
        const po = opts.completedOutcome
        if (!po) throw new Error('Choose how the match finished.')
        const winnerSide = po === 'tie' ? 'tie' : po === 'home_win' ? 'home' : 'away'
        const text =
          po === 'tie'
            ? 'Tie (dec)'
            : po === 'home_win'
              ? `${match.home.name} won (dec)`
              : `${match.away.name} won (dec)`
        const mvp = computeMatchMvp(match, cfg, events, state)
        const potmResult = buildPlayerOfTheMatchResult(mvp)
        const existingCareer = await fetchCareerRollupsForXi(getDb(), { ...match, id })
        const batch = writeBatch(getDb())
        const mref = doc(getDb(), 'matches', id)
        batch.update(mref, {
          status: 'completed',
          completedAt: serverTimestamp(),
          resultSummary: {
            winnerSide,
            text,
            endReason,
            pointsOutcome: po,
          },
          ...(potmResult ? { playerOfTheMatchResult: potmResult } : {}),
        })
        applyMatchCompletionStatsToBatch(
          batch,
          getDb(),
          { ...match, id },
          cfg,
          state,
          events,
          potmResult,
          existingCareer,
          po,
        )
        await batch.commit()
      }
      if (match.tournamentId) {
        await recomputeTournament(match.tournamentId)
        if (opts.finishKind === 'completed') await advanceKnockoutFixture(id)
      }
    })
  }

  async function confirmEndMatchFromModal() {
    if (!match || !state || !cfg) return
    const r = endMatchReason.trim()
    if (endMatchFinishKind === 'completed' && !endMatchCompletedOutcome) {
      const msg = 'Select a result: tie or which team won.'
      setEndMatchModalError(msg)
      return
    }
    if (!r) {
      const msg = 'Please enter a reason for ending this match.'
      setEndMatchModalError(msg)
      return
    }
    setEndMatchModalError(null)
    try {
      await persistOrganiserEndMatch({
        finishKind: endMatchFinishKind,
        completedOutcome: endMatchFinishKind === 'completed' ? endMatchCompletedOutcome : null,
        endReason: r,
      })
      setEndMatchModalOpen(false)
      setEndMatchReason('')
      setEndMatchFinishKind('completed')
      setEndMatchCompletedOutcome(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not end match')
    }
  }

  function dismissEndMatchModal() {
    if (writePending) return
    setEndMatchModalOpen(false)
    setEndMatchModalError(null)
    setEndMatchFinishKind('completed')
    setEndMatchCompletedOutcome(null)
  }

  async function savePlayerOfTheMatch() {
    if (!id || !match || user?.uid !== match.createdBy || !cfg || !state) return
    const next = potmDraft.trim()
    const prev = (match.playerOfTheMatchPlayerId ?? '').trim()
    const needsResultBackfill =
      match.status === 'completed' && !match.playerOfTheMatchResult && computeMatchMvp(match, cfg, events, state).potm
    if (next === prev && !needsResultBackfill) return
    setError(null)
    try {
      await run(async () => {
        const prevStoredPotmId = match.playerOfTheMatchResult?.playerId ?? null
        const nextMatch: MatchDoc = {
          ...match,
          playerOfTheMatchPlayerId: next === '' ? undefined : next,
        }
        const potmResult = buildPlayerOfTheMatchResult(computeMatchMvp(nextMatch, cfg, events, state))
        const idField =
          next === '' ? { playerOfTheMatchPlayerId: deleteField() } : { playerOfTheMatchPlayerId: next }
        const resultPatch =
          match.status === 'completed'
            ? potmResult
              ? { playerOfTheMatchResult: potmResult }
              : { playerOfTheMatchResult: deleteField() }
            : {}
        await updateDoc(doc(getDb(), 'matches', id), { ...idField, ...resultPatch })
        if (match.status === 'completed') {
          await syncPotmChangeAfterComplete(
            getDb(),
            { ...nextMatch, id },
            cfg,
            state,
            events,
            prevStoredPotmId,
            potmResult,
          )
        }
      })
      toast.success(
        next ? 'Player of the Match updated.' : 'Player of the Match set to automatic (MVP rules).',
      )
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save')
    }
  }

  useEffect(() => {
    if (!needsNextBowlerConfirm || !match || !cfg || !state) return
    const inn = currentInnings(state)
    const opts = xiPlayers(match, opp(inn.battingSide)).filter(
      (p) => canBowlerDeliverMore(cfg, inn, p.playerId) && p.playerId !== inn.bowlerId,
    )
    setNextBowlerId((prev) => {
      if (prev && opts.some((o) => o.playerId === prev)) return prev
      return opts[0]?.playerId ?? ''
    })
  }, [needsNextBowlerConfirm, match, cfg, state])

  async function confirmEndInnings() {
    if (!id || !state) return
    const inn = state.activeInnings
    setError(null)
    try {
      await run(() => appendEndInnings(id, { innings: inn, reason: endInningsReason }))
      setEndInningsOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not end innings')
    }
  }

  async function openScoreOverlayLinkModal() {
    if (!id || !match || user?.uid !== match.createdBy) return
    setOverlayPublicIdBusy(true)
    try {
      const hadPublicId = Boolean(match.publicId?.trim())
      const pid = await ensureMatchPublicId(doc(getDb(), 'matches', id), match.publicId, run)
      if (!hadPublicId) {
        setOptimisticOverlayPublicId(pid)
        toast.success('Overlay link created')
      }
      setSettingsMenuOpen(false)
      setOverlayLinkModalOpen(true)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not create overlay link')
    } finally {
      setOverlayPublicIdBusy(false)
    }
  }

  const effectivePublicId = (optimisticOverlayPublicId ?? match?.publicId)?.trim() ?? ''

  const overlayPublicUrl = useMemo(() => {
    if (!effectivePublicId) return ''
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    return `${origin}/overlay/${effectivePublicId}`
  }, [effectivePublicId])

  if (!id) return <p>Missing id</p>
  if (!match) return <p>Loading…</p>

  const canOfferEndInnings =
    match.status === 'live' &&
    cfg &&
    state &&
    !state.matchComplete &&
    !isInningsOver(cfg, currentInnings(state), state)

  const canScore =
    match.status === 'live' &&
    match.lineup &&
    cfg &&
    state &&
    !state.matchComplete &&
    !inn1Done &&
    !needsNextBowlerConfirm

  /** Allow undo until the match doc is `completed` — includes reverting the last ball after a natural finish. */
  const canUndoScoring =
    match.status === 'live' && Boolean(state && lastEventSeqForUndo(events) > 0)

  const nextBowlerChoices =
    needsNextBowlerConfirm && cfg && state
      ? xiPlayers(match, opp(currentInnings(state).battingSide)).filter((p) => {
          const inn = currentInnings(state)
          return canBowlerDeliverMore(cfg, inn, p.playerId) && p.playerId !== inn.bowlerId
        })
      : []

  /** Live summary card: first batting team (innings 1) on top row */
  const liveSummarySidesOrder: Side[] =
    cfg && cfg.lineup.innings1BattingSide === 'away' ? ['away', 'home'] : ['home', 'away']
  const chaseSummary =
    state && cfg && state.innings2 && !state.matchComplete
      ? (() => {
          const target = state.innings1.runs + 1
          const runsNeeded = Math.max(target - state.innings2.runs, 0)
          const ballsLeft = Math.max(cfg.oversLimit * cfg.ballsPerOver - state.innings2.legalBalls, 0)
          const battingNow = state.innings2.battingSide === 'home' ? match.home.name : match.away.name
          return `${battingNow} need ${runsNeeded} runs from ${ballsLeft} balls`
        })()
      : null
  const requiredRateDisplay =
    state && cfg && state.innings2 && !state.matchComplete
      ? (() => {
          const target = state.innings1.runs + 1
          const runsNeeded = Math.max(target - state.innings2.runs, 0)
          const ballsLeft = Math.max(cfg.oversLimit * cfg.ballsPerOver - state.innings2.legalBalls, 0)
          if (ballsLeft <= 0) return '—'
          const oversLeft = ballsLeft / cfg.ballsPerOver
          return (runsNeeded / oversLeft).toFixed(2)
        })()
      : null

  return (
    <div className="score-page-root">
      {writePending && (
        <div className="write-pending-overlay" role="status" aria-live="polite">
          <div className="write-pending-card">
            <Spinner size="md" />
            <span>Saving…</span>
          </div>
        </div>
      )}
      {match.status !== 'scheduled' && (
      <div className="score-page-title-row">
        <Link
          to="/app/matches"
          className={cn(
            'inline-flex items-center gap-1.5 text-sm font-medium no-underline hover:underline',
            '!text-primary hover:!text-primary visited:!text-primary',
          )}
        >
          <ArrowLeft className="size-4 shrink-0" strokeWidth={2.5} aria-hidden />
          My matches
        </Link>
        {(match.status === 'live' || match.status === 'completed') &&
          user?.uid === match.createdBy && (
          <div className="score-settings">
            <button
              type="button"
              className="score-settings-trigger"
              aria-label="Match settings"
              aria-expanded={settingsMenuOpen}
              onClick={() => setSettingsMenuOpen((v) => !v)}
            >
              <Settings className="size-5" strokeWidth={2.2} aria-hidden />
            </button>
            {settingsMenuOpen && (
              <>
                <button
                  type="button"
                  className="score-settings-overlay"
                  aria-label="Close settings menu"
                  onClick={() => setSettingsMenuOpen(false)}
                />
                <div className="score-settings-panel">
                  <Link
                    to={`/app/matches/${id}/edit`}
                    className="score-settings-item"
                    onClick={() => setSettingsMenuOpen(false)}
                  >
                    <span className="score-settings-item-icon" aria-hidden>
                      <Settings className="size-5" strokeWidth={2.1} />
                    </span>
                    <span className="score-settings-item-copy">
                      <span className="score-settings-item-title">Match settings</span>
                      <span className="score-settings-item-sub">Edit match details and preferences</span>
                    </span>
                    <ChevronRight className="score-settings-item-chev" strokeWidth={2.4} aria-hidden />
                  </Link>
                  <Link
                    to={`/app/matches/${id}/squads`}
                    className="score-settings-item"
                    onClick={() => setSettingsMenuOpen(false)}
                  >
                    <span className="score-settings-item-icon" aria-hidden>
                      <Users className="size-5" strokeWidth={2.1} />
                    </span>
                    <span className="score-settings-item-copy">
                      <span className="score-settings-item-title">Edit playing squads</span>
                      <span className="score-settings-item-sub">Add, remove or edit players</span>
                    </span>
                    <ChevronRight className="score-settings-item-chev" strokeWidth={2.4} aria-hidden />
                  </Link>
                  <button
                    type="button"
                    className="score-settings-item"
                    disabled={overlayPublicIdBusy || writePending}
                    onClick={() => void openScoreOverlayLinkModal()}
                  >
                    <span className="score-settings-item-icon" aria-hidden>
                      <Monitor className="size-5" strokeWidth={2.1} />
                    </span>
                    <span className="score-settings-item-copy">
                      <span className="score-settings-item-title">Score overlay link</span>
                      <span className="score-settings-item-sub">
                        {overlayPublicIdBusy
                          ? 'Creating…'
                          : effectivePublicId
                            ? 'OBS / streaming browser source'
                            : 'Generate shareable URL for OBS'}
                      </span>
                    </span>
                    <ChevronRight className="score-settings-item-chev" strokeWidth={2.4} aria-hidden />
                  </button>
                  {id && effectivePublicId && (
                    <Link
                      to={`/app/matches/${id}/overlay`}
                      className="score-settings-item"
                      onClick={() => setSettingsMenuOpen(false)}
                    >
                      <span className="score-settings-item-icon" aria-hidden>
                        <PanelsTopLeft className="size-5" strokeWidth={2.1} />
                      </span>
                      <span className="score-settings-item-copy">
                        <span className="score-settings-item-title">Manage overlay</span>
                        <span className="score-settings-item-sub">Preview cards & duration</span>
                      </span>
                      <ChevronRight className="score-settings-item-chev" strokeWidth={2.4} aria-hidden />
                    </Link>
                  )}
                  {canOfferEndInnings && (
                    <button
                      type="button"
                      className="score-settings-item"
                      onClick={() => {
                        setSettingsMenuOpen(false)
                        setEndInningsOpen(true)
                      }}
                    >
                      <span className="score-settings-item-icon" aria-hidden>
                        <Flag className="size-5" strokeWidth={2.1} />
                      </span>
                      <span className="score-settings-item-copy">
                        <span className="score-settings-item-title">End innings...</span>
                        <span className="score-settings-item-sub">Finish current innings</span>
                      </span>
                      <ChevronRight className="score-settings-item-chev" strokeWidth={2.4} aria-hidden />
                    </button>
                  )}
                  {match.status === 'live' && state && !state.matchComplete && (
                    <button
                      type="button"
                      className={`score-settings-item score-settings-item--danger${writePending ? ' score-settings-end-match--busy' : ''}`}
                      disabled={writePending}
                      onClick={() => {
                        if (writePending) return
                        setSettingsMenuOpen(false)
                        setEndMatchReason('')
                        setEndMatchModalError(null)
                        setEndMatchFinishKind('completed')
                        setEndMatchCompletedOutcome(null)
                        setEndMatchModalOpen(true)
                      }}
                    >
                      <span className="score-settings-item-icon" aria-hidden>
                        <CircleMinus className="size-5" strokeWidth={2.1} />
                      </span>
                      <span className="score-settings-item-copy">
                        <span className="score-settings-item-title">End match</span>
                        <span className="score-settings-item-sub">Close this match</span>
                      </span>
                      <ChevronRight className="score-settings-item-chev" strokeWidth={2.4} aria-hidden />
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
        </div>
      )}
      {error && <p className="error">{error}</p>}

      {overlayLinkModalOpen && overlayPublicUrl && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOverlayLinkModalOpen(false)
          }}
        >
          <div
            className="flex max-h-[min(90dvh,560px)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="overlay-link-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="relative shrink-0 border-b border-slate-100 px-5 pb-4 pt-5">
              <button
                type="button"
                className="absolute top-4 right-4 inline-flex size-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
                aria-label="Close"
                onClick={() => setOverlayLinkModalOpen(false)}
              >
                <X className="size-4" strokeWidth={2.2} />
              </button>
              <div className="flex items-start gap-3 pr-10">
                <div
                  className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
                  aria-hidden
                >
                  <Monitor className="size-5" strokeWidth={2} />
                </div>
                <div className="min-w-0 leading-tight">
                  <h2 id="overlay-link-title" className="text-lg font-bold text-slate-900">
                    Score overlay
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Add this URL as a browser source in OBS or open it on another screen to show the live scoreboard.
                  </p>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {!match.isPublic && (
                <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950">
                  This match is <strong>private</strong>. The overlay page will show “Private” until you enable{' '}
                  <strong>Public score</strong> in{' '}
                  <Link to={`/app/matches/${id}/edit`} className="font-semibold text-primary underline">
                    Match settings
                  </Link>
                  .
                </p>
              )}
              <label htmlFor="overlay-public-url" className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Overlay URL
              </label>
              <input
                id="overlay-public-url"
                readOnly
                value={overlayPublicUrl}
                onFocus={(e) => e.target.select()}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-xs text-slate-900 outline-none ring-primary focus:ring-2 sm:text-sm"
              />
            </div>

            <div className="flex shrink-0 flex-wrap gap-3 border-t border-slate-100 px-5 py-4">
              <Button
                type="button"
                variant="outline"
                className="h-11 min-w-0 flex-1 rounded-xl font-semibold sm:flex-initial"
                onClick={() => {
                  void navigator.clipboard
                    .writeText(overlayPublicUrl)
                    .then(() => toast.success('Link copied'))
                    .catch(() => toast.error('Could not copy link'))
                }}
              >
                <Copy className="mr-2 size-4 shrink-0" strokeWidth={2.2} aria-hidden />
                Copy link
              </Button>
              <Button
                type="button"
                className="h-11 min-w-0 flex-1 rounded-xl font-semibold sm:flex-initial"
                onClick={() => {
                  window.open(overlayPublicUrl, '_blank', 'noopener,noreferrer')
                }}
              >
                <ExternalLink className="mr-2 size-4 shrink-0" strokeWidth={2.2} aria-hidden />
                Open link
              </Button>
            </div>
          </div>
        </div>
      )}

      {match.status === 'scheduled' && (
        <>
        <div className="mx-auto w-full max-w-3xl space-y-4 pb-2">
          <Link
            to="/app/matches"
            className={cn(
              'inline-flex items-center gap-1.5 text-sm font-medium no-underline hover:underline',
              '!text-primary hover:!text-primary visited:!text-primary',
            )}
          >
            <ArrowLeft className="size-4 shrink-0" strokeWidth={2.5} aria-hidden />
            My matches
          </Link>

          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1 leading-tight">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Start match</h1>
              <p className="mt-1 text-sm text-slate-500">
                Squad size: {match.squadSize}
                {match.oversPerBowler != null && (
                  <>
                    {' '}
                    · Max {match.oversPerBowler} overs per bowler (per innings)
                  </>
                )}
              </p>
            </div>
            <div
              className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
              aria-hidden
            >
              <UserPlus className="size-6" strokeWidth={2} />
            </div>
          </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (startMatchWizardStep < 3) return
            requestStartMatch(e)
          }}
          className="card flex flex-col gap-5 rounded-xl border-slate-200/90 bg-white p-4 shadow-sm sm:p-5"
        >
          <nav aria-label="Start match steps">
            <ol className="m-0 flex list-none flex-wrap gap-2 p-0">
              {START_MATCH_STEP_LABELS.map((label, i) => (
                <li
                  key={label}
                  aria-current={i === startMatchWizardStep ? 'step' : undefined}
                  className={cn(
                    'flex min-w-[calc(50%-4px)] flex-1 basis-[45%] items-center justify-center rounded-lg border px-2 py-2.5 text-center sm:min-w-0 sm:basis-0 sm:py-3',
                    i === startMatchWizardStep
                      ? 'border-primary/40 bg-primary/10'
                      : i < startMatchWizardStep
                        ? 'border-slate-200 bg-slate-50 text-slate-700'
                        : 'border-slate-100 bg-white text-slate-400',
                  )}
                >
                  <span
                    className={cn(
                      'text-[11px] font-semibold uppercase leading-tight tracking-wide sm:text-xs',
                      i === startMatchWizardStep && 'text-red-600',
                    )}
                  >
                    {label}
                  </span>
                </li>
              ))}
            </ol>
          </nav>

          {startMatchWizardStep === 0 && (
          <div className="grid gap-5 sm:grid-cols-2 sm:gap-6">
            <fieldset className="min-w-0 rounded-2xl border-2 border-slate-200/90 bg-gradient-to-br from-primary/[0.12] via-white to-slate-50 p-5 shadow-lg shadow-slate-200/60 ring-1 ring-primary/10 sm:p-6">
              <legend className="mb-4 flex w-full items-center gap-2.5 text-sm font-extrabold uppercase tracking-wide text-slate-900">
                <span className="h-7 w-1.5 shrink-0 rounded-full bg-primary shadow-sm shadow-primary/40" aria-hidden />
                Toss winner
              </legend>
              <div className="grid grid-cols-2 gap-3">
                <label
                  className={cn(
                    'flex cursor-pointer flex-col items-center gap-2.5 rounded-xl border-2 px-2 py-4 text-center text-sm font-bold transition-all duration-150',
                    tossWinner === 'home'
                      ? 'border-primary/45 bg-primary/[0.06] text-slate-800 shadow-sm shadow-slate-200/50 ring-1 ring-primary/20'
                      : 'border-slate-300 bg-white text-slate-700 shadow-sm hover:border-primary/45 hover:bg-primary/[0.04]',
                  )}
                >
                  <input
                    type="radio"
                    name="toss-winner"
                    className="sr-only"
                    checked={tossWinner === 'home'}
                    onChange={() => setTossWinner('home')}
                  />
                  <Shirt
                    className={cn('size-7', tossWinner === 'home' ? 'text-primary/75' : 'text-slate-500')}
                    strokeWidth={2.25}
                    aria-hidden
                  />
                  <span className="line-clamp-2 leading-tight">{match.home.name}</span>
                </label>
                <label
                  className={cn(
                    'flex cursor-pointer flex-col items-center gap-2.5 rounded-xl border-2 px-2 py-4 text-center text-sm font-bold transition-all duration-150',
                    tossWinner === 'away'
                      ? 'border-primary/45 bg-primary/[0.06] text-slate-800 shadow-sm shadow-slate-200/50 ring-1 ring-primary/20'
                      : 'border-slate-300 bg-white text-slate-700 shadow-sm hover:border-primary/45 hover:bg-primary/[0.04]',
                  )}
                >
                  <input
                    type="radio"
                    name="toss-winner"
                    className="sr-only"
                    checked={tossWinner === 'away'}
                    onChange={() => setTossWinner('away')}
                  />
                  <Shirt
                    className={cn('size-7', tossWinner === 'away' ? 'text-primary/75' : 'text-slate-500')}
                    strokeWidth={2.25}
                    aria-hidden
                  />
                  <span className="line-clamp-2 leading-tight">{match.away.name}</span>
                </label>
              </div>
            </fieldset>
            <fieldset className="min-w-0 rounded-2xl border-2 border-slate-200/90 bg-gradient-to-br from-primary/[0.12] via-white to-slate-50 p-5 shadow-lg shadow-slate-200/60 ring-1 ring-primary/10 sm:p-6">
              <legend className="mb-4 flex w-full items-center gap-2.5 text-sm font-extrabold uppercase tracking-wide text-slate-900">
                <span className="h-7 w-1.5 shrink-0 rounded-full bg-primary shadow-sm shadow-primary/40" aria-hidden />
                Elected to
              </legend>
              <div className="grid grid-cols-2 gap-3">
                <label
                  className={cn(
                    'flex cursor-pointer flex-col items-center gap-2.5 rounded-xl border-2 px-2 py-4 text-center text-base font-bold transition-all duration-150',
                    tossElected === 'bat'
                      ? 'border-primary/45 bg-primary/[0.06] text-slate-800 shadow-sm shadow-slate-200/50 ring-1 ring-primary/20'
                      : 'border-slate-300 bg-white text-slate-700 shadow-sm hover:border-primary/45 hover:bg-primary/[0.04]',
                  )}
                >
                  <input
                    type="radio"
                    name="toss-elected"
                    className="sr-only"
                    checked={tossElected === 'bat'}
                    onChange={() => setTossElected('bat')}
                  />
                  <CricketBatIcon
                    className={cn('size-7', tossElected === 'bat' ? 'text-primary/75' : 'text-slate-500')}
                    strokeWidth={2.25}
                    aria-hidden
                  />
                  <span>Bat</span>
                </label>
                <label
                  className={cn(
                    'flex cursor-pointer flex-col items-center gap-2.5 rounded-xl border-2 px-2 py-4 text-center text-base font-bold transition-all duration-150',
                    tossElected === 'field'
                      ? 'border-primary/45 bg-primary/[0.06] text-slate-800 shadow-sm shadow-slate-200/50 ring-1 ring-primary/20'
                      : 'border-slate-300 bg-white text-slate-700 shadow-sm hover:border-primary/45 hover:bg-primary/[0.04]',
                  )}
                >
                  <input
                    type="radio"
                    name="toss-elected"
                    className="sr-only"
                    checked={tossElected === 'field'}
                    onChange={() => setTossElected('field')}
                  />
                  <KeeperGlovesIcon
                    className={cn('size-7', tossElected === 'field' ? 'text-primary/75' : 'text-slate-500')}
                    strokeWidth={2.25}
                    aria-hidden
                  />
                  <span>Field</span>
                </label>
              </div>
            </fieldset>
          </div>
          )}
          {startMatchWizardStep === 1 && (
          <>
          {(match.home.userTeamId || match.away.userTeamId) && (
            <>
              <div className="mb-2 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                {match.home.userTeamId && (
                  <Link className={MY_TEAMS_TOOLBAR_EDIT_LINK_CLASS} to={`/app/teams/${match.home.userTeamId}`}>
                    Edit {match.home.name}
                  </Link>
                )}
                {match.away.userTeamId && (
                  <Link className={MY_TEAMS_TOOLBAR_EDIT_LINK_CLASS} to={`/app/teams/${match.away.userTeamId}`}>
                    Edit {match.away.name}
                  </Link>
                )}
                {user?.uid === match.createdBy && (
                  <button
                    type="button"
                    className={MY_TEAMS_TOOLBAR_REFRESH_CLASS}
                    disabled={writePending}
                    onClick={() => void refreshRostersFromMyTeams()}
                  >
                    <BtnPendingLabel
                      pending={writePending}
                      idle={
                        <>
                          <RefreshCw className="size-4 shrink-0" strokeWidth={2.25} aria-hidden />
                          Refresh
                        </>
                      }
                      busyText="Saving…"
                    />
                  </button>
                )}
                </div>
              <p className="text-xs leading-snug text-slate-500">
                After editing squads in My teams, use Refresh so player lists update here. XI picks reset when you refresh.
              </p>
              </div>
            </>
          )}
          <StartMatchSquadSection
            teamName={match.home.name}
            players={match.home.players}
            pick={homePick}
            squadSize={match.squadSize}
            onSelectClick={() => {
              setError(null)
              setSquadPickerSide('home')
            }}
            onRemovePlayer={(pid) => {
              setHomePick((prev) => prev.filter((x) => x !== pid))
              setHomeCaptainId((c) => (c === pid ? '' : c))
              setHomeKeeperId((k) => (k === pid ? '' : k))
              setStrikerId((s) => (s === pid ? '' : s))
              setNonStrikerId((n) => (n === pid ? '' : n))
              setBowlerId((b) => (b === pid ? '' : b))
            }}
          />
          <StartMatchSquadSection
            teamName={match.away.name}
            players={match.away.players}
            pick={awayPick}
            squadSize={match.squadSize}
            onSelectClick={() => {
              setError(null)
              setSquadPickerSide('away')
            }}
            onRemovePlayer={(pid) => {
              setAwayPick((prev) => prev.filter((x) => x !== pid))
              setAwayCaptainId((c) => (c === pid ? '' : c))
              setAwayKeeperId((k) => (k === pid ? '' : k))
              setStrikerId((s) => (s === pid ? '' : s))
              setNonStrikerId((n) => (n === pid ? '' : n))
              setBowlerId((b) => (b === pid ? '' : b))
            }}
          />
          </>
          )}
          {startMatchWizardStep === 2 && (
          <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_2px_12px_rgba(15,23,42,0.04)]">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Users className="size-4 text-primary" strokeWidth={2.2} aria-hidden />
              Captains & keepers
            </div>

            <div className="flex gap-3 rounded-xl border border-sky-100 bg-sky-50 px-3 py-3 text-sm text-slate-700">
              <Info className="size-5 shrink-0 text-sky-600" strokeWidth={2} aria-hidden />
              <p className="min-w-0 leading-snug">
                All four roles are required. The wicket-keeper is used as the default name for stumping dismissals.
              </p>
            </div>

            <div className="space-y-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <User className="size-4 shrink-0 text-primary" strokeWidth={2.2} aria-hidden />
                  <span className="text-sm font-semibold text-slate-900">{match.home.name} captain</span>
                </div>
                <div className="relative w-full shrink-0 sm:max-w-[20rem]">
                  <select
                    className={matchFormSelectClass}
                    value={homeCaptainId}
                    onChange={(e) => setHomeCaptainId(e.target.value)}
                    aria-label={`${match.home.name} captain`}
                  >
                    <option value="">Select player</option>
                    {match.home.players
                      .filter((p) => homePick.includes(p.playerId))
                      .map((p) => (
                        <option key={p.playerId} value={p.playerId}>
                          {p.name}
                        </option>
                      ))}
                  </select>
                  <ChevronDown
                    className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-primary"
                    aria-hidden
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <KeeperGlovesIcon className="size-4 shrink-0 text-primary" strokeWidth={2.25} aria-hidden />
                  <span className="text-sm font-semibold text-slate-900">{match.home.name} wicket-keeper</span>
                </div>
                <div className="relative w-full shrink-0 sm:max-w-[20rem]">
                  <select
                    className={matchFormSelectClass}
                    value={homeKeeperId}
                    onChange={(e) => setHomeKeeperId(e.target.value)}
                    aria-label={`${match.home.name} wicket-keeper`}
                  >
                    <option value="">Select player</option>
                    {match.home.players
                      .filter((p) => homePick.includes(p.playerId))
                      .map((p) => (
                        <option key={p.playerId} value={p.playerId}>
                          {p.name}
                        </option>
                      ))}
                  </select>
                  <ChevronDown
                    className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-primary"
                    aria-hidden
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <User className="size-4 shrink-0 text-primary" strokeWidth={2.2} aria-hidden />
                  <span className="text-sm font-semibold text-slate-900">{match.away.name} captain</span>
                </div>
                <div className="relative w-full shrink-0 sm:max-w-[20rem]">
                  <select
                    className={matchFormSelectClass}
                    value={awayCaptainId}
                    onChange={(e) => setAwayCaptainId(e.target.value)}
                    aria-label={`${match.away.name} captain`}
                  >
                    <option value="">Select player</option>
                    {match.away.players
                      .filter((p) => awayPick.includes(p.playerId))
                      .map((p) => (
                        <option key={p.playerId} value={p.playerId}>
                          {p.name}
                        </option>
                      ))}
                  </select>
                  <ChevronDown
                    className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-primary"
                    aria-hidden
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <KeeperGlovesIcon className="size-4 shrink-0 text-primary" strokeWidth={2.25} aria-hidden />
                  <span className="text-sm font-semibold text-slate-900">{match.away.name} wicket-keeper</span>
                </div>
                <div className="relative w-full shrink-0 sm:max-w-[20rem]">
                  <select
                    className={matchFormSelectClass}
                    value={awayKeeperId}
                    onChange={(e) => setAwayKeeperId(e.target.value)}
                    aria-label={`${match.away.name} wicket-keeper`}
                  >
                    <option value="">Select player</option>
                    {match.away.players
                      .filter((p) => awayPick.includes(p.playerId))
                      .map((p) => (
                        <option key={p.playerId} value={p.playerId}>
                          {p.name}
                        </option>
                      ))}
                  </select>
                  <ChevronDown
                    className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-primary"
                    aria-hidden
                  />
                </div>
              </div>
            </div>
          </section>
          )}
          {startMatchWizardStep === 3 && (
          <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_2px_12px_rgba(15,23,42,0.04)]">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <PlayCircle className="size-4 text-primary" strokeWidth={2.2} aria-hidden />
              Opening players
            </div>

            <div className="flex gap-3 rounded-xl border border-sky-100 bg-sky-50 px-3 py-3 text-sm text-slate-700">
              <Info className="size-5 shrink-0 text-sky-600" strokeWidth={2} aria-hidden />
              <p className="min-w-0 leading-snug">
                <strong className="font-semibold text-slate-800">All three roles are required.</strong> Choose the striker
                and non-striker from the team batting first, and the opening bowler from the fielding side.
              </p>
            </div>

            <div className="space-y-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <CricketBatIcon className="size-4 shrink-0 text-primary" strokeWidth={2.25} aria-hidden />
                  <span className="text-sm font-semibold text-slate-900">Striker (batting first innings)</span>
                </div>
                <div className="relative w-full shrink-0 sm:max-w-[20rem]">
                  <select
                    className={matchFormSelectClass}
                    required
                    value={strikerId}
                    onChange={(e) => {
                      const v = e.target.value
                      setStrikerId(v)
                      if (v && v === nonStrikerId) setNonStrikerId('')
                    }}
                    aria-label="Striker (batting first innings)"
                  >
                    <option value="">Select player</option>
                    {batFirstSide &&
                      [...match.home.players, ...match.away.players]
                        .filter((p) => (batFirstSide === 'home' ? homePick : awayPick).includes(p.playerId))
                        .filter((p) => p.playerId !== nonStrikerId)
                        .map((p) => (
                          <option key={p.playerId} value={p.playerId}>
                            {p.name}
                          </option>
                        ))}
                  </select>
                  <ChevronDown
                    className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-primary"
                    aria-hidden
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <User className="size-4 shrink-0 text-primary" strokeWidth={2.2} aria-hidden />
                  <span className="text-sm font-semibold text-slate-900">Non-striker</span>
                </div>
                <div className="relative w-full shrink-0 sm:max-w-[20rem]">
                  <select
                    className={matchFormSelectClass}
                    required
                    value={nonStrikerId}
                    onChange={(e) => {
                      const v = e.target.value
                      setNonStrikerId(v)
                      if (v && v === strikerId) setStrikerId('')
                    }}
                    aria-label="Non-striker"
                  >
                    <option value="">Select player</option>
                    {batFirstSide &&
                      [...match.home.players, ...match.away.players]
                        .filter((p) => (batFirstSide === 'home' ? homePick : awayPick).includes(p.playerId))
                        .filter((p) => p.playerId !== strikerId)
                        .map((p) => (
                          <option key={p.playerId} value={p.playerId}>
                            {p.name}
                          </option>
                        ))}
                  </select>
                  <ChevronDown
                    className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-primary"
                    aria-hidden
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <CircleDot className="size-4 shrink-0 text-primary" strokeWidth={2.2} aria-hidden />
                  <span className="text-sm font-semibold text-slate-900">Opening bowler (fielding side)</span>
                </div>
                <div className="relative w-full shrink-0 sm:max-w-[20rem]">
                  <select
                    className={matchFormSelectClass}
                    required
                    value={bowlerId}
                    onChange={(e) => setBowlerId(e.target.value)}
                    aria-label="Opening bowler (fielding side)"
                  >
                    <option value="">Select player</option>
                    {batFirstSide &&
                      [...match.home.players, ...match.away.players]
                        .filter((p) => (batFirstSide === 'home' ? awayPick : homePick).includes(p.playerId))
                        .map((p) => (
                          <option key={p.playerId} value={p.playerId}>
                            {p.name}
                          </option>
                        ))}
                  </select>
                  <ChevronDown
                    className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-primary"
                    aria-hidden
                  />
                </div>
              </div>
            </div>
          </section>
          )}
          <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
            {startMatchWizardStep > 0 && (
              <button
                type="button"
                className="btn order-2 w-full sm:order-1 sm:w-auto"
                onClick={() => {
                  setError(null)
                  setStartMatchWizardStep((s) => Math.max(0, s - 1))
                }}
              >
                Cancel
              </button>
            )}
            <p className="order-3 text-center text-xs text-slate-500 sm:order-2 sm:flex-1">
              Step {startMatchWizardStep + 1} of 4 — {START_MATCH_STEP_LABELS[startMatchWizardStep]}
            </p>
            <div className="order-1 flex w-full justify-end sm:order-3 sm:w-auto">
              {startMatchWizardStep < 3 ? (
                <button
                  type="button"
                  className="btn primary w-full rounded-xl py-3 text-base font-semibold shadow-sm sm:min-w-[12rem]"
                  onClick={handleStartWizardNext}
                >
                  Next
                </button>
              ) : (
                <button
                  type="submit"
                  className="btn primary w-full rounded-xl py-3 text-base font-semibold shadow-sm sm:min-w-[12rem]"
                  disabled={writePending}
                >
                  <BtnPendingLabel pending={writePending} idle="Go live" busyText="Saving…" />
                </button>
              )}
            </div>
          </div>
        </form>
        </div>
        <MatchPlayingSquadModal
          key={squadPickerSide ?? 'closed'}
          open={squadPickerSide !== null}
          onClose={() => setSquadPickerSide(null)}
          teamName={squadPickerSide === 'away' ? match.away.name : match.home.name}
          players={squadPickerSide === 'away' ? match.away.players : match.home.players}
          maxCount={match.squadSize}
          selectedIds={squadPickerSide === 'away' ? awayPick : homePick}
          onConfirm={(ids) => {
            if (squadPickerSide === 'home') setHomePick(ids)
            else if (squadPickerSide === 'away') setAwayPick(ids)
            setSquadPickerSide(null)
          }}
        />
        </>
      )}

      {goLiveConfirmOpen && match.status === 'scheduled' && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !writePending) setGoLiveConfirmOpen(false)
          }}
        >
          <div
            className="flex max-h-[min(90dvh,640px)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="go-live-confirm-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="relative border-b border-slate-100 px-5 pb-4 pt-5">
              <button
                type="button"
                className="absolute top-4 right-4 inline-flex size-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50"
                aria-label="Close"
                disabled={writePending}
                onClick={() => setGoLiveConfirmOpen(false)}
              >
                <X className="size-4" strokeWidth={2.2} />
              </button>
              <div className="flex items-start gap-3 pr-10">
                <div
                  className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
                  aria-hidden
                >
                  <PlayCircle className="size-5" strokeWidth={2} />
                </div>
                <div className="min-w-0 leading-tight">
                  <h2 id="go-live-confirm-title" className="text-lg font-bold text-slate-900">
                    Start match?
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Confirm toss, captains, keepers, openers, and opening bowler before going live.
                  </p>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <div className="space-y-4">
                <section className="rounded-xl border border-slate-100 bg-gradient-to-br from-slate-50 to-white p-4 shadow-sm">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Toss</h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-slate-800">
                    <span className="font-semibold text-slate-900">
                      {tossWinner === 'home' ? match.home.name : match.away.name}
                    </span>{' '}
                    won the toss and elected to{' '}
                    <span className="font-semibold text-primary">
                      {tossElected === 'bat' ? 'bat first' : 'bowl first'}
                    </span>
                    .
                  </p>
                </section>

                <section className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Captains &amp; wicket-keepers
                  </h3>
                  <dl className="mt-3 divide-y divide-slate-100">
                    <div className="flex flex-col gap-0.5 py-2.5 first:pt-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                      <dt className="text-xs font-medium text-slate-500">{match.home.name} · Captain</dt>
                      <dd className="min-w-0 max-w-full break-words text-sm font-semibold leading-snug text-slate-900 sm:max-w-[55%] sm:text-right">
                        {nameFor(match, homeCaptainId)}
                      </dd>
                    </div>
                    <div className="flex flex-col gap-0.5 py-2.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                      <dt className="text-xs font-medium text-slate-500">{match.home.name} · Wicket-keeper</dt>
                      <dd className="min-w-0 max-w-full break-words text-sm font-semibold leading-snug text-slate-900 sm:max-w-[55%] sm:text-right">
                        {nameFor(match, homeKeeperId)}
                      </dd>
                    </div>
                    <div className="flex flex-col gap-0.5 py-2.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                      <dt className="text-xs font-medium text-slate-500">{match.away.name} · Captain</dt>
                      <dd className="min-w-0 max-w-full break-words text-sm font-semibold leading-snug text-slate-900 sm:max-w-[55%] sm:text-right">
                        {nameFor(match, awayCaptainId)}
                      </dd>
                    </div>
                    <div className="flex flex-col gap-0.5 py-2.5 last:pb-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                      <dt className="text-xs font-medium text-slate-500">{match.away.name} · Wicket-keeper</dt>
                      <dd className="min-w-0 max-w-full break-words text-sm font-semibold leading-snug text-slate-900 sm:max-w-[55%] sm:text-right">
                        {nameFor(match, awayKeeperId)}
                      </dd>
                    </div>
                  </dl>
                </section>

                <section className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Opening players
                  </h3>
                  <dl className="mt-3 divide-y divide-slate-100">
                    <div className="flex flex-col gap-0.5 py-2.5 first:pt-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                      <dt className="text-xs font-medium text-slate-500">Striker</dt>
                      <dd className="min-w-0 max-w-full break-words text-sm font-semibold leading-snug text-slate-900 sm:max-w-[55%] sm:text-right">
                        {nameFor(match, strikerId)}
                      </dd>
                    </div>
                    <div className="flex flex-col gap-0.5 py-2.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                      <dt className="text-xs font-medium text-slate-500">Non-striker</dt>
                      <dd className="min-w-0 max-w-full break-words text-sm font-semibold leading-snug text-slate-900 sm:max-w-[55%] sm:text-right">
                        {nameFor(match, nonStrikerId)}
                      </dd>
                    </div>
                    <div className="flex flex-col gap-0.5 py-2.5 last:pb-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                      <dt className="text-xs font-medium text-slate-500">Opening bowler</dt>
                      <dd className="min-w-0 max-w-full break-words text-sm font-semibold leading-snug text-slate-900 sm:max-w-[55%] sm:text-right">
                        {nameFor(match, bowlerId)}
                      </dd>
                    </div>
                  </dl>
                </section>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-100 p-4 sm:flex-row">
              <Button
                type="button"
                className="order-1 h-11 w-full rounded-xl font-semibold !text-primary-foreground sm:order-2 sm:flex-1"
                disabled={writePending}
                onClick={() => void executeStartMatch()}
              >
                <BtnPendingLabel pending={writePending} idle="Confirm & go live" busyText="Saving…" />
              </Button>
              <Button
                type="button"
                variant="outline"
                className="order-2 h-11 w-full rounded-xl sm:order-1 sm:flex-1"
                disabled={writePending}
                onClick={() => setGoLiveConfirmOpen(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {endMatchModalOpen && match.status === 'live' && state && !state.matchComplete && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) dismissEndMatchModal()
          }}
        >
          <div
            className="flex max-h-[min(90dvh,720px)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="end-match-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="relative shrink-0 border-b border-slate-100 px-5 pb-4 pt-5">
              <button
                type="button"
                className={cn(
                  'absolute top-4 right-4 inline-flex size-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800',
                  writePending && 'pointer-events-none opacity-40',
                )}
                aria-label="Close"
                disabled={writePending}
                onClick={() => dismissEndMatchModal()}
              >
                <X className="size-4" strokeWidth={2.2} />
              </button>
              <div className="flex items-start gap-3 pr-10">
                <div
                  className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
                  aria-hidden
                >
                  <CircleMinus className="size-5" strokeWidth={2} />
                </div>
                <div className="min-w-0 leading-tight">
                  <h2 id="end-match-title" className="text-lg font-bold text-slate-900">
                    End match?
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Scoring will be locked. Choose how this counts for the tournament table. A reason is required and
                    saved on the result.
                  </p>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-4">
              <p className="text-sm font-semibold text-slate-800">Match status</p>
              <fieldset className="mt-2 flex flex-nowrap gap-2 border-0 p-0">
                <legend className="sr-only">Match status</legend>
                <label
                  className={cn(
                    'flex min-h-11 min-w-0 flex-1 cursor-pointer items-center justify-center rounded-xl border px-2 py-2.5 text-center text-xs font-medium leading-snug transition-colors sm:text-sm',
                    endMatchFinishKind === 'completed'
                      ? 'border-primary bg-primary/[0.06] ring-1 ring-primary/20'
                      : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50',
                    writePending && 'pointer-events-none opacity-60',
                  )}
                >
                  <input
                    type="radio"
                    name="end-match-kind"
                    checked={endMatchFinishKind === 'completed'}
                    disabled={writePending}
                    onChange={() => {
                      setEndMatchFinishKind('completed')
                      if (endMatchModalError) setEndMatchModalError(null)
                    }}
                    className="sr-only"
                  />
                  Completed
                </label>
                <label
                  className={cn(
                    'flex min-h-11 min-w-0 flex-1 cursor-pointer items-center justify-center rounded-xl border px-2 py-2.5 text-center text-xs font-medium leading-snug transition-colors sm:text-sm',
                    endMatchFinishKind === 'abandoned'
                      ? 'border-primary bg-primary/[0.06] ring-1 ring-primary/20'
                      : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50',
                    writePending && 'pointer-events-none opacity-60',
                  )}
                >
                  <input
                    type="radio"
                    name="end-match-kind"
                    checked={endMatchFinishKind === 'abandoned'}
                    disabled={writePending}
                    onChange={() => {
                      setEndMatchFinishKind('abandoned')
                      if (endMatchModalError) setEndMatchModalError(null)
                    }}
                    className="sr-only"
                  />
                  Abandoned
                </label>
              </fieldset>

              {endMatchFinishKind === 'completed' && (
                <>
                  <p
                    id="end-match-result-label"
                    className="mt-5 text-sm font-semibold text-slate-800"
                  >
                    Result <span className="font-semibold text-red-600" aria-hidden>*</span>
                    <span className="sr-only"> — required</span>
                  </p>
                  <fieldset
                    className="mt-2 flex flex-nowrap gap-2 border-0 p-0"
                    aria-labelledby="end-match-result-label"
                    aria-required="true"
                  >
                    <legend className="sr-only">Result — required</legend>
                    <label
                      className={cn(
                        'flex min-h-11 min-w-0 flex-1 cursor-pointer items-center justify-center rounded-xl border px-2 py-2.5 text-center text-xs font-medium leading-snug transition-colors sm:text-sm',
                        endMatchCompletedOutcome === 'tie'
                          ? 'border-primary bg-primary/[0.06] ring-1 ring-primary/20'
                          : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50',
                        writePending && 'pointer-events-none opacity-60',
                      )}
                    >
                      <input
                        type="radio"
                        name="end-match-outcome"
                        checked={endMatchCompletedOutcome === 'tie'}
                        disabled={writePending}
                        required
                        onChange={() => {
                          setEndMatchCompletedOutcome('tie')
                          if (endMatchModalError) setEndMatchModalError(null)
                        }}
                        className="sr-only"
                      />
                      Tie
                    </label>
                    <label
                      className={cn(
                        'flex min-h-11 min-w-0 flex-1 cursor-pointer items-center justify-center rounded-xl border px-2 py-2.5 text-center text-xs font-medium leading-snug transition-colors sm:text-sm',
                        endMatchCompletedOutcome === 'home_win'
                          ? 'border-primary bg-primary/[0.06] ring-1 ring-primary/20'
                          : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50',
                        writePending && 'pointer-events-none opacity-60',
                      )}
                    >
                      <input
                        type="radio"
                        name="end-match-outcome"
                        checked={endMatchCompletedOutcome === 'home_win'}
                        disabled={writePending}
                        onChange={() => {
                          setEndMatchCompletedOutcome('home_win')
                          if (endMatchModalError) setEndMatchModalError(null)
                        }}
                        className="sr-only"
                      />
                      {match.home.name} won
                    </label>
                    <label
                      className={cn(
                        'flex min-h-11 min-w-0 flex-1 cursor-pointer items-center justify-center rounded-xl border px-2 py-2.5 text-center text-xs font-medium leading-snug transition-colors sm:text-sm',
                        endMatchCompletedOutcome === 'away_win'
                          ? 'border-primary bg-primary/[0.06] ring-1 ring-primary/20'
                          : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50',
                        writePending && 'pointer-events-none opacity-60',
                      )}
                    >
                      <input
                        type="radio"
                        name="end-match-outcome"
                        checked={endMatchCompletedOutcome === 'away_win'}
                        disabled={writePending}
                        onChange={() => {
                          setEndMatchCompletedOutcome('away_win')
                          if (endMatchModalError) setEndMatchModalError(null)
                        }}
                        className="sr-only"
                      />
                      {match.away.name} won
                    </label>
                  </fieldset>
                </>
              )}

              <label className="mt-5 block">
                <span className="text-sm font-medium text-slate-700">
                  Reason <span className="font-semibold text-red-600" aria-hidden>*</span>
                  <span className="sr-only"> — required</span>
                </span>
                <textarea
                  rows={3}
                  value={endMatchReason}
                  onChange={(e) => {
                    setEndMatchReason(e.target.value)
                    if (endMatchModalError) setEndMatchModalError(null)
                  }}
                  placeholder="e.g. Rain stopped play, mutual agreement, forfeit…"
                  disabled={writePending}
                  required
                  aria-required="true"
                  className="mt-1.5 block w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 disabled:opacity-60"
                />
              </label>

              {endMatchModalError && (
                <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                  {endMatchModalError}
                </p>
              )}
            </div>

            <div className="flex shrink-0 gap-3 border-t border-slate-100 p-4">
              <Button
                type="button"
                variant="outline"
                className="h-11 flex-1 rounded-xl"
                disabled={writePending}
                onClick={() => dismissEndMatchModal()}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="h-11 flex-1 rounded-xl font-semibold !text-primary-foreground"
                disabled={writePending}
                onClick={() => void confirmEndMatchFromModal()}
              >
                <BtnPendingLabel pending={writePending} idle="End match" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {(match.status === 'live' || match.status === 'abandoned') && cfg && state && bowlingSplit && (
        <>
          <div className="card score-live-summary">
            {match.status === 'abandoned' && (
              <p className="muted small" style={{ marginBottom: '0.5rem' }}>
                <strong>Match abandoned</strong> — partial score below.
              </p>
            )}
            <div className="score-live-summary-top">
              {liveSummarySidesOrder.map((side) => {
                const team = side === 'home' ? match.home : match.away
                const scoreParts = scoreLinePartsForSide(state, cfg, side)
                const avatarLabel = teamAvatarLabel(team)
                const isResultLoser =
                  match.status === 'completed' &&
                  state.matchComplete &&
                  state.winner != null &&
                  state.winner !== 'tie' &&
                  state.winner !== side
                return (
                  <div
                    key={side}
                    className={cn(
                      'score-live-side',
                      side === 'home' ? 'score-live-side--home' : 'score-live-side--away',
                      state?.innings2 &&
                        !state.matchComplete &&
                        state.innings1.battingSide === side &&
                        'score-live-side--completed-innings',
                      isResultLoser && 'score-live-side--result-loser',
                    )}
                  >
                    <div className="score-live-side-main">
                      <span
                        className={cn(
                          'score-live-side-avatar',
                          side === 'away' && 'score-live-side-avatar--away',
                          avatarLabel.length > 2 && 'score-live-side-avatar--compact',
                        )}
                      >
                        {avatarLabel}
                      </span>
                      <span className="score-live-side-label">{team.name}</span>
                      <div className="score-live-side-score">
                        {scoreParts.kind === 'yet' ? (
                          scoreParts.text
                        ) : (
                          <>
                            <span className="score-live-side-rw">
                              {scoreParts.rw}
                            </span>
                            {scoreParts.overs ? (
                              <>
                                {' '}
                                <span className="score-live-side-overs">{scoreParts.overs}</span>
                              </>
                            ) : null}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            {!state.matchComplete && (
              <div className="score-live-crr">
                <span className="score-live-crr-label">CRR</span>
                <span className="score-live-crr-val">
                  {crrDisplay(currentInnings(state), cfg.ballsPerOver)}
                </span>
                {requiredRateDisplay ? (
                  <>
                    <span className="score-live-crr-sep">·</span>
                    <span className="score-live-crr-label">RR</span>
                    <span className="score-live-crr-val">{requiredRateDisplay}</span>
                  </>
                ) : null}
              </div>
            )}
            {state.matchComplete ? (
              <>
                <p className="score-live-result">
                  {matchCompleteHeadline(state, match)}
                </p>
                {match.resultSummary?.endReason && (
                  <p className="muted small" style={{ marginTop: '0.35rem' }}>
                    <strong>Reason:</strong> {match.resultSummary.endReason}
                  </p>
                )}
              </>
            ) : (
              null
            )}
            {chaseSummary ? <div className="score-live-chase-strip">{chaseSummary}</div> : null}
            {match.status === 'abandoned' && (
              <>
                <p className="score-live-result" style={{ marginTop: '0.65rem' }}>
                  {humanizeResultForMatch(match.resultSummary?.text ?? 'No result (abandoned)', match)}
                </p>
                {match.resultSummary?.endReason && (
                  <p className="muted small" style={{ marginTop: '0.35rem' }}>
                    <strong>Reason:</strong> {match.resultSummary.endReason}
                  </p>
                )}
              </>
            )}
          </div>

          {!state.matchComplete && (
            <div className="card score-live-stats">
              <div className="score-live-stats-section score-live-stats-section--batting">
                <table className="score-live-table score-live-table--batting">
                  <thead>
                    <tr>
                      <th>Batsman</th>
                      <th className="num">R</th>
                      <th className="num">B</th>
                      <th className="num">4s</th>
                      <th className="num">6s</th>
                      <th className="num">SR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderedLiveBatters(match, state).map((p) => {
                      const inn = currentInnings(state)
                      const bs = state.batterStats[p.playerId]
                      const runs = bs?.runs ?? 0
                      const balls = bs?.balls ?? 0
                      const notOutStar =
                        p.playerId === inn.strikerId &&
                        !inn.retiredOffField.has(p.playerId) &&
                        (!bs || !bs.out)
                      return (
                        <tr key={p.playerId}>
                          <td className="score-live-name">
                            <div>
                              {p.name}
                              <PlayerRoleMarkers
                                match={match}
                                side={currentInnings(state).battingSide}
                                playerId={p.playerId}
                              />
                              {notOutStar ? '*' : ''}
                            </div>
                          </td>
                          <td className="num score-live-runs">{runs}</td>
                          <td className="num muted">{balls}</td>
                          <td className="num muted">{bs?.fours ?? 0}</td>
                          <td className="num muted">{bs?.sixes ?? 0}</td>
                          <td className="num muted">{srRuns(runs, balls)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="score-live-stats-section score-live-stats-section--bowling">
                <table className="score-live-table score-live-table--bowling">
                  <thead>
                    <tr>
                      <th>Bowler</th>
                      <th className="num">O</th>
                      <th className="num">M</th>
                      <th className="num">R</th>
                      <th className="num">W</th>
                      <th className="num">ER</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const inn = currentInnings(state)
                      const bid = inn.bowlerId
                      const agg =
                        state.activeInnings === 1 ? bowlingSplit.innings1 : bowlingSplit.innings2
                      const st = agg[bid]
                      const legalBalls = st?.legalBalls ?? 0
                      return (
                        <tr key={bid}>
                          <td className="score-live-name">
                            <div>{nameFor(match, bid)}</div>
                          </td>
                          <td className="num muted">{bowlerOversDisplay(legalBalls, cfg.ballsPerOver)}</td>
                          <td className="num muted">0</td>
                          <td className="num muted">{st?.runs ?? 0}</td>
                          <td className="num muted">{st?.wickets ?? 0}</td>
                          <td className="num muted">
                            {bowlerEconomy(st?.runs ?? 0, legalBalls, cfg.ballsPerOver)}
                          </td>
                        </tr>
                      )
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {inn1Done && match && state && cfg && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4" role="presentation">
          <div
            className="flex max-h-[min(90dvh,640px)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="start-second-innings-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="shrink-0 border-b border-slate-100 px-5 pb-4 pt-5">
              <div className="flex items-start gap-3">
                <div
                  className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
                  aria-hidden
                >
                  <PlayCircle className="size-5" strokeWidth={2} />
                </div>
                <div className="min-w-0 leading-tight">
                  <h2 id="start-second-innings-title" className="text-lg font-bold text-slate-900">
                    Start second innings
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Set the opening pair and bowler, then confirm to begin the chase.
                  </p>
                </div>
              </div>
            </div>

            <form className="flex min-h-0 flex-1 flex-col" onSubmit={startSecond}>
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
                {canUndoScoring && (
                  <div className="flex gap-3 rounded-xl border border-sky-100 bg-sky-50 px-3 py-3 text-sm text-slate-700">
                    <Info className="size-5 shrink-0 text-sky-600" strokeWidth={2} aria-hidden />
                    <p className="min-w-0 leading-snug">
                      Wrongly closed the first innings? Use <strong>Undo</strong> below to step back (e.g. remove
                      &quot;End innings&quot;), then continue scoring.
                    </p>
                  </div>
                )}

                <div className={FOW_FORM_ROW}>
                  <div className={FOW_FORM_LABEL}>Chasing</div>
                  <div className={cn(FOW_FORM_CONTROL, 'text-sm font-medium text-slate-800')}>
                    {opp(state.innings1.battingSide) === 'home' ? match.home.name : match.away.name}
                  </div>
                </div>

                <div className={FOW_FORM_ROW}>
                  <label htmlFor="i2-striker" className={FOW_FORM_LABEL}>
                    Striker
                  </label>
                  <div className={FOW_FORM_CONTROL}>
                    <select
                      id="i2-striker"
                      className={matchFormSelectClass}
                      value={i2striker}
                      onChange={(e) => {
                        setSecondInningsModalError(null)
                        const v = e.target.value
                        setI2striker(v)
                        if (v && v === i2non) setI2non('')
                      }}
                      aria-required="true"
                    >
                      <option value="">Select player</option>
                      {xiPlayers(match, opp(state.innings1.battingSide))
                        .filter((p) => p.playerId !== i2non)
                        .map((p) => (
                          <option key={p.playerId} value={p.playerId}>
                            {p.name}
                          </option>
                        ))}
                    </select>
                    <ChevronDown
                      className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-primary"
                      aria-hidden
                    />
                  </div>
                </div>

                <div className={FOW_FORM_ROW}>
                  <label htmlFor="i2-non" className={FOW_FORM_LABEL}>
                    Non-striker
                  </label>
                  <div className={FOW_FORM_CONTROL}>
                    <select
                      id="i2-non"
                      className={matchFormSelectClass}
                      value={i2non}
                      onChange={(e) => {
                        setSecondInningsModalError(null)
                        const v = e.target.value
                        setI2non(v)
                        if (v && v === i2striker) setI2striker('')
                      }}
                      aria-required="true"
                    >
                      <option value="">Select player</option>
                      {xiPlayers(match, opp(state.innings1.battingSide))
                        .filter((p) => p.playerId !== i2striker)
                        .map((p) => (
                          <option key={p.playerId} value={p.playerId}>
                            {p.name}
                          </option>
                        ))}
                    </select>
                    <ChevronDown
                      className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-primary"
                      aria-hidden
                    />
                  </div>
                </div>

                <div className={FOW_FORM_ROW}>
                  <label htmlFor="i2-bowler" className={FOW_FORM_LABEL}>
                    Opening bowler
                  </label>
                  <div className={FOW_FORM_CONTROL}>
                    <select
                      id="i2-bowler"
                      className={matchFormSelectClass}
                      value={i2bowler}
                      onChange={(e) => {
                        setSecondInningsModalError(null)
                        setI2bowler(e.target.value)
                      }}
                      aria-required="true"
                    >
                      <option value="">Select player</option>
                      {xiPlayers(match, state.innings1.battingSide).map((p) => (
                        <option key={p.playerId} value={p.playerId}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-primary"
                      aria-hidden
                    />
                  </div>
                </div>
              </div>

              <div className="shrink-0 space-y-3 border-t border-slate-100 p-4">
                {secondInningsModalError && (
                  <p
                    role="alert"
                    className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive"
                  >
                    {secondInningsModalError}
                  </p>
                )}
                <div className="flex gap-3">
                  {canUndoScoring && (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 flex-1 rounded-xl"
                      disabled={writePending}
                      onClick={() => void undo()}
                    >
                      Undo
                    </Button>
                  )}
                  <Button
                    type="submit"
                    className={cn(
                      'h-11 rounded-xl font-semibold !text-primary-foreground',
                      canUndoScoring ? 'flex-1' : 'w-full',
                    )}
                    disabled={writePending}
                  >
                    <BtnPendingLabel pending={writePending} idle="Confirm & start" />
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {needsNextBowlerConfirm && cfg && state && match && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4"
          role="presentation"
        >
          <div
            className="flex max-h-[min(90dvh,640px)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="next-bowler-modal-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="relative shrink-0 border-b border-slate-100 px-5 pb-4 pt-5">
              <div className="flex items-start gap-3">
                <div
                  className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
                  aria-hidden
                >
                  <Shirt className="size-5" strokeWidth={2} />
                </div>
                <div className="min-w-0 leading-tight">
                  <h2 id="next-bowler-modal-title" className="text-lg font-bold text-slate-900">
                    New over — choose bowler
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    End of over. Pick who bowls next. Limit: {cfg.oversPerBowler} overs (
                    {maxBallsPerBowlerPerInnings(cfg)} legal balls) per bowler per innings.
                  </p>
                </div>
              </div>
            </div>

            <form className="flex min-h-0 flex-1 flex-col" onSubmit={confirmNextBowler}>
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
                {canUndoScoring && (
                  <div className="flex gap-3 rounded-xl border border-sky-100 bg-sky-50 px-3 py-3 text-sm text-slate-700">
                    <Info className="size-5 shrink-0 text-sky-600" strokeWidth={2} aria-hidden />
                    <p className="min-w-0 leading-snug">
                      Picked the wrong bowler already? Use <strong>Undo</strong> to revert that confirmation, or to
                      remove the last ball if the over should not have ended yet.
                    </p>
                  </div>
                )}
                {nextBowlerChoices.length === 0 ? (
                  <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                    No bowlers left under the overs-per-bowler rule. Adjust limits or end the innings.
                  </p>
                ) : (
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-900" htmlFor="next-bowler-select">
                      Bowler for the next over
                    </label>
                    <div className="relative w-full">
                      <select
                        id="next-bowler-select"
                        className={matchFormSelectClass}
                        value={nextBowlerId}
                        onChange={(e) => setNextBowlerId(e.target.value)}
                        required
                        autoFocus
                        aria-label="Bowler for the next over"
                      >
                        <option value="">Select…</option>
                        {nextBowlerChoices.map((p) => {
                          const inn = currentInnings(state)
                          const maxB = maxBallsPerBowlerPerInnings(cfg) ?? 0
                          const used = bowlerLegalBallsThisInnings(inn, p.playerId)
                          const ballsLeft = maxB - used
                          return (
                            <option key={p.playerId} value={p.playerId}>
                              {p.name} ({oversQuotaRemainingLabel(ballsLeft, cfg.ballsPerOver)})
                            </option>
                          )
                        })}
                      </select>
                      <ChevronDown
                        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-primary"
                        aria-hidden
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex shrink-0 gap-3 border-t border-slate-100 p-4">
                {canUndoScoring && (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 flex-1 rounded-xl"
                    disabled={writePending}
                    onClick={() => void undo()}
                  >
                    Undo
                  </Button>
                )}
                <Button
                  type="submit"
                  className={cn(
                    'h-11 rounded-xl font-semibold !text-primary-foreground',
                    canUndoScoring ? 'flex-1' : 'w-full',
                  )}
                  disabled={!nextBowlerId || writePending || nextBowlerChoices.length === 0}
                >
                  <BtnPendingLabel pending={writePending} idle="Continue to next over" />
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {canScore && (
        <div className="card record-ball-card">
          <div className="record-this-over">
            <span className="muted small record-this-over-label">This over:</span>
            <div className="record-this-over-pills">
              {thisOverSymbols.length === 0 ? null : (
                thisOverSymbols.map((sym, i) => (
                  <span key={`${sym}-${i}`} className={scoreBallPillClass(sym)}>
                    {sym}
                  </span>
                ))
              )}
            </div>
          </div>
          <div className="record-ball-shell">
            <div className="record-ball-sidebar">
              <button
                type="button"
                className="btn"
                disabled={writePending || !canUndoScoring}
                onClick={() => void undo()}
                title="Reverts the last ball, bowler change at end of over, swap ends, or innings close — one step per tap."
              >
                Undo
              </button>
              <button type="button" className="btn" disabled={writePending} onClick={() => openRetire()}>
                Retire
              </button>
              <button type="button" className="btn" disabled={writePending} onClick={() => void sendSwapEndsEvent()}>
                Swap
              </button>
            </div>
            <div className="record-ball-main">
              <div className="record-ball-modifiers" role="group" aria-label="Delivery modifiers">
                <label className={`record-ball-chk${chkWide ? ' is-active' : ''}`}>
                  <input
                    type="checkbox"
                    disabled={writePending}
                    checked={chkWide}
                    onChange={(e) => {
                      const v = e.target.checked
                      setChkWide(v)
                      if (v) setChkNoBall(false)
                    }}
                  />
                  <span className="record-ball-chk-icon">↔</span>
                  Wide
                </label>
                <label className={`record-ball-chk${chkNoBall ? ' is-active' : ''}`}>
                  <input
                    type="checkbox"
                    disabled={writePending}
                    checked={chkNoBall}
                    onChange={(e) => {
                      const v = e.target.checked
                      setChkNoBall(v)
                      if (v) setChkWide(false)
                    }}
                  />
                  <span className="record-ball-chk-icon">⊘</span>
                  No ball
                </label>
                <label className={`record-ball-chk${chkByes ? ' is-active' : ''}`}>
                  <input
                    type="checkbox"
                    disabled={writePending}
                    checked={chkByes}
                    onChange={(e) => {
                      const v = e.target.checked
                      setChkByes(v)
                      if (v) setChkLegByes(false)
                    }}
                  />
                  <span className="record-ball-chk-icon record-ball-chk-icon--byes">
                    <ByesIcon className="h-[1.08rem] w-auto max-h-[1.15rem]" />
                  </span>
                  Byes
                </label>
                <label className={`record-ball-chk${chkLegByes ? ' is-active' : ''}`}>
                  <input
                    type="checkbox"
                    disabled={writePending}
                    checked={chkLegByes}
                    onChange={(e) => {
                      const v = e.target.checked
                      setChkLegByes(v)
                      if (v) setChkByes(false)
                    }}
                  />
                  <span className="record-ball-chk-icon record-ball-chk-icon--leg-byes">
                    <LegByesIcon className="h-[1.08rem] w-auto max-h-[1.15rem]" />
                  </span>
                  Leg byes
                </label>
                <label className={`record-ball-chk${chkWicket ? ' is-active record-ball-chk--wicket' : ''}`}>
                  <input
                    type="checkbox"
                    disabled={writePending}
                    checked={chkWicket}
                    onChange={(e) => setChkWicket(e.target.checked)}
                  />
                  <span className="record-ball-chk-icon">⚑</span>
                  Wicket
                </label>
              </div>
              <div className="record-numpad">
                {[0, 1, 2, 3, 4, 5, 6].map((r) => (
                  <button
                    key={r}
                    type="button"
                    className="btn pad record-numpad-btn"
                    disabled={writePending}
                    onClick={() => void sendDigit(r)}
                  >
                    {r}
                  </button>
                ))}
                <button
                  type="button"
                  className="btn pad record-numpad-btn record-numpad-more"
                  disabled={writePending}
                  onClick={() => {
                    setOverthrowStr('')
                    setOverthrowFieldError(null)
                    setOverthrowOpen(true)
                  }}
                  aria-label="Add overthrow runs"
                >
                  …
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {overthrowOpen && canScore && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOverthrowOpen(false)
          }}
        >
          <div
            className="flex max-h-[min(90dvh,520px)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="overthrow-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="relative shrink-0 border-b border-slate-100 px-5 pb-4 pt-5">
              <button
                type="button"
                className="absolute right-4 top-4 inline-flex size-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
                aria-label="Close"
                disabled={writePending}
                onClick={() => setOverthrowOpen(false)}
              >
                <X className="size-4" strokeWidth={2.2} />
              </button>
              <div className="flex items-start gap-3 pr-10">
                <div
                  className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
                  aria-hidden
                >
                  <Plus className="size-5" strokeWidth={2} />
                </div>
                <div className="min-w-0 leading-tight">
                  <h2 id="overthrow-title" className="text-lg font-bold text-slate-900">
                    Overthrow runs
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Extra runs from overthrows on the same ball (added to the total, no extra delivery).
                  </p>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <div className="space-y-2">
                <label htmlFor="overthrow-runs" className="text-sm font-semibold text-slate-900">
                  Runs
                </label>
                <input
                  id="overthrow-runs"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={36}
                  value={overthrowStr}
                  onChange={(e) => {
                    setOverthrowStr(e.target.value)
                    if (overthrowFieldError) setOverthrowFieldError(null)
                  }}
                  aria-invalid={Boolean(overthrowFieldError)}
                  aria-describedby={overthrowFieldError ? 'overthrow-runs-error' : undefined}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-none outline-none transition-[box-shadow,border-color] placeholder:text-slate-400 focus:border-primary/35 focus:shadow-[0_0_0_3px_rgba(229,9,20,0.12)]"
                  autoFocus
                />
                {overthrowFieldError ? (
                  <p id="overthrow-runs-error" className="text-sm text-red-600" role="alert">
                    {overthrowFieldError}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="shrink-0 border-t border-slate-100 px-5 py-4">
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 rounded-xl px-4 text-sm font-semibold"
                  disabled={writePending}
                  onClick={() => {
                    setOverthrowOpen(false)
                    setOverthrowFieldError(null)
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="h-11 rounded-xl px-4 text-sm font-semibold !text-primary-foreground"
                  disabled={writePending}
                  onClick={() => {
                    void (async () => {
                      const v = parseOverthrowRuns(overthrowStr)
                      if (!v) return
                      await submitOverthrow(v)
                    })()
                  }}
                >
                  <BtnPendingLabel pending={writePending} idle="Save runs" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {wicketOpen && canScore && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4" role="presentation">
          {wicketModalMode === 'score' ? (
            <div
              className="flex max-h-[min(90dvh,720px)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-2xl"
              role="dialog"
              aria-modal="true"
              aria-labelledby="fall-wicket-title"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="relative shrink-0 border-b border-slate-100 px-5 pb-4 pt-5">
                <button
                  type="button"
                  className="absolute top-4 right-4 inline-flex size-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
                  aria-label="Close"
                  disabled={writePending}
                  onClick={closeWicketModal}
                >
                  <X className="size-4" strokeWidth={2.2} />
                </button>
                <div className="flex items-start gap-3 pr-10">
                  <div
                    className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
                    aria-hidden
                  >
                    <UserX className="size-5" strokeWidth={2} />
                  </div>
                  <div className="min-w-0 leading-tight">
                    <h2 id="fall-wicket-title" className="text-lg font-bold text-slate-900">
                      Fall of wicket
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      The striker is dismissed unless you choose Run out (then pick striker or non-striker). Who
                      helped? applies for catch, run out, and stumping only.
                    </p>
                  </div>
                </div>
              </div>

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
                {pendingRunsFromPad !== null && (
                  <div className="flex gap-3 rounded-xl border border-sky-100 bg-sky-50 px-3 py-3 text-sm text-slate-700">
                    <Info className="size-5 shrink-0 text-sky-600" strokeWidth={2} aria-hidden />
                    <p className="min-w-0 leading-snug">
                      This ball: <strong>{pendingRunsFromPad}</strong> run(s) to the total (incl. extras).
                    </p>
                  </div>
                )}

                <div className={FOW_FORM_ROW}>
                  <label htmlFor="fow-kind" className={FOW_FORM_LABEL}>
                    How did the wicket fall?
                  </label>
                  <div className={FOW_FORM_CONTROL}>
                    <select
                      id="fow-kind"
                      className={matchFormSelectClass}
                      value={wFallKind}
                      onChange={(e) => {
                        const k = e.target.value as WicketFallKind
                        setWicketModalError(null)
                        setWFallKind(k)
                        if (!fallKindShowsFielder(k)) setWFielderId('')
                        if (state) setWDismiss(dismissedDefaultForFallKind(currentInnings(state), k))
                      }}
                      aria-required="true"
                    >
                      {WICKET_FALL_OPTIONS.map((o) => (
                        <option
                          key={o}
                          value={o}
                          disabled={
                            (wicketFallOnlyRunOut && o !== 'Run out') ||
                            (wideWicketRunOutOrStumpingOnly && o !== 'Run out' && o !== 'Stumping')
                          }
                        >
                          {o}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-primary"
                      aria-hidden
                    />
                  </div>
                </div>

                {state && fallKindShowsWhoGotOut(wFallKind) && (
                  <div className={FOW_FORM_ROW}>
                    <label htmlFor="fow-dismiss" className={FOW_FORM_LABEL}>
                      Who got out?
                    </label>
                    <div className={FOW_FORM_CONTROL}>
                      <select
                        id="fow-dismiss"
                        className={matchFormSelectClass}
                        value={wDismiss}
                        onChange={(e) => {
                          setWicketModalError(null)
                          setWDismiss(e.target.value)
                        }}
                        aria-required="true"
                      >
                        <option value={currentInnings(state).strikerId}>
                          {nameFor(match, currentInnings(state).strikerId)} (striker)
                        </option>
                        <option value={currentInnings(state).nonStrikerId}>
                          {nameFor(match, currentInnings(state).nonStrikerId)} (non-striker)
                        </option>
                      </select>
                      <ChevronDown
                        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-primary"
                        aria-hidden
                      />
                    </div>
                  </div>
                )}

                {state && fallKindShowsFielder(wFallKind) && (
                  <div className="space-y-1">
                    <div className={FOW_FORM_ROW}>
                      <label htmlFor="fow-fielder" className={FOW_FORM_LABEL}>
                        Who helped?
                      </label>
                      <div className={FOW_FORM_CONTROL}>
                        <select
                          id="fow-fielder"
                          className={matchFormSelectClass}
                          value={wFielderId}
                          onChange={(e) => {
                            setWicketModalError(null)
                            setWFielderId(e.target.value)
                          }}
                          aria-required="true"
                        >
                          <option value="">Select fielding player</option>
                          {xiPlayers(match, opp(currentInnings(state).battingSide)).map((p) => (
                            <option key={p.playerId} value={p.playerId}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                        <ChevronDown
                          className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-primary"
                          aria-hidden
                        />
                      </div>
                    </div>
                    <p className="w-full text-xs leading-snug text-slate-500 sm:pl-[calc(11rem+0.75rem)]">
                      Fielder for catch or run out; wicket-keeper defaults for stumping (you can change).
                    </p>
                  </div>
                )}

                {state &&
                  cfg &&
                  currentInnings(state).wickets + 1 <
                    maxWicketsForBattingSide(cfg, currentInnings(state).battingSide) && (
                    <div className={FOW_FORM_ROW}>
                      <label htmlFor="fow-new" className={FOW_FORM_LABEL}>
                        New batsman
                      </label>
                      <div className={FOW_FORM_CONTROL}>
                        <select
                          id="fow-new"
                          className={matchFormSelectClass}
                          value={wNew}
                          onChange={(e) => {
                            setWicketModalError(null)
                            setWNew(e.target.value)
                          }}
                          aria-required="true"
                        >
                          <option value="">Select new batsman</option>
                          {battersYetToPlay(
                            match,
                            state,
                            wFallKind === 'Run out'
                              ? wDismiss
                              : currentInnings(state).strikerId,
                          ).map((p) => (
                            <option key={p.playerId} value={p.playerId}>
                              {incomingBatterOptionLabel(match, state, p.playerId)}
                            </option>
                          ))}
                        </select>
                        <ChevronDown
                          className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-primary"
                          aria-hidden
                        />
                      </div>
                    </div>
                  )}
                {state &&
                  cfg &&
                  currentInnings(state).wickets + 1 >=
                    maxWicketsForBattingSide(cfg, currentInnings(state).battingSide) && (
                    <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-sm text-slate-600">
                      Last wicket of the innings — no incoming batter.
                    </div>
                  )}
              </div>

              <div className="shrink-0 space-y-3 border-t border-slate-100 p-4">
                {wicketModalError && (
                  <p
                    role="alert"
                    className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive"
                  >
                    {wicketModalError}
                  </p>
                )}
                <Button
                  type="button"
                  className="h-11 w-full rounded-xl font-semibold !text-primary-foreground"
                  disabled={writePending}
                  onClick={() => {
                    void (async () => {
                      if (!state || !cfg) return
                      const inn = currentInnings(state)
                      if (chkByes && chkLegByes) {
                        setWicketModalError('Choose either Byes or Leg byes, not both.')
                        return
                      }
                      const dismissedId = wFallKind === 'Run out' ? wDismiss : inn.strikerId
                      const missing: string[] = []
                      if (
                        wFallKind === 'Run out' &&
                        (!wDismiss ||
                          (wDismiss !== inn.strikerId && wDismiss !== inn.nonStrikerId))
                      ) {
                        missing.push('Who got out?')
                      }
                      if (fallKindShowsFielder(wFallKind) && !wFielderId) {
                        missing.push('Who helped?')
                      }
                      const needsIncoming =
                        inn.wickets + 1 < maxWicketsForBattingSide(cfg, inn.battingSide)
                      if (needsIncoming) {
                        const yet = battersYetToPlay(match, state, dismissedId)
                        if (!wNew || !yet.some((p) => p.playerId === wNew)) {
                          missing.push('New batsman')
                        }
                      }
                      if (missing.length > 0) {
                        setWicketModalError(
                          missing.length === 1
                            ? `Fill in: ${missing[0]}`
                            : `Fill in: ${missing.join(' · ')}`,
                        )
                        return
                      }
                      if (wFallKind !== 'Run out' && wicketFallOnlyRunOut) {
                        setWicketModalError(
                          pendingFreeHitNextDelivery && !chkWide && !chkNoBall
                            ? 'On a free hit, only run out can dismiss a batter.'
                            : 'With runs on this ball, only run out can dismiss a batter.',
                        )
                        return
                      }
                      if (
                        wideWicketRunOutOrStumpingOnly &&
                        wFallKind !== 'Run out' &&
                        wFallKind !== 'Stumping'
                      ) {
                        setWicketModalError(
                          'On a wide with wicket, only run out or stumping can dismiss a batter.',
                        )
                        return
                      }
                      setWicketModalError(null)
                      const runs = pendingRunsFromPad ?? 0
                      const delivery = chkWide ? 'wide' : chkNoBall ? 'noball' : 'legal'
                      const alloc = buildRunsAllocation(chkWide, chkNoBall, chkByes, chkLegByes, runs)
                      const ok = await sendBall(
                        makeBall(state, {
                          delivery,
                          ...alloc,
                          wicket: buildScoreWicketPayload(
                            match,
                            wFallKind,
                            dismissedId,
                            needsIncoming ? wNew : '',
                            fallKindShowsFielder(wFallKind) ? wFielderId : '',
                          ),
                        }),
                      )
                      if (!ok) return
                      clearDeliveryCheckboxes()
                      closeWicketModal()
                    })()
                  }}
                >
                  <BtnPendingLabel pending={writePending} idle="Done" />
                </Button>
              </div>
            </div>
          ) : (
            <div
              className="flex max-h-[min(90dvh,640px)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-2xl"
              role="dialog"
              aria-modal="true"
              aria-labelledby="retired-hurt-title"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="relative shrink-0 border-b border-slate-100 px-5 pb-4 pt-5">
                <button
                  type="button"
                  className="absolute top-4 right-4 inline-flex size-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
                  aria-label="Close"
                  disabled={writePending}
                  onClick={closeWicketModal}
                >
                  <X className="size-4" strokeWidth={2.2} />
                </button>
                <div className="flex items-start gap-3 pr-10">
                  <div
                    className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
                    aria-hidden
                  >
                    <UserMinus className="size-5" strokeWidth={2} />
                  </div>
                  <div className="min-w-0 leading-tight">
                    <h2 id="retired-hurt-title" className="text-lg font-bold text-slate-900">
                      Retired hurt
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      No wicket, no ball bowled — player may bat again later this innings.
                    </p>
                  </div>
                </div>
              </div>

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
                <div
                  className={cn(FOW_FORM_ROW, 'items-start')}
                  role="group"
                  aria-labelledby="retire-hurt-who-label"
                >
                  <div id="retire-hurt-who-label" className={cn(FOW_FORM_LABEL, 'pt-0.5')}>
                    Who is retiring?
                  </div>
                  {state && (
                    <div
                      className={cn(FOW_FORM_CONTROL, 'grid grid-cols-1 gap-2 sm:grid-cols-2')}
                      role="group"
                      aria-labelledby="retire-hurt-who-label"
                    >
                      <button
                        type="button"
                        className={cn(
                          'w-full rounded-xl border px-3 py-3 text-left text-sm font-medium text-slate-900 transition-[border-color,box-shadow,background-color]',
                          wDismiss === currentInnings(state).strikerId
                            ? 'border-primary bg-primary/[0.06] shadow-[0_0_0_1px_rgba(229,9,20,0.2)]'
                            : 'border-slate-200 bg-slate-50/50 hover:border-slate-300 hover:bg-slate-50',
                        )}
                        aria-pressed={wDismiss === currentInnings(state).strikerId}
                        onClick={() => {
                          setWicketModalError(null)
                          setWDismiss(currentInnings(state).strikerId)
                        }}
                      >
                        <span className="block leading-snug">{nameFor(match, currentInnings(state).strikerId)}</span>
                        <span className="mt-0.5 block text-xs font-semibold text-slate-500">Striker</span>
                      </button>
                      <button
                        type="button"
                        className={cn(
                          'w-full rounded-xl border px-3 py-3 text-left text-sm font-medium text-slate-900 transition-[border-color,box-shadow,background-color]',
                          wDismiss === currentInnings(state).nonStrikerId
                            ? 'border-primary bg-primary/[0.06] shadow-[0_0_0_1px_rgba(229,9,20,0.2)]'
                            : 'border-slate-200 bg-slate-50/50 hover:border-slate-300 hover:bg-slate-50',
                        )}
                        aria-pressed={wDismiss === currentInnings(state).nonStrikerId}
                        onClick={() => {
                          setWicketModalError(null)
                          setWDismiss(currentInnings(state).nonStrikerId)
                        }}
                      >
                        <span className="block leading-snug">
                          {nameFor(match, currentInnings(state).nonStrikerId)}
                        </span>
                        <span className="mt-0.5 block text-xs font-semibold text-slate-500">Non-striker</span>
                      </button>
                    </div>
                  )}
                </div>

                {state && (
                  <div className={FOW_FORM_ROW}>
                    <label htmlFor="fow-retire-replace" className={FOW_FORM_LABEL}>
                      Replaced by?
                    </label>
                    <div className={FOW_FORM_CONTROL}>
                      <select
                        id="fow-retire-replace"
                        className={matchFormSelectClass}
                        value={wNew}
                        onChange={(e) => {
                          setWicketModalError(null)
                          setWNew(e.target.value)
                        }}
                        aria-required="true"
                      >
                        <option value="">Select replacement</option>
                        {replacementBattersForRetirement(match, state, wDismiss).map((p) => (
                          <option key={p.playerId} value={p.playerId}>
                            {incomingBatterOptionLabel(match, state, p.playerId)}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-primary"
                        aria-hidden
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="shrink-0 space-y-3 border-t border-slate-100 p-4">
                {wicketModalError && (
                  <p
                    role="alert"
                    className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive"
                  >
                    {wicketModalError}
                  </p>
                )}
                <Button
                  type="button"
                  className="h-11 w-full rounded-xl font-semibold !text-primary-foreground"
                  disabled={writePending}
                  onClick={() => {
                    void (async () => {
                      if (!state || !cfg) return
                      const inn = currentInnings(state)
                      const missing: string[] = []
                      if (
                        !wDismiss ||
                        (wDismiss !== inn.strikerId && wDismiss !== inn.nonStrikerId)
                      ) {
                        missing.push('Who is retiring?')
                      }
                      const opts = replacementBattersForRetirement(match, state, wDismiss)
                      if (!wNew || !opts.some((p) => p.playerId === wNew)) {
                        missing.push('Replaced by?')
                      }
                      if (missing.length > 0) {
                        setWicketModalError(
                          missing.length === 1
                            ? `Fill in: ${missing[0]}`
                            : `Fill in: ${missing.join(' · ')}`,
                        )
                        return
                      }
                      setWicketModalError(null)
                      const ok = await sendBall(
                        makeBall(state, {
                          delivery: 'legal',
                          runsOffBat: 0,
                          noDelivery: true,
                          wicket: {
                            dismissedId: wDismiss,
                            howOut: 'Retired hurt',
                            newBatsmanId: wNew,
                            countsAsWicket: false,
                          },
                        }),
                      )
                      if (!ok) return
                      closeWicketModal()
                    })()
                  }}
                >
                  <BtnPendingLabel pending={writePending} idle="Done" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {(match.status === 'completed' || state?.matchComplete) && (
        <div className="card">
          <p>
            {humanizeResultForMatch(
              match.resultSummary?.text ?? state?.resultText ?? 'Completed',
              match,
            )}
          </p>
          {match.resultSummary?.endReason && (
            <p className="muted small" style={{ marginTop: '0.35rem' }}>
              <strong>Reason:</strong> {match.resultSummary.endReason}
            </p>
          )}
        </div>
      )}

      {state?.matchComplete &&
        state.innings2 &&
        match.lineup &&
        mvpForPotm?.potm &&
        match.status !== 'scheduled' && (
          <div className="card" style={{ marginTop: '0.75rem' }}>
            <div className="flex items-start gap-2">
              <Trophy className="mt-0.5 size-5 shrink-0 text-amber-600" strokeWidth={2} aria-hidden />
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold text-slate-900">Player of the Match</h2>
                <p className="mt-1 text-base text-slate-800">
                  <span className="font-semibold">{mvpForPotm.potm.name}</span>
                  <span className="text-slate-500"> · </span>
                  <span className="text-slate-600">
                    {mvpForPotm.potm.side === 'home'
                      ? matchTeamShortLabel(match.home)
                      : matchTeamShortLabel(match.away)}
                  </span>
                </p>
                {mvpForPotm.potmNote ? (
                  <p className="muted small mt-1">{mvpForPotm.potmNote}</p>
                ) : null}
                {match.playerOfTheMatchPlayerId?.trim() ? (
                  <p className="muted small mt-1">Manually selected — shown on the public scorecard and PDF.</p>
                ) : null}
                {user?.uid === match.createdBy && match.status !== 'abandoned' && (
                  <div className="mt-4 border-t border-slate-100 pt-4">
                    <label htmlFor="score-potm-select" className="text-xs font-medium text-slate-600">
                      Change Player of the Match
                    </label>
                    <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end">
                      <select
                        id="score-potm-select"
                        className={cn(matchFormSelectClass, 'min-h-11 min-w-0 flex-1 sm:max-w-md')}
                        value={potmDraft}
                        onChange={(e) => setPotmDraft(e.target.value)}
                      >
                        <option value="">Automatic (MVP rules)</option>
                        {potmSelectOptions.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      <Button
                        type="button"
                        className="h-11 shrink-0 rounded-xl font-semibold"
                        disabled={
                          writePending || (potmDraft.trim() || '') === (match.playerOfTheMatchPlayerId ?? '').trim()
                        }
                        onClick={() => void savePlayerOfTheMatch()}
                      >
                        <BtnPendingLabel pending={writePending} idle="Save" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      {inningsBreakPopup && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setInningsBreakPopup(null)
          }}
        >
          <div
            className="flex max-h-[min(90dvh,560px)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="innings-break-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="shrink-0 border-b border-slate-100 px-5 pb-4 pt-5">
              <div className="flex items-start gap-3">
                <div
                  className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
                  aria-hidden
                >
                  <PlayCircle className="size-5" strokeWidth={2} />
                </div>
                <div className="min-w-0 leading-tight">
                  <h2 id="innings-break-title" className="text-lg font-bold text-slate-900">
                    First innings complete
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">Start the second innings when you are ready.</p>
                </div>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <p className="text-sm leading-relaxed text-slate-700">
                <strong className="font-semibold text-slate-900">{inningsBreakPopup.teamName}</strong> need{' '}
                <strong className="font-semibold text-slate-900">{inningsBreakPopup.runsNeeded}</strong> runs from{' '}
                <strong className="font-semibold text-slate-900">{inningsBreakPopup.oversLimit}</strong> overs, at a
                required run rate of <strong className="font-semibold text-slate-900">{inningsBreakPopup.rpo}</strong>{' '}
                runs per over.
              </p>
            </div>
            <div className="flex shrink-0 justify-end border-t border-slate-100 p-4">
              <Button
                type="button"
                className="h-11 min-w-[10rem] rounded-xl font-semibold !text-primary-foreground"
                onClick={() => setInningsBreakPopup(null)}
              >
                OK
              </Button>
            </div>
          </div>
        </div>
      )}

      {matchCompletePopup && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4" role="presentation">
          <div
            className="flex max-h-[min(90dvh,640px)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="match-complete-popup-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="relative shrink-0 border-b border-slate-100 px-5 pb-4 pt-5">
              <div className="flex items-start gap-3">
                <div
                  className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
                  aria-hidden
                >
                  <Trophy className="size-5" strokeWidth={2} />
                </div>
                <div className="min-w-0 leading-tight">
                  <h2 id="match-complete-popup-title" className="text-lg font-bold text-slate-900">
                    Match over
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">Review the result, then save or undo.</p>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <p className="text-base font-semibold leading-snug text-slate-900">{matchCompletePopup.summary}</p>
              {matchCompletePopup.scoreLines.map((line, i) => (
                <p key={i} className="text-sm text-slate-600">
                  {line}
                </p>
              ))}
              <div className="flex gap-3 rounded-xl border border-sky-100 bg-sky-50 px-3 py-3 text-sm text-slate-700">
                <Info className="size-5 shrink-0 text-sky-600" strokeWidth={2} aria-hidden />
                <p className="min-w-0 leading-snug">
                  <strong className="font-semibold text-slate-800">Undo</strong> removes the last scoring step if the
                  finish was wrong. <strong className="font-semibold text-slate-800">Confirm result</strong> saves the
                  match as completed and locks scoring.
                </p>
              </div>
            </div>

            <div className="flex shrink-0 gap-3 border-t border-slate-100 p-4">
              {canUndoScoring && (
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 flex-1 rounded-xl"
                  disabled={writePending}
                  onClick={() => void undo()}
                >
                  Undo
                </Button>
              )}
              <Button
                type="button"
                className={cn(
                  'h-11 rounded-xl font-semibold !text-primary-foreground',
                  canUndoScoring ? 'flex-1' : 'w-full',
                )}
                disabled={writePending || match.status !== 'live'}
                onClick={() => {
                  void (async () => {
                    try {
                      if (match.status === 'live' && state?.matchComplete) {
                        await persistMatchComplete()
                      }
                      setMatchCompletePopup(null)
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'Could not save match result')
                    }
                  })()
                }}
              >
                Confirm result
              </Button>
            </div>
          </div>
        </div>
      )}

      {endInningsOpen && state && cfg && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setEndInningsOpen(false)
          }}
        >
          <div
            className="flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="end-innings-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="relative border-b border-slate-100 px-5 pb-4 pt-5">
              <button
                type="button"
                className="absolute top-4 right-4 inline-flex size-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
                aria-label="Close"
                onClick={() => setEndInningsOpen(false)}
              >
                <X className="size-4" strokeWidth={2.2} />
              </button>
              <div className="flex items-start gap-3 pr-10">
                <div
                  className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
                  aria-hidden
                >
                  <Flag className="size-5" strokeWidth={2} />
                </div>
                <div className="min-w-0 leading-tight">
                  <h2 id="end-innings-title" className="text-lg font-bold text-slate-900">
                    End innings
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Close the {state.activeInnings === 1 ? 'first' : 'second'} innings now (before all out or the overs
                    limit).
                  </p>
                </div>
              </div>
            </div>

            <div className="px-5 pb-5 pt-4">
              <p className="text-sm leading-relaxed text-slate-600">
                If you confirm by mistake, use{' '}
                <strong className="font-semibold text-slate-800">Undo</strong> on the score page afterward (same as
                reversing a ball) — it removes this &quot;End innings&quot; step.
              </p>

              <fieldset className="mt-4 flex flex-nowrap gap-2 border-0 p-0">
                <legend className="sr-only">How the innings ended</legend>
                <label
                  className={cn(
                    'flex min-h-11 min-w-0 flex-1 cursor-pointer items-center justify-center rounded-xl border px-3 py-2.5 text-center text-sm font-medium transition-colors',
                    endInningsReason === 'declared'
                      ? 'border-primary bg-primary/[0.06] ring-1 ring-primary/20'
                      : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50',
                  )}
                >
                  <input
                    type="radio"
                    name="endInningsReason"
                    checked={endInningsReason === 'declared'}
                    onChange={() => setEndInningsReason('declared')}
                    className="sr-only"
                  />
                  Declared
                </label>
                <label
                  className={cn(
                    'flex min-h-11 min-w-0 flex-1 cursor-pointer items-center justify-center rounded-xl border px-3 py-2.5 text-center text-sm font-medium transition-colors',
                    endInningsReason === 'all_out'
                      ? 'border-primary bg-primary/[0.06] ring-1 ring-primary/20'
                      : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50',
                  )}
                >
                  <input
                    type="radio"
                    name="endInningsReason"
                    checked={endInningsReason === 'all_out'}
                    onChange={() => setEndInningsReason('all_out')}
                    className="sr-only"
                  />
                  All out
                </label>
              </fieldset>
            </div>

            <div className="flex gap-3 border-t border-slate-100 p-4">
              <Button type="button" variant="outline" className="h-11 flex-1 rounded-xl" onClick={() => setEndInningsOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                className="h-11 flex-1 rounded-xl font-semibold !text-primary-foreground"
                disabled={writePending}
                onClick={() => void confirmEndInnings()}
              >
                <BtnPendingLabel pending={writePending} idle="End innings" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function crrDisplay(inn: InningsSnapshot, ballsPerOver: number): string {
  if (inn.legalBalls <= 0) return '—'
  const overs = inn.legalBalls / ballsPerOver
  return (inn.runs / overs).toFixed(2)
}

function bowlerOversDisplay(legalBalls: number, ballsPerOver: number): string {
  if (legalBalls <= 0) return '0'
  return oversString(legalBalls, ballsPerOver)
}

function bowlerEconomy(runs: number, legalBalls: number, ballsPerOver: number): string {
  if (legalBalls <= 0) return '0.00'
  const overs = legalBalls / ballsPerOver
  return (runs / overs).toFixed(2)
}

function srRuns(runs: number, balls: number): string {
  if (balls <= 0) return '—'
  return ((runs / balls) * 100).toFixed(2)
}

/** Batters at the crease, in XI order (striker is indicated with * only, not by row order). */
function orderedLiveBatters(match: MatchDoc, state: ReplayState): RosterPlayer[] {
  const inn = currentInnings(state)
  const xi = xiPlayers(match, inn.battingSide)
  const atCrease = new Set([inn.strikerId, inn.nonStrikerId])
  return xi.filter((p) => atCrease.has(p.playerId))
}

function buildRunsAllocation(
  wide: boolean,
  noball: boolean,
  byes: boolean,
  legByes: boolean,
  runs: number,
): Pick<BallEventPayload, 'runsOffBat' | 'extraWideRuns' | 'extraNoBallRuns' | 'byeRuns' | 'legByeRuns'> {
  if (wide) {
    if (byes) {
      return {
        runsOffBat: 0,
        extraWideRuns: 0,
        extraNoBallRuns: 0,
        byeRuns: Math.max(0, runs - 1),
        legByeRuns: 0,
      }
    }
    if (legByes) {
      return {
        runsOffBat: 0,
        extraWideRuns: 0,
        extraNoBallRuns: 0,
        byeRuns: 0,
        legByeRuns: Math.max(0, runs - 1),
      }
    }
    // Numpad = runs in addition to the 1-run wide penalty (e.g. 1 → 2 team runs total).
    return {
      runsOffBat: 0,
      extraWideRuns: Math.max(0, runs),
      extraNoBallRuns: 0,
      byeRuns: 0,
      legByeRuns: 0,
    }
  }
  if (noball) {
    if (byes) {
      return {
        runsOffBat: 0,
        extraWideRuns: 0,
        extraNoBallRuns: 0,
        byeRuns: Math.max(0, runs - 1),
        legByeRuns: 0,
      }
    }
    if (legByes) {
      return {
        runsOffBat: 0,
        extraWideRuns: 0,
        extraNoBallRuns: 0,
        byeRuns: 0,
        legByeRuns: Math.max(0, runs - 1),
      }
    }
    // Numpad = runs in addition to the 1-run no-ball penalty.
    return {
      runsOffBat: 0,
      extraWideRuns: 0,
      extraNoBallRuns: Math.max(0, runs),
      byeRuns: 0,
      legByeRuns: 0,
    }
  }
  if (byes) {
    return { runsOffBat: 0, extraWideRuns: 0, extraNoBallRuns: 0, byeRuns: runs, legByeRuns: 0 }
  }
  if (legByes) {
    return { runsOffBat: 0, extraWideRuns: 0, extraNoBallRuns: 0, byeRuns: 0, legByeRuns: runs }
  }
  return { runsOffBat: runs, extraWideRuns: 0, extraNoBallRuns: 0, byeRuns: 0, legByeRuns: 0 }
}

function scoreBallPillClass(sym: string): string {
  const base = 'public-live-ball'
  if (sym.startsWith('+')) return `${base} ${base}--extra`
  if (sym === 'W' || sym === 'w' || /^\d+W$/i.test(sym)) return `${base} ${base}--wicket`
  if (sym.startsWith('Wd') && sym.endsWith('W')) return `${base} ${base}--wicket`
  if (sym.startsWith('Nb') && sym.includes('W')) return `${base} ${base}--wicket`
  if (sym === 'Rh') return `${base} ${base}--retired-hurt`
  if (sym === '⇄') return `${base} ${base}--swap`
  if (sym.startsWith('Wd')) return base
  if (sym.startsWith('Nb')) return base
  if (sym.startsWith('Wd') || sym.startsWith('Nb')) return `${base} ${base}--extra`
  const n = Number.parseInt(sym, 10)
  if (!Number.isNaN(n)) {
    if (n === 4) return `${base} ${base}--four`
    if (n === 6) return `${base} ${base}--six`
    return `${base} ${base}--runs`
  }
  return base
}

function nameFor(match: MatchDoc, pid: string) {
  return (
    match.home.players.find((p) => p.playerId === pid)?.name ??
    match.away.players.find((p) => p.playerId === pid)?.name ??
    pid
  )
}

/** Label in Fall of wicket / replacement selects; retired hurt returnees show `(rtd)`. */
function incomingBatterOptionLabel(match: MatchDoc, state: ReplayState, playerId: string): string {
  const base = nameFor(match, playerId)
  return currentInnings(state).retiredOffField.has(playerId) ? `${base} (rtd)` : base
}

function xiPlayers(match: MatchDoc, side: Side) {
  const xi = match.lineup?.[side === 'home' ? 'homeXI' : 'awayXI'] ?? []
  const pool = side === 'home' ? match.home.players : match.away.players
  return pool.filter((p) => xi.includes(p.playerId))
}

function battersYetToPlay(match: MatchDoc, state: ReplayState, pendingDismissedId: string): RosterPlayer[] {
  const inn = currentInnings(state)
  const xi = xiPlayers(match, inn.battingSide)
  const keep = new Set(
    battersYetToPlayIds(
      xi.map((p) => p.playerId),
      inn,
      pendingDismissedId,
    ),
  )
  return xi.filter((p) => keep.has(p.playerId))
}

/** Batters who may replace a retired hurt player: yet to bat or previously retired hurt (may return). */
function replacementBattersForRetirement(match: MatchDoc, state: ReplayState, retiringId: string): RosterPlayer[] {
  const inn = currentInnings(state)
  const xi = xiPlayers(match, inn.battingSide)
  const partner = retiringId === inn.strikerId ? inn.nonStrikerId : inn.strikerId
  return xi.filter(
    (p) =>
      !inn.dismissed.has(p.playerId) &&
      p.playerId !== partner &&
      p.playerId !== retiringId &&
      (!inn.appearedBatIds.has(p.playerId) || inn.retiredOffField.has(p.playerId)),
  )
}

function makeBall(
  state: ReplayState,
  partial: Partial<BallEventPayload> & Pick<BallEventPayload, 'delivery' | 'runsOffBat'>,
): BallEventPayload {
  const inn = currentInnings(state)
  const base: BallEventPayload = {
    innings: state.activeInnings as 1 | 2,
    battingSide: inn.battingSide,
    delivery: partial.delivery,
    runsOffBat: partial.runsOffBat,
    extraWideRuns: partial.extraWideRuns ?? 0,
    extraNoBallRuns: partial.extraNoBallRuns ?? 0,
    byeRuns: partial.byeRuns ?? 0,
    legByeRuns: partial.legByeRuns ?? 0,
  }
  if (partial.wicket) {
    base.wicket = partial.wicket
  }
  if (partial.noDelivery) {
    base.noDelivery = true
  }
  return base
}
