import type { Meta, StoryObj } from '@storybook/react-vite'
import { Route, Routes } from 'react-router-dom'
import { PublicLayout } from '@/components/PublicLayout'
import { withMockAuth } from '@/stories/decorators/withMockAuth'

const meta = {
  title: 'Scoretrack/Layout/Public Layout',
  component: PublicLayout,
  tags: ['autodocs'],
  decorators: [
    withMockAuth,
    (Story) => (
      <Routes>
        <Route element={<Story />}>
          <Route index element={<p className="p-4 text-sm">Public browse page</p>} />
        </Route>
      </Routes>
    ),
  ],
  parameters: {
    auth: { preset: 'signedOut' },
    router: { initialEntries: ['/'], outlet: true },
    layout: 'fullscreen',
  },
} satisfies Meta<typeof PublicLayout>

export default meta
type Story = StoryObj<typeof meta>

export const SignedOut: Story = {}

export const SignedIn: Story = {
  parameters: { auth: { preset: 'signedIn' } },
}
