import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Deliberately separate from vite.config.ts: that file reads package.json and
// registers the service-worker plugin, none of which a unit test needs.
// Only pure modules under src/ are tested for now, so the environment stays
// "node" (no DOM). A suite that needs a DOM opts in with
// `// @vitest-environment jsdom` once jsdom is added as a dependency.
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
