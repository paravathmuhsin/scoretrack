import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { AddPlayersModal } from '@/components/AddPlayersModal'
import { makeTeamDoc } from '@/stories/fixtures/team'

const meta = {
  title: 'Scoretrack/Forms/Add Players Modal',
  component: AddPlayersModal,
  tags: ['autodocs'],
  args: {
    open: true,
    onClose: fn(),
    roster: makeTeamDoc().players,
    onAddPlayers: fn(),
    maxRosterSize: 15,
  },
} satisfies Meta<typeof AddPlayersModal>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
