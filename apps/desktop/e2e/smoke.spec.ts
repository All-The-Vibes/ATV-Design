import * as path from 'node:path';
import { expect, test } from './fixtures/electron-app';

test('app launches and main window opens', async ({ firstWindow }) => {
  const title = await firstWindow.title();
  expect(title).toBeTruthy();
  expect(title.length).toBeGreaterThan(0);

  const isVisible = await firstWindow.isVisible('body');
  expect(isVisible).toBe(true);

  await firstWindow.screenshot({
    path: path.join(__dirname, '../test-results/screenshots/smoke-launch.png'),
  });
});

test('renderer mounts without console errors', async ({ firstWindow }) => {
  const consoleErrors: string[] = [];

  firstWindow.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  // Settle for 3s to catch deferred errors
  await firstWindow.waitForTimeout(3_000);

  expect(consoleErrors).toEqual([]);
});

test('app version is exposed', async ({ electronApp }) => {
  const version = await electronApp.evaluate(({ app }) => app.getVersion());
  // Should be a semver-like string e.g. "0.1.4"
  expect(version).toMatch(/^\d+\.\d+/);
});
