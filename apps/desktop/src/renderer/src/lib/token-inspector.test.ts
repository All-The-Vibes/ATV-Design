import { describe, expect, it } from 'vitest';
import { classifyToken, parseRootTokens } from './token-inspector';

/**
 * T2/T3 — DesignCanvas split, unit 2: the live design-token inspector.
 *
 * Ported from Terminal 42 `DesignCanvas.tsx` (readProjectTokens + classifyToken,
 * lines 1386-1428) — part of what the analysis doc §2 calls "the single
 * highest-value UI asset in either repo." The eng review's CQ-F4 split pulls it
 * out of the god-component. The value-bearing logic is `parseRootTokens`, a pure
 * CSS-text parser (no DOM), so it is unit-testable in the desktop package's
 * node test environment — `readProjectTokens(doc)` is a thin DOM wrapper over it.
 */

describe('classifyToken — value-shape classification', () => {
  it('classifies hex colors as color', () => {
    expect(classifyToken('#fff')).toBe('color');
    expect(classifyToken('#c8763e')).toBe('color');
    expect(classifyToken('#11223344')).toBe('color');
  });

  it('classifies rgb/rgba/hsl/hsla as color', () => {
    expect(classifyToken('rgb(10 20 30)')).toBe('color');
    expect(classifyToken('rgba(10,20,30,0.5)')).toBe('color');
    expect(classifyToken('hsl(200 50% 50%)')).toBe('color');
    expect(classifyToken('hsla(200,50%,50%,0.4)')).toBe('color');
  });

  it('classifies dimensional / numeric values as number', () => {
    for (const v of ['16px', '1.5rem', '100%', '0', '24', '2.5em', '300ms', '1.2s', '80vw']) {
      expect(classifyToken(v), v).toBe('number');
    }
  });

  it('classifies font stacks and free text as text', () => {
    expect(classifyToken("'DM Sans', sans-serif")).toBe('text');
    expect(classifyToken('cubic-bezier(0.4, 0, 0.2, 1)')).toBe('text');
  });
});

describe('parseRootTokens — extract :root tokens from design CSS', () => {
  it('pulls --custom-props out of a :root block', () => {
    const names = parseRootTokens([
      ':root { --brand: #c8763e; --gap: 16px; --font: "DM Sans", sans-serif; }',
    ]).map((t) => t.name);
    expect(names).toContain('--brand');
    expect(names).toContain('--gap');
    expect(names).toContain('--font');
  });

  it('classifies each extracted token by value shape', () => {
    const byName = Object.fromEntries(
      parseRootTokens([':root { --brand: #c8763e; --gap: 16px; --font: serif; }']).map((t) => [
        t.name,
        t.kind,
      ]),
    );
    expect(byName['--brand']).toBe('color');
    expect(byName['--gap']).toBe('number');
    expect(byName['--font']).toBe('text');
  });

  it('orders tokens color-first, then number, then text (inspector swatch order)', () => {
    const kinds = parseRootTokens([':root { --font: serif; --gap: 8px; --brand: #000; }']).map(
      (t) => t.kind,
    );
    const firstColor = kinds.indexOf('color');
    const firstNumber = kinds.indexOf('number');
    const firstText = kinds.indexOf('text');
    expect(firstColor).toBeLessThan(firstNumber);
    expect(firstNumber).toBeLessThan(firstText);
  });

  it('dedupes a token declared in multiple :root blocks (first wins)', () => {
    const brand = parseRootTokens([':root { --brand: #111; }', ':root { --brand: #222; }']).filter(
      (t) => t.name === '--brand',
    );
    expect(brand).toHaveLength(1);
    expect(brand[0]?.value).toBe('#111');
  });

  it('also reads html { … } blocks, not just :root', () => {
    const names = parseRootTokens(['html { --x: #fff; }']).map((t) => t.name);
    expect(names).toContain('--x');
  });

  it('returns an empty list when the CSS defines no :root tokens', () => {
    expect(parseRootTokens(['body { margin: 0 }'])).toEqual([]);
  });

  it('reads tokens across multiple style chunks', () => {
    const names = parseRootTokens([':root { --a: #fff; }', ':root { --b: 12px; }']).map(
      (t) => t.name,
    );
    expect(names).toContain('--a');
    expect(names).toContain('--b');
  });

  it('prefers a resolver value (collapsed var()) over the literal when provided', () => {
    const tokens = parseRootTokens([':root { --brand: var(--accent); }'], (name) =>
      name === '--brand' ? '#0ea5e9' : '',
    );
    const brand = tokens.find((t) => t.name === '--brand');
    expect(brand?.value).toBe('#0ea5e9');
    expect(brand?.kind).toBe('color');
  });
});
