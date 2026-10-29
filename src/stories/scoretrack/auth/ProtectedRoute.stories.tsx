import type { Meta, StoryObj } from '@storybook/react-vite'
import { Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { withMockAuth } from '@/stories/decorators/withMockAuth'

const meta = {
  title: 'Scoretrack/Auth/Protected Route',
  component: ProtectedRoute,
  tags: ['autodocs'],
  decorators: [
    withMockAuth,
    (Story) => (
      <Routes>
        <Route element={<Story />}>
          <Route path="/app" element={<p className="text-sm">Protected app content</p>} />
        </Route>
        <Route path="/login" element={<p className="text-sm">Login redirect target</p>} />
      </Routes>
    ),
  ],
  parameters: { router: { initialEntries: ['/app'], outlet: true } },
} satisfies Meta<typeof ProtectedRoute>

export default meta
type Story = StoryObj<typeof meta>

export const SignedIn: Story = {
  parameters: { auth: { preset: 'signedIn' } },
}

export const SignedOut: Story = {
  parameters: { auth: { preset: 'signedOut' } },
}

export const Loading: Story = {
  parameters: { auth: { preset: 'loading' } },
}
