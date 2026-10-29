import type { Meta, StoryObj } from '@storybook/react-vite'
import { ObsBowlingScorecard } from '@/components/ObsBowlingScorecard'
import { makeObsProps } from '@/stories/fixtures/scoring'

const meta = {
  title: 'Scoretrack/OBS/Bowling Scorecard',
  component: ObsBowlingScorecard,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  args: makeObsProps(),
} satisfies Meta<typeof ObsBowlingScorecard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
