import { describe, expect, it } from 'vitest';
import { buildSrcdoc, extractAndUpgradeArtifact } from './index';

describe('buildSrcdoc', () => {
  it('strips CSP meta tags', () => {
    const html =
      '<html><head><meta http-equiv="Content-Security-Policy" content="default-src none"></head><body></body></html>';
    const out = buildSrcdoc(html);
    expect(out).not.toContain('Content-Security-Policy');
  });

  it('keeps legacy full-HTML documents as HTML but injects the preview overlay', () => {
    // Snapshots written before the JSX-only switchover contain raw HTML
    // documents. Wrapping those as JSX makes Babel bark on the DOCTYPE /
    // <html> tokens, so buildSrcdoc injects the preview overlay without
    // routing them through the React+Babel wrapper.
    const html = '<html><body><p>x</p></body></html>';
    const out = buildSrcdoc(html);
    expect(out).toContain('<p>x</p>');
    expect(out).toContain('CODESIGN_OVERLAY_SCRIPT');
    expect(out).toContain('ELEMENT_SELECTED');
    expect(out).not.toContain('AGENT_BODY_BEGIN');

    const doctyped = '<!DOCTYPE html><html><body><p>y</p></body></html>';
    const doctypedOut = buildSrcdoc(doctyped);
    expect(doctypedOut).toContain('<p>y</p>');
    expect(doctypedOut).toContain('CODESIGN_OVERLAY_SCRIPT');
    expect(doctypedOut).not.toContain('AGENT_BODY_BEGIN');
  });

  it('does not duplicate the overlay when a full-HTML document is rebuilt', () => {
    const once = buildSrcdoc('<html><body><p>x</p></body></html>');
    const twice = buildSrcdoc(once);
    expect(twice).toBe(once);
  });

  it('wraps a fragment via the JSX path (no legacy HTML branch)', () => {
    const out = buildSrcdoc('<div>plain</div>');
    expect(out).toContain('AGENT_BODY_BEGIN');
    expect(out).toContain('<script type="text/babel"');
    expect(out).toContain('<div>plain</div>');
  });
});

describe('buildSrcdoc — static (script-less) artifact tweaks', () => {
  const staticArtifact = `<!doctype html><html><head><style>
    :root { --color-accent: #CC785C; --radius-base: 8px; }
    body { background: #fff; }
  </style></head><body><h1>Hi</h1></body></html>`;

  it('injects the static CSS-var tweak bridge into a script-less HTML doc with :root vars', () => {
    const out = buildSrcdoc(staticArtifact);
    // Bridge present + still rendered as a plain HTML doc (not JSX-wrapped).
    expect(out).toContain('CODESIGN_STATIC_TWEAKS');
    expect(out).toContain('codesign:tweaks:update');
    expect(out).toContain('<h1>Hi</h1>');
    expect(out).not.toContain('AGENT_BODY_BEGIN');
    // The overlay still goes in too.
    expect(out).toContain('CODESIGN_OVERLAY_SCRIPT');
  });

  it('seeds the bridge with the extracted :root tokens so a panel can read defaults', () => {
    const out = buildSrcdoc(staticArtifact);
    expect(out).toContain('--color-accent');
    expect(out).toContain('#CC785C');
    expect(out).toContain('--radius-base');
  });

  it('does NOT inject the static tweak bridge when the doc has no :root vars', () => {
    const noVars = '<!doctype html><html><body><p>x</p></body></html>';
    const out = buildSrcdoc(noVars);
    expect(out).not.toContain('CODESIGN_STATIC_TWEAKS');
    // Overlay still injected — only the tweak bridge degrades away.
    expect(out).toContain('CODESIGN_OVERLAY_SCRIPT');
  });

  it('does not duplicate the static bridge when a built doc is rebuilt', () => {
    const once = buildSrcdoc(staticArtifact);
    const twice = buildSrcdoc(once);
    expect(twice).toBe(once);
  });

  it('does not add a static bridge on the JSX path (scripted artifacts use the React tweaks bridge)', () => {
    const jsx = `const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{"a":1}/*EDITMODE-END*/;
ReactDOM.createRoot(document.getElementById('root')).render(<div/>);`;
    const out = buildSrcdoc(jsx);
    expect(out).not.toContain('CODESIGN_STATIC_TWEAKS');
  });

  it('does not splice document tail into the bridge via a $-pattern in a :root value', () => {
    // The bridge is injected with String.replace(/<\/body>/, `${script}...`).
    // A string replacement would interpret `$'` (and `$&`, `` $` ``) in the
    // script as special patterns, splicing UNescaped document text after the
    // match into the <script>. A :root value containing `$'` plus a trailing
    // `</script>` after </body> would then break out. A function replacer (used
    // now) inserts the payload verbatim, so nothing is spliced.
    const evil = `<!doctype html><html><head><style>
      :root { --x: "$'end"; }
    </style></head><body><h1>Hi</h1></body></html><script>alert('tail')</script>`;
    const out = buildSrcdoc(evil);
    // The original trailing script's content must not have been hoisted into the
    // injected bridge script — i.e. no `alert('tail')` appears before </body>.
    const beforeBody = out.slice(0, out.indexOf('</body>'));
    expect(beforeBody).not.toContain("alert('tail')");
  });
});

