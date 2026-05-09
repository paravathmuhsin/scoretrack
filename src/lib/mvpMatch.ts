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

export type PlayerMvpRow = {
  playerId: string
  name: string
  side: Side
  batting: number
  bowling: number
  fielding: number
  total: number
}

export type MatchMvpResult = {
  rows: PlayerMvpRow[]
  potm: { playerId: string; name: string; side: Side } | null
  potmNote: string | null
}

function baseRunsPerWicket(oversLimit: number): number {
  if (oversLimit <= 7) return 12
  if (oversLimit <= 12) return 14
  if (oversLimit <= 16) return 16
  if (oversLimit <= 20) return 18
  if (oversLimit <= 26) return 20
  if (oversLimit <= 40) return 22
  if (oversLimit <= 50) return 25
  if (oversLimit <= 99) return 27
  return 25
}

/** Batting SR bonus % and bowling economy SR % (same brackets as CricHeroes article). */
function srBonusPct(oversLimit: number): number {
  if (oversLimit <= 20) return 0.08
  if (oversLimit <= 35) return 0.06
  if (oversLimit <= 50) return 0.04
  return 0.02
}

function maidensPerWicketEquivalent(oversLimit: number): number {
  if (oversLimit <= 7) return 1
  if (oversLimit <= 26) return 2
  if (oversLimit <= 50) return 3
  return 6
}

function battingOrderSlot(match: MatchDoc, battingSide: Side, playerId: string): number {
  const key = battingSide === 'home' ? 'homeXI' : 'awayXI'
  const ids = match.lineup?.[key] ?? []
  const idx = ids.indexOf(playerId)
  if (idx >= 0) return idx + 1
  return 6
}

function positionRunsMultiplier(order: number): number {
  if (order <= 4) return 1
  if (order <= 8) return 0.8
  return 0.6
}

function snapBatters(s: ReplayState): Record<string, { r: number; b: number }> {
  const o: Record<string, { r: number; b: number }> = {}
  for (const [k, v] of Object.entries(s.batterStats)) {
    o[k] = { r: v.runs, b: v.balls }
  }
  return o
}

