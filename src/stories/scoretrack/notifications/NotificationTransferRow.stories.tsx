import type { Meta, StoryObj } from '@storybook/react-vite'
import { NotificationTransferRow } from '@/components/NotificationTransferRow'
import { notificationFixtures } from '@/stories/fixtures/notifications'
import { withFirestoreSeed } from '@/stories/decorators/withFirestoreSeed'

const meta = {
  title: 'Scoretrack/Notifications/Transfer Row',
  component: NotificationTransferRow,
  tags: ['autodocs'],
  decorators: [withFirestoreSeed],
  args: {
    notificationId: 'n-transfer',
    uid: 'storybook-user',
    data: notificationFixtures.ownership_transfer,
  },
} satisfies Meta<typeof NotificationTransferRow>

export default meta
type Story = StoryObj<typeof meta>

export const Received: Story = {}
