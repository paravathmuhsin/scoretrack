import { collection, doc, setDoc, Timestamp, type Firestore } from 'firebase/firestore'
import type {
  TournamentTeamLinkInviteDoc,
  TournamentTeamLinkNotification,
  TournamentTeamLinkNotificationKind,
} from '../types/models'

function payload(
  invite: TournamentTeamLinkInviteDoc & { id: string },
  kind: TournamentTeamLinkNotificationKind,
  recipientUid: string,
): TournamentTeamLinkNotification {
  const isOrganiser = recipientUid === invite.createdBy
  return {
    type: 'tournament_team_link',
    kind,
    inviteId: invite.id,
    tournamentId: invite.tournamentId,
    tournamentName: invite.tournamentName,
    linkedTeamId: invite.linkedTeamId,
    teamId: invite.teamId,
    teamName: invite.teamName,
    teamNumber: invite.teamNumber,
    otherUid: isOrganiser ? invite.teamOwnerUid : invite.createdBy,
    otherDisplayName: isOrganiser ? undefined : invite.organiserDisplayName,
    createdAt: Timestamp.now(),
  }
}

export async function writeTournamentTeamLinkNotification(
  db: Firestore,
  invite: TournamentTeamLinkInviteDoc & { id: string },
  kind: TournamentTeamLinkNotificationKind,
  recipientUid: string,
): Promise<void> {
  const ref = doc(collection(db, 'users', recipientUid, 'notifications'))
  await setDoc(ref, payload(invite, kind, recipientUid))
}

export async function notifyTournamentLinkInviteReceived(
  db: Firestore,
  invite: TournamentTeamLinkInviteDoc & { id: string },
  recipientUids: string[],
): Promise<void> {
  for (const uid of recipientUids) {
    if (uid === invite.createdBy) continue
    await writeTournamentTeamLinkNotification(db, invite, 'link_received', uid)
  }
}

export async function notifyTournamentLinkResolved(
  db: Firestore,
  invite: TournamentTeamLinkInviteDoc & { id: string },
  kind: 'link_accepted' | 'link_rejected' | 'link_expired',
): Promise<void> {
  await writeTournamentTeamLinkNotification(db, invite, kind, invite.createdBy)
}
