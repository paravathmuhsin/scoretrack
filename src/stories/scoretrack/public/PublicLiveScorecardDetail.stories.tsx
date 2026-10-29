import type { Meta, StoryObj } from '@storybook/react-vite'
import { PublicLiveScorecardDetail } from '@/components/PublicLiveScorecardDetail'
import { makeObsProps } from '@/stories/fixtures/scoring'

const { match, cfg, state, events } = makeObsProps()

const meta = {
  title: 'Scoretrack/Public/Live Scorecard Detail',
  component: PublicLiveScorecardDetail,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  args: { match, cfg, state, events },
} satisfies Meta<typeof PublicLiveScorecardDetail>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
