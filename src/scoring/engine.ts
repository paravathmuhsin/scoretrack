import type { BallEventPayload, MatchLineup, Side } from '../types/models'

export type ScoreEvent =
  | { seq: number; kind: 'ball'; ball: BallEventPayload }
  | { seq: number; kind: 'undo'; revertedSeq: number }
  | { seq: number; kind: 'change_bowler'; bowlerId: string }
  /** Swap striker and non-striker without a delivery (no ball counted). */
  | { seq: number; kind: 'swap_ends' }
  /** Extra runs from overthrows on the same delivery (no extra ball). */
  | { seq: number; kind: 'overthrow'; runs: number }
  | {
      seq: number
      kind: 'start_second_innings'
      battingSide: Side
      strikerId: string
      nonStrikerId: string
      bowlerId: string
    }
  /** Scorer ends the current innings before natural completion (e.g. declaration). */
  | { seq: number; kind: 'end_innings'; innings: 1 | 2; reason: 'declared' | 'all_out' }

export interface ReplayConfig {
  squadSize: number
  oversLimit: number
  ballsPerOver: number
  /** Max overs per bowler per innings; null = unlimited */
  oversPerBowler: number | null
  lineup: MatchLineup
  /** Used in `resultText` when a match completes (defaults to "home" / "away"). */
  homeName?: string
  awayName?: string
}

export interface InningsSnapshot {
  innings: 1 | 2
  battingSide: Side
  runs: number
  wickets: number
  legalBalls: number
  strikerId: string
  nonStrikerId: string
  bowlerId: string
  dismissed: Set<string>
  /** Batters who have taken the crease (striker or non-striker) at least once this innings. */
  appearedBatIds: Set<string>
  /** Retired hurt — off the field but may bat again this innings. */
  retiredOffField: Set<string>
  /** Legal deliveries bowled by each bowler this innings (for quota) */
  bowlerBallCounts: Record<string, number>
  /**
   * After each completed over (when overs-per-bowler applies), scorer confirms the next bowler.
   * This stores `legalBalls` after the last `change_bowler` at an over boundary; it must match
   * current `legalBalls` while still between overs, or the UI would stay stuck on “choose bowler”.
   */
  bowlerConfirmedAtLegalCount: number
}

export type ManualInningsEndReason = 'declared' | 'all_out'

/** Snapshot for scorecard dismissal line (caught / bowled, extras on same ball). */
export type BatterDismissalSnap = {
  bowlerId: string
  delivery: 'legal' | 'wide' | 'noball'
  fielderId?: string
  fielderName?: string
  /** Total runs on the wicket ball (wides / no-balls). */
  runsOnDelivery: number
}

export type BatterStatRow = {
  runs: number
  balls: number
  fours: number
  sixes: number
  out: boolean
  how?: string
  dismissal?: BatterDismissalSnap
}

export interface ReplayState {
  innings1: InningsSnapshot
  innings2: InningsSnapshot | null
  activeInnings: 1 | 2
  /** Innings 1 closed early by scorer (declaration / recorded all-out closure). */
  manualEndInnings1: ManualInningsEndReason | null
  manualEndInnings2: ManualInningsEndReason | null
  recentBalls: string[]
  matchComplete: boolean
  resultText: string | null
  winner: Side | 'tie' | null
  batterStats: Record<string, BatterStatRow>
  bowlerStats: Record<string, { balls: number; runs: number; wickets: number }>
}

export function opp(side: Side): Side {
  return side === 'home' ? 'away' : 'home'
}

function sideDisplayName(cfg: ReplayConfig, side: Side): string {
  return side === 'home' ? (cfg.homeName ?? 'home') : (cfg.awayName ?? 'away')
}

export function maxWickets(squadSize: number): number {
  return Math.max(0, squadSize - 1)
}

/** Max dismissals in an innings = batting XI player count − 1. Uses lineup when present, else `cfg.squadSize`. */
export function maxWicketsForBattingSide(cfg: ReplayConfig, battingSide: Side): number {
  const xi = battingSide === 'home' ? cfg.lineup.homeXI : cfg.lineup.awayXI
  const players = xi.length > 0 ? xi.length : cfg.squadSize
  return Math.max(0, players - 1)
}

