import type { Meta, StoryObj } from '@storybook/react-vite'
import { Separator } from '@/components/ui/separator'

const meta = {
  title: 'UI/Layout/Separator',
  component: Separator,
  tags: ['autodocs'],
} satisfies Meta<typeof Separator>

export default meta
type Story = StoryObj<typeof meta>

export const Horizontal: Story = {
  render: () => (
    <div className="w-64 space-y-2">
      <p className="text-sm">Section A</p>
      <Separator />
      <p className="text-sm">Section B</p>
    </div>
  ),
}

export const Vertical: Story = {
  render: () => (
    <div className="flex h-8 items-center gap-2">
      <span className="text-sm">Home</span>
      <Separator orientation="vertical" />
      <span className="text-sm">Away</span>
    </div>
  ),
}
