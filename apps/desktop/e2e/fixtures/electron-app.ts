import { mkdtempSync, rmSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { type ElectronApplication, type Page, _electron, test as base } from '@playwright/test';
import { seedOnboardedPreferences } from './seed-preferences';

export interface ElectronFixtures {
  electronApp: ElectronApplication;
  firstWindow: Page;
}

// ── Base fixture — fresh (unauthenticated) launch ─────────────────────────────

export const test = base.extend<ElectronFixtures>({
  // eslint-disable-next-line no-empty-pattern
  // biome-ignore lint/correctness/noEmptyPattern: Playwright fixture signature requires destructuring even when empty
  electronApp: async ({}, use) => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), 'codesign-e2e-'));

    const electronApp = await _electron.launch({
      args: [
        path.join(__dirname, '../../out/main/index.js'),
        '--disable-gpu',
        '--no-sandbox',
        '--disable-dev-shm-usage',
      ],
      env: {
        ...process.env,
        ELECTRON_USER_DATA_DIR: tempDir,
        CODESIGN_E2E: '1',
      },
      timeout: 60_000,
    });

    await use(electronApp);

    await electronApp.close();

    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  },

  firstWindow: async ({ electronApp }, use) => {
    const page = await electronApp.firstWindow();
    // Wait for the window to be visible
    await page.waitForLoadState('domcontentloaded');
    await use(page);
  },
});

// ── Onboarded fixture — seeds config BEFORE launch so app boots past login ────

export const testOnboarded = base.extend<ElectronFixtures>({
  // eslint-disable-next-line no-empty-pattern
  // biome-ignore lint/correctness/noEmptyPattern: Playwright fixture signature requires destructuring even when empty
  electronApp: async ({}, use) => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), 'codesign-e2e-onboarded-'));

    // Seed preferences BEFORE Electron starts so the main process reads a
    // valid config.toml on boot and getOnboardingState() returns hasKey:true.
    await seedOnboardedPreferences(tempDir);

    const electronApp = await _electron.launch({
      args: [
        path.join(__dirname, '../../out/main/index.js'),
        '--disable-gpu',
        '--no-sandbox',
        '--disable-dev-shm-usage',
      ],
      env: {
        ...process.env,
        ELECTRON_USER_DATA_DIR: tempDir,
        CODESIGN_E2E: '1',
      },
      timeout: 60_000,
    });

    await use(electronApp);

    await electronApp.close();

    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  },

  firstWindow: async ({ electronApp }, use) => {
    const page = await electronApp.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    // Give the renderer a moment to hydrate Zustand from IPC
    await page.waitForTimeout(2_000);
    await use(page);
  },
});

export { expect } from '@playwright/test';
