/**
 * Cross-platform Playwright runner.
 *
 * Sets PW_DISABLE_TS_ESM=1 BEFORE spawning playwright so the flag is in the
 * environment when the loader initialises (setting it inside playwright.config.ts
 * is too late — the ESM loader runs first).
 *
 * Usage:
 *   node scripts/e2e-run.cjs [playwright-args...]
 * e.g.
 *   node scripts/e2e-run.cjs --headed
 *   node scripts/e2e-run.cjs e2e/smoke.spec.ts
 */
'use strict';

const { spawnSync } = require('node:child_process');
const path = require('node:path');

const playwrightBin = path.join(__dirname, '..', 'node_modules', '.bin', 'playwright');
const args = ['test', ...process.argv.slice(2)];

const result = spawnSync(playwrightBin, args, {
  stdio: 'inherit',
  env: { ...process.env, PW_DISABLE_TS_ESM: '1' },
  cwd: path.join(__dirname, '..'),
  shell: process.platform === 'win32',
});

process.exit(result.status ?? 1);
