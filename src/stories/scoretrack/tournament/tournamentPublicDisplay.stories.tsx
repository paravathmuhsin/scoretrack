import type { Meta, StoryObj } from '@storybook/react-vite'
import { MapPin } from 'lucide-react'
import {
  OverviewDetailRow,
  publicTournamentMatchHeadMeta,
  publicTournamentMatchKicker,
} from '@/components/tournament/tournamentPublicDisplay'
import { makeMatchDoc } from '@/stories/fixtures/match'

const meta = {
  title: 'Scoretrack/Tournament/Public Display Helpers',
  tags: ['autodocs'],
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const KickerLive: Story = {
  render: () => <span>{publicTournamentMatchKicker('live')}</span>,
}

export const HeadMeta: Story = {
  render: () => (
    <span>{publicTournamentMatchHeadMeta(makeMatchDoc({ tournamentFixtureLabel: 'League · Match 3 · North vs Coastal' }), 'Mumbai')}</span>
  ),
}

export const OverviewRow: Story = {
  render: () => (
    <OverviewDetailRow icon={MapPin} label="Venue">
      Wankhede Stadium, Mumbai
    </OverviewDetailRow>
  ),
}
