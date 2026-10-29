import type { Meta, StoryObj } from '@storybook/react-vite'
import { LiveMatchListCard } from '@/components/LiveMatchListCard'
import { makeMatchWithId } from '@/stories/fixtures/match'
import { withFirestoreSeed } from '@/stories/decorators/withFirestoreSeed'

const meta = {
  title: 'Scoretrack/Match/Live Match List Card',
  component: LiveMatchListCard,
  tags: ['autodocs'],
  decorators: [withFirestoreSeed],
  parameters: {
    firestoreSeed: {},
    layout: 'padded',
  },
} satisfies Meta<typeof LiveMatchListCard>

export default meta
type Story = StoryObj<typeof meta>

export const Live: Story = {
  args: {
    match: makeMatchWithId({ status: 'live' }),
    replayMode: 'off',
  },
}

export const Completed: Story = {
  args: {
    match: makeMatchWithId({
      status: 'completed',
      resultSummary: { winnerSide: 'home', text: 'North Stars won by 5 wickets', pointsOutcome: 'home_win' },
    }),
    replayMode: 'completed',
  },
}
