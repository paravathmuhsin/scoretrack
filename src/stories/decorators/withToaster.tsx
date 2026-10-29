import type { Decorator } from '@storybook/react-vite'
import { Toaster } from '@/components/ui/sonner'

export const withToaster: Decorator = (Story) => (
  <>
    <Story />
    <Toaster />
  </>
)
