import type { Preview } from '@storybook/react-vite'
import { withMemoryRouter } from '../src/stories/decorators/withMemoryRouter'
import { withToaster } from '../src/stories/decorators/withToaster'
import '../src/index.css'

const preview: Preview = {
  parameters: {
    layout: 'padded',
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    a11y: { test: 'todo' },
  },
  decorators: [withMemoryRouter, withToaster],
}

export default preview
