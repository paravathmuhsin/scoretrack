import { doc, Timestamp, updateDoc } from 'firebase/firestore'
import { useState } from 'react'
import { toast } from 'sonner'
import { getDb } from '../firebase/config'
import {
  acceptOwnershipTransfer,
  rejectOwnershipTransfer,
} from '../lib/teamOwnershipTransfer'
import type { OwnershipTransferNotification } from '../types/models'
import { NotificationItemLayout } from './NotificationItemLayout'
import { Button } from '@/components/ui/button'

type Props = {
  notificationId: string
  uid: string
  data: OwnershipTransferNotification
  onAction?: () => void
}

function messageFor(data: OwnershipTransferNotification, recipientUid: string): string {
  const other = data.otherDisplayName?.trim() || 'Another player'
  const team = data.teamName
  switch (data.kind) {
    case 'transfer_sent':
      return `You sent an ownership request for ${team} to ${other}.`
    case 'transfer_received':
      return `${other} wants to transfer ownership of ${team} to you.`
    case 'transfer_accepted':
      return `Ownership of ${team} was transferred to ${other}.`
    case 'transfer_rejected':
      return `${other} rejected your ownership request for ${team}.`
    case 'transfer_expired':
      return `The ownership request for ${team} has expired.`
    case 'transfer_cancelled':
      if (data.actorUid) {
        return recipientUid === data.actorUid
          ? `You cancelled the ownership request for ${team}.`
          : `${other} cancelled the ownership request for ${team}.`
      }
      return `The ownership request for ${team} was cancelled.`
    default:
      return `Update for ${team}.`
  }
}

export function NotificationTransferRow({ notificationId, uid, data, onAction }: Props) {
  const [busy, setBusy] = useState(false)
  const showActions = data.kind === 'transfer_received' && !data.readAt
  const isUnread = !data.readAt

  async function markRead() {
    if (data.readAt) return
    await updateDoc(doc(getDb(), 'users', uid, 'notifications', notificationId), {
      readAt: Timestamp.now(),
    })
  }

  return (
    <NotificationItemLayout
      notificationId={notificationId}
      uid={uid}
      isUnread={isUnread}
      disabled={busy}
      onMarkRead={showActions ? undefined : markRead}
    >
      <p className="text-sm leading-relaxed text-slate-800">{messageFor(data, uid)}</p>
      {showActions ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            className="h-9 rounded-lg"
            disabled={busy}
            onClick={() => {
              void (async () => {
                setBusy(true)
                try {
                  await markRead()
                  await acceptOwnershipTransfer(getDb(), data.transferId, uid)
                  toast.success('You now own this team')
                  onAction?.()
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : 'Could not accept')
                } finally {
                  setBusy(false)
                }
              })()
            }}
          >
            Accept
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-9 rounded-lg"
            disabled={busy}
            onClick={() => {
              void (async () => {
                setBusy(true)
                try {
                  await markRead()
                  await rejectOwnershipTransfer(getDb(), data.transferId, uid)
                  toast.success('Request rejected')
                  onAction?.()
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : 'Could not reject')
                } finally {
                  setBusy(false)
                }
              })()
            }}
          >
            Reject
          </Button>
        </div>
      ) : null}
    </NotificationItemLayout>
  )
}
