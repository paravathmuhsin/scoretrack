import type { MatchDoc } from '../types/models'
import type { ScoreEvent } from '../scoring/engine'

/**
 * Resolves stable display names for scorecard/PDF exports.
 * Uses match roster first, then denormalized names on ball events (e.g. fielder),
 * then a short fallback so raw Firestore ids are not shown when avoidable.
 */
export function buildPlayerNameLookup(
  match: MatchDoc,
  events: ScoreEvent[],
): (playerId: string) => string {
  const map = new Map<string, string>()

  const put = (playerId: string, name: string | undefined) => {
    const t = name?.trim()
    if (playerId && t) map.set(playerId, t)
  }

  for (const p of match.home.players) put(p.playerId, p.name)
  for (const p of match.away.players) put(p.playerId, p.name)

  for (const e of events) {
    if (e.kind !== 'ball') continue
    const w = e.ball.wicket
    if (w?.fielderId && w.fielderName?.trim()) {
      put(w.fielderId, w.fielderName)
    }
  }

  return (playerId: string) => {
    const hit = map.get(playerId)
    if (hit) return hit
    if (playerId.length >= 20) return `Unknown player (…${playerId.slice(-6)})`
    return playerId
  }
}
