import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { useRef, useState } from 'react'
import { MatchTeamPickerDialogContent } from '@/components/MatchTeamPickerDialogContent'
import { makeTeamDoc } from '@/stories/fixtures/team'

const options = [
  {
    id: 'team-1',
    ownerUid: 'demo-user',
    isCoOwned: false,
    ...makeTeamDoc(),
  },
]

const meta = {
  title: 'Scoretrack/Match/Team Picker Dialog Content',
  component: MatchTeamPickerDialogContent,
  tags: ['autodocs'],
} satisfies Meta<typeof MatchTeamPickerDialogContent>

export default meta
type Story = StoryObj<typeof meta>

export const SideA: Story = {
  render: function Render() {
    const [search, setSearch] = useState('')
    const ref = useRef<HTMLInputElement>(null)
    return (
      <div className="max-w-md rounded-xl border bg-white">
        <MatchTeamPickerDialogContent
          titleId="picker-title"
          pickerSide="A"
          pickerSearch={search}
          onPickerSearchChange={setSearch}
          searchInputRef={ref}
          pickerOptions={options}
          filteredPickerOptions={options}
          excludeKey=""
          tournamentId={null}
          allowGlobalSearch
          onSelectTeam={fn()}
          onClose={fn()}
        />
      </div>
    )
  },
}
