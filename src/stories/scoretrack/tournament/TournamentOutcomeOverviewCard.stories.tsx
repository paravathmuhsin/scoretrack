import type { Meta, StoryObj } from '@storybook/react-vite'
import { TournamentOutcomeOverviewCard } from '@/components/tournament/TournamentOutcomeOverviewCard'
import { makeTournamentOutcome } from '@/stories/fixtures/tournament'

const meta = {
  title: 'Scoretrack/Tournament/Outcome Overview Card',
  component: TournamentOutcomeOverviewCard,
  tags: ['autodocs'],
  args: {
    outcome: makeTournamentOutcome(),
    teamLabel: (id: string) => (id === 'lt-1' ? 'North Stars' : 'Coastal Kings'),
  },
} satisfies Meta<typeof TournamentOutcomeOverviewCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
