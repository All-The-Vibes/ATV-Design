import path from 'node:path';
import { defineConfig } from '@playwright/test';

// Set PW_DISABLE_TS_ESM in-process so the script works on Windows without
// the Unix `VAR=value cmd` syntax (which cmd.exe doesn't support).
process.env['PW_DISABLE_TS_ESM'] = '1';

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: path.join('playwright-report'), open: 'never' }]],
  snapshotDir: 'e2e/__snapshots__',
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.02 },
  },
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  outputDir: 'test-results',
});
