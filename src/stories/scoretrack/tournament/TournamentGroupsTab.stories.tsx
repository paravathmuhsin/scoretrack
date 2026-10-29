import type { Meta, StoryObj } from '@storybook/react-vite'
import { TournamentGroupsTab } from '@/components/tournament/TournamentGroupsTab'
import { makeLinkedTeam } from '@/stories/fixtures/team'
import { withFirestoreSeed } from '@/stories/decorators/withFirestoreSeed'

const meta = {
  title: 'Scoretrack/Tournament/Groups Tab',
  component: TournamentGroupsTab,
  tags: ['autodocs'],
  decorators: [withFirestoreSeed],
  parameters: {
    firestoreSeed: {
      'tournaments/tournament-demo/groups/g1': { name: 'Pool A', teamIds: ['lt-1'] },
    },
  },
  args: {
    tournamentId: 'tournament-demo',
    linkedTeams: [makeLinkedTeam()],
    writePending: false,
    run: async (fn) => fn(),
  },
} satisfies Meta<typeof TournamentGroupsTab>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
