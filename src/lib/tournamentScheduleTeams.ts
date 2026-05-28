import { doc, getDoc, type Firestore } from 'firebase/firestore'
import type { MatchTeamSnapshot, TeamDoc, TournamentLinkedTeamDoc } from '../types/models'
import { buildSnapshotFromUserTeam } from './userTeamSnapshot'

/** Load squad roster from My teams or the owner's `users/{uid}/teams` path (external links). */
export async function fetchTeamDocForLinkedSquad(
  db: Firestore,
  link: TournamentLinkedTeamDoc & { id: string },
  organiserUid: string,
  myTeams: (TeamDoc & { id: string })[],
): Promise<(TeamDoc & { id: string }) | null> {
  const ownerUid = link.userTeamOwnerUid ?? organiserUid
  const mine = myTeams.find((t) => t.id === link.userTeamId)
  if (mine && ownerUid === organiserUid) return mine

  try {
    const snap = await getDoc(doc(db, 'users', ownerUid, 'teams', link.userTeamId))
    if (!snap.exists()) return null
    return { id: snap.id, ...(snap.data() as TeamDoc) }
  } catch {
    return null
  }
}

export function squadDisplayName(
  team: TeamDoc | undefined,
  link: TournamentLinkedTeamDoc,
): string {
  return team?.name?.trim() || link.teamName?.trim() || link.userTeamId
}

/** Match side snapshot for a tournament-linked squad (includes external owner when needed). */
export function buildTournamentEntrySnapshotForLink(
  team: TeamDoc & { id: string },
  link: TournamentLinkedTeamDoc & { id: string },
  organiserUid: string,
): MatchTeamSnapshot {
  const ownerUid = link.userTeamOwnerUid ?? organiserUid
  const base = buildSnapshotFromUserTeam(team, { ownerUid, currentUserUid: organiserUid })
  const linkShort = link.teamShortName?.trim()
  return {
    ...base,
    name: squadDisplayName(team, link),
    ...(linkShort ? { shortName: linkShort } : {}),
    tournamentTeamId: link.id,
  }
}
