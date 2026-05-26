import {
  collection,
  doc,
  getDoc,
  runTransaction,
  Timestamp,
  type Firestore,
} from 'firebase/firestore'
import type { TeamDoc, TournamentTeamLinkInviteDoc } from '../types/models'
import {
  notifyTournamentLinkInviteReceived,
  notifyTournamentLinkResolved,
} from './tournamentTeamLinkNotifications'
import { teamParticipantRecipientUids } from './teamNumber'

export async function createTournamentTeamLinkInvite(
  db: Firestore,
  params: {
    tournamentId: string
    tournamentName: string
    linkedTeamId: string
    teamOwnerUid: string
    teamId: string
    teamNumber: number
    teamName: string
    createdBy: string
    organiserDisplayName: string
    team: TeamDoc
  },
): Promise<string> {
  const inviteRef = doc(collection(db, 'tournamentTeamLinkInvites'))
  const invite: TournamentTeamLinkInviteDoc = {
    tournamentId: params.tournamentId,
    tournamentName: params.tournamentName,
    linkedTeamId: params.linkedTeamId,
    teamOwnerUid: params.teamOwnerUid,
    teamId: params.teamId,
    teamNumber: params.teamNumber,
    teamName: params.teamName,
    createdBy: params.createdBy,
    status: 'pending',
    createdAt: Timestamp.now(),
    organiserDisplayName: params.organiserDisplayName,
  }
  await runTransaction(db, async (tx) => {
    tx.set(inviteRef, invite)
  })
  const inviteWithId = { id: inviteRef.id, ...invite }
  const recipients = teamParticipantRecipientUids(params.teamOwnerUid, params.team)
  await notifyTournamentLinkInviteReceived(db, inviteWithId, recipients)
  return inviteRef.id
}

export async function acceptTournamentTeamLink(
  db: Firestore,
  inviteId: string,
  responderUid: string,
): Promise<void> {
  const inviteRef = doc(db, 'tournamentTeamLinkInvites', inviteId)
  const inviteSnap = await getDoc(inviteRef)
  if (!inviteSnap.exists()) throw new Error('Invitation not found.')
  const invite = { id: inviteSnap.id, ...(inviteSnap.data() as TournamentTeamLinkInviteDoc) }
  if (invite.status !== 'pending') throw new Error('This invitation is no longer pending.')

  const linkRef = doc(
    db,
    'tournaments',
    invite.tournamentId,
    'linkedTeams',
    invite.linkedTeamId,
  )

  await runTransaction(db, async (tx) => {
    const cur = await tx.get(inviteRef)
    if (!cur.exists()) throw new Error('Invitation not found.')
    const data = cur.data() as TournamentTeamLinkInviteDoc
    if (data.status !== 'pending') throw new Error('This invitation is no longer pending.')
    tx.update(inviteRef, {
      status: 'accepted',
      resolvedAt: Timestamp.now(),
      respondedByUid: responderUid,
    })
    tx.update(linkRef, { linkApprovalStatus: 'accepted' })
  })

  const resolved = {
    ...invite,
    status: 'accepted' as const,
    resolvedAt: Timestamp.now(),
    respondedByUid: responderUid,
  }
  await notifyTournamentLinkResolved(db, resolved, 'link_accepted')
}

export async function rejectTournamentTeamLink(
  db: Firestore,
  inviteId: string,
  responderUid: string,
): Promise<void> {
  const inviteRef = doc(db, 'tournamentTeamLinkInvites', inviteId)
  const inviteSnap = await getDoc(inviteRef)
  if (!inviteSnap.exists()) throw new Error('Invitation not found.')
  const invite = { id: inviteSnap.id, ...(inviteSnap.data() as TournamentTeamLinkInviteDoc) }
  if (invite.status !== 'pending') throw new Error('This invitation is no longer pending.')

  const linkRef = doc(
    db,
    'tournaments',
    invite.tournamentId,
    'linkedTeams',
    invite.linkedTeamId,
  )

  await runTransaction(db, async (tx) => {
    tx.update(inviteRef, {
      status: 'rejected',
      resolvedAt: Timestamp.now(),
      respondedByUid: responderUid,
    })
    tx.update(linkRef, { linkApprovalStatus: 'rejected' })
  })

  const resolved = {
    ...invite,
    status: 'rejected' as const,
    resolvedAt: Timestamp.now(),
    respondedByUid: responderUid,
  }
  await notifyTournamentLinkResolved(db, resolved, 'link_rejected')
}

export function linkedTeamIsApproved(
  link: { linkApprovalStatus?: string },
): boolean {
  const s = link.linkApprovalStatus
  return s == null || s === 'accepted'
}
