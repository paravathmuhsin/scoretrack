import type { Meta, StoryObj } from '@storybook/react-vite'
import { Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'

const meta = {
  title: 'UI/Buttons/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'outline', 'secondary', 'ghost', 'destructive', 'link'],
    },
    size: {
      control: 'select',
      options: ['default', 'xs', 'sm', 'lg', 'icon', 'icon-xs', 'icon-sm', 'icon-lg'],
    },
  },
} satisfies Meta<typeof Button>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: { children: 'Primary action' },
}

export const Outline: Story = {
  args: { variant: 'outline', children: 'Outline' },
}

export const Destructive: Story = {
  args: { variant: 'destructive', children: 'Delete' },
}

export const WithIcon: Story = {
  render: () => (
    <Button>
      <Mail data-icon="inline-start" />
      Email login
    </Button>
  ),
}
