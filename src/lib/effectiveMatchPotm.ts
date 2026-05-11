import { computeMatchMvp, type MatchMvpResult } from './mvpMatch'
import type { MatchDoc } from '../types/models'
import type { ReplayConfig, ReplayState, ScoreEvent } from '../scoring/engine'

/** Prefer persisted POTM on completed matches; otherwise recompute from events. */
export function effectiveMatchMvp(
  match: MatchDoc,
  cfg: ReplayConfig,
  events: ScoreEvent[],
  state: ReplayState,
): MatchMvpResult {
  const pr = match.playerOfTheMatchResult
  const computed = computeMatchMvp(match, cfg, events, state)
  if (match.status === 'completed' && pr && pr.playerId) {
    return {
      rows: computed.rows,
      potm: { playerId: pr.playerId, name: pr.name, side: pr.side },
      potmNote: pr.note,
      potmSource: pr.source,
      fieldingByPlayerId: computed.fieldingByPlayerId,
    }
  }
  return computed
}
