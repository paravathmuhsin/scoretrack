import type { Meta, StoryObj } from '@storybook/react-vite'
import { NotificationCoOwnerRow } from '@/components/NotificationCoOwnerRow'
import { notificationFixtures } from '@/stories/fixtures/notifications'
import { withFirestoreSeed } from '@/stories/decorators/withFirestoreSeed'

const meta = {
  title: 'Scoretrack/Notifications/Co-Owner Row',
  component: NotificationCoOwnerRow,
  tags: ['autodocs'],
  decorators: [withFirestoreSeed],
  args: {
    notificationId: 'n-co',
    uid: 'storybook-user',
    data: notificationFixtures.team_co_owner,
  },
} satisfies Meta<typeof NotificationCoOwnerRow>

export default meta
type Story = StoryObj<typeof meta>

export const Assigned: Story = {}
