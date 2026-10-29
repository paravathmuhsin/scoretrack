import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { EndTournamentDialog } from '@/components/tournament/EndTournamentDialog'
import { makeStatsDoc } from '@/stories/fixtures/stats'

const meta = {
  title: 'Scoretrack/Tournament/End Tournament Dialog',
  component: EndTournamentDialog,
  tags: ['autodocs'],
  args: {
    open: true,
    onClose: fn(),
    tournamentName: 'Summer Premier League',
    teamOptions: [
      { id: 'lt-1', label: 'North Stars' },
      { id: 'lt-2', label: 'Coastal Kings' },
    ],
    statsPlayers: makeStatsDoc().players,
    potKeySep: '|',
    winnerId: 'lt-1',
    onWinnerChange: fn(),
    runnerId: 'lt-2',
    onRunnerChange: fn(),
    potKey: 'home-1|lt-1',
    onPotKeyChange: fn(),
    error: null,
    writePending: false,
    onSubmit: fn(),
  },
} satisfies Meta<typeof EndTournamentDialog>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