function snapBowlers(s: ReplayState): Record<string, { r: number; b: number; w: number }> {
  const o: Record<string, { r: number; b: number; w: number }> = {}
  for (const [k, v] of Object.entries(s.bowlerStats)) {
    o[k] = { r: v.runs, b: v.balls, w: v.wickets }
  }
  return o
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

function isRunOut(how: string): boolean {
  return how === 'Run out'
}

function isAssistedDismissal(how: string): boolean {
  return how === 'Catch out' || how === 'Stumping'
}

function milestoneBonusForWicketCount(w: number): number {
  let b = 0
  if (w >= 3) b += 0.5
  if (w >= 5) b += 0.5
  if (w >= 10) b += 0.5
  return b
}

function battingPointsForInnings(
  runs: number,
  balls: number,
  teamRuns: number,
  teamLegalBalls: number,
  oversLimit: number,
): number {
  if (runs <= 0 && balls <= 0) return 0
  const base = runs / 10
  const teamSR = teamLegalBalls > 0 ? (teamRuns / teamLegalBalls) * 100 : 0
  const playerSR = balls > 0 ? (runs / balls) * 100 : 0
  const pct = srBonusPct(oversLimit)
  let srBonus = 0
  if (teamSR > 0 && playerSR > 0 && runs > 0) {
    const faster = playerSR >= teamSR ? 1 : 0
    srBonus = (playerSR / teamSR) * faster * pct * base
  }
  return base + srBonus
}

function bowlingEconomySrBonus(
  runsConceded: number,
  legalBalls: number,
  teamRuns: number,
  teamLegalBalls: number,
  oversLimit: number,
): number {
  if (legalBalls <= 0) return 0
  const teamSR = teamLegalBalls > 0 ? (teamRuns / teamLegalBalls) * 100 : 0
  const bowlerSR = (runsConceded / legalBalls) * 100
  if (teamSR <= 0 || bowlerSR <= 0) return 0
  const econ = teamSR >= bowlerSR ? 1 : 0
  return (teamSR / bowlerSR) * (teamSR - bowlerSR) * srBonusPct(oversLimit) * econ
}

/**
 * MVP-style points inspired by CricHeroes (v1): 10 runs = 1 pt, SR adjustment (no penalties),
 * wicket value by match length + batting order, assisted fielding +20%, run-out to fielder,
 * wicket milestones, economy SR bonus (no penalties), maiden equivalents. Par-score bonuses omitted.
 */
export function computeMatchMvp(
  match: MatchDoc,
  cfg: ReplayConfig,
  events: ScoreEvent[],
  finalState: ReplayState,
): MatchMvpResult {
  const oversLimit = cfg.oversLimit
  const brw = baseRunsPerWicket(oversLimit)
  const topOrderWicketPts = (brw * positionRunsMultiplier(1)) / 10
  const maidensPerWk = maidensPerWicketEquivalent(oversLimit)

  const sorted = [...events].sort((a, b) => a.seq - b.seq)
  const undone = new Set<number>()
  for (const e of sorted) {
    if (e.kind === 'undo') undone.add(e.revertedSeq)
  }

  const batByInn: [Record<string, { runs: number; balls: number }>, Record<string, { runs: number; balls: number }>] = [
    {},
    {},
  ]
  /** Runs conceded (to bowler) and legal balls per bowler per innings — for economy SR bonus. */
  const bowlEcon: [Record<string, { runs: number; legalBalls: number }>, Record<string, { runs: number; legalBalls: number }>] = [
    {},
    {},
  ]
  const bowlPts: [Record<string, number>, Record<string, number>] = [{}, {}]
  const fieldPts: [Record<string, number>, Record<string, number>] = [{}, {}]
  const bowMvpWickets: [Record<string, number>, Record<string, number>] = [{}, {}]
  const maidensByInn: [Record<string, number>, Record<string, number>] = [{}, {}]

  const state = initialReplayState(cfg)
  let runsSinceOverStart = 0

  const addBowl = (inn: 1 | 2, id: string, pts: number) => {
    const m = bowlPts[inn - 1]
    m[id] = (m[id] ?? 0) + pts
  }
  const addField = (inn: 1 | 2, id: string, pts: number) => {
    const m = fieldPts[inn - 1]
    m[id] = (m[id] ?? 0) + pts
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
    const battingSide = b.battingSide

    const prevBat = snapBatters(state)
    const prevBowl = snapBowlers(state)

    if (wicketIsRealDismissal(b) && b.wicket) {
      const w = b.wicket
      const how = w.howOut
      const order = battingOrderSlot(match, battingSide, w.dismissedId)
      const wicketRunsValue = brw * positionRunsMultiplier(order)
      const wicketPts = wicketRunsValue / 10

      if (isRunOut(how)) {
        if (w.fielderId) addField(innNum, w.fielderId, wicketPts)
      } else if (isAssistedDismissal(how)) {
        addBowl(innNum, bowlerId, wicketPts)
        const prevW = bowMvpWickets[innNum - 1][bowlerId] ?? 0
        bowMvpWickets[innNum - 1][bowlerId] = prevW + 1
        const nw = prevW + 1
        addBowl(innNum, bowlerId, milestoneBonusForWicketCount(nw) - milestoneBonusForWicketCount(prevW))
        if (w.fielderId) addField(innNum, w.fielderId, wicketPts * 0.2)
      } else {
        addBowl(innNum, bowlerId, wicketPts)
        const prevW = bowMvpWickets[innNum - 1][bowlerId] ?? 0
        bowMvpWickets[innNum - 1][bowlerId] = prevW + 1
        const nw = prevW + 1
        addBowl(innNum, bowlerId, milestoneBonusForWicketCount(nw) - milestoneBonusForWicketCount(prevW))
      }
    }

    runsSinceOverStart += totalRunsOnDelivery(b)
    applyBall(cfg, state, b)

    const innAfter = currentInnings(state)
    if (countsAsLegalBall(b) && innAfter.legalBalls > 0 && innAfter.legalBalls % cfg.ballsPerOver === 0) {
      if (runsSinceOverStart === 0) {
        const m = maidensByInn[innNum - 1]
        m[bowlerId] = (m[bowlerId] ?? 0) + 1
      }
      runsSinceOverStart = 0
    }

    for (const [pid, v] of Object.entries(state.batterStats)) {
      const pr = prevBat[pid]
      const dr = v.runs - (pr?.r ?? 0)
      const db = v.balls - (pr?.b ?? 0)
      if (dr !== 0 || db !== 0) {
        const slot = batByInn[innNum - 1][pid] ?? { runs: 0, balls: 0 }
        slot.runs += dr
        slot.balls += db
        batByInn[innNum - 1][pid] = slot
      }
    }

    const dBr = state.bowlerStats[bowlerId]?.runs ?? 0
    const dBb = state.bowlerStats[bowlerId]?.balls ?? 0
    const pbr = prevBowl[bowlerId]
    const dRuns = dBr - (pbr?.r ?? 0)
    const dBalls = dBb - (pbr?.b ?? 0)
    if (dRuns !== 0 || dBalls !== 0) {
      const row = bowlEcon[innNum - 1][bowlerId] ?? { runs: 0, legalBalls: 0 }
      row.runs += dRuns
      row.legalBalls += dBalls
      bowlEcon[innNum - 1][bowlerId] = row
    }
  }

  const inn1Runs = finalState.innings1.runs
  const inn1Balls = finalState.innings1.legalBalls
  const inn2 = finalState.innings2

  for (const pid of Object.keys(bowlEcon[0])) {
    const stats = bowlEcon[0][pid]
    if (!stats || stats.legalBalls <= 0) continue
    const m = maidensByInn[0][pid] ?? 0
    const maidenPts = (m / maidensPerWk) * topOrderWicketPts
    addBowl(1, pid, maidenPts)
    const srB = bowlingEconomySrBonus(stats.runs, stats.legalBalls, inn1Runs, inn1Balls, oversLimit)
    addBowl(1, pid, srB)
  }

  if (inn2) {
    const inn2Runs = inn2.runs
    const inn2Balls = inn2.legalBalls
    for (const pid of Object.keys(bowlEcon[1])) {
      const stats = bowlEcon[1][pid]
      if (!stats || stats.legalBalls <= 0) continue
      const m = maidensByInn[1][pid] ?? 0
      const maidenPts = (m / maidensPerWk) * topOrderWicketPts
      addBowl(2, pid, maidenPts)
      const srB = bowlingEconomySrBonus(stats.runs, stats.legalBalls, inn2Runs, inn2Balls, oversLimit)
      addBowl(2, pid, srB)
    }
  }

  const battingTotals: Record<string, number> = {}
  for (const [pid, st] of Object.entries(batByInn[0])) {
    battingTotals[pid] = (battingTotals[pid] ?? 0) + battingPointsForInnings(st.runs, st.balls, inn1Runs, inn1Balls, oversLimit)
  }
  if (inn2) {
    const inn2Runs = inn2.runs
    const inn2Balls = inn2.legalBalls
    for (const [pid, st] of Object.entries(batByInn[1])) {
      battingTotals[pid] = (battingTotals[pid] ?? 0) + battingPointsForInnings(st.runs, st.balls, inn2Runs, inn2Balls, oversLimit)
    }
  }

  const bowlingTotals: Record<string, number> = {}
  const fieldingTotals: Record<string, number> = {}
  for (const pid of new Set([...Object.keys(bowlPts[0]), ...Object.keys(bowlPts[1])])) {
    bowlingTotals[pid] = (bowlPts[0][pid] ?? 0) + (bowlPts[1][pid] ?? 0)
  }
  for (const pid of new Set([...Object.keys(fieldPts[0]), ...Object.keys(fieldPts[1])])) {
    fieldingTotals[pid] = (fieldPts[0][pid] ?? 0) + (fieldPts[1][pid] ?? 0)
  }

  const xiIds = new Set<string>([
    ...(match.lineup?.homeXI ?? []),
    ...(match.lineup?.awayXI ?? []),
  ])

  const rows: PlayerMvpRow[] = []
  for (const pid of xiIds) {
    const side = playerSide(match, pid)
    if (!side) continue
    const batting = battingTotals[pid] ?? 0
    const bowling = bowlingTotals[pid] ?? 0
    const fielding = fieldingTotals[pid] ?? 0
    const total = batting + bowling + fielding
    rows.push({
      playerId: pid,
      name: nameFor(match, pid),
      side,
      batting,
      bowling,
      fielding,
      total,
    })
  }

  rows.sort((a, b) => b.total - a.total)

  let potm: MatchMvpResult['potm'] = null
  let potmNote: string | null = null
  if (finalState.matchComplete && rows.length > 0) {
    const w = finalState.winner
    const top3 = rows.slice(0, 3)
    if (w && w !== 'tie') {
      const fromWinner = top3.filter((r) => r.side === w)
      if (fromWinner.length > 0) {
        potm = { playerId: fromWinner[0]!.playerId, name: fromWinner[0]!.name, side: fromWinner[0]!.side }
        potmNote = 'Top MVP among the top three from the winning side.'
      } else {
        potm = { playerId: rows[0]!.playerId, name: rows[0]!.name, side: rows[0]!.side }
        potmNote = 'No winning-side player in the top three by MVP; award goes to the match leader.'
      }
    } else {
      potm = { playerId: rows[0]!.playerId, name: rows[0]!.name, side: rows[0]!.side }
      potmNote = w === 'tie' ? 'Match tied; award goes to the MVP leader.' : null
    }
  }

  return { rows, potm, potmNote }
}
