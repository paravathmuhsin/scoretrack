import type { MatchDoc, Side } from '../types/models'
import {
  applyBall,
  applyBowlerChange,
  applyEndInnings,
  applyOverthrow,
  applySecondInningsStart,
  applySwapEnds,
  countsAsLegalBall,
  currentInnings,
  initialReplayState,
  totalRunsOnDelivery,
  wicketIsRealDismissal,
  type ReplayConfig,
  type ReplayState,
  type ScoreEvent,
} from '../scoring/engine'
import {
  computeMvpPointsForPlayer,
  isShortFormatMvp,
  type MvpMatchContext,
  type MvpPlayerStats,
} from './mvpPoints'

export type PlayerMvpRow = {
  playerId: string
  name: string
  side: Side
  batting: number
  bowling: number
  fielding: number
  /** Win bonus, cameo, top-scorer wicket, chase finisher — see {@link computeMvpPointsForPlayer}. */
  impact: number
  total: number
}

/** Fielding credits aligned with MVP fantasy (catch / run out / stumping). */
export type MatchMvpFieldingRow = { catches: number; runOuts: number; stumpings: number }

export type MatchMvpResult = {
  rows: PlayerMvpRow[]
  potm: { playerId: string; name: string; side: Side } | null
  potmNote: string | null
  /** How POTM was chosen when `potm` is set; null when no POTM. */
  potmSource: 'manual' | 'auto' | null
  /** Per-XI player fielding tallies from the same replay as MVP rows. */
  fieldingByPlayerId: Record<string, MatchMvpFieldingRow>
}

function playerSide(match: MatchDoc, playerId: string): Side | null {
  if (match.lineup?.homeXI.includes(playerId)) return 'home'
  if (match.lineup?.awayXI.includes(playerId)) return 'away'
  if (match.home.players.some((p) => p.playerId === playerId)) return 'home'
  if (match.away.players.some((p) => p.playerId === playerId)) return 'away'
  return null
}

function nameFor(match: MatchDoc, pid: string): string {
  return (
    match.home.players.find((p) => p.playerId === pid)?.name ??
    match.away.players.find((p) => p.playerId === pid)?.name ??
    pid
  )
}

/** Stable tournament / side key for win bonus (matches recompute tournament keys). */
function teamKeyForSide(match: MatchDoc, side: Side): string {
  const snap = side === 'home' ? match.home : match.away
  return snap.tournamentTeamId?.trim() || side
}

function chaseAlreadyWon(state: ReplayState): boolean {
  if (state.activeInnings !== 2 || !state.innings2) return false
  const target = state.innings1.runs + 1
  return state.innings2.runs >= target
}

function normalizeHow(how: string): string {
  return how.trim().toLowerCase()
}

function isRunOutHow(how: string): boolean {
  return normalizeHow(how) === 'run out'
}

function isCatchOutHow(how: string): boolean {
  return normalizeHow(how) === 'catch out'
}

function isStumpingHow(how: string): boolean {
  const k = normalizeHow(how)
  return k === 'stumping' || k === 'stumped'
}

type BowlerWicketMeta = {
  dismissalTypes: string[]
  dismissedPlayerIds: string[]
}

type FieldingAgg = { catches: number; runOuts: number; stumpings: number }

function emptyBowlerMeta(): BowlerWicketMeta {
  return { dismissalTypes: [], dismissedPlayerIds: [] }
}

function emptyFielding(): FieldingAgg {
  return { catches: 0, runOuts: 0, stumpings: 0 }
}

/** Top run-scorer in the match (for “wicket of top scorer”); ties broken by playerId sort. */
function topScorerPlayerId(state: ReplayState): string {
  let bestId = ''
  let bestRuns = -1
  for (const [pid, row] of Object.entries(state.batterStats)) {
    const r = row.runs
    if (r > bestRuns || (r === bestRuns && pid < bestId)) {
      bestRuns = r
      bestId = pid
    }
  }
  return bestId
}

function buildMatchContext(match: MatchDoc, state: ReplayState): MvpMatchContext {
  const w = state.winner
  const winningTeamId = w === 'home' || w === 'away' ? teamKeyForSide(match, w) : ''
  return {
    winningTeamId,
    topScorerPlayerId: topScorerPlayerId(state),
    shortFormat: isShortFormatMvp(match.oversLimit),
  }
}

