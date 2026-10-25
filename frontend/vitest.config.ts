import { defineConfig } from 'vitest/config'
export default defineConfig({
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    // Imported-rig surface tests are CPU-heavy. Keep their existing timeouts
    // meaningful instead of making every file compete for the same cores.
    fileParallelism: false,
  },
})
