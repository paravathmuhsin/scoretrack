import type { BallEventPayload, Side } from '../types/models'
import {
  countsAsLegalBall,
  currentInnings,
  isInningsOver,
  replayEvents,
  type ReplayConfig,
  type ScoreEvent,
} from '../scoring/engine'

export type ScoreBarBallCue = 'four' | 'six' | 'wicket' | 'freeHit'

function effectiveNonUndoEventsSorted(events: ScoreEvent[]): ScoreEvent[] {
  const sorted = [...events].sort((a, b) => a.seq - b.seq)
  const undone = new Set<number>()
  for (const e of sorted) {
    if (e.kind === 'undo') undone.add(e.revertedSeq)
  }
  return sorted.filter((e) => e.kind !== 'undo' && !undone.has(e.seq))
}

/** Balls for one batting side in one innings, chronological order (same undo rules as replay). */
function ballsInInningsChronological(
  events: ScoreEvent[],
  innings: 1 | 2,
  battingSide: Side,
): BallEventPayload[] {
  const active = effectiveNonUndoEventsSorted(events)
  const out: BallEventPayload[] = []
  for (const e of active) {
    if (e.kind !== 'ball' || !e.ball) continue
    const b = e.ball
    if (b.innings === innings && b.battingSide === battingSide) out.push(b)
  }
  return out
}

/**
 * ICC-style chain: after a no-ball, the next delivery is a free hit; wide / no-ball keep the
 * next delivery as free hit until a **legal** ball is bowled.
 */
function freeHitPendingAfterPrefix(
  events: ScoreEvent[],
  innings: 1 | 2,
  battingSide: Side,
  freeHitOnNoBall: boolean,
): boolean {
  if (!freeHitOnNoBall) return false
  const balls = ballsInInningsChronological(events, innings, battingSide)
  let lastNoBallIdx = -1
  for (let i = balls.length - 1; i >= 0; i--) {
    if (balls[i]!.delivery === 'noball') {
      lastNoBallIdx = i
      break
    }
  }
  if (lastNoBallIdx < 0) return false
  for (let j = lastNoBallIdx + 1; j < balls.length; j++) {
    if (balls[j]!.delivery === 'legal') return false
  }
  return true
}

/** True before the next ball is entered: free hit applies (same rules as score bar flash). */
export function freeHitPendingBeforeNextBall(
  events: ScoreEvent[],
  innings: 1 | 2,
  battingSide: Side,
  freeHitOnNoBall: boolean,
): boolean {
  return freeHitPendingAfterPrefix(events, innings, battingSide, freeHitOnNoBall)
}

/** Latest scored ball for this innings & batting side (undo-aware), or null. */
export function lastScoredBallForInningsSide(
  events: ScoreEvent[],
  innings: 1 | 2,
  battingSide: Side,
): { seq: number; delivery: BallEventPayload['delivery'] } | null {
  const active = effectiveNonUndoEventsSorted(events)
  for (let i = active.length - 1; i >= 0; i--) {
    const e = active[i]!
    if (e.kind !== 'ball' || !e.ball) continue
    const b = e.ball
    if (b.innings === innings && b.battingSide === battingSide) {
      return { seq: e.seq, delivery: b.delivery }
    }
  }
  return null
}

/**
 * Whether the score bar should flash for the latest applied ball (4 / 6 / wicket / free hit).
 * FREE HIT: flashes after no-ball / chain wide-noball when the
 * **next** delivery is a free hit — not after the legal free-hit ball itself.
 * Suppresses when that ball also ends the over, ends an innings, or completes the match.
 */
/** Latest applied ball event `seq`, or null if none. */
export function lastEffectiveBallSeq(events: ScoreEvent[]): number | null {
  const active = effectiveNonUndoEventsSorted(events)
  for (let i = active.length - 1; i >= 0; i--) {
    const e = active[i]!
    if (e.kind === 'ball') return e.seq
  }
  return null
}

export function lastBallScoreBarCue(
  cfg: ReplayConfig,
  events: ScoreEvent[],
  freeHitOnNoBall?: boolean,
): ScoreBarBallCue | null {
  const active = effectiveNonUndoEventsSorted(events)
  let lastBall: { seq: number; ball: BallEventPayload } | null = null
  for (let i = active.length - 1; i >= 0; i--) {
    const e = active[i]!
    if (e.kind === 'ball') {
      lastBall = { seq: e.seq, ball: e.ball }
      break
    }
  }
  if (!lastBall) return null

  const sortedAll = [...events].sort((a, b) => a.seq - b.seq)
  const eventsMinusLastBall = sortedAll.filter((e) => !(e.kind === 'ball' && e.seq === lastBall!.seq))

  const stateAfter = replayEvents(cfg, events)
  const stateBefore = replayEvents(cfg, eventsMinusLastBall)

  if (stateAfter.matchComplete) return null

  const innAfter = currentInnings(stateAfter)
  const innBefore = currentInnings(stateBefore)

  if (isInningsOver(cfg, innAfter, stateAfter) && !isInningsOver(cfg, innBefore, stateBefore)) {
    return null
  }

  const b = lastBall.ball
  if (
    countsAsLegalBall(b) &&
    innAfter.legalBalls > 0 &&
    innAfter.legalBalls % cfg.ballsPerOver === 0
  ) {
    return null
  }

  if (b.wicket && b.wicket.countsAsWicket !== false) return 'wicket'
  if (b.runsOffBat === 6) return 'six'
  if (b.runsOffBat === 4) return 'four'
  if (
    freeHitPendingBeforeNextBall(events, innAfter.innings, innAfter.battingSide, freeHitOnNoBall === true)
  )
    return 'freeHit'
  return null
}
