import type { Meta, StoryObj } from '@storybook/react-vite'
import { DraftPlayerRoleMarkers, PlayerRoleMarkers } from '@/components/PlayerRoleMarkers'
import { makeMatchDoc } from '@/stories/fixtures/match'

const match = makeMatchDoc()

const meta = {
  title: 'Scoretrack/Match/Player Role Markers',
  tags: ['autodocs'],
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const FromMatch: Story = {
  render: () => (
    <span className="inline-flex items-center gap-1">
      Alex Kohli <PlayerRoleMarkers match={match} side="home" playerId="home-1" />
    </span>
  ),
}

export const Draft: Story = {
  render: () => (
    <span className="inline-flex items-center gap-1">
      Jordan Patel <DraftPlayerRoleMarkers playerId="home-2" captainId="home-1" keeperId="home-2" />
    </span>
  ),
}
