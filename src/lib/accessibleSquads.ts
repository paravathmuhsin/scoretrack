import {
  deleteDoc,
  doc,
  type Firestore,
  setDoc,
  writeBatch,
} from 'firebase/firestore'
import type { AccessibleSquadDoc, TeamDoc } from '../types/models'
import { buildMemberIdsFromPlayers } from './matchRosterIndex'

export function accessibleSquadDocId(ownerUid: string, teamId: string): string {
  return `${ownerUid}_${teamId}`
}

/** Upsert membership index for each non-owner player on the squad. */
export async function syncAccessibleSquadsForTeam(
  db: Firestore,
  ownerUid: string,
  teamId: string,
  team: Pick<TeamDoc, 'name' | 'shortName' | 'players' | 'ownerIds'>,
): Promise<void> {
  const batch = writeBatch(db)
  const sn = team.shortName?.trim()
  const memberIds = buildMemberIdsFromPlayers(team.players)
  const coOwnerSet = new Set(team.ownerIds ?? [])

  for (const pid of memberIds) {
    if (pid === ownerUid) continue
    const ref = doc(db, 'users', pid, 'accessibleSquads', accessibleSquadDocId(ownerUid, teamId))
    const row: AccessibleSquadDoc = {
      ownerUid,
      teamId,
      teamName: team.name,
      ...(sn ? { teamShortName: sn } : {}),
      role: coOwnerSet.has(pid) ? 'co-owner' : 'member',
    }
    batch.set(ref, row)
  }

  await batch.commit()
}

/** After owner saves roster: upsert current members and remove stale accessibleSquads docs. */
export async function syncAccessibleSquadsAfterRosterChange(
  db: Firestore,
  ownerUid: string,
  teamId: string,
  team: Pick<TeamDoc, 'name' | 'shortName' | 'players' | 'ownerIds'>,
  previousMemberIds: string[],
): Promise<void> {
  const nextIds = new Set(buildMemberIdsFromPlayers(team.players))
  const coOwners = new Set(team.ownerIds ?? [])
  const prevSet = new Set(previousMemberIds)
  const removed = [...prevSet].filter((id) => id !== ownerUid && !nextIds.has(id) && !coOwners.has(id))
  await Promise.all(removed.map((pid) => deleteAccessibleSquadForMember(db, pid, ownerUid, teamId)))
  await syncAccessibleSquadsForTeam(db, ownerUid, teamId, team)
}

export async function deleteAccessibleSquadForMember(
  db: Firestore,
  memberUid: string,
  ownerUid: string,
  teamId: string,
): Promise<void> {
  await deleteDoc(doc(db, 'users', memberUid, 'accessibleSquads', accessibleSquadDocId(ownerUid, teamId)))
}

/** Member joins via invite — write their own accessibleSquads doc. */
export async function writeAccessibleSquadForJoiner(
  db: Firestore,
  memberUid: string,
  ownerUid: string,
  teamId: string,
  teamName: string,
  teamShortName?: string,
): Promise<void> {
  const sn = teamShortName?.trim()
  const row: AccessibleSquadDoc = {
    ownerUid,
    teamId,
    teamName,
    ...(sn ? { teamShortName: sn } : {}),
    role: 'member',
  }
  await setDoc(
    doc(db, 'users', memberUid, 'accessibleSquads', accessibleSquadDocId(ownerUid, teamId)),
    row,
  )
}
