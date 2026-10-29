import type { Meta, StoryObj } from '@storybook/react-vite'
import { TournamentPointsPanel } from '@/components/TournamentPointsPanel'
import { makeStandingsDoc, makeTournamentDoc } from '@/stories/fixtures/tournament'
import { withFirestoreSeed } from '@/stories/decorators/withFirestoreSeed'
import { withMockAuth } from '@/stories/decorators/withMockAuth'

const meta = {
  title: 'Scoretrack/Tournament/Points Panel',
  component: TournamentPointsPanel,
  tags: ['autodocs'],
  decorators: [withMockAuth, withFirestoreSeed],
  parameters: {
    auth: { preset: 'signedIn' },
    firestoreSeed: {
      'tournaments/tournament-demo': makeTournamentDoc(),
      'tournaments/tournament-demo/standings/summary': makeStandingsDoc(),
    },
  },
  args: { tournamentId: 'tournament-demo', variant: 'embedded' },
} satisfies Meta<typeof TournamentPointsPanel>

export default meta
type Story = StoryObj<typeof meta>

export const Embedded: Story = {}

export const PublicVariant: Story = {
  args: { variant: 'public' },
}
