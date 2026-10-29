import type { Meta, StoryObj } from '@storybook/react-vite'
import { NotificationRosterRow } from '@/components/NotificationRosterRow'
import { notificationFixtures } from '@/stories/fixtures/notifications'
import { withFirestoreSeed } from '@/stories/decorators/withFirestoreSeed'

const meta = {
  title: 'Scoretrack/Notifications/Roster Row',
  component: NotificationRosterRow,
  tags: ['autodocs'],
  decorators: [withFirestoreSeed],
  args: {
    notificationId: 'n-roster',
    uid: 'storybook-user',
    data: notificationFixtures.team_roster,
  },
} satisfies Meta<typeof NotificationRosterRow>

export default meta
type Story = StoryObj<typeof meta>

export const Removed: Story = {}
