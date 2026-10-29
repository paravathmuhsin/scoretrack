import type { Meta, StoryObj } from '@storybook/react-vite'
import { ObsMatchSummaryCard } from '@/components/ObsMatchSummaryCard'
import { makeObsProps } from '@/stories/fixtures/scoring'

const meta = {
  title: 'Scoretrack/OBS/Match Summary Card',
  component: ObsMatchSummaryCard,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  args: { ...makeObsProps(), previewPlaceholder: true },
} satisfies Meta<typeof ObsMatchSummaryCard>

export default meta
type Story = StoryObj<typeof meta>

export const Preview: Story = {}

export const Complete: Story = {
  args: {
    previewPlaceholder: false,
    state: { ...makeObsProps().state, matchComplete: true, resultText: 'North Stars won by 5 wickets', winner: 'home' },
  },
}
