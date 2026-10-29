import type { Meta, StoryObj } from '@storybook/react-vite'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'

const meta = {
  title: 'UI/Overlays/Sheet',
  component: Sheet,
  tags: ['autodocs'],
} satisfies Meta<typeof Sheet>

export default meta
type Story = StoryObj<typeof meta>

export const Right: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger render={<Button variant="outline" />}>Open sheet</SheetTrigger>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Filter matches</SheetTitle>
          <SheetDescription>Show live, upcoming, or completed fixtures.</SheetDescription>
        </SheetHeader>
      </SheetContent>
    </Sheet>
  ),
}

export const Bottom: Story = {
  render: () => (
    <Sheet defaultOpen>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>Quick actions</SheetTitle>
          <SheetDescription>Share scorecard or copy overlay link.</SheetDescription>
        </SheetHeader>
      </SheetContent>
    </Sheet>
  ),
}
