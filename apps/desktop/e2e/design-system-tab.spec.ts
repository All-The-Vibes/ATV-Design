/**
 * UAT: Design System tab — Claude Design parity.
 *
 * Validates the three flows the parity work introduced:
 *   1. Default (built-in) system is visible immediately, with token panels rendered
 *   2. Import dropdown is present and the URL form is reachable
 *   3. A token edit dispatches updateDesignSystemTokens via the bridge
 *
 * Visual regression: `toHaveScreenshot` gates pixel regressions (maxDiffPixelRatio
 * configured in playwright.config.ts). The explicit `.screenshot()` calls are kept
 * alongside as ad-hoc evidence written to test-results/screenshots/.
 *
 * NOTE: First run with `toHaveScreenshot` will fail with "no baseline" — that is
 * expected. Run once with `--update-snapshots` to commit the baselines, then they
 * gate future runs. Baselines live in e2e/__snapshots__/.
 *
 * Uses the `testOnboarded` fixture so the app boots past the GitHub Copilot
 * OAuth gate via the seeded ollama-keyless config; OAuth is not exercised here.
 */

import * as path from 'node:path';
import { expect, testOnboarded as test } from './fixtures/electron-app';

const SHOT_DIR = path.join(__dirname, '../test-results/screenshots');
const HUB_TAB_KEY = 'designSystems';

/** Drives the renderer Zustand store directly to switch hub tabs without
 *  relying on locale-specific button text. */
async function gotoDesignSystemsTab(win: import('@playwright/test').Page): Promise<void> {
  await win.evaluate((tab: string) => {
    type StoreWindow = Window & {
      __codesignStore?: { getState: () => { setHubTab: (t: string) => void } };
    };
    const w = window as StoreWindow;
    // Fallback: dispatch via the store if it's been exposed for tests; else click
    if (w.__codesignStore?.getState) {
      w.__codesignStore.getState().setHubTab(tab);
    }
  }, HUB_TAB_KEY);

  // If the store wasn't exposed, click the TopBar tab button (label varies by locale).
  const tabButton = win.getByRole('button', { name: /design\s*systems/i }).first();
  if (await tabButton.count()) {
    await tabButton.click().catch(() => undefined);
  }
}

test('design system tab shows built-in default on boot', async ({ firstWindow }) => {
  await gotoDesignSystemsTab(firstWindow);

  // Wait for the rewritten tab to render — the "Built-in" badge is the
  // canonical signal that Gap 1 is fixed.
  const builtInBadge = firstWindow.getByText(/built[-\s]?in/i).first();
  await expect(builtInBadge).toBeVisible({ timeout: 8_000 });

  // All six token panels should be present.
  const colorsHeader = firstWindow.getByRole('heading', { name: /colors/i, level: 3 });
  const typoHeader = firstWindow.getByRole('heading', { name: /typography/i, level: 3 });
  const spacingHeader = firstWindow.getByRole('heading', { name: /spacing/i, level: 3 });
  const radiusHeader = firstWindow.getByRole('heading', { name: /radius/i, level: 3 });
  const shadowsHeader = firstWindow.getByRole('heading', { name: /shadows/i, level: 3 });
  const componentsHeader = firstWindow.getByRole('heading', { name: /components/i, level: 3 });

  await expect(colorsHeader).toBeVisible();
  await expect(typoHeader).toBeVisible();
  await expect(spacingHeader).toBeVisible();
  await expect(radiusHeader).toBeVisible();
  await expect(shadowsHeader).toBeVisible();
  await expect(componentsHeader).toBeVisible();

  // Visual regression baseline (first run creates snapshot; subsequent runs gate it).
  await expect(firstWindow).toHaveScreenshot('design-system-builtin-default.png', {
    mask: [firstWindow.locator('[data-testid="ds-source-badge"]')],
  });

  await firstWindow.screenshot({
    path: path.join(SHOT_DIR, 'design-system-builtin-default.png'),
    fullPage: true,
  });
});

