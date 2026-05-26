import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  Timestamp,
  updateDoc,
  where,
  type Firestore,
} from 'firebase/firestore'
import type { MatchDoc, MatchParticipationInviteDoc, Side, TeamDoc } from '../types/models'
import {
  notifyMatchParticipationInviteReceived,
  notifyMatchParticipationResolved,
} from './matchParticipationNotifications'
import { teamParticipantRecipientUids } from './teamNumber'

export type PendingParticipantInput = {
  side: Side
  ownerUid: string
  teamId: string
  teamNumber: number
  teamName: string
}

export async function createMatchParticipationInvites(
  db: Firestore,
  matchId: string,
  createdBy: string,
  creatorDisplayName: string,
  scheduledAt: Date,
  pending: PendingParticipantInput[],
  teamDocs: Map<string, TeamDoc & { id: string }>,
): Promise<void> {
  const scheduledTs = Timestamp.fromDate(scheduledAt)
  for (const p of pending) {
    const teamKey = `${p.ownerUid}:${p.teamId}`
    const team = teamDocs.get(teamKey)
    const inviteRef = doc(collection(db, 'matchParticipationInvites'))
    const invite: MatchParticipationInviteDoc = {
      matchId,
      side: p.side,
      teamOwnerUid: p.ownerUid,
      teamId: p.teamId,
      teamNumber: p.teamNumber,
      teamName: p.teamName,
      createdBy,
      status: 'pending',
      scheduledAt: scheduledTs,
      expiresAt: scheduledTs,
      createdAt: Timestamp.now(),
      creatorDisplayName,
    }
    await runTransaction(db, async (tx) => {
      tx.set(inviteRef, invite)
    })
    const inviteWithId = { id: inviteRef.id, ...invite }
    const recipients = team
      ? teamParticipantRecipientUids(p.ownerUid, team)
      : teamParticipantRecipientUids(p.ownerUid, { ownerIds: [] })
    await notifyMatchParticipationInviteReceived(db, inviteWithId, recipients)
  }
}

async function allInvitesForMatch(
  db: Firestore,
  matchId: string,
): Promise<(MatchParticipationInviteDoc & { id: string })[]> {
  const qy = query(
    collection(db, 'matchParticipationInvites'),
    where('matchId', '==', matchId),
  )
  const snap = await getDocs(qy)
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as MatchParticipationInviteDoc) }))
}

async function syncMatchApprovalFromInvites(
  db: Firestore,
  matchId: string,
): Promise<void> {
  const invites = await allInvitesForMatch(db, matchId)
  if (invites.length === 0) return

  const matchRef = doc(db, 'matches', matchId)
  const matchSnap = await getDoc(matchRef)
  if (!matchSnap.exists()) return

  const clearedInvitees = { pendingParticipantTeams: [], participantInviteeUids: [] }

  if (invites.some((i) => i.status === 'rejected')) {
    await updateDoc(matchRef, {
      participantApprovalStatus: 'rejected',
      ...clearedInvitees,
    })
    return
  }
  if (invites.some((i) => i.status === 'expired')) {
    await updateDoc(matchRef, {
      participantApprovalStatus: 'expired',
      ...clearedInvitees,
    })
    return
  }
  const allAccepted = invites.every((i) => i.status === 'accepted')
  if (allAccepted) {
    await updateDoc(matchRef, {
      participantApprovalStatus: 'accepted',
      ...clearedInvitees,
    })
    return
  }
  const pendingTeams = invites
    .filter((i) => i.status === 'pending')
    .map((i) => ({
      side: i.side,
      ownerUid: i.teamOwnerUid,
      teamId: i.teamId,
      teamNumber: i.teamNumber,
    }))
  await updateDoc(matchRef, {
    participantApprovalStatus: 'pending',
    pendingParticipantTeams: pendingTeams,
  })
}