export function totalRunsOnDelivery(b: BallEventPayload): number {
  if (b.delivery === 'wide') {
    return 1 + b.extraWideRuns + b.runsOffBat + b.byeRuns + b.legByeRuns
  }
  if (b.delivery === 'noball') {
    return 1 + b.extraNoBallRuns + b.runsOffBat + b.byeRuns + b.legByeRuns
  }
  return b.runsOffBat + b.byeRuns + b.legByeRuns
}

/** Runs from wides (incl. 1st wide); no-balls (incl. 1st nb); byes; leg-byes — matches scorecard “extras” splits. */
export type InningsExtrasBreakdown = { wd: number; nb: number; b: number; lb: number }

/**
 * Sum extras components from ball events still in effect after undos (same rules as {@link replayEvents}).
 */
export function inningsExtrasBreakdownFromBalls(
  events: ScoreEvent[],
  innings: 1 | 2,
  battingSide: Side,
): InningsExtrasBreakdown {
  const sorted = [...events].sort((a, b) => a.seq - b.seq)
  const undone = new Set<number>()
  for (const e of sorted) {
    if (e.kind === 'undo') undone.add(e.revertedSeq)
  }
  const out: InningsExtrasBreakdown = { wd: 0, nb: 0, b: 0, lb: 0 }
  for (const e of sorted) {
    if (e.kind !== 'ball' || !e.ball) continue
    if (undone.has(e.seq)) continue
    const b = e.ball
    if (b.noDelivery) continue
    if (b.innings !== innings || b.battingSide !== battingSide) continue
    out.b += b.byeRuns
    out.lb += b.legByeRuns
    if (b.delivery === 'wide') {
      out.wd += 1 + b.extraWideRuns
    } else if (b.delivery === 'noball') {
      out.nb += 1 + b.extraNoBallRuns
    }
  }
  return out
}

/**
 * Display like `4 (2wd, 2nb)` or `6 (1wd, 2nb, 3ot)` — `ot` is runs not attributed to balls (e.g. overthrows).
 */
export function formatExtrasBreakdownLine(
  total: number,
  x: InningsExtrasBreakdown,
  otherRuns: number,
): string {
  const parts: string[] = []
  if (x.wd > 0) parts.push(`${x.wd}wd`)
  if (x.nb > 0) parts.push(`${x.nb}nb`)
  if (x.b > 0) parts.push(`${x.b}b`)
  if (x.lb > 0) parts.push(`${x.lb}lb`)
  if (otherRuns > 0) parts.push(`${otherRuns}ot`)
  if (parts.length === 0) return String(total)
  return `${total} (${parts.join(', ')})`
}

export function countsAsLegalBall(b: BallEventPayload): boolean {
  if (b.noDelivery) return false
  return b.delivery === 'legal'
}

/** True when this ball records a wicket that increments the innings wicket tally (excludes retired hurt). */
export function wicketIsRealDismissal(b: BallEventPayload): boolean {
  return Boolean(b.wicket && b.wicket.countsAsWicket !== false)
}

export function symbolForBall(b: BallEventPayload): string {
  if (b.wicket && b.wicket.countsAsWicket === false) return 'Rh'
  if (b.wicket && b.delivery === 'wide') {
    const extra = b.extraWideRuns + b.runsOffBat + b.byeRuns + b.legByeRuns
    return extra > 0 ? `Wd${extra}W` : 'WdW'
  }
  if (b.wicket && b.delivery === 'noball') {
    const extra = b.extraNoBallRuns + b.runsOffBat + b.byeRuns + b.legByeRuns
    return extra > 0 ? `Nb${extra}W` : 'NbW'
  }
  if (b.wicket) return 'W'
  if (b.delivery === 'wide') {
    const extra = b.extraWideRuns + b.runsOffBat + b.byeRuns + b.legByeRuns
    return extra > 0 ? `Wd${extra}` : 'Wd'
  }
  if (b.delivery === 'noball') {
    const extra = b.extraNoBallRuns + b.runsOffBat + b.byeRuns + b.legByeRuns
    return extra > 0 ? `Nb${extra}` : 'Nb'
  }
  if (b.legByeRuns > 0) return `LB${b.legByeRuns}`
  if (b.byeRuns > 0) return `B${b.byeRuns}`
  const r = b.runsOffBat + b.byeRuns + b.legByeRuns
  return String(r)
}

