import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { useRef, useState } from 'react'
import { TournamentAddSquadDialogContent } from '@/components/tournament/TournamentAddSquadDialogContent'
import { makeTeamDoc } from '@/stories/fixtures/team'

const squads = [{ id: 'team-1', ...makeTeamDoc() }]

const meta = {
  title: 'Scoretrack/Tournament/Add Squad Dialog Content',
  component: TournamentAddSquadDialogContent,
  tags: ['autodocs'],
} satisfies Meta<typeof TournamentAddSquadDialogContent>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: function Render() {
    const [search, setSearch] = useState('')
    const ref = useRef<HTMLInputElement>(null)
    return (
      <div className="max-w-md rounded-xl border bg-white p-4">
        <TournamentAddSquadDialogContent
          titleId="add-squad-title"
          search={search}
          onSearchChange={setSearch}
          searchInputRef={ref}
          linkableTeams={squads}
          filteredLinkableTeams={squads}
          hasAnySquads
          teamSlotsRemaining={3}
          writePending={false}
          linkingSquadId={null}
          error={null}
          onSelectSquad={fn()}
          onClose={fn()}
        />
      </div>
    )
  },
}
