import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Deliberately separate from vite.config.ts: that file reads package.json and
// registers the service-worker plugin, none of which a unit test needs.
// Pure modules run in the default "node" environment; a suite that needs a DOM (a
// component rendered with Testing Library) opts in with `// @vitest-environment jsdom`
// at the top of the file.
export default defineConfig({
  resolve: {
    // Mirrors "paths" in tsconfig.json.
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.mjs'],
    environment: 'node',
  },
})
