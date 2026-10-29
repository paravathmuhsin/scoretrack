import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { SquadPickTile, SquadSummaryTile } from '@/components/PlayingSquadTiles'

const meta = {
  title: 'Scoretrack/Match/Playing Squad Tiles',
  tags: ['autodocs'],
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const PickTile: Story = {
  render: () => (
    <SquadPickTile name="Alex Kohli" selected={false} onToggle={fn()} />
  ),
}

export const SummaryTile: Story = {
  render: () => <SquadSummaryTile name="Jordan Patel" onRemove={fn()} />,
}
