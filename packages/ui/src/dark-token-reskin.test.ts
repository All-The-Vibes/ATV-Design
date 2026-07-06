import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * T5 / Phase 1 — Dark-token reskin contract (ATV × Terminal 42 merge).
 *
 * Product decision Q1 (analysis/MERGE-ARCHITECTURE.md): adopt Terminal
 * 42's dark pro-tool system as the SINGLE identity and drop ATV's warm editorial
 * theme. The reskin keeps ATV's token plumbing (the --color-* names its 9
 * consumers already reference) and swaps the VALUES to T42's ladder.
 *
 * This test pins the merged dark theme to T42's signature so a future
 * "warm editorial" regression (a drift back to hue ~50 cream/terracotta) fails
 * loudly. It reads the real tokens.css rather than a snapshot so it tracks the
 * shipped file.
 *
 * T42 dark ladder (globals.css), converted sRGB -> OKLCH:
 *   --bg            8 8 10   -> oklch(0.135 0.005 286)  cool near-black
 *   --surface       18 18 22 -> oklch(0.184 0.008 286)
 *   --elevated      28 28 34 -> oklch(0.229 0.011 286)
 *   --accent        56 189 248 -> oklch(0.754 0.139 233) sky blue (default; runtime-overridable)
 *   --text-primary  245 245 245 -> oklch(0.970 0 90)    near-white
 */

const tokensCss = readFileSync(path.resolve(process.cwd(), 'src/tokens.css'), 'utf8');

/** Extract the body of a CSS rule block by selector. */
function ruleBlock(selector: string): string {
  const re = new RegExp(`${selector.replace('.', '\\.')}\\s*\\{([\\s\\S]*?)\\n\\}`, 'm');
  const m = tokensCss.match(re);
  if (!m) throw new Error(`rule block ${selector} not found`);
  return m[1] ?? '';
}

/** Parse `--name: oklch(L C H ...)` -> [L, C, H] from a block. */
function oklch(block: string, name: string): [number, number, number] {
  const re = new RegExp(`${name}:\\s*oklch\\(([0-9.]+)\\s+([0-9.]+)\\s+([0-9.]+)`);
  const m = block.match(re);
  if (!m) throw new Error(`${name} not found as oklch() in block`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

describe('T5 dark-token reskin — merged theme adopts the Terminal 42 ladder', () => {
  const dark = ruleBlock('.dark');

  it('uses a deep, near-black background (T42 --bg 8 8 10, L ~0.135)', () => {
    const [L, C] = oklch(dark, '--color-background');
    // T42 --bg is oklch L~0.135; the old warm-editorial dark sat at L~0.18.
    // Pin tight so a drift back to the lighter warm canvas fails.
    expect(L).toBeLessThan(0.16);
    expect(C).toBeLessThan(0.02); // near-zero chroma: cool neutral, not warm
  });

  it('builds a three-step surface ladder bg < surface < elevated (T42 8/18/28 idiom)', () => {
    const bg = oklch(dark, '--color-background')[0];
    const surface = oklch(dark, '--color-surface')[0];
    const elevated = oklch(dark, '--color-surface-elevated')[0];
    expect(bg).toBeLessThan(surface);
    expect(surface).toBeLessThan(elevated);
  });

  it('drops the warm editorial hue — neutrals are cool (hue not in the 40-70 warm band)', () => {
    // Old ATV dark used warm hue ~50 on surfaces. T42 neutrals sit near 286 with
    // tiny chroma. Assert surface is NOT a warm, chromatic brown.
    const [, C] = oklch(dark, '--color-surface');
    expect(C).toBeLessThan(0.03);
  });

  it('keeps a high-contrast near-white primary text (T42 245/245/245)', () => {
    const [L, C] = oklch(dark, '--color-text-primary');
    expect(L).toBeGreaterThan(0.92);
    expect(C).toBeLessThan(0.02);
  });

  it('ships the T42 sky-blue accent as the default (runtime-overridable later)', () => {
    const [L, C, H] = oklch(dark, '--color-accent');
    // sky blue: high-ish L, real chroma, hue in the blue band (~230).
    expect(C).toBeGreaterThan(0.1);
    expect(H).toBeGreaterThan(200);
    expect(H).toBeLessThan(260);
    expect(L).toBeGreaterThan(0.6);
  });

  it('still exposes every token name the 9 consumers depend on (plumbing intact)', () => {
    for (const name of [
      '--color-background',
      '--color-surface',
      '--color-surface-elevated',
      '--color-border',
      '--color-accent',
      '--color-text-primary',
      '--color-text-secondary',
    ]) {
      expect(dark).toContain(name);
    }
  });
});
