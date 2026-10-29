import type { Meta, StoryObj } from '@storybook/react-vite'
import { MobileHeader, PublicMobileFooter } from '@/components/MobileChrome'
import { withMockAuth } from '@/stories/decorators/withMockAuth'

const meta = {
  title: 'Scoretrack/Navigation/Mobile Chrome',
  tags: ['autodocs'],
  decorators: [withMockAuth],
  parameters: { layout: 'fullscreen', auth: { preset: 'signedIn' } },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const Header: Story = {
  render: () => (
    <div className="shell mx-auto max-w-[768px] bg-[#f3f4f6]">
      <MobileHeader />
    </div>
  ),
}

export const Footer: Story = {
  render: () => (
    <div className="shell relative mx-auto h-32 max-w-[768px] bg-[#f3f4f6]">
      <PublicMobileFooter />
    </div>
  ),
}
