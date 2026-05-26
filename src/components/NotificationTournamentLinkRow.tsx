import { doc, Timestamp, updateDoc } from 'firebase/firestore'
import { useState } from 'react'
import { toast } from 'sonner'
import { getDb } from '../firebase/config'
import {
  acceptTournamentTeamLink,
  rejectTournamentTeamLink,
} from '../lib/tournamentTeamLinkInvite'
import type { TournamentTeamLinkNotification } from '../types/models'
import { NotificationItemLayout } from './NotificationItemLayout'
import { Button } from '@/components/ui/button'

type Props = {
  notificationId: string
  uid: string
  data: TournamentTeamLinkNotification
  onAction?: () => void
}

function messageFor(data: TournamentTeamLinkNotification): string {
  const other = data.otherDisplayName?.trim() || 'Tournament organiser'
  const team = data.teamName
  switch (data.kind) {
    case 'link_received':
      return `${other} wants to add ${team} to tournament “${data.tournamentName}”.`
    case 'link_accepted':
      return `${team} was added to “${data.tournamentName}”.`
    case 'link_rejected':
      return `${team} declined to join “${data.tournamentName}”.`
    case 'link_expired':
      return `The request to add ${team} to “${data.tournamentName}” expired.`
    default:
      return `Tournament update for ${team}.`
  }
}

export function NotificationTournamentLinkRow({ notificationId, uid, data, onAction }: Props) {
  const [busy, setBusy] = useState(false)
  const showActions = data.kind === 'link_received' && !data.readAt
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
                  await acceptTournamentTeamLink(getDb(), data.inviteId, uid)
                  toast.success('Tournament link accepted')
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
                  await rejectTournamentTeamLink(getDb(), data.inviteId, uid)
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