function emptyInnings(
  inn: 1 | 2,
  battingSide: Side,
  striker: string,
  non: string,
  bowler: string,
): InningsSnapshot {
  return {
    innings: inn,
    battingSide,
    runs: 0,
    wickets: 0,
    legalBalls: 0,
    strikerId: striker,
    nonStrikerId: non,
    bowlerId: bowler,
    dismissed: new Set(),
    appearedBatIds: new Set([striker, non]),
    retiredOffField: new Set(),
    bowlerBallCounts: {},
    bowlerConfirmedAtLegalCount: 0,
  }
}

export function initialReplayState(cfg: ReplayConfig): ReplayState {
  const { lineup } = cfg
  const inn1 = emptyInnings(
    1,
    lineup.innings1BattingSide,
    lineup.strikerId,
    lineup.nonStrikerId,
    lineup.bowlerId,
  )
  return {
    innings1: inn1,
    innings2: null,
    activeInnings: 1,
    manualEndInnings1: null,
    manualEndInnings2: null,
    recentBalls: [],
    matchComplete: false,
    resultText: null,
    winner: null,
    batterStats: {},
    bowlerStats: {},
  }
}

function legalBallsCap(cfg: ReplayConfig): number {
  return cfg.oversLimit * cfg.ballsPerOver
}

export function currentInnings(state: ReplayState): InningsSnapshot {
  return state.activeInnings === 1 ? state.innings1 : state.innings2!
}

/** Batting XI members who have not yet played this innings (never at the crease). Excludes dismissed and the non-out partner. */
export function battersYetToPlayIds(
  battingXiIds: string[],
  inn: InningsSnapshot,
  pendingDismissedId: string,
): string[] {
  const out = new Set(inn.dismissed)
  out.add(pendingDismissedId)
  const partner = pendingDismissedId === inn.strikerId ? inn.nonStrikerId : inn.strikerId
  return battingXiIds.filter(
    (id) => !out.has(id) && id !== partner && !inn.appearedBatIds.has(id),
  )
}

export function maxBallsPerBowlerPerInnings(cfg: ReplayConfig): number | null {
  if (cfg.oversPerBowler == null) return null
  return cfg.oversPerBowler * cfg.ballsPerOver
}

export function bowlerLegalBallsThisInnings(inn: InningsSnapshot, bowlerId: string): number {
  return inn.bowlerBallCounts[bowlerId] ?? 0
}

/** True if this bowler may bowl at least one more legal ball this innings */
export function canBowlerDeliverMore(cfg: ReplayConfig, inn: InningsSnapshot, bowlerId: string): boolean {
  const cap = maxBallsPerBowlerPerInnings(cfg)
  if (cap === null) return true
  return bowlerLegalBallsThisInnings(inn, bowlerId) < cap
}

/**
 * After a full over, scorer must confirm the next bowler before the next delivery.
 * Skipped when oversPerBowler is null (legacy / unlimited quota).
 */
export function needsNewBowlerBeforeNextBall(cfg: ReplayConfig, state: ReplayState): boolean {
  if (cfg.oversPerBowler == null) return false
  if (state.matchComplete) return false
  const inn = currentInnings(state)
  if (isInningsOver(cfg, inn, state)) return false
  if (inn.legalBalls === 0 || inn.legalBalls % cfg.ballsPerOver !== 0) return false
  return inn.bowlerConfirmedAtLegalCount !== inn.legalBalls
}

export function applyBowlerChange(state: ReplayState, bowlerId: string): void {
  const inn = currentInnings(state)
  inn.bowlerId = bowlerId
  inn.bowlerConfirmedAtLegalCount = inn.legalBalls
}

export function applySwapEnds(state: ReplayState): void {
  if (state.matchComplete) return
  const inn = currentInnings(state)
  const t = inn.strikerId
  inn.strikerId = inn.nonStrikerId
  inn.nonStrikerId = t
}

export function applyOverthrow(state: ReplayState, runs: number): void {
  if (state.matchComplete || runs <= 0) return
  const inn = currentInnings(state)
  inn.runs += runs
  state.recentBalls.push(`+${runs}`)
  if (state.recentBalls.length > 12) state.recentBalls.shift()
}

function ensureBatter(
  stats: ReplayState['batterStats'],
  id: string,
) {
  if (!stats[id]) stats[id] = { runs: 0, balls: 0, fours: 0, sixes: 0, out: false }
}

