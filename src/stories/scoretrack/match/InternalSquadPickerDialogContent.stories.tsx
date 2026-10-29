import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { useRef, useState } from 'react'
import { InternalSquadPickerDialogContent } from '@/components/InternalSquadPickerDialogContent'
import { makeTeamDoc } from '@/stories/fixtures/team'

const meta = {
  title: 'Scoretrack/Match/Internal Squad Picker',
  component: InternalSquadPickerDialogContent,
  tags: ['autodocs'],
} satisfies Meta<typeof InternalSquadPickerDialogContent>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: function Render() {
    const [search, setSearch] = useState('')
    const ref = useRef<HTMLInputElement>(null)
    const squads = [
      {
        ownerUid: 'demo-user',
        teamId: 'team-1',
        teamName: 'North Stars',
        teamShortName: 'NST',
        isOwner: true,
        players: makeTeamDoc().players,
        loading: false,
      },
    ]
    return (
      <div className="max-w-md rounded-xl border bg-white p-4">
        <InternalSquadPickerDialogContent
          titleId="internal-picker"
          pickerSearch={search}
          onPickerSearchChange={setSearch}
          searchInputRef={ref}
          squads={squads}
          filteredSquads={squads}
          loading={false}
          onSelect={fn()}
          onClose={fn()}
        />
      </div>
    )
  },
}
