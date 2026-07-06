import { defineConfig } from 'vitest/config';

// Dedicated project for root-level `scripts/` tooling tests (the `pnpm smoke`
// harness and its `?raw` loader). These live outside any workspace package, so
// they need their own vitest entry. Wired into CI via the root `test:scripts`
// script; `turbo run test` covers the packages, this covers the tooling.
export default defineConfig({
  test: {
    include: ['scripts/**/*.test.mts', 'scripts/**/*.test.mjs'],
    exclude: ['**/node_modules/**'],
  },
});
