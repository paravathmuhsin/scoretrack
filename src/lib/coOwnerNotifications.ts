import {
  collection,
  doc,
  type Firestore,
  Timestamp,
  writeBatch,
} from 'firebase/firestore'
import type { TeamCoOwnerNotification, UserNotificationDoc } from '../types/models'
import { isLikelyRegisteredUserId } from './teamOwnerIds'

type CoOwnerNotifyContext = {
  primaryOwnerUid: string
  teamId: string
  teamName: string
  primaryDisplayName: string
  previousOwnerIds: string[]
  nextOwnerIds: string[]
  /** uid -> displayName for newly assigned co-owners */
  newCoOwnerNames: Record<string, string>
}

function coOwnerPayload(
  partial: Omit<TeamCoOwnerNotification, 'type' | 'createdAt'>,
): UserNotificationDoc {
  return {
    type: 'team_co_owner',
    createdAt: Timestamp.now(),
    ...partial,
  }
}

function appendNotification(
  batch: ReturnType<typeof writeBatch>,
  db: Firestore,
  recipientUid: string,
  payload: UserNotificationDoc,
): void {
  const ref = doc(collection(db, 'users', recipientUid, 'notifications'))
  batch.set(ref, payload)
}

/** Notify each newly added co-owner (after team doc lists them in ownerIds). */
export function appendCoOwnerAssignedNotifications(
  batch: ReturnType<typeof writeBatch>,
  db: Firestore,
  ctx: Pick<
    CoOwnerNotifyContext,
    'primaryOwnerUid' | 'teamId' | 'teamName' | 'primaryDisplayName' | 'newCoOwnerNames'
  >,
): void {
  for (const coOwnerUid of Object.keys(ctx.newCoOwnerNames)) {
    appendNotification(batch, db, coOwnerUid, coOwnerPayload({
      kind: 'co_owner_assigned',
      teamId: ctx.teamId,
      teamName: ctx.teamName,
      primaryOwnerUid: ctx.primaryOwnerUid,
      otherUid: ctx.primaryOwnerUid,
      otherDisplayName: ctx.primaryDisplayName,
    }))
  }
}

function coOwnerLeftPayload(
  ctx: {
    primaryOwnerUid: string
    teamId: string
    teamName: string
    coOwnerUid: string
    coOwnerDisplayName: string
  },
): UserNotificationDoc {
  return coOwnerPayload({
    kind: 'co_owner_left',
    teamId: ctx.teamId,
    teamName: ctx.teamName,
    primaryOwnerUid: ctx.primaryOwnerUid,
    otherUid: ctx.coOwnerUid,
    otherDisplayName: ctx.coOwnerDisplayName,
  })
}

/** Notify primary owner and the co-owner who left. */
export function appendCoOwnerLeftNotifications(
  batch: ReturnType<typeof writeBatch>,
  db: Firestore,
  ctx: {
    primaryOwnerUid: string
    teamId: string
    teamName: string
    coOwnerUid: string
    coOwnerDisplayName: string
    primaryDisplayName: string
  },
): void {
  const payload = coOwnerLeftPayload(ctx)
  appendNotification(batch, db, ctx.primaryOwnerUid, payload)
  appendNotification(batch, db, ctx.coOwnerUid, payload)
}

export function appendCoOwnerRemovedNotifications(
  batch: ReturnType<typeof writeBatch>,
  db: Firestore,
  ctx: Pick<
    CoOwnerNotifyContext,
    'primaryOwnerUid' | 'teamId' | 'teamName' | 'primaryDisplayName' | 'newCoOwnerNames'
  >,
): void {
  for (const coOwnerUid of Object.keys(ctx.newCoOwnerNames)) {
    if (!isLikelyRegisteredUserId(coOwnerUid)) continue
    appendNotification(batch, db, coOwnerUid, coOwnerPayload({
      kind: 'co_owner_removed',
      teamId: ctx.teamId,
      teamName: ctx.teamName,
      primaryOwnerUid: ctx.primaryOwnerUid,
      otherUid: ctx.primaryOwnerUid,
      otherDisplayName: ctx.primaryDisplayName,
    }))
  }
}

export async function notifyNewCoOwners(
  db: Firestore,
  ctx: CoOwnerNotifyContext,
): Promise<void> {
  const prev = new Set(ctx.previousOwnerIds)
  const added = ctx.nextOwnerIds.filter((id) => !prev.has(id))
  if (added.length === 0) return

  const newCoOwnerNames: Record<string, string> = {}
  for (const id of added) {
    const name = ctx.newCoOwnerNames[id]?.trim()
    if (name) newCoOwnerNames[id] = name
  }
  if (Object.keys(newCoOwnerNames).length === 0) return

  const batch = writeBatch(db)
  appendCoOwnerAssignedNotifications(batch, db, {
    primaryOwnerUid: ctx.primaryOwnerUid,
    teamId: ctx.teamId,
    teamName: ctx.teamName,
    primaryDisplayName: ctx.primaryDisplayName,
    newCoOwnerNames,
  })
  await batch.commit()
}

/** Notify co-owners removed by the primary owner on save. */
export async function notifyRemovedCoOwners(
  db: Firestore,
  ctx: CoOwnerNotifyContext,
): Promise<void> {
  const next = new Set(ctx.nextOwnerIds)
  const removed = ctx.previousOwnerIds.filter((id) => !next.has(id))
  if (removed.length === 0) return

  const removedCoOwnerNames: Record<string, string> = {}
  for (const id of removed) {
    if (!isLikelyRegisteredUserId(id)) continue
    const name = ctx.newCoOwnerNames[id]?.trim()
    if (name) removedCoOwnerNames[id] = name
  }
  if (Object.keys(removedCoOwnerNames).length === 0) return

  const batch = writeBatch(db)
  appendCoOwnerRemovedNotifications(batch, db, {
    primaryOwnerUid: ctx.primaryOwnerUid,
    teamId: ctx.teamId,
    teamName: ctx.teamName,
    primaryDisplayName: ctx.primaryDisplayName,
    newCoOwnerNames: removedCoOwnerNames,
  })
  await batch.commit()
}
