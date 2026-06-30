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
});
