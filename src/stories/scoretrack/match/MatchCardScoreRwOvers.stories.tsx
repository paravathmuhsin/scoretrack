import type { Meta, StoryObj } from '@storybook/react-vite'
import { MatchCardScoreRwOvers } from '@/components/MatchCardScoreRwOvers'

const meta = {
  title: 'Scoretrack/Match/Match Card Score',
  component: MatchCardScoreRwOvers,
  tags: ['autodocs'],
} satisfies Meta<typeof MatchCardScoreRwOvers>

export default meta
type Story = StoryObj<typeof meta>

export const WithOvers: Story = {
  args: { rw: '142/3', oversParen: '(18.4)' },
}

export const RunsOnly: Story = {
  args: { rw: '87', oversParen: null },
}
