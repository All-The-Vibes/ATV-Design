/**
 * UAT: Design System tab — Components panel.
 *
 * Drives the new Components panel introduced in Wave 2:
 *   1. Components panel is rendered with the built-in default entries
 *   2. "+ Add" appends a new row
 *   3. Typing a rule in the new row persists via the bridge
 *
 * NOTE: `toHaveScreenshot` baselines are created on first run with
 * `--update-snapshots`. They live in e2e/__snapshots__/. The first CI run
 * without committed baselines will fail — commit the generated PNGs after
 * verifying them locally.
 *
 * Uses the `testOnboarded` fixture (ollama-keyless config) — no OAuth exercised.
 */

import * as path from 'node:path';
import { expect, testOnboarded as test } from './fixtures/electron-app';

const SHOT_DIR = path.join(__dirname, '../test-results/screenshots');
const HUB_TAB_KEY = 'designSystems';

async function gotoDesignSystemsTab(win: import('@playwright/test').Page): Promise<void> {
  await win.evaluate((tab: string) => {
    type StoreWindow = Window & {
      __codesignStore?: { getState: () => { setHubTab: (t: string) => void } };
    };
    const w = window as StoreWindow;
    if (w.__codesignStore?.getState) {
      w.__codesignStore.getState().setHubTab(tab);
    }
  }, HUB_TAB_KEY);

  const tabButton = win.getByRole('button', { name: /design\s*systems/i }).first();
  if (await tabButton.count()) {
    await tabButton.click().catch(() => undefined);
  }
}

test('components panel is visible with built-in default entries', async ({ firstWindow }) => {
  await gotoDesignSystemsTab(firstWindow);

  // Wait for the tab to render
  await expect(firstWindow.getByText(/built[-\s]?in/i).first()).toBeVisible({ timeout: 8_000 });

  // Components panel heading
  const componentsHeader = firstWindow.getByRole('heading', { name: /components/i, level: 3 });
  await expect(componentsHeader).toBeVisible({ timeout: 4_000 });

  // At least one built-in entry (Buttons) should be visible
  await expect(firstWindow.getByText('Buttons').first()).toBeVisible({ timeout: 4_000 });

  await expect(firstWindow).toHaveScreenshot('design-system-components-default.png', {
    mask: [firstWindow.locator('[data-testid="ds-source-badge"]')],
  });

  await firstWindow.screenshot({
    path: path.join(SHOT_DIR, 'design-system-components-default.png'),
    fullPage: true,
  });
});

test('clicking Add in Components panel appends a new row', async ({ firstWindow }) => {
  await gotoDesignSystemsTab(firstWindow);

  // Wait for tab render
  await expect(firstWindow.getByText(/built[-\s]?in/i).first()).toBeVisible({ timeout: 8_000 });
  await expect(firstWindow.getByRole('heading', { name: /components/i, level: 3 })).toBeVisible({
    timeout: 4_000,
  });

  // Count component rows before adding
  const rowsBefore = await firstWindow.getByText('Buttons').count();
  expect(rowsBefore).toBeGreaterThanOrEqual(1);

  // Find the "+ Add" button inside the Components panel header.
  // The tab wraps every TokenPanel in an outer <section>, which ALSO contains
  // the Components heading — so the filter matches both the outer wrapper and
  // the inner Components panel. `.last()` selects the innermost (Components)
  // panel; `.first()` would grab the outer wrapper and click the Colors Add.
  const componentsSection = firstWindow
    .locator('section')
    .filter({
      has: firstWindow.getByRole('heading', { name: /components/i, level: 3 }),
    })
    .last();
  const addButton = componentsSection.getByRole('button', { name: /^\+\s*add/i }).first();
  await expect(addButton).toBeVisible({ timeout: 4_000 });
  await addButton.click();

  // A new row with "New component" text should appear
  const newRow = firstWindow.getByText(/new component/i).first();
  await expect(newRow).toBeVisible({ timeout: 4_000 });

  await expect(firstWindow).toHaveScreenshot('design-system-components-after-add.png', {
    mask: [firstWindow.locator('[data-testid="ds-source-badge"]')],
  });

  await firstWindow.screenshot({
    path: path.join(SHOT_DIR, 'design-system-components-after-add.png'),
    fullPage: true,
  });
});

test('editing a component rule dispatches updateDesignSystemTokens', async ({ firstWindow }) => {
  await gotoDesignSystemsTab(firstWindow);

  await expect(firstWindow.getByText(/built[-\s]?in/i).first()).toBeVisible({ timeout: 8_000 });

  // Use the bridge directly to patch components — same pattern as the token edit test
  const result = await firstWindow.evaluate(async () => {
    type Bridge = {
      updateDesignSystemTokens?: (patch: {
        components?: Array<{ name: string; rule: string }>;
      }) => Promise<{
        designSystem?: {
          components?: Array<{ name: string; rule: string }>;
          userEdited?: boolean;
        } | null;
      }>;
    };
    const codesign = (window as { codesign?: Bridge }).codesign;
    if (!codesign?.updateDesignSystemTokens) {
      return { ok: false as const, reason: 'bridge-missing' as const };
    }
    try {
      const state = await codesign.updateDesignSystemTokens({
        components: [
          { name: 'Buttons', rule: 'Updated rule for E2E test.' },
          { name: 'Cards', rule: 'Cards use surface tokens.' },
        ],
      });
      return {
        ok: true as const,
        count: state.designSystem?.components?.length ?? 0,
        firstRule: state.designSystem?.components?.[0]?.rule ?? '',
        userEdited: state.designSystem?.userEdited ?? false,
      };
    } catch (err) {
      return { ok: false as const, reason: err instanceof Error ? err.message : String(err) };
    }
  });

  if (!result.ok) {
    throw new Error(`updateDesignSystemTokens (components) failed: ${result.reason}`);
  }

  expect(result.count).toBe(2);
  expect(result.firstRule).toBe('Updated rule for E2E test.');
  expect(result.userEdited).toBe(true);

  await expect(firstWindow).toHaveScreenshot('design-system-components-after-rule-edit.png', {
    mask: [firstWindow.locator('[data-testid="ds-source-badge"]')],
  });

  await firstWindow.screenshot({
    path: path.join(SHOT_DIR, 'design-system-components-after-rule-edit.png'),
    fullPage: true,
  });
});
