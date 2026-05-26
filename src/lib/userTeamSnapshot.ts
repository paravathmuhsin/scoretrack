import type { MatchTeamSnapshot, TeamDoc } from '../types/models'

export function buildSnapshotFromUserTeam(
  t: TeamDoc & { id: string },
  opts?: { ownerUid: string; currentUserUid?: string },
): MatchTeamSnapshot {
  const sn = t.shortName?.trim()
  const ownerUid = opts?.ownerUid
  const currentUserUid = opts?.currentUserUid
  return {
    name: t.name,
    ...(sn ? { shortName: sn } : {}),
    players: t.players,
    userTeamId: t.id,
    ...(ownerUid && currentUserUid && ownerUid !== currentUserUid
      ? { userTeamOwnerUid: ownerUid }
      : {}),
  }
}
