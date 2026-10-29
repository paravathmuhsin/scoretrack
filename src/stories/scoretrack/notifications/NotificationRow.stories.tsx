import type { Meta, StoryObj } from '@storybook/react-vite'
import { NotificationRow } from '@/components/NotificationRow'
import { notificationFixtures } from '@/stories/fixtures/notifications'
import { withFirestoreSeed } from '@/stories/decorators/withFirestoreSeed'
import { withMockAuth } from '@/stories/decorators/withMockAuth'

const meta = {
  title: 'Scoretrack/Notifications/Notification Row',
  component: NotificationRow,
  tags: ['autodocs'],
  decorators: [withMockAuth, withFirestoreSeed],
  parameters: { auth: { preset: 'signedIn' } },
  args: {
    notificationId: 'n-1',
    uid: 'storybook-user',
  },
} satisfies Meta<typeof NotificationRow>

export default meta
type Story = StoryObj<typeof meta>

export const OwnershipTransfer: Story = {
  args: { data: notificationFixtures.ownership_transfer },
}

export const MatchParticipation: Story = {
  args: { data: notificationFixtures.match_participation },
}
