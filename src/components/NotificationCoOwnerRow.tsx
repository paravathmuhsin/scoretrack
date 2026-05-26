import { doc, Timestamp, updateDoc } from 'firebase/firestore'
import { getDb } from '../firebase/config'
import type { TeamCoOwnerNotification } from '../types/models'
import { NotificationItemLayout } from './NotificationItemLayout'

type Props = {
  notificationId: string
  uid: string
  data: TeamCoOwnerNotification
}

function messageFor(data: TeamCoOwnerNotification, recipientUid: string): string {
  const other = data.otherDisplayName?.trim() || 'Another player'
  const team = data.teamName
  if (data.kind === 'co_owner_assigned') {
    return `${other} made you a co-owner of ${team}. You can edit the squad and use it in matches.`
  }
  if (data.kind === 'co_owner_left') {
    if (recipientUid === data.primaryOwnerUid) {
      return `${other} removed their co-ownership of ${team}.`
    }
    return `You removed your co-ownership of ${team}.`
  }
  if (data.kind === 'co_owner_removed') {
    return `${other} removed your co-ownership of ${team}.`
  }
  return `Update for ${team}.`
}

export function NotificationCoOwnerRow({ notificationId, uid, data }: Props) {
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
      onMarkRead={markRead}
    >
      <p className="text-sm leading-relaxed text-slate-800">{messageFor(data, uid)}</p>
    </NotificationItemLayout>
  )
}
