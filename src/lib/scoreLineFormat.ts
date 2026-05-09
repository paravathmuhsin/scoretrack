import { oversString, type ReplayConfig, type ReplayState } from '../scoring/engine'
import type { Side } from '../types/models'

/** Runs/wickets plus overs progress, matching the in-app score header (e.g. `12/2 (4.3/20)`). */
export function scoreLineForSide(state: ReplayState, cfg: ReplayConfig, side: Side): string {
  const ov = (legalBalls: number) =>
    `(${oversString(legalBalls, cfg.ballsPerOver)}/${cfg.oversLimit})`
  if (state.innings1.battingSide === side) {
    const inn = state.innings1
    return `${inn.runs}/${inn.wickets} ${ov(inn.legalBalls)}`
  }
  if (state.innings2?.battingSide === side) {
    const inn = state.innings2
    return `${inn.runs}/${inn.wickets} ${ov(inn.legalBalls)}`
  }
  return 'Yet to bat'
}
