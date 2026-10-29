import type { Meta, StoryObj } from '@storybook/react-vite'
import { Label } from '@/components/ui/label'

const meta = {
  title: 'UI/Forms/Label',
  component: Label,
  tags: ['autodocs'],
} satisfies Meta<typeof Label>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: { children: 'Display name', htmlFor: 'display-name' },
}
