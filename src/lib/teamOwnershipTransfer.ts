import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  Timestamp,
  where,
  setDoc,
  updateDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore'
import type { TeamDoc, TeamOwnershipTransferDoc } from '../types/models'
import { deleteAccessibleSquadForMember, syncAccessibleSquadsForTeam } from './accessibleSquads'
import { buildMemberIdsFromPlayers } from './matchRosterIndex'
import {
  appendTransferNotifications,
  writeTransferNotifications,
} from './ownershipTransferNotifications'

const TRANSFER_TTL_DAYS = 7

export function transferExpiresAt(from: Date = new Date()): Timestamp {
  const d = new Date(from)
  d.setDate(d.getDate() + TRANSFER_TTL_DAYS)
  return Timestamp.fromDate(d)
}

export async function createOwnershipTransferRequest(
  db: Firestore,
  fromUid: string,
  team: TeamDoc & { id: string },
  toUid: string,
  toDisplayName: string,
  fromDisplayName: string,
): Promise<string> {
  if (fromUid === toUid) throw new Error('Cannot transfer to yourself.')
  if (team.pendingOwnershipTransferId) {
    throw new Error('A transfer request is already pending for this team.')
  }

  const transferRef = doc(collection(db, 'teamOwnershipTransfers'))
  const teamRef = doc(db, 'users', fromUid, 'teams', team.id)
  const snapshot: TeamDoc = {
    name: team.name,
    shortName: team.shortName,
    players: team.players,
    location: team.location ?? null,
    memberIds: buildMemberIdsFromPlayers(team.players),
    ownerIds: team.ownerIds ?? [],
    ...(team.joinInviteToken ? { joinInviteToken: team.joinInviteToken } : {}),
  }

  const transfer: TeamOwnershipTransferDoc = {
    fromUid,
    toUid,
    teamId: team.id,
    teamName: team.name,
    ...(team.shortName?.trim() ? { teamShortName: team.shortName.trim() } : {}),
    status: 'pending',
    createdAt: Timestamp.now(),
    expiresAt: transferExpiresAt(),
    teamSnapshot: snapshot,
    fromDisplayName,
    toDisplayName,
  }

  await setDoc(transferRef, transfer)

  const transferWithId = { id: transferRef.id, ...transfer }
  const batch = writeBatch(db)
  batch.update(teamRef, { pendingOwnershipTransferId: transferRef.id })
  appendTransferNotifications(batch, db, transferWithId, 'sent')
  await batch.commit()
  return transferRef.id
}

export async function cancelOwnershipTransfer(
  db: Firestore,
  transferId: string,
  fromUid: string,
): Promise<void> {
  const transferRef = doc(db, 'teamOwnershipTransfers', transferId)
  const snap = await getDoc(transferRef)
  if (!snap.exists()) throw new Error('Transfer request not found.')
  const transfer = { id: snap.id, ...(snap.data() as TeamOwnershipTransferDoc) }
  if (transfer.fromUid !== fromUid) throw new Error('Not authorized.')
  if (transfer.status !== 'pending') throw new Error('This request is no longer pending.')

  await updateDoc(transferRef, { status: 'cancelled', resolvedAt: Timestamp.now() })

  const teamRef = doc(db, 'users', fromUid, 'teams', transfer.teamId)
  await updateDoc(teamRef, { pendingOwnershipTransferId: deleteField() })

  const resolvedTransfer: TeamOwnershipTransferDoc & { id: string } = {
    ...transfer,
    status: 'cancelled',
    resolvedAt: Timestamp.now(),
  }
  await writeTransferNotifications(db, resolvedTransfer, 'cancelled')
}

async function migrateAccessibleSquadsForTransfer(
  db: Firestore,
  fromUid: string,
  toUid: string,
  teamId: string,
  team: TeamDoc,
): Promise<void> {
  const memberIds = buildMemberIdsFromPlayers(team.players)
  for (const pid of memberIds) {
    if (pid === fromUid || pid === toUid) continue
    await deleteAccessibleSquadForMember(db, pid, fromUid, teamId)
  }
  await syncAccessibleSquadsForTeam(db, toUid, teamId, team)
  for (const pid of memberIds) {
    if (pid === toUid) continue
    if (pid === fromUid) continue
  }
}

