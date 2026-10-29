import type { Meta, StoryObj } from '@storybook/react-vite'
import { BtnPendingLabel, Spinner } from '@/components/Spinner'
import { Button } from '@/components/ui/button'

const meta = { title: 'Scoretrack/Feedback/Spinner', component: Spinner, tags: ['autodocs'] } satisfies Meta<typeof Spinner>
export default meta
type Story = StoryObj<typeof meta>

export const Medium: Story = { args: { size: 'md', label: 'Loading' } }
export const Small: Story = { args: { size: 'sm' } }
export const PendingButton: Story = {
  render: () => (
    <Button disabled>
      <BtnPendingLabel pending idle="Save match" busyText="Saving…" />
    </Button>
  ),
}
