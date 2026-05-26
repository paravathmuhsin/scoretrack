import { NotificationCoOwnerRow } from './NotificationCoOwnerRow'
import { NotificationMatchInviteRow } from './NotificationMatchInviteRow'
import { NotificationRosterRow } from './NotificationRosterRow'
import { NotificationTournamentLinkRow } from './NotificationTournamentLinkRow'
import { NotificationTransferRow } from './NotificationTransferRow'
import type { UserNotificationDoc } from '../types/models'

type Props = {
  notificationId: string
  uid: string
  data: UserNotificationDoc
}

export function NotificationRow({ notificationId, uid, data }: Props) {
  if (data.type === 'ownership_transfer') {
    return (
      <NotificationTransferRow notificationId={notificationId} uid={uid} data={data} />
    )
  }
  if (data.type === 'team_roster') {
    return <NotificationRosterRow notificationId={notificationId} uid={uid} data={data} />
  }
  if (data.type === 'match_participation') {
    return <NotificationMatchInviteRow notificationId={notificationId} uid={uid} data={data} />
  }
  if (data.type === 'tournament_team_link') {
    return <NotificationTournamentLinkRow notificationId={notificationId} uid={uid} data={data} />
  }
  return <NotificationCoOwnerRow notificationId={notificationId} uid={uid} data={data} />
}
