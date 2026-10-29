import type { Meta, StoryObj } from '@storybook/react-vite'
import { TournamentMvpTab } from '@/components/tournament/TournamentMvpTab'
import { makeStatsDoc } from '@/stories/fixtures/stats'
import { makeTournamentWithId } from '@/stories/fixtures/tournament'
import { withFirestoreSeed } from '@/stories/decorators/withFirestoreSeed'
import { withMockAuth } from '@/stories/decorators/withMockAuth'

const meta = {
  title: 'Scoretrack/Tournament/MVP Tab',
  component: TournamentMvpTab,
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
    publicListing: true,
  },
} satisfies Meta<typeof TournamentMvpTab>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