/**
 * MVP points for the match using the ScoreTrack fantasy formula ({@link computeMvpPointsForPlayer}).
 * Replays ball events (with undos) to collect maidens, dismissal types, fielding credits, and chase finisher.
 */
export function computeMatchMvp(
  match: MatchDoc,
  cfg: ReplayConfig,
  events: ScoreEvent[],
  finalState: ReplayState,
): MatchMvpResult {
  const sorted = [...events].sort((a, b) => a.seq - b.seq)
  const undone = new Set<number>()
  for (const e of sorted) {
    if (e.kind === 'undo') undone.add(e.revertedSeq)
  }

  const bowlerMeta = new Map<string, BowlerWicketMeta>()
  const fielding = new Map<string, FieldingAgg>()
  const maidensByBowler = new Map<string, number>()

  const getBowler = (id: string): BowlerWicketMeta => {
    let m = bowlerMeta.get(id)
    if (!m) {
      m = emptyBowlerMeta()
      bowlerMeta.set(id, m)
    }
    return m
  }

  const getField = (id: string): FieldingAgg => {
    let f = fielding.get(id)
    if (!f) {
      f = emptyFielding()
      fielding.set(id, f)
    }
    return f
  }

  const state = initialReplayState(cfg)
  let runsSinceOverStart = 0
  /** Batter who faced the ball that first completed a successful chase (impact bonus). */
  let chaseFinisherId: string | null = null

  for (const e of sorted) {
    if (e.kind === 'undo') continue
    if (e.kind === 'start_second_innings') {
      if (undone.has(e.seq)) continue
      runsSinceOverStart = 0
      applySecondInningsStart(state, e.battingSide, e.strikerId, e.nonStrikerId, e.bowlerId)
      continue
    }
    if (e.kind === 'change_bowler') {
      if (undone.has(e.seq)) continue
      const inn = currentInnings(state)
      if (inn.legalBalls > 0 && inn.legalBalls % cfg.ballsPerOver === 0) {
        applyBowlerChange(state, e.bowlerId)
      }
      continue
    }
    if (e.kind === 'swap_ends') {
      if (undone.has(e.seq)) continue
      applySwapEnds(state)
      continue
    }
    if (e.kind === 'overthrow') {
      if (undone.has(e.seq)) continue
      applyOverthrow(state, e.runs)
      continue
    }
    if (e.kind === 'end_innings') {
      if (undone.has(e.seq)) continue
      runsSinceOverStart = 0
      applyEndInnings(state, cfg, e.innings, e.reason)
      continue
    }
    if (e.kind !== 'ball') continue
    if (undone.has(e.seq)) continue

    const b = e.ball
    const innBefore = currentInnings(state)
    const bowlerId = innBefore.bowlerId
    const innNum = innBefore.innings as 1 | 2

    const chaseWonBeforeBall = chaseAlreadyWon(state)
    const strikerAtStart = innBefore.strikerId

    if (wicketIsRealDismissal(b) && b.wicket) {
      const w = b.wicket
      const how = w.howOut
      const bm = getBowler(bowlerId)
      bm.dismissalTypes.push(how)
      bm.dismissedPlayerIds.push(w.dismissedId)

      const fid = w.fielderId
      if (fid) {
        const fa = getField(fid)
        if (isRunOutHow(how)) fa.runOuts += 1
        else if (isCatchOutHow(how)) fa.catches += 1
        else if (isStumpingHow(how)) fa.stumpings += 1
      }
    }

    runsSinceOverStart += totalRunsOnDelivery(b)
    applyBall(cfg, state, b)

    const innAfter = currentInnings(state)
    if (countsAsLegalBall(b) && innAfter.legalBalls > 0 && innAfter.legalBalls % cfg.ballsPerOver === 0) {
      if (runsSinceOverStart === 0) {
        maidensByBowler.set(bowlerId, (maidensByBowler.get(bowlerId) ?? 0) + 1)
      }
      runsSinceOverStart = 0
    }

    // Chase completed on this ball: credit the striker who faced it.
    if (
      state.matchComplete &&
      state.innings2 &&
      innNum === 2 &&
      !chaseWonBeforeBall &&
      chaseAlreadyWon(state) &&
      state.winner === innBefore.battingSide
    ) {
      chaseFinisherId = strikerAtStart
    }
  }

  const ctx = buildMatchContext(match, finalState)

  const xiIds = new Set<string>([
    ...(match.lineup?.homeXI ?? []),
    ...(match.lineup?.awayXI ?? []),
  ])

  const rows: PlayerMvpRow[] = []
  for (const pid of xiIds) {
    const side = playerSide(match, pid)
    if (!side) continue

    const bs = finalState.batterStats[pid]
    const bw = finalState.bowlerStats[pid]
    const bm = bowlerMeta.get(pid)
    const fg = fielding.get(pid)

    const runs = bs?.runs ?? 0
    const balls = bs?.balls ?? 0
    const how = bs?.how?.trim() ?? ''
    const duck =
      runs === 0 &&
      balls > 0 &&
      bs?.out === true &&
      how.toLowerCase() !== 'retired hurt'

    const stats: MvpPlayerStats = {
      playerId: pid,
      teamId: teamKeyForSide(match, side),
      runs,
      balls,
      fours: bs?.fours ?? 0,
      sixes: bs?.sixes ?? 0,
      wickets: bw?.wickets ?? 0,
      maidenOvers: maidensByBowler.get(pid) ?? 0,
      oversBowled: bw ? bw.balls / cfg.ballsPerOver : 0,
      runsConceded: bw?.runs ?? 0,
      catches: fg?.catches ?? 0,
      stumpings: fg?.stumpings ?? 0,
      runOuts: fg?.runOuts ?? 0,
      ducks: duck,
      dismissalTypes: bm?.dismissalTypes ?? [],
      dismissedPlayerIds: bm?.dismissedPlayerIds ?? [],
      notOut: bs ? !bs.out : undefined,
      matchFinishingInnings: chaseFinisherId === pid,
    }

    const pts = computeMvpPointsForPlayer(stats, ctx)
    rows.push({
      playerId: pid,
      name: nameFor(match, pid),
      side,
      batting: pts.batting,
      bowling: pts.bowling,
      fielding: pts.fielding,
      impact: pts.impact,
      total: pts.total,
    })
  }

  rows.sort((a, b) => b.total - a.total)

  let potm: MatchMvpResult['potm'] = null
  let potmNote: string | null = null
  let potmSource: MatchMvpResult['potmSource'] = null
  if (finalState.matchComplete && rows.length > 0) {
    const overrideId = match.playerOfTheMatchPlayerId?.trim()
    const overrideSide = overrideId ? playerSide(match, overrideId) : null
    if (overrideId && overrideSide && xiIds.has(overrideId)) {
      potm = { playerId: overrideId, name: nameFor(match, overrideId), side: overrideSide }
      potmNote = null
      potmSource = 'manual'
    } else {
      const w = finalState.winner
      const top3 = rows.slice(0, 3)
      if (w && w !== 'tie') {
        const fromWinner = top3.filter((r) => r.side === w)
        if (fromWinner.length > 0) {
          potm = { playerId: fromWinner[0]!.playerId, name: fromWinner[0]!.name, side: fromWinner[0]!.side }
        } else {
          potm = { playerId: rows[0]!.playerId, name: rows[0]!.name, side: rows[0]!.side }
          potmNote = 'No winning-side player in the top three by MVP; award goes to the match leader.'
        }
      } else {
        potm = { playerId: rows[0]!.playerId, name: rows[0]!.name, side: rows[0]!.side }
        potmNote = w === 'tie' ? 'Match tied; award goes to the MVP leader.' : null
      }
      potmSource = 'auto'
    }
  }

  const fieldingByPlayerId: Record<string, MatchMvpFieldingRow> = {}
  for (const [pid, fg] of fielding) {
    fieldingByPlayerId[pid] = { catches: fg.catches, runOuts: fg.runOuts, stumpings: fg.stumpings }
  }

  return { rows, potm, potmNote, potmSource, fieldingByPlayerId }
}
