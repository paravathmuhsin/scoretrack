import type { Meta, StoryObj } from '@storybook/react-vite'
import { Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'
import { withMockAuth } from '@/stories/decorators/withMockAuth'

const meta = {
  title: 'Scoretrack/Layout/App Shell',
  component: AppShell,
  tags: ['autodocs'],
  decorators: [
    withMockAuth,
    (Story) => (
      <Routes>
        <Route element={<Story />}>
          <Route index element={<p className="p-4 text-sm">Sample app page content</p>} />
        </Route>
      </Routes>
    ),
  ],
  parameters: {
    auth: { preset: 'signedIn' },
    router: { initialEntries: ['/app'], outlet: true },
    layout: 'fullscreen',
  },
} satisfies Meta<typeof AppShell>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
