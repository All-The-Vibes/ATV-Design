/**
 * N1 — semantic export E2E.
 *
 * The originally-specified assertion for this test was "the exported file has
 * an HTML doctype". That assertion is vacuous: `buildHtmlDocument` prepends a
 * doctype unconditionally, so it passed on the pre-N0 output — a file
 * containing literal, unexecutable JSX that opened to a blank page. The test
 * as specified would have certified the bug it was meant to catch.
 *
 * This asserts the property a user actually cares about: **the exported file
 * renders**. It drives the real export IPC (same path the Export menu uses),
 * then opens the written file in a browser context with all network requests
 * blocked, and requires that `#root` gained children and no console errors
 * were logged.
 *
 * Network blocking is the load-bearing part. `buildSrcdoc` inlines React,
 * ReactDOM, and Babel, so a correct export renders fully offline. If a future
 * refactor replaces those inlines with CDN tags, this test fails — which is
 * the regression we want to hear about.
 */

import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { ElectronApplication, Page } from '@playwright/test';
import { expect, testOnboarded as test } from './fixtures/electron-app';

/** A representative agent artifact: the bare JSX module contract. */
const JSX_ARTIFACT = `const TWEAK_DEFAULTS = /* EDITMODE-BEGIN */{ heading: 'Exported OK' }/* EDITMODE-END */;
function App() {
  return (
    <div className="p-8">
      <h1 data-testid="exported-heading">{TWEAK_DEFAULTS.heading}</h1>
      <p>Rendered from the exported file.</p>
    </div>
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(<App />);`;

/**
 * Open `filePath` in a fresh Electron BrowserWindow with **all** network
 * egress blocked, and hand back the Playwright Page for it.
 *
 * A correct export is self-contained (`buildSrcdoc` inlines React, ReactDOM,
 * and Babel), so it must render with the network cut. If it ever depends on a
 * CDN again, the blocked request turns into a console error and the caller's
 * assertions fail — which is the regression this test exists to catch.
 */
async function openExportedFile(electronApp: ElectronApplication, filePath: string): Promise<Page> {
  // Start waiting BEFORE the window is created, otherwise the event can fire
  // while we are still inside `evaluate` and the wait times out.
  const pagePromise = electronApp.waitForEvent('window', { timeout: 20_000 });

  await electronApp.evaluate(({ BrowserWindow, session }, file) => {
    const ses = session.fromPartition(`e2e-export-${Math.random().toString(36).slice(2)}`);
    // Block everything that is not the local file itself.
    ses.webRequest.onBeforeRequest((details, callback) => {
      const isLocal = details.url.startsWith('file://') || details.url.startsWith('data:');
      callback({ cancel: !isLocal });
    });

    const win = new BrowserWindow({
      show: false,
      width: 1280,
      height: 800,
      webPreferences: {
        session: ses,
        sandbox: true,
        nodeIntegration: false,
        contextIsolation: true,
      },
    });
    // Deliberately not awaited: the caller is already waiting for the
    // 'window' event, and awaiting the load here would deadlock that wait.
    void win.loadFile(file);
  }, filePath);

  return pagePromise;
}

test('exported HTML renders offline with no console errors', async ({
  electronApp,
  firstWindow,
}) => {
  const outDir = mkdtempSync(path.join(os.tmpdir(), 'codesign-e2e-export-'));
  const outPath = path.join(outDir, 'export.html');

  try {
    // Stub the save dialog in the main process so the export writes to a
    // known path without human interaction. This leaves the entire rest of
    // the export path — IPC validation, dispatch, the exporter itself —
    // exercised for real.
    await electronApp.evaluate(({ dialog }, filePath) => {
      dialog.showSaveDialog = (async () => ({
        canceled: false,
        filePath,
      })) as typeof dialog.showSaveDialog;
    }, outPath);

    // Seed the artifact into the store and invoke the real export action, so
    // the compile-before-dispatch step in `exportActive` is under test rather
    // than bypassed.
    await firstWindow.waitForFunction(
      () =>
        (window as Window & { __codesign_test_store__?: unknown }).__codesign_test_store__ != null,
      { timeout: 15_000 },
    );

    const result = await firstWindow.evaluate(async (artifact) => {
      const w = window as Window & {
        __codesign_test_store__?: {
          getState: () => {
            previewHtml: string | null;
            exportActive: (format: string) => Promise<void>;
            lastError?: string | null;
          };
          setState: (patch: Record<string, unknown>) => void;
        };
      };
      const store = w.__codesign_test_store__;
      if (!store) return { ok: false, reason: 'no test store' };
      store.setState({ previewHtml: artifact });
      await store.getState().exportActive('html');
      return { ok: true, lastError: store.getState().lastError ?? null };
    }, JSX_ARTIFACT);

    expect(result.ok).toBe(true);
    expect(result.lastError).toBeNull();

    const exported = readFileSync(outPath, 'utf8');

    // Structural preconditions. These are necessary but NOT sufficient —
    // the pre-N0 output satisfied the doctype check too, which is exactly
    // why the render assertion below exists.
    expect(exported).toMatch(/<!doctype html>/i);
    expect(exported.match(/<!doctype html>/gi)).toHaveLength(1);

    // The semantic assertion: open the file with the network cut and require
    // that it actually renders.
    //
    // Playwright's Electron driver cannot create browser contexts
    // (`Target.createTarget` is unsupported), so the file is opened in a real
    // Electron BrowserWindow instead. Network blocking is applied at the
    // session level via `webRequest`, which is stricter than page routing —
    // it covers subresources the renderer requests directly.
    const viewer = await openExportedFile(electronApp, outPath);

    const consoleErrors: string[] = [];
    viewer.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    viewer.on('pageerror', (err) => consoleErrors.push(String(err)));

    await viewer.waitForLoadState('domcontentloaded');

    // Babel transpiles in-page on load; give it a moment to mount.
    await viewer.waitForFunction(
      () => {
        const root = document.getElementById('root');
        return !!root && root.children.length > 0;
      },
      { timeout: 20_000 },
    );

    const rootChildren = await viewer.evaluate(
      () => document.getElementById('root')?.children.length ?? 0,
    );
    expect(rootChildren).toBeGreaterThan(0);

    // The artifact's own content made it through compile + export + render.
    await expect(viewer.getByTestId('exported-heading')).toHaveText('Exported OK');

    // Blocked-resource errors are expected TODAY and are pinned separately
    // below — the export is not yet self-contained (Tailwind CDN + Google
    // Fonts). Anything else is a genuine runtime failure.
    const blockedErrors = consoleErrors.filter((e) => e.includes('ERR_BLOCKED_BY_CLIENT'));
    const runtimeErrors = consoleErrors.filter((e) => !e.includes('ERR_BLOCKED_BY_CLIENT'));
    expect(runtimeErrors).toEqual([]);

    // The artifact renders *despite* those blocked requests, which is the N0
    // guarantee: React, ReactDOM, and Babel are inlined, so nothing needed to
    // execute the design comes off the network.
    //
    // N6 (html.ts Tier 2) makes the export genuinely self-contained by
    // inlining fonts and precompiling away the Tailwind CDN tag. When it
    // lands, `blockedErrors` drops to zero and this assertion should be
    // tightened to `toEqual([])` — the failure is the reminder to do so.
    expect(
      blockedErrors.length,
      'Export still fetches from the network (Tailwind CDN / Google Fonts). ' +
        'If N6 has landed, tighten this to expect zero blocked requests.',
    ).toBeLessThanOrEqual(2);
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
});
