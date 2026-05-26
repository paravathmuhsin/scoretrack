import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  type Firestore,
  setDoc,
  Timestamp,
  where,
  writeBatch,
} from 'firebase/firestore'
import type {
  OwnershipTransferNotification,
  OwnershipTransferNotificationKind,
  TeamOwnershipTransferDoc,
} from '../types/models'

const TRANSFER_RECEIVED = 'transfer_received' satisfies OwnershipTransferNotificationKind

function notificationPayload(
  transfer: TeamOwnershipTransferDoc & { id: string },
  kind: OwnershipTransferNotificationKind,
  recipientUid: string,
): OwnershipTransferNotification {
  const isSender = recipientUid === transfer.fromUid
  const otherUid = isSender ? transfer.toUid : transfer.fromUid
  const otherDisplayName = isSender ? transfer.toDisplayName : transfer.fromDisplayName
  return {
    type: 'ownership_transfer',
    kind,
    transferId: transfer.id,
    teamId: transfer.teamId,
    teamName: transfer.teamName,
    otherUid,
    ...(otherDisplayName ? { otherDisplayName } : {}),
    ...(kind === 'transfer_cancelled' ? { actorUid: transfer.fromUid } : {}),
    createdAt: Timestamp.now(),
  }
}

export async function deleteTransferReceivedNotifications(
  db: Firestore,
  transferId: string,
  recipientUid: string,
): Promise<void> {
  const qy = query(
    collection(db, 'users', recipientUid, 'notifications'),
    where('transferId', '==', transferId),
    where('kind', '==', TRANSFER_RECEIVED),
  )
  const snap = await getDocs(qy)
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)))
}

type TransferNotificationEvent = 'sent' | 'accepted' | 'rejected' | 'expired' | 'cancelled'

function recipientsForEvent(
  transfer: TeamOwnershipTransferDoc & { id: string },
  event: TransferNotificationEvent,
): { uid: string; kind: OwnershipTransferNotificationKind }[] {
  switch (event) {
    case 'sent':
      return [{ uid: transfer.toUid, kind: 'transfer_received' }]
    case 'accepted':
      return [
        { uid: transfer.fromUid, kind: 'transfer_accepted' },
        { uid: transfer.toUid, kind: 'transfer_accepted' },
      ]
    case 'rejected':
      return [{ uid: transfer.fromUid, kind: 'transfer_rejected' }]
    case 'expired':
      return [
        { uid: transfer.fromUid, kind: 'transfer_expired' },
        { uid: transfer.toUid, kind: 'transfer_expired' },
      ]
    case 'cancelled':
      return [
        { uid: transfer.fromUid, kind: 'transfer_cancelled' },
        { uid: transfer.toUid, kind: 'transfer_cancelled' },
      ]
  }
}

/** Write lifecycle notifications one doc at a time (avoids batch + rules visibility issues). */
export async function writeTransferNotifications(
  db: Firestore,
  transfer: TeamOwnershipTransferDoc & { id: string },
  event: TransferNotificationEvent,
): Promise<void> {
  for (const { uid, kind } of recipientsForEvent(transfer, event)) {
    const ref = doc(collection(db, 'users', uid, 'notifications'))
    await setDoc(ref, notificationPayload(transfer, kind, uid))
  }
}

/** Append notification docs for both parties per lifecycle event. */
export function appendTransferNotifications(
  batch: ReturnType<typeof writeBatch>,
  db: Firestore,
  transfer: TeamOwnershipTransferDoc & { id: string },
  event: TransferNotificationEvent,
): void {
  for (const { uid, kind } of recipientsForEvent(transfer, event)) {
    const ref = doc(collection(db, 'users', uid, 'notifications'))
    batch.set(ref, notificationPayload(transfer, kind, uid))
  }
}
