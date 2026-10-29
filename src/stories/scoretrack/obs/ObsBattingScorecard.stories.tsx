import type { Meta, StoryObj } from '@storybook/react-vite'
import { ObsBattingScorecard } from '@/components/ObsBattingScorecard'
import { makeObsProps } from '@/stories/fixtures/scoring'

const meta = {
  title: 'Scoretrack/OBS/Batting Scorecard',
  component: ObsBattingScorecard,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  args: makeObsProps(),
} satisfies Meta<typeof ObsBattingScorecard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
