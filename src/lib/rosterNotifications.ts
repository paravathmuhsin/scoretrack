import {
  collection,
  doc,
  type Firestore,
  Timestamp,
  writeBatch,
} from 'firebase/firestore'
import type { RosterPlayer, TeamRosterNotification, UserNotificationDoc } from '../types/models'
import { isLikelyRegisteredUserId } from './teamOwnerIds'

type RemovedPlayerContext = {
  primaryOwnerUid: string
  teamId: string
  teamName: string
  actorUid: string
  actorDisplayName: string
  removedPlayers: RosterPlayer[]
}

function rosterPayload(
  partial: Omit<TeamRosterNotification, 'type' | 'createdAt'>,
): UserNotificationDoc {
  return {
    type: 'team_roster',
    createdAt: Timestamp.now(),
    ...partial,
  }
}

/** Notify registered users removed from the squad roster on save. */
export async function notifyPlayersRemovedFromTeam(
  db: Firestore,
  ctx: RemovedPlayerContext,
): Promise<void> {
  const batch = writeBatch(db)
  let count = 0
  for (const player of ctx.removedPlayers) {
    if (player.playerId === ctx.primaryOwnerUid) continue
    if (player.playerId === ctx.actorUid) continue
    if (!isLikelyRegisteredUserId(player.playerId)) continue
    const ref = doc(collection(db, 'users', player.playerId, 'notifications'))
    batch.set(
      ref,
      rosterPayload({
        kind: 'removed_from_team',
        teamId: ctx.teamId,
        teamName: ctx.teamName,
        primaryOwnerUid: ctx.primaryOwnerUid,
        actorUid: ctx.actorUid,
        actorDisplayName: ctx.actorDisplayName,
      }),
    )
    count += 1
  }
  if (count === 0) return
  await batch.commit()
}
