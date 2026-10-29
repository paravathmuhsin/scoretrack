import type { Meta, StoryObj } from '@storybook/react-vite'
import { MatchScorecard } from '@/components/MatchScorecard'
import { makeReplayConfig, makeReplayState } from '@/stories/fixtures/scoring'

const cfg = makeReplayConfig()
const state = makeReplayState()

const meta = {
  title: 'Scoretrack/Match/Match Scorecard',
  component: MatchScorecard,
  tags: ['autodocs'],
  args: {
    homeName: cfg.homeName!,
    awayName: cfg.awayName!,
    cfg,
    state,
    headerMode: 'live' as const,
    listingLayout: true,
    headerMetaRight: 'Summer Premier League',
    listingLiveFooter: 'North Stars need 24 runs from 18 balls',
  },
} satisfies Meta<typeof MatchScorecard>

export default meta
type Story = StoryObj<typeof meta>

export const LiveListing: Story = {}

export const Completed: Story = {
  args: {
    headerMode: 'result',
    resultSummaryText: 'North Stars won by 5 wickets',
  },
}