function ensureBowler(stats: ReplayState['bowlerStats'], id: string) {
  if (!stats[id]) stats[id] = { balls: 0, runs: 0, wickets: 0 }
}

function runsFirstInnings(state: ReplayState): number {
  return state.innings1.runs
}

function isChaseWon(state: ReplayState): boolean {
  if (state.activeInnings !== 2 || !state.innings2) return false
  const target = runsFirstInnings(state) + 1
  return state.innings2.runs >= target
}

function isInningsComplete(state: ReplayState, inn: InningsSnapshot, cfg: ReplayConfig): boolean {
  return isInningsOver(cfg, inn, state)
}

function isInningsOverNatural(cfg: ReplayConfig, inn: InningsSnapshot, state: ReplayState): boolean {
  const cap = legalBallsCap(cfg)
  const mw = maxWicketsForBattingSide(cfg, inn.battingSide)
  if (inn.wickets >= mw) return true
  if (inn.legalBalls >= cap) return true
  if (inn.innings === 2 && isChaseWon(state)) return true
  return false
}

/** True when this innings should stop (all out, overs finished, target chased, or manual end). */
export function isInningsOver(cfg: ReplayConfig, inn: InningsSnapshot, state: ReplayState): boolean {
  if (inn.innings === 1 && state.manualEndInnings1 != null) return true
  if (inn.innings === 2 && state.manualEndInnings2 != null) return true
  return isInningsOverNatural(cfg, inn, state)
}

export function applyEndInnings(
  state: ReplayState,
  cfg: ReplayConfig,
  innings: 1 | 2,
  reason: ManualInningsEndReason,
): void {
  if (state.matchComplete) return
  if (state.activeInnings !== innings) return
  const inn = innings === 1 ? state.innings1 : state.innings2
  if (!inn) return
  if (isInningsOverNatural(cfg, inn, state)) return
  if (innings === 1) {
    if (state.manualEndInnings1 != null) return
    state.manualEndInnings1 = reason
  } else {
    if (state.manualEndInnings2 != null) return
    state.manualEndInnings2 = reason
    finishMatch(state, cfg)
  }
}

export type PlayingConstraintPatch = {
  squadSize: number
  oversLimit: number
  oversPerBowler: number | null
}

/** Returns an error message if the new limits are incompatible with the current score state. */
export function validatePlayingConstraintPatch(
  cfg: ReplayConfig,
  state: ReplayState,
  next: PlayingConstraintPatch,
): string | null {
  const bpo = cfg.ballsPerOver
  const cap = next.oversLimit * bpo
  const mw = maxWickets(next.squadSize)
  if (state.innings1.wickets > mw) {
    return 'Current wickets exceed the new players-per-team limit.'
  }
  if (state.innings1.legalBalls > cap) {
    return 'First innings has already bowled more than the new overs limit allows.'
  }
  if (state.innings2) {
    if (state.innings2.wickets > mw) {
      return 'Second innings wickets exceed the new players-per-team limit.'
    }
    if (state.innings2.legalBalls > cap) {
      return 'Second innings has already bowled more than the new overs limit allows.'
    }
  }
  if (next.oversPerBowler != null) {
    const maxB = next.oversPerBowler * bpo
    for (const c of Object.values(state.innings1.bowlerBallCounts)) {
      if (c > maxB) return 'A bowler has already bowled more than the new max overs per bowler (first innings).'
    }
    if (state.innings2) {
      for (const c of Object.values(state.innings2.bowlerBallCounts)) {
        if (c > maxB) return 'A bowler has already bowled more than the new max overs per bowler (second innings).'
      }
    }
  }
  return null
}

/** Squad / overs / bowler limits may be edited until the first innings is over (including manual end). */
export function canEditMatchPlayingConstraints(cfg: ReplayConfig, state: ReplayState): boolean {
  if (state.matchComplete) return false
  return !isInningsOver(cfg, state.innings1, state)
}

function unitWord(n: number, singular: string, plural: string): string {
  return n === 1 ? singular : plural
}

