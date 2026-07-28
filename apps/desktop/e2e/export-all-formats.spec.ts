/**
 * Manual export verification — PR #42 test-plan box.
 *
 * Exports a real design to all five formats through the *real* export IPC
 * (only the save dialog is stubbed), then inspects each written file for
 * format-appropriate evidence that the artifact actually made it through.
 *
 * This is the manual counterpart to `export-semantic.spec.ts`: that test
 * proves the HTML export renders; this one proves all five formats produce a
 * plausible, non-empty, correctly-typed file from a single JSX artifact.
 *
 * Run against a built app:
 *   pnpm build:dir && pnpm exec playwright test e2e/export-all-formats.spec.ts
 */

import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { expect, testOnboarded as test } from './fixtures/electron-app';

const JSX_ARTIFACT = `const TWEAK_DEFAULTS = /* EDITMODE-BEGIN */{ heading: 'Quarterly Review' }/* EDITMODE-END */;
function App() {
  return (
    <div className="p-8">
      <h1 data-testid="exported-heading">{TWEAK_DEFAULTS.heading}</h1>
      <p>Revenue grew 24% quarter over quarter.</p>
      <ul><li>Enterprise: 62%</li><li>Self-serve: 38%</li></ul>
    </div>
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(<App />);`;

/** Leading bytes that identify each container format. */
const MAGIC: Record<string, (buf: Buffer) => boolean> = {
  // PDF files begin with "%PDF-".
  pdf: (b) => b.subarray(0, 5).toString('latin1') === '%PDF-',
  // PPTX and ZIP are both ZIP containers ("PK\x03\x04").
  pptx: (b) => b.subarray(0, 2).toString('latin1') === 'PK',
  zip: (b) => b.subarray(0, 2).toString('latin1') === 'PK',
};

test('exports a real design to all five formats', async ({ electronApp, firstWindow }) => {
  const outDir = mkdtempSync(path.join(os.tmpdir(), 'codesign-export-all-'));
  const results: Record<string, { bytes: number; ok: boolean; note: string }> = {};

  try {
    await firstWindow.waitForFunction(
      () =>
        (window as Window & { __codesign_test_store__?: unknown }).__codesign_test_store__ != null,
      { timeout: 15_000 },
    );

    for (const format of ['html', 'pdf', 'pptx', 'zip', 'markdown'] as const) {
      const ext = format === 'markdown' ? 'md' : format;
      const outPath = path.join(outDir, `design.${ext}`);

      await electronApp.evaluate(({ dialog }, filePath) => {
        dialog.showSaveDialog = (async () => ({
          canceled: false,
          filePath,
        })) as typeof dialog.showSaveDialog;
      }, outPath);

      const res = await firstWindow.evaluate(
        async ({ artifact, fmt }) => {
          const w = window as Window & {
            __codesign_test_store__?: {
              getState: () => {
                exportActive: (format: string) => Promise<void>;
                lastError?: string | null;
              };
              setState: (patch: Record<string, unknown>) => void;
            };
          };
          const store = w.__codesign_test_store__;
          if (!store) return { ok: false, error: 'no test store' };
          store.setState({ previewHtml: artifact, lastError: null });
          try {
            await store.getState().exportActive(fmt);
          } catch (e) {
            return { ok: false, error: String(e) };
          }
          return { ok: true, error: store.getState().lastError ?? null };
        },
        { artifact: JSX_ARTIFACT, fmt: format },
      );

      expect(res.ok, `${format}: export threw`).toBe(true);

      // Markdown is the one format that CANNOT succeed for a JSX artifact
      // today, and that is the intended N0 behaviour rather than a gap in
      // this run. `convertBody` strips <head> and every <script>, and the
      // compiled artifact renders on the client, so there is no static HTML
      // left to convert — the export would be YAML frontmatter and nothing
      // else. N0 made that fail loudly instead of writing a 34-byte file and
      // calling it a success. Static prerendering is N6; when it lands this
      // branch flips to the normal success path.
      if (format === 'markdown') {
        expect(res.error, 'markdown should refuse a client-rendered artifact').toContain(
          'produced no content',
        );
        results[format] = {
          bytes: 0,
          ok: true,
          note: 'correctly refused (client-rendered; N6 will fix)',
        };
        continue;
      }

      expect(res.error, `${format}: store reported an error`).toBeNull();

      const stat = statSync(outPath);
      expect(stat.size, `${format}: wrote an empty file`).toBeGreaterThan(0);

      let note = '';
      const magic = MAGIC[format];
      if (magic) {
        const buf = readFileSync(outPath);
        expect(magic(buf), `${format}: wrong container magic bytes`).toBe(true);
        note = `valid ${format} container`;
      } else {
        const text = readFileSync(outPath, 'utf8');
        // The N0 guarantee: compiled, self-executing, not literal JSX.
        expect(text).toMatch(/<!doctype html>/i);
        expect(text).toContain('text/babel');
        expect(text).toContain('id="root"');
        note = 'compiled runtime present';
      }

      results[format] = { bytes: stat.size, ok: true, note };
    }

    // eslint-disable-next-line no-console
    console.log('\n=== EXPORT VERIFICATION (PR #42) ===');
    for (const [format, r] of Object.entries(results)) {
      // eslint-disable-next-line no-console
      console.log(`  ${format.padEnd(9)} ${String(r.bytes).padStart(10)} bytes  ${r.note}`);
    }
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
});

/**
 * The markdown guard must reject *client-rendered* documents specifically,
 * not markdown export in general. Without this, a guard that rejected
 * everything would look identical in the run above.
 */
test('markdown export still works for a static HTML artifact', async ({
  electronApp,
  firstWindow,
}) => {
  const outDir = mkdtempSync(path.join(os.tmpdir(), 'codesign-export-md-'));
  const outPath = path.join(outDir, 'static.md');

  try {
    await electronApp.evaluate(({ dialog }, filePath) => {
      dialog.showSaveDialog = (async () => ({
        canceled: false,
        filePath,
      })) as typeof dialog.showSaveDialog;
    }, outPath);

    await firstWindow.waitForFunction(
      () =>
        (window as Window & { __codesign_test_store__?: unknown }).__codesign_test_store__ != null,
      { timeout: 15_000 },
    );

    // A legacy pre-JSX-switchover snapshot: a real static HTML document.
    const STATIC_HTML =
      '<!doctype html><html><head><title>Report</title></head>' +
      '<body><h1>Quarterly Review</h1><p>Revenue grew 24%.</p></body></html>';

    const res = await firstWindow.evaluate(async (artifact) => {
      const w = window as Window & {
        __codesign_test_store__?: {
          getState: () => {
            exportActive: (format: string) => Promise<void>;
            lastError?: string | null;
          };
          setState: (patch: Record<string, unknown>) => void;
        };
      };
      const store = w.__codesign_test_store__;
      if (!store) return { ok: false, error: 'no test store' };
      store.setState({ previewHtml: artifact, lastError: null });
      await store.getState().exportActive('markdown');
      return { ok: true, error: store.getState().lastError ?? null };
    }, STATIC_HTML);

    expect(res.ok).toBe(true);
    expect(res.error).toBeNull();

    const md = readFileSync(outPath, 'utf8');
    expect(md).toMatch(/^---\n/);
    expect(md).toContain('# Quarterly Review');
    expect(md).toContain('Revenue grew 24%');
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
});