export async function acceptOwnershipTransfer(
  db: Firestore,
  transferId: string,
  toUid: string,
): Promise<void> {
  const transferRef = doc(db, 'teamOwnershipTransfers', transferId)
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(transferRef)
    if (!snap.exists()) throw new Error('Transfer request not found.')
    const transfer = snap.data() as TeamOwnershipTransferDoc
    if (transfer.toUid !== toUid) throw new Error('Not authorized.')
    if (transfer.status !== 'pending') throw new Error('This request is no longer pending.')
    if (transfer.expiresAt.toMillis() <= Date.now()) {
      throw new Error('This transfer request has expired.')
    }

    const fromTeamRef = doc(db, 'users', transfer.fromUid, 'teams', transfer.teamId)
    const toTeamRef = doc(db, 'users', toUid, 'teams', transfer.teamId)
    const fromTeamSnap = await tx.get(fromTeamRef)
    if (!fromTeamSnap.exists()) throw new Error('Team no longer exists.')

    const moved: TeamDoc = {
      ...transfer.teamSnapshot,
      pendingOwnershipTransferId: null,
      ownerIds: (transfer.teamSnapshot.ownerIds ?? []).filter((id) => id !== toUid),
    }

    tx.set(toTeamRef, moved)
    tx.delete(fromTeamRef)
    tx.update(transferRef, { status: 'accepted', resolvedAt: Timestamp.now() })

    if (moved.joinInviteToken) {
      const invRef = doc(db, 'userTeamJoinInvites', moved.joinInviteToken)
      tx.update(invRef, {
        ownerUid: toUid,
        memberIds: buildMemberIdsFromPlayers(moved.players),
        teamName: moved.name,
      })
    }
  })

  const transferSnap = await getDoc(transferRef)
  const transfer = { id: transferSnap.id, ...(transferSnap.data() as TeamOwnershipTransferDoc) }
  await writeTransferNotifications(db, transfer, 'accepted')
  await migrateAccessibleSquadsForTransfer(
    db,
    transfer.fromUid,
    toUid,
    transfer.teamId,
    transfer.teamSnapshot,
  )
}

export async function rejectOwnershipTransfer(
  db: Firestore,
  transferId: string,
  toUid: string,
): Promise<void> {
  const transferRef = doc(db, 'teamOwnershipTransfers', transferId)
  const snap = await getDoc(transferRef)
  if (!snap.exists()) throw new Error('Transfer request not found.')
  const transfer = { id: snap.id, ...(snap.data() as TeamOwnershipTransferDoc) }
  if (transfer.toUid !== toUid) throw new Error('Not authorized.')
  if (transfer.status !== 'pending') throw new Error('This request is no longer pending.')

  await updateDoc(transferRef, { status: 'rejected', resolvedAt: Timestamp.now() })

  const resolvedTransfer: TeamOwnershipTransferDoc & { id: string } = {
    ...transfer,
    status: 'rejected',
    resolvedAt: Timestamp.now(),
  }
  const teamRef = doc(db, 'users', transfer.fromUid, 'teams', transfer.teamId)
  await updateDoc(teamRef, { pendingOwnershipTransferId: deleteField() })

  await writeTransferNotifications(db, resolvedTransfer, 'rejected')
}

/** Expire pending transfers the signed-in user is party to (scoped for security rules). */
export async function markExpiredOwnershipTransfers(db: Firestore, callerUid: string): Promise<void> {
  const now = Timestamp.now()
  const pendingExpired = [
    where('status', '==', 'pending'),
    where('expiresAt', '<=', now),
  ] as const

  const [fromSnap, toSnap] = await Promise.all([
    getDocs(
      query(
        collection(db, 'teamOwnershipTransfers'),
        where('fromUid', '==', callerUid),
        ...pendingExpired,
      ),
    ),
    getDocs(
      query(
        collection(db, 'teamOwnershipTransfers'),
        where('toUid', '==', callerUid),
        ...pendingExpired,
      ),
    ),
  ])

  const byId = new Map<string, TeamOwnershipTransferDoc & { id: string }>()
  for (const d of [...fromSnap.docs, ...toSnap.docs]) {
    byId.set(d.id, { id: d.id, ...(d.data() as TeamOwnershipTransferDoc) })
  }

  for (const transfer of byId.values()) {
    await updateDoc(doc(db, 'users', transfer.fromUid, 'teams', transfer.teamId), {
      pendingOwnershipTransferId: deleteField(),
    })
    await updateDoc(doc(db, 'teamOwnershipTransfers', transfer.id), {
      status: 'expired',
      resolvedAt: Timestamp.now(),
    })
    await writeTransferNotifications(db, transfer, 'expired')
  }
}
