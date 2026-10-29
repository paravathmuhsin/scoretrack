import type { Meta, StoryObj } from '@storybook/react-vite'
import { PublicUpcomingMatchCard } from '@/components/PublicUpcomingMatchCard'
import { makeMatchWithId } from '@/stories/fixtures/match'

const meta = {
  title: 'Scoretrack/Public/Upcoming Match Card',
  component: PublicUpcomingMatchCard,
  tags: ['autodocs'],
  args: { match: makeMatchWithId({ status: 'scheduled' }) },
} satisfies Meta<typeof PublicUpcomingMatchCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