export async function acceptMatchParticipation(
  db: Firestore,
  inviteId: string,
  responderUid: string,
): Promise<void> {
  const inviteRef = doc(db, 'matchParticipationInvites', inviteId)
  const inviteSnap = await getDoc(inviteRef)
  if (!inviteSnap.exists()) throw new Error('Invitation not found.')
  const invite = { id: inviteSnap.id, ...(inviteSnap.data() as MatchParticipationInviteDoc) }
  if (invite.status !== 'pending') throw new Error('This invitation is no longer pending.')

  const matchRef = doc(db, 'matches', invite.matchId)
  const resolvedAt = Timestamp.now()

  await runTransaction(db, async (tx) => {
    const [curInvite, curMatch] = await Promise.all([tx.get(inviteRef), tx.get(matchRef)])
    if (!curInvite.exists()) throw new Error('Invitation not found.')
    const data = curInvite.data() as MatchParticipationInviteDoc
    if (data.status !== 'pending') throw new Error('This invitation is no longer pending.')
    if (!curMatch.exists()) throw new Error('Match not found.')

    tx.update(inviteRef, {
      status: 'accepted',
      resolvedAt,
      respondedByUid: responderUid,
    })

    const match = curMatch.data() as MatchDoc
    const pending = match.pendingParticipantTeams ?? []
    const remaining = pending.filter(
      (p) => p.ownerUid !== data.teamOwnerUid || p.teamId !== data.teamId,
    )

    if (remaining.length === 0) {
      tx.update(matchRef, {
        participantApprovalStatus: 'accepted',
        pendingParticipantTeams: [],
        participantInviteeUids: [],
      })
    } else {
      tx.update(matchRef, {
        participantApprovalStatus: 'pending',
        pendingParticipantTeams: remaining,
      })
    }
  })

  const resolved = {
    ...invite,
    status: 'accepted' as const,
    resolvedAt,
    respondedByUid: responderUid,
  }
  try {
    await notifyMatchParticipationResolved(db, resolved, 'invite_accepted')
  } catch {
    // Invite + match already committed; do not fail the user action.
  }
}

export async function rejectMatchParticipation(
  db: Firestore,
  inviteId: string,
  responderUid: string,
): Promise<void> {
  const inviteRef = doc(db, 'matchParticipationInvites', inviteId)
  const inviteSnap = await getDoc(inviteRef)
  if (!inviteSnap.exists()) throw new Error('Invitation not found.')
  const invite = { id: inviteSnap.id, ...(inviteSnap.data() as MatchParticipationInviteDoc) }
  if (invite.status !== 'pending') throw new Error('This invitation is no longer pending.')

  const matchRef = doc(db, 'matches', invite.matchId)
  const resolvedAt = Timestamp.now()

  await runTransaction(db, async (tx) => {
    const [curInvite, curMatch] = await Promise.all([tx.get(inviteRef), tx.get(matchRef)])
    if (!curInvite.exists()) throw new Error('Invitation not found.')
    const data = curInvite.data() as MatchParticipationInviteDoc
    if (data.status !== 'pending') throw new Error('This invitation is no longer pending.')
    if (!curMatch.exists()) throw new Error('Match not found.')
    tx.update(inviteRef, {
      status: 'rejected',
      resolvedAt,
      respondedByUid: responderUid,
    })
    tx.update(matchRef, {
      participantApprovalStatus: 'rejected',
      pendingParticipantTeams: [],
      participantInviteeUids: [],
    })
  })

  const resolved = {
    ...invite,
    status: 'rejected' as const,
    resolvedAt,
    respondedByUid: responderUid,
  }
  try {
    await notifyMatchParticipationResolved(db, resolved, 'invite_rejected')
  } catch {
    // Invite + match already committed; do not fail the user action.
  }
}

export async function expirePendingMatchInvites(db: Firestore): Promise<void> {
  const now = Timestamp.now()
  const qy = query(
    collection(db, 'matchParticipationInvites'),
    where('status', '==', 'pending'),
    where('expiresAt', '<=', now),
  )
  const snap = await getDocs(qy)
  for (const d of snap.docs) {
    const invite = { id: d.id, ...(d.data() as MatchParticipationInviteDoc) }
    await updateDoc(d.ref, {
      status: 'expired',
      resolvedAt: Timestamp.now(),
    })
    const resolved = { ...invite, status: 'expired' as const, resolvedAt: Timestamp.now() }
    await syncMatchApprovalFromInvites(db, invite.matchId)
    await notifyMatchParticipationResolved(db, resolved, 'invite_expired')
  }
}

export function matchCanStartScoring(match: MatchDoc): boolean {
  const s = match.participantApprovalStatus
  return s == null || s === 'accepted'
}

export function participantApprovalStatusLabel(
  status: MatchDoc['participantApprovalStatus'],
): string | null {
  switch (status) {
    case 'pending':
      return 'Pending'
    case 'rejected':
      return 'Rejected'
    case 'expired':
      return 'Expired'
    default:
      return null
  }
}

export { matchApprovedForPublicListing as matchVisibleOnPublicHome } from './publicHomeMatchQueries'
