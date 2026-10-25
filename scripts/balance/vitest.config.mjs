import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Probes, not tests: `npm test` never runs them. run.mjs starts them with this config.
export default defineConfig({
  root: fileURLToPath(new URL('../..', import.meta.url)),
  test: { environment: 'node', include: ['scripts/balance/*.probe.mjs'], testTimeout: 3_600_000 },
});
