import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { useState } from 'react'
import { MatchFormCreateFields } from '@/components/MatchFormCreateFields'
import { makeTeamDoc } from '@/stories/fixtures/team'

function MatchFormDemo() {
  const team = { id: 'team-1', ...makeTeamDoc() }
  const [squadSize, setSquadSize] = useState(11)
  const [oversLimit, setOversLimit] = useState(20)
  const [oversPerBowler, setOversPerBowler] = useState(4)
  const [scheduleMode, setScheduleMode] = useState<'now' | 'later'>('now')
  const [scheduledAt, setScheduledAt] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const [freeHit, setFreeHit] = useState(false)
  const [venue, setVenue] = useState('')

  return (
    <MatchFormCreateFields
      pickA="team-1"
      pickB="team-2"
      previewA={team}
      previewB={{ ...team, id: 'team-2', name: 'Coastal Kings', shortName: 'CKG' }}
      openPicker={fn()}
      squadSize={squadSize}
      setSquadSize={setSquadSize}
      oversLimit={oversLimit}
      setOversLimit={setOversLimit}
      oversPerBowler={oversPerBowler}
      setOversPerBowler={setOversPerBowler}
      scheduleMode={scheduleMode}
      setScheduleMode={setScheduleMode}
      scheduledAt={scheduledAt}
      setScheduledAt={setScheduledAt}
      isPublic={isPublic}
      setIsPublic={setIsPublic}
      freeHitOnNoBall={freeHit}
      setFreeHitOnNoBall={setFreeHit}
      canSubmit
      writePending={false}
      error={null}
      submitIdleLabel="Create match"
      friendlyVenue={venue}
      setFriendlyVenue={setVenue}
      showFriendlyVenue
      showGlobalTeamSearchHint
    />
  )
}

const meta = {
  title: 'Scoretrack/Match/Match Form Create Fields',
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => <MatchFormDemo />,
}
