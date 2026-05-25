import type { RosterPlayer } from '../types/models'

export function rosterPlayersFromIds(ids: string[], pool: RosterPlayer[]): RosterPlayer[] {
  const byId = new Map(pool.map((p) => [p.playerId, p]))
  const out: RosterPlayer[] = []
  for (const id of ids) {
    const p = byId.get(id)
    if (p) out.push(p)
  }
  return out
}

export function internalMatchSidesOverlap(homeIds: string[], awayIds: string[]): boolean {
  const away = new Set(awayIds)
  return homeIds.some((id) => away.has(id))
}
