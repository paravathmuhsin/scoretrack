import { doc, Timestamp, updateDoc } from 'firebase/firestore'
import { getDb } from '../firebase/config'
import type { TeamRosterNotification } from '../types/models'
import { NotificationItemLayout } from './NotificationItemLayout'

type Props = {
  notificationId: string
  uid: string
  data: TeamRosterNotification
}

function messageFor(data: TeamRosterNotification): string {
  const actor = data.actorDisplayName?.trim() || 'Someone'
  const team = data.teamName
  if (data.kind === 'removed_from_team') {
    return `${actor} removed you from ${team}.`
  }
  return `Update for ${team}.`
}

export function NotificationRosterRow({ notificationId, uid, data }: Props) {
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
      <p className="text-sm leading-relaxed text-slate-800">{messageFor(data)}</p>
    </NotificationItemLayout>
  )
}
