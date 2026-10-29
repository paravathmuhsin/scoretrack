import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import type { StorybookConfig } from '@storybook/react-vite'
import { mergeConfig } from 'vite'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(dirname, '..')
const firebaseConfigMock = path.resolve(dirname, 'mocks/firebaseConfig.ts')
const firestoreMock = path.resolve(dirname, 'mocks/firestore.ts')

const config: StorybookConfig = {
  stories: ['../src/stories/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y'],
  framework: '@storybook/react-vite',
  async viteFinal(viteConfig) {
    return mergeConfig(viteConfig, {
      plugins: [tailwindcss()],
      resolve: {
        alias: {
          '@': path.resolve(projectRoot, 'src'),
          'firebase/firestore': firestoreMock,
          [path.resolve(projectRoot, 'src/firebase/config.ts')]: firebaseConfigMock,
        },
      },
      define: {
        __APP_VERSION__: JSON.stringify('storybook'),
      },
    })
  },
}

export default config
