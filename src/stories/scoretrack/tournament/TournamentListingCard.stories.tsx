import type { Meta, StoryObj } from '@storybook/react-vite'
import { TournamentListingCard } from '@/components/TournamentListingCard'
import { makeTournamentWithId } from '@/stories/fixtures/tournament'

const meta = {
  title: 'Scoretrack/Tournament/Listing Card',
  component: TournamentListingCard,
  tags: ['autodocs'],
  args: {
    t: makeTournamentWithId(),
    to: '/tournaments/tournament-demo',
    metaRight: '8 teams · Public',
  },
} satisfies Meta<typeof TournamentListingCard>

export default meta
type Story = StoryObj<typeof meta>

export const Upcoming: Story = {}
