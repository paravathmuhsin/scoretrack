import type { MatchDoc, Side } from '../types/models'
import type { ReplayState } from '../scoring/engine'

export type CaptaincyIncrements = {
  matches: number
  wins: number
  losses: number
  ties: number
}

export type PointsOutcome = 'home_win' | 'away_win' | 'tie' | 'no_result'

/** Effective match winner for career rollups (forced outcome overrides replay). */
export function resolveMatchWinnerForStats(
  state: ReplayState,
  pointsOutcome?: PointsOutcome,
): Side | 'tie' | null {
  if (pointsOutcome === 'home_win') return 'home'
  if (pointsOutcome === 'away_win') return 'away'
  if (pointsOutcome === 'tie') return 'tie'
  if (pointsOutcome === 'no_result') return null
  return state.winner
}

/** Captaincy W/L/T increments for one XI player in a completed match; null if not captain. */
export function captaincyIncrementsForPlayer(
  match: MatchDoc,
  playerId: string,
  winnerSide: Side | 'tie' | null,
): CaptaincyIncrements | null {
  const lu = match.lineup
  if (!lu) return null

  let side: Side | null = null
  if (lu.homeCaptainId === playerId) side = 'home'
  else if (lu.awayCaptainId === playerId) side = 'away'
  else return null

  const inc: CaptaincyIncrements = { matches: 1, wins: 0, losses: 0, ties: 0 }
  if (winnerSide === 'tie') inc.ties = 1
  else if (winnerSide === side) inc.wins = 1
  else if (winnerSide === 'home' || winnerSide === 'away') inc.losses = 1
  return inc
}
