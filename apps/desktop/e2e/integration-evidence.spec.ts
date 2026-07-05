/**
 * Evidence capture for the Terminal 42 × ATV Design integration PR.
 *
 * NOT a regression gate — this spec exists to produce real, non-faked
 * screenshots of the running Electron app for the PR body. Each capture drives
 * the actual built main process (out/main/index.js) via the testOnboarded
 * fixture, so what you see is the real renderer, not a mock.
 *
 * Captures:
 *   1. hub-light        — ATV hub, warm-cream light theme (ATV trunk intact)
 *   2. hub-dark-t42     — the Terminal 42 dark pro-tool reskin (near-black
 *                         canvas, sky-blue accent) applied to ATV's shell
 *   3. settings-providers — ATV backend: provider/model settings surface
 *   4. design-system-dark — Design System token panels (DesignCanvas-derived
 *                           token inspector) in the T42 dark theme
 *
 * Output: apps/desktop/test-results/screenshots/integration/*.png
 */

import * as path from 'node:path';
import type { Page } from '@playwright/test';
import { testOnboarded as test } from './fixtures/electron-app';

const SHOT_DIR = path.join(__dirname, '../test-results/screenshots/integration');

/** Wait for the app to boot past the onboarding gate to the hub. The
 *  testOnboarded fixture seeds a keyless ollama config so `hasKey` is true;
 *  the renderer still needs a beat to hydrate `config` from IPC (App.tsx
 *  gate: `configLoaded && config !== null && config.hasKey`). The hub mounts
 *  a [data-testid="hub-view"] once ready. */
async function waitForHub(win: Page): Promise<void> {
  const hub = win.getByTestId('hub-view');
  await hub.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => undefined);
  await win.waitForTimeout(500);
}

/** Force the app theme by toggling the `.dark` class the store drives
 *  (store.ts: `root.classList.add('dark')`). Works whether or not the store
 *  is exposed on window. */
async function setTheme(win: Page, theme: 'light' | 'dark'): Promise<void> {
  await win.evaluate((t: string) => {
    const root = document.documentElement;
    if (t === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    // Also nudge the store if it exposes a setter (keeps state consistent).
    type StoreWin = Window & {
      __codesignStore?: { getState: () => { setTheme?: (x: string) => void } };
    };
    (window as StoreWin).__codesignStore?.getState?.().setTheme?.(t);
  }, theme);
  await win.waitForTimeout(400);
}

async function gotoDesignSystemsTab(win: Page): Promise<void> {
  const tabButton = win.getByRole('button', { name: /design\s*systems/i }).first();
  if (await tabButton.count()) {
    await tabButton.click().catch(() => undefined);
    await win.waitForTimeout(600);
  }
}

async function openSettings(win: Page): Promise<void> {
  const gear = win
    .getByTestId('topbar-button-settings')
    .or(win.getByRole('button', { name: /settings|preferences/i }))
    .first();
  if (await gear.count()) {
    await gear.click().catch(() => undefined);
    await win.waitForTimeout(800);
  }
}

test('capture: hub in ATV light theme', async ({ firstWindow }) => {
  await waitForHub(firstWindow);
  await setTheme(firstWindow, 'light');
  await firstWindow.screenshot({ path: path.join(SHOT_DIR, '01-hub-light.png') });
});

test('capture: hub in Terminal 42 dark reskin', async ({ firstWindow }) => {
  await waitForHub(firstWindow);
  await setTheme(firstWindow, 'dark');
  await firstWindow.screenshot({ path: path.join(SHOT_DIR, '02-hub-dark-t42.png') });
});

test('capture: provider/model settings (ATV backend)', async ({ firstWindow }) => {
  await waitForHub(firstWindow);
  await setTheme(firstWindow, 'dark');
  await openSettings(firstWindow);
  await firstWindow.screenshot({ path: path.join(SHOT_DIR, '03-settings-providers.png') });
});

test('capture: design-system token panels in dark theme', async ({ firstWindow }) => {
  await waitForHub(firstWindow);
  await setTheme(firstWindow, 'dark');
  await gotoDesignSystemsTab(firstWindow);
  await firstWindow.screenshot({
    path: path.join(SHOT_DIR, '04-design-system-dark.png'),
    fullPage: true,
  });
});

test('capture: design-system token panels in light theme', async ({ firstWindow }) => {
  await waitForHub(firstWindow);
  await setTheme(firstWindow, 'light');
  await gotoDesignSystemsTab(firstWindow);
  await firstWindow.screenshot({
    path: path.join(SHOT_DIR, '05-design-system-light.png'),
    fullPage: true,
  });
});
