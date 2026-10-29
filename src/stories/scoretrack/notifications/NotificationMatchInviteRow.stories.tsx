import type { Meta, StoryObj } from '@storybook/react-vite'
import { NotificationMatchInviteRow } from '@/components/NotificationMatchInviteRow'
import { notificationFixtures } from '@/stories/fixtures/notifications'
import { withFirestoreSeed } from '@/stories/decorators/withFirestoreSeed'

const meta = {
  title: 'Scoretrack/Notifications/Match Invite Row',
  component: NotificationMatchInviteRow,
  tags: ['autodocs'],
  decorators: [withFirestoreSeed],
  args: {
    notificationId: 'n-match',
    uid: 'storybook-user',
    data: notificationFixtures.match_participation,
  },
} satisfies Meta<typeof NotificationMatchInviteRow>

export default meta
type Story = StoryObj<typeof meta>

export const InviteReceived: Story = {}
