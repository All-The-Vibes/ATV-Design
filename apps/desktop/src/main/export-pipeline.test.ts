import { buildHtmlDocument } from '@atv-design/exporters/html';
import { buildSrcdoc } from '@atv-design/runtime';
import { describe, expect, it } from 'vitest';

/**
 * N0 green-path integration test.
 *
 * `packages/exporters` deliberately does not depend on `@atv-design/runtime`
 * (the exporters consume rendered HTML and know nothing about JSX), so the
 * full compile-then-export pipeline can only be asserted here, where both
 * packages are in scope — the same place the real seam lives.
 *
 * `html.test.ts` in the exporters package pins the *broken* behaviour (raw
 * JSX gets wrapped, not compiled). This is its counterpart: it proves the
 * post-N0 path actually produces an executable document. Without it, deleting
 * the `buildSrcdoc` call in `store.ts:exportActive` would leave the exporter
 * unit suite entirely green.
 */

const JSX_ARTIFACT = `const TWEAK_DEFAULTS = /* EDITMODE-BEGIN */{ title: 'Hello' }/* EDITMODE-END */;
function App() {
  return <div className="p-4"><h1>{TWEAK_DEFAULTS.title}</h1></div>;
}
ReactDOM.createRoot(document.getElementById('root')).render(<App />);`;

describe('export pipeline — compile then build (N0 green path)', () => {
  const exported = buildHtmlDocument(buildSrcdoc(JSX_ARTIFACT));

  it('ships a runtime that can actually execute the artifact', () => {
    expect(exported).toContain('text/babel');
    expect(exported).toContain('id="root"');
    // React + ReactDOM + Babel are inlined, so the document is substantial.
    // The pre-N0 output was a few hundred bytes of literal JSX.
    expect(exported.length).toBeGreaterThan(100_000);
  });

  it('still carries the agent source, but as an executable script body', () => {
    // The JSX is present (Babel transpiles it in-page), but now inside a
    // <script type="text/babel"> rather than loose in the document body.
    const scriptIdx = exported.indexOf('text/babel');
    expect(scriptIdx).toBeGreaterThan(-1);
    expect(exported.indexOf('function App()')).toBeGreaterThan(scriptIdx);
  });

  it('emits exactly one doctype through the full pipeline', () => {
    expect(exported.match(/<!doctype html>/gi)).toHaveLength(1);
  });

  it('is a complete document, not a bare fragment', () => {
    expect(exported).toMatch(/<html/i);
    expect(exported).toMatch(/<\/html>/i);
  });
});
