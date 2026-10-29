import type { Meta, StoryObj } from '@storybook/react-vite'
import { MainNav } from '@/components/MainNav'
import { withMockAuth } from '@/stories/decorators/withMockAuth'

const meta = {
  title: 'Scoretrack/Navigation/Main Nav',
  component: MainNav,
  tags: ['autodocs'],
  decorators: [withMockAuth],
  parameters: { router: { initialEntries: ['/'] } },
} satisfies Meta<typeof MainNav>

export default meta
type Story = StoryObj<typeof meta>

export const SignedOut: Story = {
  parameters: { auth: { preset: 'signedOut' } },
}

export const SignedIn: Story = {
  parameters: { auth: { preset: 'signedIn' } },
}
