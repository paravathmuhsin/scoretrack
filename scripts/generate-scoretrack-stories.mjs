/**
 * One-off generator for Scoretrack component stories (central src/stories/scoretrack).
 * Run: node scripts/generate-scoretrack-stories.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'src/stories/scoretrack')

/** @type {Array<{ file: string, body: string }>} */
const stories = []

function add(file, body) {
  stories.push({ file: path.join(outDir, file), body })
}

add(
  'icons/CricketDecorIcons.stories.tsx',
  `import type { Meta, StoryObj } from '@storybook/react-vite'
import { ByesIcon, CricketBatIcon, KeeperGlovesIcon, LegByesIcon } from '@/components/CricketDecorIcons'

const meta = { title: 'Scoretrack/Icons/Cricket Decor', tags: ['autodocs'] } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const All: Story = {
  render: () => (
    <div className="flex items-center gap-4 text-primary">
      <CricketBatIcon className="size-8" />
      <KeeperGlovesIcon className="size-8" />
      <ByesIcon className="size-8" />
      <LegByesIcon className="size-8" />
    </div>
  ),
}
`,
)

add(
  'feedback/Spinner.stories.tsx',
  `import type { Meta, StoryObj } from '@storybook/react-vite'
import { BtnPendingLabel, Spinner } from '@/components/Spinner'
import { Button } from '@/components/ui/button'

const meta = { title: 'Scoretrack/Feedback/Spinner', component: Spinner, tags: ['autodocs'] } satisfies Meta<typeof Spinner>
export default meta
type Story = StoryObj<typeof meta>

export const Medium: Story = { args: { size: 'md', label: 'Loading' } }
export const Small: Story = { args: { size: 'sm' } }
export const PendingButton: Story = {
  render: () => (
    <Button disabled>
      <BtnPendingLabel pending idle="Save match" busyText="Saving…" />
    </Button>
  ),
}
`,
)

add(
  'layout/StagingBanner.stories.tsx',
  `import type { Meta, StoryObj } from '@storybook/react-vite'
import { StagingBanner } from '@/components/StagingBanner'

function StagingBannerPreview() {
  return (
    <div role="status" className="fixed inset-x-0 top-0 z-[100] bg-amber-500 px-4 py-1.5 text-center text-sm font-medium text-amber-950">
      Staging environment — data here is not production
    </div>
  )
}

const meta = { title: 'Scoretrack/Layout/Staging Banner', tags: ['autodocs'] } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const ProductionHidden: Story = { render: () => <StagingBanner /> }
export const StagingVisible: Story = { render: () => <StagingBannerPreview /> }
`,
)

for (const { file, body } of stories) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  if (!fs.existsSync(file)) fs.writeFileSync(file, body)
}

console.log('Wrote', stories.length, 'story files (skipped existing)')