function finishMatch(state: ReplayState, cfg: ReplayConfig): void {
  state.matchComplete = true
  const i1 = state.innings1
  const i2 = state.innings2
  if (!i2) {
    state.resultText = 'Match ended after first innings'
    state.winner = null
    return
  }
  const s1 = i1.runs
  const s2 = i2.runs
  const bat1 = i1.battingSide
  const bat2 = i2.battingSide
  const mw = maxWicketsForBattingSide(cfg, bat2)
  const ballsCap = legalBallsCap(cfg)

  if (s1 === s2) {
    state.resultText = 'Match tied'
    state.winner = 'tie'
    return
  }

  if (s1 > s2) {
    state.winner = bat1
    const margin = s1 - s2
    state.resultText = `${sideDisplayName(cfg, bat1)} won by ${margin} ${unitWord(margin, 'run', 'runs')}`
    return
  }

  state.winner = bat2
  const wktsInHand = mw - i2.wickets
  const ballsRem = Math.max(0, ballsCap - i2.legalBalls)
  let text = `${sideDisplayName(cfg, bat2)} won by ${wktsInHand} ${unitWord(wktsInHand, 'wicket', 'wickets')}`
  if (ballsRem > 0) {
    text += ` (with ${ballsRem} ${unitWord(ballsRem, 'ball', 'balls')} remaining)`
  }
  state.resultText = text
}

function beginSecondInnings(
  state: ReplayState,
  battingSide: Side,
  strikerId: string,
  nonStrikerId: string,
  bowlerId: string,
): void {
  state.innings2 = emptyInnings(2, battingSide, strikerId, nonStrikerId, bowlerId)
  state.activeInnings = 2
}

/**
 * Apply one ball to state (mutates). Assumes active innings not complete before this ball.
 */
export function applyBall(cfg: ReplayConfig, state: ReplayState, b: BallEventPayload): void {
  if (state.matchComplete) return

  const inn = currentInnings(state)
  if (isInningsOver(cfg, inn, state)) {
    return
  }
  if (b.innings !== state.activeInnings || b.battingSide !== inn.battingSide) {
    throw new Error('Ball does not match active innings')
  }

  const striker = inn.strikerId
  const non = inn.nonStrikerId
  const bowler = inn.bowlerId

  ensureBatter(state.batterStats, striker)
  ensureBatter(state.batterStats, non)
  ensureBowler(state.bowlerStats, bowler)

  const runsTotal = totalRunsOnDelivery(b)

  if (!b.noDelivery) {
    inn.runs += runsTotal

    // Bowler conceded (byes / leg-byes not debited to bowler)
    let toBowler = runsTotal - b.byeRuns - b.legByeRuns
    if (toBowler < 0) toBowler = 0
    state.bowlerStats[bowler].runs += toBowler

    if (countsAsLegalBall(b)) {
      inn.legalBalls += 1
      state.bowlerStats[bowler].balls += 1
      inn.bowlerBallCounts[bowler] = (inn.bowlerBallCounts[bowler] ?? 0) + 1
      const bs = state.batterStats[striker]
      bs.balls += 1
      bs.runs += b.runsOffBat
      if (b.runsOffBat === 4) bs.fours += 1
      if (b.runsOffBat === 6) bs.sixes += 1
    } else {
      // wide / no-ball: runs off bat credited to striker if any
      if (b.runsOffBat > 0) {
        state.batterStats[striker].runs += b.runsOffBat
      }
    }
  }

  if (b.wicket) {
    const outId = b.wicket.dismissedId
    const newB = b.wicket.newBatsmanId
    const cw = b.wicket.countsAsWicket !== false

    if (cw) {
      inn.wickets += 1
      state.bowlerStats[bowler].wickets += 1
      ensureBatter(state.batterStats, outId)
      state.batterStats[outId].out = true
      state.batterStats[outId].how = b.wicket.howOut
      state.batterStats[outId].dismissal = {
        bowlerId: bowler,
        delivery: b.delivery,
        fielderId: b.wicket.fielderId,
        fielderName: b.wicket.fielderName,
        runsOnDelivery: runsTotal,
      }
      inn.dismissed.add(outId)
    } else {
      ensureBatter(state.batterStats, outId)
      state.batterStats[outId].out = false
      state.batterStats[outId].how = b.wicket.howOut
      delete state.batterStats[outId].dismissal
      inn.retiredOffField.add(outId)
    }

    if (outId === striker) {
      inn.strikerId = newB ?? striker
      inn.nonStrikerId = non
    } else if (outId === non) {
      inn.nonStrikerId = newB ?? non
      inn.strikerId = striker
    }
    if (newB) {
      inn.appearedBatIds.add(newB)
      inn.retiredOffField.delete(newB)
      const nb = state.batterStats[newB]
      if (nb?.how === 'Retired hurt') delete nb.how
    }
  } else {
    // strike rotation on total runs (including extras)
    if (runsTotal % 2 === 1) {
      const t = inn.strikerId
      inn.strikerId = inn.nonStrikerId
      inn.nonStrikerId = t
    }
    if (countsAsLegalBall(b) && inn.legalBalls % cfg.ballsPerOver === 0) {
      const t2 = inn.strikerId
      inn.strikerId = inn.nonStrikerId
      inn.nonStrikerId = t2
    }
  }

  const ballSym = symbolForBall(b)
  if (ballSym !== 'Rh') {
    state.recentBalls.push(ballSym)
    if (state.recentBalls.length > 12) state.recentBalls.shift()
  }

  if (isInningsComplete(state, inn, cfg)) {
    if (inn.innings === 1) {
      // wait for explicit start_second_innings event — mark innings structurally done by not auto-starting
      state.matchComplete = false
    } else {
      finishMatch(state, cfg)
    }
  } else if (inn.innings === 2 && isChaseWon(state)) {
    finishMatch(state, cfg)
  }
}

