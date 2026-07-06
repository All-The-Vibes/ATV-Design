import { describe, expect, it } from 'vitest';
import { extractRootCssVars } from './css-vars';

describe('extractRootCssVars', () => {
  it('extracts custom properties from a :root block', () => {
    const css = `:root {
      --color-accent: #CC785C;
      --radius-base: 8px;
      --space-unit: 4px;
    }`;
    expect(extractRootCssVars(css)).toEqual({
      '--color-accent': '#CC785C',
      '--radius-base': '8px',
      '--space-unit': '4px',
    });
  });

  it('extracts from a :root block embedded in a full HTML document', () => {
    const html = `<!doctype html><html><head><style>
      :root { --color-bg: #0a0a0a; --font-display: 'Fraunces', serif; }
      body { background: var(--color-bg); }
    </style></head><body></body></html>`;
    expect(extractRootCssVars(html)).toEqual({
      '--color-bg': '#0a0a0a',
      '--font-display': "'Fraunces', serif",
    });
  });

  it('merges multiple :root blocks (later wins on conflict)', () => {
    const css = ':root { --a: 1; --b: 2; } :root { --b: 3; --c: 4; }';
    expect(extractRootCssVars(css)).toEqual({ '--a': '1', '--b': '3', '--c': '4' });
  });

  it('ignores non-custom declarations inside :root', () => {
    const css = ':root { --a: 1; color: red; font-size: 16px; --b: 2; }';
    expect(extractRootCssVars(css)).toEqual({ '--a': '1', '--b': '2' });
  });

  it('handles values containing colons, parens, and commas', () => {
    const css = `:root {
      --shadow: 0 2px 8px rgba(0,0,0,0.4);
      --gradient: linear-gradient(180deg, #fff 0%, #000 100%);
      --url: url("https://x.test/a.png");
    }`;
    expect(extractRootCssVars(css)).toEqual({
      '--shadow': '0 2px 8px rgba(0,0,0,0.4)',
      '--gradient': 'linear-gradient(180deg, #fff 0%, #000 100%)',
      '--url': 'url("https://x.test/a.png")',
    });
  });

  it('returns an empty object when there is no :root block', () => {
    expect(extractRootCssVars('<div>no styles</div>')).toEqual({});
    expect(extractRootCssVars('body { color: red; }')).toEqual({});
    expect(extractRootCssVars('')).toEqual({});
  });

  it('returns an empty object for a :root block with no custom properties', () => {
    expect(extractRootCssVars(':root { color: red; }')).toEqual({});
  });

  it('trims whitespace around names and values', () => {
    const css = ':root {   --x :  10px  ;  --y:20px; }';
    expect(extractRootCssVars(css)).toEqual({ '--x': '10px', '--y': '20px' });
  });

  it('is resilient to a missing closing brace (degrades, does not throw)', () => {
    // Truncated/malformed input must never crash the preview pipeline.
    expect(() => extractRootCssVars(':root { --a: 1; --b: 2')).not.toThrow();
  });

  it('does not let a brace inside a string value close the block early', () => {
    // `--quote: "}"` must NOT terminate the :root block at the inner brace.
    const css = ':root { --quote: "}"; --b: 2; }';
    expect(extractRootCssVars(css)).toEqual({ '--quote': '"}"', '--b': '2' });
  });

  it('does not split a declaration on a semicolon inside a string value', () => {
    const css = `:root { --sep: "a;b"; --b: 2; }`;
    expect(extractRootCssVars(css)).toEqual({ '--sep': '"a;b"', '--b': '2' });
  });

  it("ignores a :root that appears inside another rule's string value", () => {
    // `content: ":root{--evil:1}"` is text, not a selector — must not extract.
    const css = `body::after { content: ":root { --evil: 1 }"; } :root { --real: 2; }`;
    expect(extractRootCssVars(css)).toEqual({ '--real': '2' });
  });

  it('ignores a :root inside a CSS comment', () => {
    const css = '/* :root { --commented: 1 } */ :root { --real: 2; }';
    expect(extractRootCssVars(css)).toEqual({ '--real': '2' });
  });

  it('runs in well under a second on large pathological input (no ReDoS)', () => {
    const evil = `:root ${'a'.repeat(100_000)} { --a: 1; }`;
    const t0 = performance.now();
    extractRootCssVars(evil);
    expect(performance.now() - t0).toBeLessThan(500);
  });

  it('runs in well under a second on many :root blocks (no quadratic rescan)', () => {
    // Reachability: buildSrcdoc → extractRootCssVars runs synchronously in the
    // Electron main process (done-verify.ts) on model-generated artifact HTML,
    // BEFORE the 3s verify timeout can fire. A rescan-per-:root-match is O(n²):
    // ~0.5 MB of :root blocks froze the main process for ~33s. The scan must
    // stay linear in the number of blocks.
    const manyBlocks = ':root{--a:1;}'.repeat(40_000); // ~0.5 MB
    const t0 = performance.now();
    const out = extractRootCssVars(manyBlocks);
    expect(performance.now() - t0).toBeLessThan(500);
    expect(out).toEqual({ '--a': '1' });
  });

  it('stays linear when :root tokens have a distant or absent following brace', () => {
    // The dangerous vector: `:root :root :root …` (or a huge `:root,:root,…`
    // selector list) forces a forward scan for `{` on every match if the gap is
    // rescanned per-match. A genuine single pass consumes the gap once.
    const distantBrace = ':root '.repeat(150_000); // ~0.9 MB, no brace at all
    const t0 = performance.now();
    expect(extractRootCssVars(distantBrace)).toEqual({});
    expect(performance.now() - t0).toBeLessThan(500);

    const selectorList = `${':root,'.repeat(100_000)}.x { --a: 1; }`; // ~0.6 MB
    const t1 = performance.now();
    expect(extractRootCssVars(selectorList)).toEqual({ '--a': '1' });
    expect(performance.now() - t1).toBeLessThan(500);
  });

  it('caps the scan on pathological megabyte-scale input (defense-in-depth)', () => {
    // Beyond the scan cap the extractor stops early rather than risk any
    // large-input freeze in the main process. Real design tokens live near the
    // top of a document, so tokens within the first ~1 MB are still found.
    const leadingRoot = ':root { --a: 1; }';
    const huge = leadingRoot + ' '.repeat(3_000_000); // tokens up front, then bulk
    const t0 = performance.now();
    expect(extractRootCssVars(huge)).toEqual({ '--a': '1' });
    expect(performance.now() - t0).toBeLessThan(500);

    // A block that begins only AFTER the cap is intentionally not scanned.
    const past = `${' '.repeat(1_500_000)}:root { --late: 9; }`;
    expect(extractRootCssVars(past)).toEqual({});
  });

  it('finds the :root block when a } sits inside a comment or string in the selector gap', () => {
    // The :root→{ gap must be parsed with comment/string awareness, not a raw
    // indexOf('}') that would falsely reject these valid rules.
    expect(extractRootCssVars(':root /* } */ { --a: 1; }')).toEqual({ '--a': '1' });
    expect(extractRootCssVars(':root[data-x="}"] { --a: 1; }')).toEqual({ '--a': '1' });
  });

  it('extracts :root nested inside conditional-group at-rules', () => {
    // The canonical dark-mode / responsive token pattern (Tailwind v4, shadcn).
    expect(extractRootCssVars('@media (prefers-color-scheme: dark) { :root { --a: 1 } }')).toEqual({
      '--a': '1',
    });
    expect(extractRootCssVars('@layer base { :root { --brand: #fff } }')).toEqual({
      '--brand': '#fff',
    });
    expect(extractRootCssVars('@supports (display: grid) { :root { --x: 2 } }')).toEqual({
      '--x': '2',
    });
    expect(extractRootCssVars('@container (min-width: 0) { :root { --c: 3 } }')).toEqual({
      '--c': '3',
    });
    // Nested groups.
    expect(extractRootCssVars('@media a { @media b { :root { --deep: 9 } } }')).toEqual({
      '--deep': '9',
    });
    // A media-scoped :root overrides an earlier top-level one (cascade order).
    expect(extractRootCssVars(':root { --a: 1 } @media x { :root { --a: 2 } }')).toEqual({
      '--a': '2',
    });
  });

  it('does not descend into declaration at-rules or ordinary style rules', () => {
    // @font-face / @keyframes bodies and normal selectors are NOT conditional
    // groups; a `--a` inside them must not be mistaken for a :root token.
    expect(extractRootCssVars('@font-face { font-family: x } :root { --a: 1 }')).toEqual({
      '--a': '1',
    });
    expect(extractRootCssVars('@keyframes k { from { --a: 99 } } :root { --a: 1 }')).toEqual({
      '--a': '1',
    });
    expect(extractRootCssVars('.card { --a: 99 } :root { --a: 1 }')).toEqual({ '--a': '1' });
  });

  it('does not descend on an at-rule keyword hidden in a comment or attribute string', () => {
    // The group-at-rule decision is made from a REAL `@` token, so an `@media`
    // inside a comment or an attribute-selector string must not spoof a descent
    // into an ordinary style rule.
    expect(extractRootCssVars('/* @media */ .x { :root { --evil: 9 } }')).toEqual({});
    expect(extractRootCssVars('[data-q="@supports"] { :root { --evil: 9 } }')).toEqual({});
  });

  it('descends into a group at-rule whose prelude itself contains :root', () => {
    // `@supports selector(:root)` has `:root` in its PRELUDE; the group check
    // must win so the nested :root block is still extracted.
    expect(extractRootCssVars('@supports selector(:root) { :root { --b: 2 } }')).toEqual({
      '--b': '2',
    });
  });

  it('does not treat a longer at-rule as a group (e.g. @media-foo)', () => {
    expect(extractRootCssVars('@media-foo { :root { --a: 9 } } :root { --a: 1 }')).toEqual({
      '--a': '1',
    });
  });

  it('stays linear even with deeply nested conditional-group at-rules', () => {
    const nested = `${'@media a{'.repeat(100_000)}:root{--a:1}`;
    const t0 = performance.now();
    expect(extractRootCssVars(nested)).toEqual({ '--a': '1' });
    expect(performance.now() - t0).toBeLessThan(500);
  });
});
