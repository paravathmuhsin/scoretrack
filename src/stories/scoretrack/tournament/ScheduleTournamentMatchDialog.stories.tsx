import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { ScheduleTournamentMatchDialog } from '@/components/tournament/ScheduleTournamentMatchDialog'
import { makeLinkedTeam, makeTeamDoc } from '@/stories/fixtures/team'
import { makeTournamentWithId } from '@/stories/fixtures/tournament'
import { withFirestoreSeed } from '@/stories/decorators/withFirestoreSeed'

const meta = {
  title: 'Scoretrack/Tournament/Schedule Match Dialog',
  component: ScheduleTournamentMatchDialog,
  tags: ['autodocs'],
  decorators: [withFirestoreSeed],
  parameters: { firestoreSeed: {} },
  args: {
    open: true,
    onClose: fn(),
    openNonce: 1,
    tournamentId: 'tournament-demo',
    tournament: makeTournamentWithId(),
    linkedTeams: [makeLinkedTeam()],
    myTeams: [{ id: 'team-1', ...makeTeamDoc() }],
    organiserUid: 'demo-user',
    writePending: false,
    run: async (fn) => fn(),
    onGoToGroupsTab: fn(),
  },
} satisfies Meta<typeof ScheduleTournamentMatchDialog>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
