import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Deliberately separate from vite.config.ts: that file reads package.json and
// registers the service-worker plugin, none of which a unit test needs.
// Pure modules run in "node"; a suite that needs a DOM opts in with
// `// @vitest-environment jsdom` (jsdom and Testing Library are devDependencies).
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
