import {
  countsAsLegalBall,
  totalRunsOnDelivery,
  wicketIsRealDismissal,
  type ScoreEvent,
} from '../scoring/engine'
import type { Side } from '../types/models'

/** Runs & legal balls in current partnership (since last wicket), for one innings. */
export function partnershipSinceLastWicket(
  events: ScoreEvent[],
  innings: 1 | 2,
  battingSide: Side,
): { runs: number; legalBalls: number } {
  const sorted = [...events].sort((a, b) => a.seq - b.seq)
  const undone = new Set<number>()
  for (const e of sorted) {
    if (e.kind === 'undo') undone.add(e.revertedSeq)
  }

  let pr = 0
  let pb = 0

  for (const e of sorted) {
    if (e.kind !== 'ball' || undone.has(e.seq)) continue
    const b = e.ball
    if (b.innings !== innings || b.battingSide !== battingSide) continue
    pr += totalRunsOnDelivery(b)
    if (countsAsLegalBall(b)) pb += 1
    if (wicketIsRealDismissal(b)) {
      pr = 0
      pb = 0
    }
  }

  return { runs: pr, legalBalls: pb }
}

export type FallOfWicketInfo = {
  runs: number
  wickets: number
  legalBalls: number
  dismissedId: string
}

/** Ordered wicket falls with cumulative innings score at each dismissal. */
export function wicketsTimeline(
  events: ScoreEvent[],
  innings: 1 | 2,
  battingSide: Side,
): FallOfWicketInfo[] {
  const sorted = [...events].sort((a, b) => a.seq - b.seq)
  const undone = new Set<number>()
  for (const e of sorted) {
    if (e.kind === 'undo') undone.add(e.revertedSeq)
  }

  let runs = 0
  let legalBalls = 0
  let wkts = 0
  const out: FallOfWicketInfo[] = []

  for (const e of sorted) {
    if (e.kind !== 'ball' || undone.has(e.seq)) continue
    const b = e.ball
    if (b.innings !== innings || b.battingSide !== battingSide) continue
    runs += totalRunsOnDelivery(b)
    if (countsAsLegalBall(b)) legalBalls += 1
    if (wicketIsRealDismissal(b) && b.wicket) {
      wkts += 1
      out.push({
        runs,
        wickets: wkts,
        legalBalls,
        dismissedId: b.wicket.dismissedId,
      })
    }
  }

  return out
}

/** Abbreviate name for chips */
export function shortName(full: string, max = 18): string {
  const t = full.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}