test('import menu opens and exposes URL + folder + files + built-in options', async ({
  firstWindow,
}) => {
  await gotoDesignSystemsTab(firstWindow);

  const importButton = firstWindow.getByRole('button', { name: /^import/i }).first();
  await expect(importButton).toBeVisible({ timeout: 8_000 });
  await importButton.click();

  // The menu should now expose the four import paths.
  const urlOption = firstWindow.getByText(/import from url/i).first();
  const folderOption = firstWindow.getByText(/import from folder/i).first();
  const filesOption = firstWindow.getByText(/import from files/i).first();
  const builtInOption = firstWindow.getByText(/use built-?in/i).first();

  await expect(urlOption).toBeVisible({ timeout: 4_000 });
  await expect(folderOption).toBeVisible();
  await expect(filesOption).toBeVisible();
  await expect(builtInOption).toBeVisible();

  await expect(firstWindow).toHaveScreenshot('design-system-import-menu-open.png', {
    mask: [firstWindow.locator('[data-testid="ds-source-badge"]')],
  });

  await firstWindow.screenshot({
    path: path.join(SHOT_DIR, 'design-system-import-menu-open.png'),
    fullPage: true,
  });

  // Drill into URL import and confirm the input appears.
  await urlOption.click();
  const urlInput = firstWindow.getByPlaceholder(/https:\/\//i).first();
  await expect(urlInput).toBeVisible({ timeout: 4_000 });

  await expect(firstWindow).toHaveScreenshot('design-system-import-url-form.png', {
    mask: [firstWindow.locator('[data-testid="ds-source-badge"]')],
  });

  await firstWindow.screenshot({
    path: path.join(SHOT_DIR, 'design-system-import-url-form.png'),
    fullPage: true,
  });
});

test('updateDesignSystemTokens IPC is reachable from renderer', async ({ firstWindow }) => {
  await gotoDesignSystemsTab(firstWindow);

  // Wait for tab render.
  await expect(firstWindow.getByText(/built[-\s]?in/i).first()).toBeVisible({ timeout: 8_000 });

  // Drive the bridge directly — this is what every "Edit" button does
  // under the hood. Verifies preload exposure + main-process handler + store
  // round-trip without UI coupling. The handler returns OnboardingState which
  // has `designSystem` at the TOP LEVEL (not nested under .config).
  const result = await firstWindow.evaluate(async () => {
    type StoredDS = { colors?: string[]; userEdited?: boolean } | null;
    type Bridge = {
      updateDesignSystemTokens?: (patch: { colors?: string[] }) => Promise<{
        // OnboardingState shape — designSystem is a top-level field.
        designSystem?: StoredDS;
      }>;
    };
    const codesign = (window as { codesign?: Bridge }).codesign;
    if (!codesign?.updateDesignSystemTokens) {
      return { ok: false as const, reason: 'bridge-missing' as const };
    }
    try {
      const state = await codesign.updateDesignSystemTokens({
        colors: ['#ff0000', '#00ff00', '#0000ff'],
      });
      return {
        ok: true as const,
        colorsLen: state.designSystem?.colors?.length ?? 0,
        userEdited: state.designSystem?.userEdited ?? false,
        keys: Object.keys(state),
      };
    } catch (err) {
      return { ok: false as const, reason: err instanceof Error ? err.message : String(err) };
    }
  });

  if (!result.ok) {
    throw new Error(`updateDesignSystemTokens failed: ${result.reason}`);
  }
  expect(result.colorsLen).toBe(3);
  expect(result.userEdited).toBe(true);

  await expect(firstWindow).toHaveScreenshot('design-system-after-token-edit.png', {
    mask: [firstWindow.locator('[data-testid="ds-source-badge"]')],
  });

  await firstWindow.screenshot({
    path: path.join(SHOT_DIR, 'design-system-after-token-edit.png'),
    fullPage: true,
  });
});
