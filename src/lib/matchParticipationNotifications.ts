import { collection, doc, setDoc, Timestamp, type Firestore } from 'firebase/firestore'
import type {
  MatchParticipationInviteDoc,
  MatchParticipationNotification,
  MatchParticipationNotificationKind,
} from '../types/models'

function payload(
  invite: MatchParticipationInviteDoc & { id: string },
  kind: MatchParticipationNotificationKind,
  recipientUid: string,
): MatchParticipationNotification {
  const isCreator = recipientUid === invite.createdBy
  return {
    type: 'match_participation',
    kind,
    inviteId: invite.id,
    matchId: invite.matchId,
    teamId: invite.teamId,
    teamName: invite.teamName,
    teamNumber: invite.teamNumber,
    side: invite.side,
    otherUid: isCreator ? invite.teamOwnerUid : invite.createdBy,
    otherDisplayName: isCreator ? undefined : invite.creatorDisplayName,
    scheduledAt: invite.scheduledAt,
    createdAt: Timestamp.now(),
  }
}

export async function writeMatchParticipationNotification(
  db: Firestore,
  invite: MatchParticipationInviteDoc & { id: string },
  kind: MatchParticipationNotificationKind,
  recipientUid: string,
): Promise<void> {
  const ref = doc(collection(db, 'users', recipientUid, 'notifications'))
  await setDoc(ref, payload(invite, kind, recipientUid))
}

export async function notifyMatchParticipationInviteReceived(
  db: Firestore,
  invite: MatchParticipationInviteDoc & { id: string },
  recipientUids: string[],
): Promise<void> {
  for (const uid of recipientUids) {
    if (uid === invite.createdBy) continue
    await writeMatchParticipationNotification(db, invite, 'invite_received', uid)
  }
}

export async function notifyMatchParticipationResolved(
  db: Firestore,
  invite: MatchParticipationInviteDoc & { id: string },
  kind: 'invite_accepted' | 'invite_rejected' | 'invite_expired',
): Promise<void> {
  await writeMatchParticipationNotification(db, invite, kind, invite.createdBy)
  const recipients = [invite.teamOwnerUid, ...(invite as { coOwners?: string[] }).coOwners ?? []]
  for (const uid of recipients) {
    if (uid === invite.createdBy) continue
    await writeMatchParticipationNotification(db, invite, kind, uid)
  }
}
