import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { TournamentGroupTeamsPicker } from '@/components/tournament/TournamentGroupTeamsPicker'

const teams = [
  { id: 'lt-1', label: 'North Stars' },
  { id: 'lt-2', label: 'Coastal Kings' },
]

const meta = {
  title: 'Scoretrack/Tournament/Group Teams Picker',
  component: TournamentGroupTeamsPicker,
  tags: ['autodocs'],
} satisfies Meta<typeof TournamentGroupTeamsPicker>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: function Render() {
    const [selected, setSelected] = useState(new Set<string>(['lt-1']))
    return (
      <TournamentGroupTeamsPicker
        teams={teams}
        selectedIds={selected}
        onAdd={(id) => setSelected((s) => new Set(s).add(id))}
        onRemove={(id) =>
          setSelected((s) => {
            const n = new Set(s)
            n.delete(id)
            return n
          })
        }
      />
    )
  },
}
