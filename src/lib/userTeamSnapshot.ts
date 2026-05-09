import type { MatchTeamSnapshot, TeamDoc } from '../types/models'

export function buildSnapshotFromUserTeam(t: TeamDoc & { id: string }): MatchTeamSnapshot {
  const sn = t.shortName?.trim()
  return {
    name: t.name,
    ...(sn ? { shortName: sn } : {}),
    players: t.players,
    userTeamId: t.id,
  }
}
