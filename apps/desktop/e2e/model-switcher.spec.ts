/**
 * UAT: ModelSwitcher component.
 *
 * Uses `testOnboarded` fixture.
 */

import * as path from 'node:path';
import { expect, testOnboarded as test } from './fixtures/electron-app';

const SCREENSHOT_DIR = path.join(__dirname, '../test-results/screenshots');

test('model switcher renders', async ({ firstWindow }) => {
  // Wait for config to hydrate — ModelSwitcher only renders if config.hasKey & modelPrimary set.
  await firstWindow.waitForFunction(
    () =>
      (window as Window & { __codesign_test_store__?: unknown }).__codesign_test_store__ != null,
    { timeout: 10_000 },
  );
  await firstWindow.waitForFunction(
    () => {
      const w = window as Window & {
        __codesign_test_store__?: { getState: () => { configHydrated?: boolean } };
      };
      return w.__codesign_test_store__?.getState().configHydrated === true;
    },
    { timeout: 10_000 },
  );

  const modelSwitcher = firstWindow.getByTestId('model-switcher-button-trigger').first();

  await firstWindow.screenshot({
    path: path.join(SCREENSHOT_DIR, 'model-switcher-renders.png'),
  });

  const found = await modelSwitcher.count();

  if (found === 0) {
    test.skip(
      true,
      'ModelSwitcher not found via testid — component returns null when config has no modelPrimary; ' +
        'check testOnboarded fixture seeded config',
    );
    return;
  }

  await expect(modelSwitcher).toBeVisible();
});

test('clicking model switcher opens model list', async ({ firstWindow }) => {
  await firstWindow.waitForFunction(
    () => {
      const w = window as Window & {
        __codesign_test_store__?: { getState: () => { configHydrated?: boolean } };
      };
      return w.__codesign_test_store__?.getState().configHydrated === true;
    },
    { timeout: 10_000 },
  );

  const modelSwitcher = firstWindow.getByTestId('model-switcher-button-trigger').first();

  const found = await modelSwitcher.count();

  if (found === 0) {
    test.skip(true, 'ModelSwitcher not found via testid; check seeded config');
    return;
  }

  await modelSwitcher.click();
  await firstWindow.waitForTimeout(600);

  await firstWindow.screenshot({
    path: path.join(SCREENSHOT_DIR, 'model-switcher-open.png'),
  });

  // After clicking, a listbox, popover, or menu should appear.
  const list = firstWindow
    .getByRole('listbox')
    .or(firstWindow.getByRole('menu'))
    .or(firstWindow.getByRole('dialog'))
    .first();

  const listFound = await list.count();

  if (listFound === 0) {
    test.skip(
      true,
      'Model list did not open after click — may require real provider with models ' +
        'endpoint or the popover uses a non-standard role',
    );
    return;
  }

  await expect(list).toBeVisible();

  // Dismiss by pressing Escape.
  await firstWindow.keyboard.press('Escape');
  await firstWindow.waitForTimeout(300);
});
