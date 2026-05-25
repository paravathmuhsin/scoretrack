import type { MatchTeamSnapshot } from '../types/models'

/** Union of home/away squad roster playerIds (not playing XI). */
export function buildRosterPlayerIds(
  home: Pick<MatchTeamSnapshot, 'players'>,
  away: Pick<MatchTeamSnapshot, 'players'>,
): string[] {
  const ids = new Set<string>()
  for (const p of home.players) {
    if (p.playerId) ids.add(p.playerId)
  }
  for (const p of away.players) {
    if (p.playerId) ids.add(p.playerId)
  }
  return [...ids]
}

export function buildMemberIdsFromPlayers(players: { playerId: string }[]): string[] {
  return players.map((p) => p.playerId).filter(Boolean)
}
