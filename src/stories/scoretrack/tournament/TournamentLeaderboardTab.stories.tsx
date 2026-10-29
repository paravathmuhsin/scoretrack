import type { Meta, StoryObj } from '@storybook/react-vite'
import { TournamentLeaderboardTab } from '@/components/tournament/TournamentLeaderboardTab'
import { makeStatsDoc } from '@/stories/fixtures/stats'
import { makeTournamentWithId } from '@/stories/fixtures/tournament'
import { withFirestoreSeed } from '@/stories/decorators/withFirestoreSeed'
import { withMockAuth } from '@/stories/decorators/withMockAuth'

const meta = {
  title: 'Scoretrack/Tournament/Leaderboard Tab',
  component: TournamentLeaderboardTab,
  tags: ['autodocs'],
  decorators: [withMockAuth, withFirestoreSeed],
  parameters: {
    auth: { preset: 'signedIn' },
    firestoreSeed: {
      'tournaments/tournament-demo/stats/summary': makeStatsDoc(),
    },
  },
  args: {
    tournamentId: 'tournament-demo',
    tournament: makeTournamentWithId(),
    teamLabel: (id: string) => id,
    publicListing: true,
  },
} satisfies Meta<typeof TournamentLeaderboardTab>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