export function applySecondInningsStart(
  state: ReplayState,
  battingSide: Side,
  strikerId: string,
  nonStrikerId: string,
  bowlerId: string,
): void {
  if (state.innings2 !== null) return
  beginSecondInnings(state, battingSide, strikerId, nonStrikerId, bowlerId)
}

/** Per-innings bowling figures (legal balls, runs conceded incl. wides to bowler, wickets). */
export type PerInningsBowler = { legalBalls: number; runs: number; wickets: number }

/**
 * Split bowling stats by innings (global `bowlerStats` merges both innings for the same bowler).
 */
export function bowlingStatsPerInnings(
  cfg: ReplayConfig,
  events: ScoreEvent[],
): { innings1: Record<string, PerInningsBowler>; innings2: Record<string, PerInningsBowler> } {
  const sorted = [...events].sort((a, b) => a.seq - b.seq)
  const undone = new Set<number>()
  for (const e of sorted) {
    if (e.kind === 'undo') undone.add(e.revertedSeq)
  }

  const state = initialReplayState(cfg)
  const innings1: Record<string, PerInningsBowler> = {}
  const innings2: Record<string, PerInningsBowler> = {}
  const ensure = (inn: 1 | 2, id: string): PerInningsBowler => {
    const m = inn === 1 ? innings1 : innings2
    if (!m[id]) m[id] = { legalBalls: 0, runs: 0, wickets: 0 }
    return m[id]
  }

  for (const e of sorted) {
    if (e.kind === 'undo') continue
    if (e.kind === 'start_second_innings') {
      if (undone.has(e.seq)) continue
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
      if (!undone.has(e.seq)) applyOverthrow(state, e.runs)
      continue
    }
    if (e.kind === 'end_innings') {
      if (undone.has(e.seq)) continue
      applyEndInnings(state, cfg, e.innings, e.reason)
      continue
    }
    if (e.kind === 'ball') {
      if (undone.has(e.seq)) continue
      const innSnap = currentInnings(state)
      const bowlerId = innSnap.bowlerId
      const innNum = innSnap.innings as 1 | 2
      const b = e.ball
      let toBowler = totalRunsOnDelivery(b) - b.byeRuns - b.legByeRuns
      if (toBowler < 0) toBowler = 0
      const row = ensure(innNum, bowlerId)
      row.runs += toBowler
      if (countsAsLegalBall(b)) row.legalBalls += 1
      if (wicketIsRealDismissal(b)) row.wickets += 1
      applyBall(cfg, state, b)
    }
  }

  return { innings1, innings2 }
}

/**
 * Maidens per bowler per innings (completed overs with zero runs off the bowler’s spell),
 * using the same replay + undo rules as {@link bowlingStatsPerInnings}.
 */
