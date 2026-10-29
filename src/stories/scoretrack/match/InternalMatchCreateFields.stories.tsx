import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { InternalMatchTypeChoice } from '@/components/InternalMatchCreateFields'

const meta = {
  title: 'Scoretrack/Match/Internal Match Create Fields',
  tags: ['autodocs'],
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const TypeChoice: Story = {
  render: function Render() {
    const [isInternal, setIsInternal] = useState(false)
    return <InternalMatchTypeChoice isInternal={isInternal} setIsInternal={setIsInternal} />
  },
}
