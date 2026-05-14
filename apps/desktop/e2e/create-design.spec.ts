/**
 * UAT: Create new design end-to-end flow.
 *
 * Uses `testOnboarded` fixture (config pre-seeded with a valid provider).
 * Tests the full create flow: button → dialog → fill name → submit → workspace.
 *
 * If any step fails, we capture a screenshot and report verbatim — we do NOT
 * mask failures with fallbacks. The brief says "surface failures, don't paper
 * over them."
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { expect, testOnboarded as test } from './fixtures/electron-app';

const SCREENSHOT_DIR = path.join(__dirname, '../test-results/screenshots');

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

test('create new design flow', async ({ firstWindow }) => {
  ensureDir(SCREENSHOT_DIR);

  // ── Step 1: wait for window.codesign bridge ────────────────────────────────
  await firstWindow.waitForFunction(
    () => typeof (window as Window & { codesign?: unknown }).codesign !== 'undefined',
    { timeout: 10_000 },
  );

  // ── Step 2: wait for store to be exposed ────────────────────────────��─────
  await firstWindow.waitForFunction(
    () =>
      (window as Window & { __codesign_test_store__?: unknown }).__codesign_test_store__ != null,
    { timeout: 10_000 },
  );

  // ── Step 3: wait for configHydrated ───────────────────────────────────────
  await firstWindow.waitForFunction(
    () => {
      const w = window as Window & {
        __codesign_test_store__?: { getState: () => { configHydrated?: boolean } };
      };
      return w.__codesign_test_store__?.getState().configHydrated === true;
    },
    { timeout: 10_000 },
  );

  // ── Step 4: click the new design button ───────────────────────────────────
  const newDesignBtn = firstWindow.getByTestId('sidebar-button-new-design');
  await expect(newDesignBtn).toBeVisible({ timeout: 8_000 });
  await newDesignBtn.click();

  // ── Step 5: wait for dialog ───────────────────────────────────────────────
  const dialog = firstWindow.getByTestId('new-design-dialog');
  await expect(dialog).toBeVisible({ timeout: 8_000 });

  // ── Step 6: screenshot dialog open ───────────────────────────────────────
  await firstWindow.screenshot({
    path: path.join(SCREENSHOT_DIR, 'create-design-dialog-open.png'),
  });

  // ── Step 7: fill name ─────────────────────────────────────────────────────
  const nameInput = firstWindow.getByTestId('new-design-dialog-input-name');
  await nameInput.fill('E2E Smoke Design');

  // ── Step 8: screenshot filled ─────────────────────────────────────────────
  await firstWindow.screenshot({
    path: path.join(SCREENSHOT_DIR, 'create-design-dialog-filled.png'),
  });

  // ── Step 9: click submit ──────────────────────────────────────────────────
  const submitBtn = firstWindow.getByTestId('new-design-dialog-button-submit');
  await submitBtn.click();

  // ── Step 10: wait for dialog to be hidden ────────────────────────────────
  await expect(dialog).toBeHidden({ timeout: 10_000 });

  // ── Step 11: wait for workspace view ──────────────────────────────────────
  // workspace-view div is hidden={view !== 'workspace'}, so wait for it to
  // become visible (the hidden attr gets removed when view switches).
  const workspaceView = firstWindow.getByTestId('workspace-view');
  await expect(workspaceView).toBeVisible({ timeout: 15_000 });

  // ── Step 12: assert currentDesignId ───────────────────────────────────────
  const currentDesignId = await firstWindow.evaluate(() => {
    const w = window as Window & {
      __codesign_test_store__?: { getState: () => { currentDesignId?: string } };
    };
    return w.__codesign_test_store__?.getState().currentDesignId ?? null;
  });
  expect(typeof currentDesignId).toBe('string');
  expect(currentDesignId).not.toBe('');
  expect(currentDesignId).not.toBeNull();

  // ── Step 13: assert design name in store ──────────────────────────────────
  const foundInStore = await firstWindow.evaluate(() => {
    const w = window as Window & {
      __codesign_test_store__?: { getState: () => { designs?: Array<{ name: string }> } };
    };
    const designs = w.__codesign_test_store__?.getState().designs ?? [];
    return designs.some((d) => d.name === 'E2E Smoke Design');
  });
  expect(foundInStore).toBe(true);

  // ── Step 14: screenshot workspace ─────────────────────────────────────────
  await firstWindow.screenshot({
    path: path.join(SCREENSHOT_DIR, 'create-design-workspace.png'),
  });

  // ── Step 15: assert design visible in sidebar list ────────────────────────
  const sidebarItem = firstWindow.getByTestId(`design-list-item-${currentDesignId}`);
  await expect(sidebarItem).toBeVisible({ timeout: 5_000 });

  // ── Step 16: screenshot sidebar ───────────────────────────────────────────
  await firstWindow.screenshot({
    path: path.join(SCREENSHOT_DIR, 'create-design-in-sidebar.png'),
  });
});
