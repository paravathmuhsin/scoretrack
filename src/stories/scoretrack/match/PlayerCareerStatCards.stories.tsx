import type { Meta, StoryObj } from '@storybook/react-vite'
import { PlayerCareerStatCards } from '@/components/PlayerCareerStatCards'

const career = {
  matchesPlayed: 24,
  battingInnings: 22,
  battingDismissals: 18,
  runs: 640,
  notOuts: 4,
  fours: 52,
  sixes: 14,
  wickets: 8,
  ballsBowled: 360,
  runsConceded: 420,
  fieldingDismissals: 6,
  captainMatches: 5,
  captainWins: 3,
}

const meta = {
  title: 'Scoretrack/Match/Player Career Stat Cards',
  component: PlayerCareerStatCards,
  tags: ['autodocs'],
  args: { career, layout: 'public' },
} satisfies Meta<typeof PlayerCareerStatCards>

export default meta
type Story = StoryObj<typeof meta>

export const Public: Story = {}

export const AppLayout: Story = {
  args: { layout: 'app' },
}
