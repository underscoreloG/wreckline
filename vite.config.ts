import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import pkg from './package.json' with { type: 'json' };

export default defineConfig({
  // Relative asset URLs so the build works under any path (GitHub Pages serves it under /wreckline/).
  base: './',
  plugins: [react()],
  // package.json is the single source of the version shown on the title screen.
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  // strictPort: a busy port fails loudly instead of silently moving (parallel worktrees use their own ports).
  server: { port: 5181, strictPort: true },
  // The embedded Rapier WASM alone is ~1 MB; scripts/bundleSize.mjs enforces the real (gzip) budget.
  build: { chunkSizeWarningLimit: 4096 },
  test: { environment: 'node', include: ['src/**/*.test.ts'], testTimeout: 60000 },
});
