import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { TournamentTeamsTab } from '@/components/tournament/TournamentTeamsTab'
import { makeLinkedTeam, makeTeamDoc } from '@/stories/fixtures/team'

const meta = {
  title: 'Scoretrack/Tournament/Teams Tab',
  component: TournamentTeamsTab,
  tags: ['autodocs'],
  args: {
    tournamentEnded: false,
    teamCount: 8,
    linkedTeams: [makeLinkedTeam()],
    myTeams: [{ id: 'team-1', ...makeTeamDoc() }],
    currentUserUid: 'demo-user',
    writePending: false,
    error: null,
    onAddSquad: fn(),
    onRemoveSquad: fn(),
  },
} satisfies Meta<typeof TournamentTeamsTab>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
