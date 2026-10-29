import type { Meta, StoryObj } from '@storybook/react-vite'
import { Route, Routes } from 'react-router-dom'
import { RequireCompleteProfile } from '@/components/RequireCompleteProfile'
import { withFirestoreSeed } from '@/stories/decorators/withFirestoreSeed'
import { withMockAuth } from '@/stories/decorators/withMockAuth'

const profileSeed = {
  'users/storybook-user': {
    fullName: 'Demo Player',
    displayName: 'Demo',
    mobile: '9876543210',
  },
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/app" element={<RequireCompleteProfile />}>
        <Route index element={<p className="text-sm">App with complete profile</p>} />
        <Route path="complete-profile" element={<p className="text-sm">Complete profile page</p>} />
      </Route>
    </Routes>
  )
}

const meta = {
  title: 'Scoretrack/Auth/Require Complete Profile',
  component: RequireCompleteProfile,
  tags: ['autodocs'],
  decorators: [withMockAuth, withFirestoreSeed],
  parameters: {
    auth: { preset: 'signedIn' },
    router: { initialEntries: ['/app'], outlet: false },
    firestoreSeed: profileSeed,
  },
  render: () => <AppRoutes />,
} satisfies Meta<typeof RequireCompleteProfile>

export default meta
type Story = StoryObj<typeof meta>

/** Profile doc satisfies mobile + names — child route renders. */
export const CompleteProfile: Story = {}

export const IncompleteProfile: Story = {
  parameters: {
    firestoreSeed: {
      'users/storybook-user': { fullName: 'Demo', displayName: 'D', mobile: '123' },
    },
  },
}

export const Loading: Story = {
  parameters: {
    firestoreSeed: {},
    docs: {
      description: {
        story: 'Brief loading state while the profile doc is fetched.',
      },
    },
  },
  render: () => (
    <div className="main">
      <p className="muted">Loading…</p>
    </div>
  ),
}
