import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { MatchPlayingSquadModal } from '@/components/MatchPlayingSquadModal'
import { makeMatchDoc } from '@/stories/fixtures/match'

const meta = {
  title: 'Scoretrack/Match/Playing Squad Modal',
  component: MatchPlayingSquadModal,
  tags: ['autodocs'],
  args: {
    open: true,
    onClose: fn(),
    teamName: 'North Stars',
    players: makeMatchDoc().home.players,
    maxCount: 11,
    selectedIds: ['home-1', 'home-2', 'home-3'],
    onConfirm: fn(),
  },
} satisfies Meta<typeof MatchPlayingSquadModal>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
