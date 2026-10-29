import type { Meta, StoryObj } from '@storybook/react-vite'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Smartphone } from 'lucide-react'
import { AndroidAppDownloadModal } from '@/components/AndroidAppDownloadModal'

const meta = {
  title: 'Scoretrack/Layout/Android App Download Modal',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Auto-opens on Android mobile browsers after a delay. Story shows equivalent UI; the real component gates on user agent and env flags.',
      },
    },
  },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const ProductionGate: Story = {
  render: () => <AndroidAppDownloadModal />,
}

export const UiPreview: Story = {
  render: () => (
    <AlertDialog defaultOpen>
      <AlertDialogContent>
        <AlertDialogMedia>
          <Smartphone />
        </AlertDialogMedia>
        <AlertDialogHeader>
          <AlertDialogTitle>Get the Scoretrack app</AlertDialogTitle>
          <AlertDialogDescription>
            Install from Google Play for faster scoring and notifications.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Not now</AlertDialogCancel>
          <Button>Open Play Store</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ),
}
