import type {
  MatchTeamSnapshot,
  ParentUserTeamRef,
  RosterPlayer,
  TeamDoc,
} from '../types/models'
import { buildMemberIdsFromPlayers, buildRosterPlayerIds } from './matchRosterIndex'

export function buildTemporarySideSnapshot(
  name: string,
  players: RosterPlayer[],
  shortName?: string,
): MatchTeamSnapshot {
  const sn = shortName?.trim()
  return {
    name: name.trim(),
    ...(sn ? { shortName: sn } : {}),
    players,
    isTemporarySide: true,
  }
}

export function buildParentUserTeamRef(
  ownerUid: string,
  team: TeamDoc & { id: string },
): ParentUserTeamRef {
  const sn = team.shortName?.trim()
  return {
    ownerUid,
    teamId: team.id,
    name: team.name,
    ...(sn ? { shortName: sn } : {}),
  }
}

export function buildInternalMatchFields(
  ownerUid: string,
  parentTeam: TeamDoc & { id: string },
  home: MatchTeamSnapshot,
  away: MatchTeamSnapshot,
): {
  isInternalMatch: true
  isPublic: false
  parentUserTeamRef: ParentUserTeamRef
  parentTeamMemberIds: string[]
  rosterPlayerIds: string[]
} {
  return {
    isInternalMatch: true,
    isPublic: false,
    parentUserTeamRef: buildParentUserTeamRef(ownerUid, parentTeam),
    parentTeamMemberIds: buildMemberIdsFromPlayers(parentTeam.players),
    rosterPlayerIds: buildRosterPlayerIds(home, away),
  }
}
