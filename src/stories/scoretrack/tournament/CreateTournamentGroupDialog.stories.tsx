import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { CreateTournamentGroupDialog } from '@/components/tournament/CreateTournamentGroupDialog'
import { makeLinkedTeam } from '@/stories/fixtures/team'
import { withFirestoreSeed } from '@/stories/decorators/withFirestoreSeed'

const meta = {
  title: 'Scoretrack/Tournament/Create Group Dialog',
  component: CreateTournamentGroupDialog,
  tags: ['autodocs'],
  decorators: [withFirestoreSeed],
  args: {
    open: true,
    onClose: fn(),
    tournamentId: 'tournament-demo',
    linkedTeams: [makeLinkedTeam(), { ...makeLinkedTeam(), id: 'lt-2', teamName: 'Coastal Kings' }],
    writePending: false,
    run: async (fn) => fn(),
  },
} satisfies Meta<typeof CreateTournamentGroupDialog>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
