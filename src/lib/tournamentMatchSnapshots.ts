import type { MatchTeamSnapshot, TeamDoc } from '../types/models'

export function tbdPlaceholderSnapshot(): MatchTeamSnapshot {
  return {
    name: 'TBD',
    players: [
      { playerId: '__tbd_a', name: 'Placeholder' },
      { playerId: '__tbd_b', name: 'Placeholder' },
    ],
  }
}

/** Snapshot for a My team row linked into this tournament (`tournamentTeamId` = link doc id). */
export function buildTournamentEntrySnapshot(
  t: TeamDoc & { id: string },
  tournamentLinkId: string,
): MatchTeamSnapshot {
  const sn = t.shortName?.trim()
  return {
    name: t.name,
    ...(sn ? { shortName: sn } : {}),
    players: t.players,
    userTeamId: t.id,
    tournamentTeamId: tournamentLinkId,
  }
}
