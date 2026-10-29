import type { Meta, StoryObj } from '@storybook/react-vite'
import { ByesIcon, CricketBatIcon, KeeperGlovesIcon, LegByesIcon } from '@/components/CricketDecorIcons'

const meta = { title: 'Scoretrack/Icons/Cricket Decor', tags: ['autodocs'] } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const All: Story = {
  render: () => (
    <div className="flex items-center gap-4 text-primary">
      <CricketBatIcon className="size-8" />
      <KeeperGlovesIcon className="size-8" />
      <ByesIcon className="size-8" />
      <LegByesIcon className="size-8" />
    </div>
  ),
}
