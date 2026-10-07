import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Deliberately separate from vite.config.ts: that file reads package.json and
// registers the service-worker plugin, none of which a unit test needs.
// The default environment is "node" for pure modules; a component test opts into a DOM with
// `// @vitest-environment jsdom` on its first line.
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
