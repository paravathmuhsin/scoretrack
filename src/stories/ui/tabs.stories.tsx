import type { Meta, StoryObj } from '@storybook/react-vite'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const meta = {
  title: 'UI/Navigation/Tabs',
  component: Tabs,
  tags: ['autodocs'],
} satisfies Meta<typeof Tabs>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Tabs defaultValue="teams" className="w-[360px]">
      <TabsList>
        <TabsTrigger value="teams">Teams</TabsTrigger>
        <TabsTrigger value="fixtures">Fixtures</TabsTrigger>
        <TabsTrigger value="standings">Standings</TabsTrigger>
      </TabsList>
      <TabsContent value="teams">Linked squads for this tournament.</TabsContent>
      <TabsContent value="fixtures">Round-robin and knockout fixtures.</TabsContent>
      <TabsContent value="standings">Points table and net run rate.</TabsContent>
    </Tabs>
  ),
}

export const LineVariant: Story = {
  render: () => (
    <Tabs defaultValue="live" className="w-[360px]">
      <TabsList variant="line">
        <TabsTrigger value="live">Live</TabsTrigger>
        <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
      </TabsList>
      <TabsContent value="live">Live matches update in real time.</TabsContent>
      <TabsContent value="upcoming">Scheduled friendlies and league games.</TabsContent>
    </Tabs>
  ),
}
