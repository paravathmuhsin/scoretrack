import type { Meta, StoryObj } from '@storybook/react-vite'
import { StagingBanner } from '@/components/StagingBanner'

function StagingBannerPreview() {
  return (
    <div role="status" className="fixed inset-x-0 top-0 z-[100] bg-amber-500 px-4 py-1.5 text-center text-sm font-medium text-amber-950">
      Staging environment — data here is not production
    </div>
  )
}

const meta = { title: 'Scoretrack/Layout/Staging Banner', tags: ['autodocs'] } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const ProductionHidden: Story = { render: () => <StagingBanner /> }
export const StagingVisible: Story = { render: () => <StagingBannerPreview /> }
