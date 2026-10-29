import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { UserTeamForm } from '@/components/UserTeamForm'
import { makeTeamDoc } from '@/stories/fixtures/team'

const meta = {
  title: 'Scoretrack/Forms/User Team Form',
  component: UserTeamForm,
  tags: ['autodocs'],
  args: {
    submitLabel: 'Save squad',
    primaryUid: 'demo-user',
    onSubmit: fn(),
  },
} satisfies Meta<typeof UserTeamForm>

export default meta
type Story = StoryObj<typeof meta>

export const Create: Story = {}

export const EditExisting: Story = {
  args: {
    initial: { id: 'team-1', ...makeTeamDoc() },
    canManageOwners: true,
  },
}
