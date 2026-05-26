import { doc, Timestamp, updateDoc } from 'firebase/firestore'
import { useState } from 'react'
import { toast } from 'sonner'
import { getDb } from '../firebase/config'
import {
  acceptMatchParticipation,
  rejectMatchParticipation,
} from '../lib/matchParticipationInvite'
import type { MatchParticipationNotification } from '../types/models'
import { NotificationItemLayout } from './NotificationItemLayout'
import { Button } from '@/components/ui/button'

type Props = {
  notificationId: string
  uid: string
  data: MatchParticipationNotification
  onAction?: () => void
}

function messageFor(data: MatchParticipationNotification): string {
  const other = data.otherDisplayName?.trim() || 'Another player'
  const team = data.teamName
  const side = data.side === 'home' ? 'home' : 'away'
  switch (data.kind) {
    case 'invite_received':
      return `${other} invited ${team} to play as the ${side} team in a friendly match.`
    case 'invite_accepted':
      return `${team} accepted the match invitation.`
    case 'invite_rejected':
      return `${team} declined the match invitation.`
    case 'invite_expired':
      return `The match invitation for ${team} expired (no response before kickoff).`
    default:
      return `Match update for ${team}.`
  }
}

export function NotificationMatchInviteRow({ notificationId, uid, data, onAction }: Props) {
  const [busy, setBusy] = useState(false)
  const showActions = data.kind === 'invite_received' && !data.readAt
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
      <p className="text-sm leading-relaxed text-slate-800">{messageFor(data)}</p>
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
                  await acceptMatchParticipation(getDb(), data.inviteId, uid)
                  toast.success('Match accepted')
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
                  await rejectMatchParticipation(getDb(), data.inviteId, uid)
                  toast.success('Invitation declined')
                  onAction?.()
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : 'Could not decline')
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
