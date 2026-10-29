import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { GlobalTeamSearchPanel } from '@/components/GlobalTeamSearchPanel'

const meta = {
  title: 'Scoretrack/Forms/Global Team Search Panel',
  component: GlobalTeamSearchPanel,
  tags: ['autodocs'],
  args: {
    onSelect: fn(),
    variant: 'section',
    showDivider: true,
  },
} satisfies Meta<typeof GlobalTeamSearchPanel>

export default meta
type Story = StoryObj<typeof meta>

export const Section: Story = {}

export const LinkVariant: Story = {
  args: { variant: 'link' },
}
