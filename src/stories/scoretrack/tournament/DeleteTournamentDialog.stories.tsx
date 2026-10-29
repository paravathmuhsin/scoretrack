import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { DeleteTournamentDialog } from '@/components/tournament/DeleteTournamentDialog'

const meta = {
  title: 'Scoretrack/Tournament/Delete Tournament Dialog',
  component: DeleteTournamentDialog,
  tags: ['autodocs'],
  args: {
    open: true,
    onClose: fn(),
    tournamentName: 'Summer Premier League',
    matchBullet: '12 scheduled or live matches',
    error: null,
    writePending: false,
    onConfirm: fn(),
  },
} satisfies Meta<typeof DeleteTournamentDialog>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
