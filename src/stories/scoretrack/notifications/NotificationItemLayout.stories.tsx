import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { NotificationItemLayout } from '@/components/NotificationItemLayout'
import { withFirestoreSeed } from '@/stories/decorators/withFirestoreSeed'

const meta = {
  title: 'Scoretrack/Notifications/Item Layout',
  component: NotificationItemLayout,
  tags: ['autodocs'],
  decorators: [withFirestoreSeed],
  args: {
    notificationId: 'n-1',
    uid: 'storybook-user',
    isUnread: true,
    onMarkRead: fn(),
    children: <p className="text-sm">You were added to squad North Stars.</p>,
  },
} satisfies Meta<typeof NotificationItemLayout>

export default meta
type Story = StoryObj<typeof meta>

export const Unread: Story = {}

export const Read: Story = {
  args: { isUnread: false, onMarkRead: undefined },
}
