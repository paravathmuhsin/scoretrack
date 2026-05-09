import type { Config } from 'tailwindcss'

/**
 * Tailwind v4 theme tokens live in `src/index.css` (`@theme`).
 * This file satisfies tooling (e.g. shadcn CLI) that expects a config on disk.
 */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
} satisfies Config
