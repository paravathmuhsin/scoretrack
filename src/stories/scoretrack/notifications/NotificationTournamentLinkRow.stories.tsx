import type { Meta, StoryObj } from '@storybook/react-vite'
import { NotificationTournamentLinkRow } from '@/components/NotificationTournamentLinkRow'
import { notificationFixtures } from '@/stories/fixtures/notifications'
import { withFirestoreSeed } from '@/stories/decorators/withFirestoreSeed'

const meta = {
  title: 'Scoretrack/Notifications/Tournament Link Row',
  component: NotificationTournamentLinkRow,
  tags: ['autodocs'],
  decorators: [withFirestoreSeed],
  args: {
    notificationId: 'n-tourn',
    uid: 'storybook-user',
    data: notificationFixtures.tournament_team_link,
  },
} satisfies Meta<typeof NotificationTournamentLinkRow>

export default meta
type Story = StoryObj<typeof meta>

export const LinkReceived: Story = {}