export function maidenCountsPerInnings(
  cfg: ReplayConfig,
  events: ScoreEvent[],
): { innings1: Record<string, number>; innings2: Record<string, number> } {
  const sorted = [...events].sort((a, b) => a.seq - b.seq)
  const undone = new Set<number>()
  for (const e of sorted) {
    if (e.kind === 'undo') undone.add(e.revertedSeq)
  }

  const state = initialReplayState(cfg)
  const innings1: Record<string, number> = {}
  const innings2: Record<string, number> = {}
  let runsSinceOverStart = 0

  const bump = (inn: 1 | 2, bowlerId: string) => {
    const m = inn === 1 ? innings1 : innings2
    m[bowlerId] = (m[bowlerId] ?? 0) + 1
  }

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
      if (!undone.has(e.seq)) applyOverthrow(state, e.runs)
      continue
    }
    if (e.kind === 'end_innings') {
      if (undone.has(e.seq)) continue
      runsSinceOverStart = 0
      applyEndInnings(state, cfg, e.innings, e.reason)
      continue
    }
    if (e.kind !== 'ball' || undone.has(e.seq)) continue

    const innBefore = currentInnings(state)
    const bowlerId = innBefore.bowlerId
    const innNum = innBefore.innings as 1 | 2
    const b = e.ball

    runsSinceOverStart += totalRunsOnDelivery(b)
    applyBall(cfg, state, b)

    const innAfter = currentInnings(state)
    if (countsAsLegalBall(b) && innAfter.legalBalls > 0 && innAfter.legalBalls % cfg.ballsPerOver === 0) {
      if (runsSinceOverStart === 0) {
        bump(innNum, bowlerId)
      }
      runsSinceOverStart = 0
    }
  }

  return { innings1, innings2 }
}

/**
 * Ball symbols for the **current over** of the active innings only (includes wides/no-balls).
 * Clears after each completed set of `ballsPerOver` legal deliveries, so at an over break
 * (including before the next bowler) this is empty until the next ball is scored.
 */
export function symbolsThisOver(cfg: ReplayConfig, events: ScoreEvent[]): string[] {
  const sorted = [...events].sort((a, b) => a.seq - b.seq)
  const undone = new Set<number>()
  for (const e of sorted) {
    if (e.kind === 'undo') undone.add(e.revertedSeq)
  }

  const state = initialReplayState(cfg)
  const out: string[] = []

  for (const e of sorted) {
    if (e.kind === 'undo') continue
    if (e.kind === 'start_second_innings') {
      if (undone.has(e.seq)) continue
      applySecondInningsStart(state, e.battingSide, e.strikerId, e.nonStrikerId, e.bowlerId)
      out.length = 0
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
      out.push(`+${e.runs}`)
      applyOverthrow(state, e.runs)
      continue
    }
    if (e.kind === 'end_innings') {
      if (undone.has(e.seq)) continue
      applyEndInnings(state, cfg, e.innings, e.reason)
      out.length = 0
      continue
    }
    if (e.kind !== 'ball' || undone.has(e.seq)) continue

    const b = e.ball
    const sym = symbolForBall(b)
    if (sym !== 'Rh') out.push(sym)
    applyBall(cfg, state, b)

    const inn = currentInnings(state)
    if (countsAsLegalBall(b) && inn.legalBalls % cfg.ballsPerOver === 0) {
      out.length = 0
    }
  }

  return out
}

/** One completed legal over within an innings (for ball-by-ball timeline UI). */
export type InningsCompletedOverGroup = {
  /** 1-based over number within the innings (after 6 legal balls). */
  overNumber: number
  symbols: string[]
  runsInOver: number
}

export type InningsBallTimelineByOver = {
  /** Completed overs in chronological order (1st over first, latest last). */
  completed: InningsCompletedOverGroup[]
  /** Deliveries since the last completed legal over (current partial over). */
  partial: { symbols: string[]; runsInOver: number } | null
}

/**
 * Replays events and groups ball symbols by completed legal overs for one innings.
 * Overthrows (`+n`) attach to the same over as the preceding ball. Latest over is last in `completed`.
 */
