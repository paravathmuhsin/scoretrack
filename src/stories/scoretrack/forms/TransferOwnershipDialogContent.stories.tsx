import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { TransferOwnershipDialogContent } from '@/components/TransferOwnershipDialogContent'

const meta = {
  title: 'Scoretrack/Forms/Transfer Ownership Dialog',
  component: TransferOwnershipDialogContent,
  tags: ['autodocs'],
  args: {
    teamName: 'North Stars',
    currentUserUid: 'demo-user',
    busy: false,
    onClose: fn(),
    onConfirm: fn(),
  },
} satisfies Meta<typeof TransferOwnershipDialogContent>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
