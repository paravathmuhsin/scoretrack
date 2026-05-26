import { doc, getDoc, updateDoc, writeBatch, setDoc, deleteDoc, type Firestore } from 'firebase/firestore'
import type { TeamDoc } from '../types/models'
import { accessibleSquadDocId } from './accessibleSquads'
import { appendCoOwnerLeftNotifications } from './coOwnerNotifications'

export async function removeSelfCoOwnership(
  db: Firestore,
  primaryOwnerUid: string,
  teamId: string,
  coOwnerUid: string,
  coOwnerDisplayName: string,
  primaryDisplayName: string,
): Promise<void> {
  const teamRef = doc(db, 'users', primaryOwnerUid, 'teams', teamId)
  const snap = await getDoc(teamRef)
  if (!snap.exists()) throw new Error('Team not found.')
  const team = snap.data() as TeamDoc
  const ownerIds = team.ownerIds ?? []
  if (!ownerIds.includes(coOwnerUid)) {
    throw new Error('You are not a co-owner of this team.')
  }

  const nextOwnerIds = ownerIds.filter((id) => id !== coOwnerUid)
  const stillOnRoster = team.players.some((p) => p.playerId === coOwnerUid)
  const squadRef = doc(db, 'users', coOwnerUid, 'accessibleSquads', accessibleSquadDocId(primaryOwnerUid, teamId))

  await updateDoc(teamRef, { ownerIds: nextOwnerIds })

  if (stillOnRoster) {
    const sn = team.shortName?.trim()
    await setDoc(squadRef, {
      ownerUid: primaryOwnerUid,
      teamId,
      teamName: team.name,
      ...(sn ? { teamShortName: sn } : {}),
      role: 'member',
    })
  } else {
    await deleteDoc(squadRef)
  }

  const batch = writeBatch(db)
  appendCoOwnerLeftNotifications(batch, db, {
    primaryOwnerUid,
    teamId,
    teamName: team.name,
    coOwnerUid,
    coOwnerDisplayName,
    primaryDisplayName,
  })
  await batch.commit()
}