export function inningsOversBallTimeline(
  cfg: ReplayConfig,
  events: ScoreEvent[],
  targetInnings: 1 | 2,
  targetBattingSide: Side,
): InningsBallTimelineByOver {
  const sorted = [...events].sort((a, b) => a.seq - b.seq)
  const undone = new Set<number>()
  for (const e of sorted) {
    if (e.kind === 'undo') undone.add(e.revertedSeq)
  }

  const state = initialReplayState(cfg)
  const completed: InningsCompletedOverGroup[] = []
  let curSyms: string[] = []
  let curRuns = 0

  const isTarget = (inn: InningsSnapshot) =>
    inn.innings === targetInnings && inn.battingSide === targetBattingSide

  const flushCompletedIfNeeded = (innAfter: InningsSnapshot, b: BallEventPayload) => {
    if (!isTarget(innAfter)) return
    if (!countsAsLegalBall(b)) return
    if (innAfter.legalBalls <= 0 || innAfter.legalBalls % cfg.ballsPerOver !== 0) return
    const overNumber = innAfter.legalBalls / cfg.ballsPerOver
    completed.push({
      overNumber,
      symbols: [...curSyms],
      runsInOver: curRuns,
    })
    curSyms = []
    curRuns = 0
  }

  for (const e of sorted) {
    if (e.kind === 'undo') continue
    if (e.kind === 'start_second_innings') {
      if (undone.has(e.seq)) continue
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
      {
        const inn = currentInnings(state)
        if (isTarget(inn)) {
          curSyms.push(`+${e.runs}`)
          curRuns += e.runs
        }
      }
      applyOverthrow(state, e.runs)
      continue
    }
    if (e.kind === 'end_innings') {
      if (undone.has(e.seq)) continue
      applyEndInnings(state, cfg, e.innings, e.reason)
      continue
    }
    if (e.kind !== 'ball' || undone.has(e.seq)) continue

    const b = e.ball
    const inn = currentInnings(state)
    if (isTarget(inn)) {
      const sym = symbolForBall(b)
      if (sym !== 'Rh') curSyms.push(sym)
      if (!b.noDelivery) curRuns += totalRunsOnDelivery(b)
    }
    applyBall(cfg, state, b)
    const innAfter = currentInnings(state)
    flushCompletedIfNeeded(innAfter, b)
  }

  const partial =
    curSyms.length > 0 || curRuns > 0 ? { symbols: [...curSyms], runsInOver: curRuns } : null

  return { completed, partial }
}

/**
 * Latest event `seq` that can be reverted with an `undo` row (balls, extras, bowler change,
 * swap ends, innings end, second-innings start — not `undo` rows themselves).
 */
export function lastEventSeqForUndo(events: ScoreEvent[]): number {
  const sorted = [...events].sort((a, b) => a.seq - b.seq)
  const undone = new Set<number>()
  for (const e of sorted) {
    if (e.kind === 'undo') undone.add(e.revertedSeq)
  }
  let max = 0
  for (const e of sorted) {
    if (e.kind === 'undo') continue
    if (undone.has(e.seq)) continue
    if (e.seq > max) max = e.seq
  }
  return max
}

export function replayEvents(cfg: ReplayConfig, events: ScoreEvent[]): ReplayState {
  const sorted = [...events].sort((a, b) => a.seq - b.seq)
  const undone = new Set<number>()
  for (const e of sorted) {
    if (e.kind === 'undo') undone.add(e.revertedSeq)
  }

  const state = initialReplayState(cfg)

  for (const e of sorted) {
    if (e.kind === 'undo') continue
    if (e.kind === 'start_second_innings') {
      if (undone.has(e.seq)) continue
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
      applyEndInnings(state, cfg, e.innings, e.reason)
      continue
    }
    if (e.kind === 'ball') {
      if (undone.has(e.seq)) continue
      applyBall(cfg, state, e.ball)
    }
  }

  return state
}

export function oversString(legalBalls: number, ballsPerOver: number): string {
  const o = Math.floor(legalBalls / ballsPerOver)
  const b = legalBalls % ballsPerOver
  return `${o}.${b}`
}

/**
 * Remaining bowler quota for UI, e.g. `2 overs left`, `1 over left`, `1.3 overs left` (cricket o.b notation).
 */
export function oversQuotaRemainingLabel(legalBalls: number, ballsPerOver: number): string {
  const s = oversString(legalBalls, ballsPerOver)
  const dot = s.indexOf('.')
  const whole = Number.parseInt(s.slice(0, dot), 10)
  const ballsRem = Number.parseInt(s.slice(dot + 1), 10)
  if (ballsRem === 0) {
    if (whole === 1) return '1 over left'
    return `${whole} overs left`
  }
  return `${s} overs left`
}

export function nextLegalBallIsNewOver(legalBallsAfter: number, ballsPerOver: number): boolean {
  return legalBallsAfter > 0 && legalBallsAfter % ballsPerOver === 0
}
