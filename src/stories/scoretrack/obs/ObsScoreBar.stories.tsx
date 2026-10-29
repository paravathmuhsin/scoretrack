import type { Meta, StoryObj } from '@storybook/react-vite'
import { ObsScoreBar } from '@/components/ObsScoreBar'
import { makeObsProps } from '@/stories/fixtures/scoring'

const props = makeObsProps()

const meta = {
  title: 'Scoretrack/OBS/Score Bar',
  component: ObsScoreBar,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  args: props,
} satisfies Meta<typeof ObsScoreBar>

export default meta
type Story = StoryObj<typeof meta>

export const Live: Story = {}
