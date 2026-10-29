import type { Meta, StoryObj } from '@storybook/react-vite'
import { PublicTournamentMatchScoreLines } from '@/components/PublicTournamentMatchScoreLines'
import { makeMatchWithId } from '@/stories/fixtures/match'
import { withFirestoreSeed } from '@/stories/decorators/withFirestoreSeed'

const meta = {
  title: 'Scoretrack/Public/Tournament Match Score Lines',
  component: PublicTournamentMatchScoreLines,
  tags: ['autodocs'],
  decorators: [withFirestoreSeed],
  parameters: { firestoreSeed: {} },
  args: { match: makeMatchWithId({ status: 'live' }) },
} satisfies Meta<typeof PublicTournamentMatchScoreLines>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