describe('buildSrcdoc — JSX path', () => {
  const jsxArtifact = `const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{"a":1}/*EDITMODE-END*/;
function App() { return <div>hi</div>; }
ReactDOM.createRoot(document.getElementById("root")).render(<App/>);`;

  it('routes JSX artifacts through the React+Babel template', () => {
    const out = buildSrcdoc(jsxArtifact);
    expect(out).toContain('AGENT_BODY_BEGIN');
    expect(out).toContain('AGENT_BODY_END');
    expect(out).toContain('text/babel');
    // Vendored runtime + frame snippets must be inlined.
    expect(out).toContain('IOSDevice');
    expect(out).toContain('DesignCanvas');
    // Overlay still present so element-selection / error reporting work.
    expect(out).toContain('ELEMENT_SELECTED');
    // The agent's payload is embedded between the markers.
    expect(out).toContain('TWEAK_DEFAULTS');
  });

  it('detects JSX via ReactDOM.createRoot signature even without EDITMODE', () => {
    const src = `function App() { return <div/>; } ReactDOM.createRoot(document.getElementById("root")).render(<App/>);`;
    const out = buildSrcdoc(src);
    expect(out).toContain('AGENT_BODY_BEGIN');
  });

  it('escapes spec-legal </script variants in the embedded originalScript string literal', () => {
    // The agent source is JSON-embedded as a STRING into the
    // `window.__codesign_tweaks__.originalScript="…"` assignment. That literal is
    // data (the tweaks bridge re-compiles it later), so a `</script `/`</script/`/
    // mixed-case closer inside it must be escaped or it breaks out of that
    // wrapper <script>. (The agent's own executable JSX in the AGENT_BODY babel
    // block is a separate, intentionally-verbatim concern.)
    const malicious = `const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{"x":"</script <img onerror=alert(1)>"}/*EDITMODE-END*/;
ReactDOM.createRoot(document.getElementById('root')).render(<div/>);`;
    const out = buildSrcdoc(malicious);
    const line = out.split('\n').find((l) => l.includes('originalScript=')) ?? '';
    // Isolate just the embedded string VALUE (between originalScript=" and the
    // closing ";} ), so the wrapper's own legitimate trailing </script> is not
    // counted.
    const value = line.slice(
      line.indexOf('originalScript="') + 'originalScript="'.length,
      line.lastIndexOf('";}'),
    );
    expect(value.length).toBeGreaterThan(0);
    // The script-closer inside the embedded literal must be neutralized.
    expect(value).not.toMatch(/<\/script[\s/>]/i);
    expect(value).toContain('<\\/script');
  });

  it('extractAndUpgradeArtifact wraps JSX payloads', () => {
    const wrapped = extractAndUpgradeArtifact(jsxArtifact);
    expect(wrapped).toContain('AGENT_BODY_BEGIN');
    expect(wrapped).toContain('TWEAK_DEFAULTS');
  });

  it('extractAndUpgradeArtifact also wraps bare HTML (JSX-only contract)', () => {
    const wrapped = extractAndUpgradeArtifact('<html><body>x</body></html>');
    expect(wrapped).toContain('AGENT_BODY_BEGIN');
    expect(wrapped).toContain('<script type="text/babel"');
  });

  it('extractAndUpgradeArtifact passes already-wrapped payloads through unchanged', () => {
    const wrapped = extractAndUpgradeArtifact(jsxArtifact);
    const wrappedTwice = extractAndUpgradeArtifact(wrapped);
    expect(wrappedTwice).toBe(wrapped);
  });

  it('buildSrcdoc passes already-wrapped payloads through unchanged', () => {
    const wrapped = buildSrcdoc(jsxArtifact);
    const wrappedTwice = buildSrcdoc(wrapped);
    expect(wrappedTwice).toBe(wrapped);
  });
});
