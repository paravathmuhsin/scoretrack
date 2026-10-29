import type { Meta, StoryObj } from '@storybook/react-vite'
import { DeepLinkHandler } from '@/components/DeepLinkHandler'

const meta = {
  title: 'Scoretrack/Layout/Deep Link Handler',
  component: DeepLinkHandler,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Listens for Capacitor app URL open events and navigates in-app. No visible UI — mount is for integration testing.',
      },
    },
  },
} satisfies Meta<typeof DeepLinkHandler>

export default meta
type Story = StoryObj<typeof meta>

export const Mounted: Story = {
  render: () => (
    <p className="text-sm text-muted-foreground">
      DeepLinkHandler is mounted (check React devtools). No visual output.
      <DeepLinkHandler />
    </p>
  ),
}
