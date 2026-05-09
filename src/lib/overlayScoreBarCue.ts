import type { BallEventPayload } from '../types/models'
import {
  countsAsLegalBall,
  currentInnings,
  isInningsOver,
  replayEvents,
  type ReplayConfig,
  type ScoreEvent,
} from '../scoring/engine'

export type ScoreBarBallCue = 'four' | 'six' | 'wicket'

function effectiveNonUndoEventsSorted(events: ScoreEvent[]): ScoreEvent[] {
  const sorted = [...events].sort((a, b) => a.seq - b.seq)
  const undone = new Set<number>()
  for (const e of sorted) {
    if (e.kind === 'undo') undone.add(e.revertedSeq)
  }
  return sorted.filter((e) => e.kind !== 'undo' && !undone.has(e.seq))
}

/**
 * Whether the score bar should flash for the latest applied ball (4 / 6 / wicket).
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

export function lastBallScoreBarCue(cfg: ReplayConfig, events: ScoreEvent[]): ScoreBarBallCue | null {
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
  return null
}
