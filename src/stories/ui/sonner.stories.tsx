import type { Meta, StoryObj } from '@storybook/react-vite'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

const meta = {
  title: 'UI/Feedback/Sonner',
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const Variants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={() => toast.success('Match saved')}>
        Success
      </Button>
      <Button variant="outline" onClick={() => toast.error('Could not sync score')}>
        Error
      </Button>
      <Button variant="outline" onClick={() => toast.info('Invite sent to squad owner')}>
        Info
      </Button>
      <Button variant="outline" onClick={() => toast.warning('Squad is below XI size')}>
        Warning
      </Button>
    </div>
  ),
}
