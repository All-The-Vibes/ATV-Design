/**
 * Infer a coarse spacing scale (base unit + multiplier scale) from observed
 * spacing values (in px). Used by `read_brand` to surface a starter
 * `## Spacing Scale` section in DESIGN.md.
 *
 * Algorithm:
 *  1. Snap each input to the nearest of the canonical base candidates
 *     [4, 8, 16, 24, 32, 64].
 *  2. Count occurrences per post-snap base; the most frequent base wins.
 *  3. Build the scale as base * [1, 2, 4, 6, 8], capped at 64.
 *  4. Returns null when fewer than 3 *unique* input values are supplied
 *     (not enough signal to commit to a base unit).
 */

export interface SpacingScale {
  baseUnit: number;
  scale: number[];
}

const BASE_CANDIDATES = [4, 8, 16, 24, 32, 64] as const;
const SCALE_MULTIPLIERS = [1, 2, 4, 6, 8] as const;
const MAX_SCALE_VALUE = 64;

function snapToBase(value: number): number {
  let best: number = BASE_CANDIDATES[0];
  let bestDelta = Number.POSITIVE_INFINITY;
  for (const c of BASE_CANDIDATES) {
    const delta = Math.abs(c - value);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = c;
    }
  }
  return best;
}

export function inferSpacingScale(spacings: number[]): SpacingScale | null {
  const finite = spacings.filter((n) => Number.isFinite(n) && n > 0);
  const unique = new Set(finite);
  if (unique.size < 3) return null;

  const counts = new Map<number, number>();
  for (const v of finite) {
    const base = snapToBase(v);
    counts.set(base, (counts.get(base) ?? 0) + 1);
  }

  // Pick the dominant base. Tie-breaker: prefer the smaller base (denser
  // scales are more useful than sparse ones for design systems).
  let baseUnit: number = BASE_CANDIDATES[0];
  let bestCount = -1;
  for (const c of BASE_CANDIDATES) {
    const count = counts.get(c) ?? 0;
    if (count > bestCount) {
      bestCount = count;
      baseUnit = c;
    }
  }

  const scale = SCALE_MULTIPLIERS.map((m) => baseUnit * m).filter((v) => v <= MAX_SCALE_VALUE);

  return { baseUnit, scale };
}
