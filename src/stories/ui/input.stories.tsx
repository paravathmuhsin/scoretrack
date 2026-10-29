import type { Meta, StoryObj } from '@storybook/react-vite'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const meta = {
  title: 'UI/Forms/Input',
  component: Input,
  tags: ['autodocs'],
} satisfies Meta<typeof Input>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: { placeholder: 'Team name' },
}

export const Disabled: Story = {
  args: { placeholder: 'Read only', disabled: true, defaultValue: 'North Stars' },
}

export const WithLabel: Story = {
  render: () => (
    <div className="grid w-full max-w-sm gap-2">
      <Label htmlFor="mobile">Mobile</Label>
      <Input id="mobile" placeholder="10-digit mobile" />
    </div>
  ),
}
