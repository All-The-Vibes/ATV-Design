/**
 * Infer a coarse type ramp (h1/h2/h3/body/small + base unit) from a flat list
 * of observed font sizes (in px). Used by `read_brand` to surface a starter
 * `## Type Ramp` section in DESIGN.md. The numbers are intentionally rough —
 * good enough to seed the design system; the agent or user can refine later.
 *
 * Algorithm:
 *  1. Drop NaN / non-finite, dedupe, keep the input range 8..96 inclusive.
 *  2. If fewer than 3 unique sizes remain → null (not enough signal).
 *  3. If every remaining size is identical → null (degenerate input).
 *  4. Pick `body`: prefer the most common mid-range size (between min and max
 *     excluding the extremes when there are ≥ 4 sizes); otherwise the median.
 *  5. Derive ratios h1=body*2, h2=body*1.5, h3=body*1.25, small=body*0.85.
 *  6. For each derived value, snap to the nearest input size if it lies
 *     within 15% — otherwise return the computed (un-snapped) value rounded
 *     to 1 decimal.
 */

export interface TypeRamp {
  h1: number;
  h2: number;
  h3: number;
  body: number;
  small: number;
  baseUnit: number;
}

const MIN_SIZE_PX = 8;
const MAX_SIZE_PX = 96;
const SNAP_TOLERANCE = 0.15;

function snap(value: number, candidates: number[]): number {
  let best = value;
  let bestDelta = Number.POSITIVE_INFINITY;
  for (const c of candidates) {
    const delta = Math.abs(c - value) / value;
    if (delta < bestDelta) {
      bestDelta = delta;
      best = c;
    }
  }
  if (bestDelta <= SNAP_TOLERANCE) return best;
  return Math.round(value * 10) / 10;
}

/**
 * Pick the body size from the filtered input.
 *
 * Strategy: most frequent wins; ties broken first by closest-to-median (so
 * we don't accidentally pick an outlier in the type scale), then by smaller
 * value (body text is more often on the lower end of the ramp than the high
 * end). Frequency is computed from the raw filtered list (with duplicates)
 * because that's where the "most common" signal lives — the unique-sorted
 * list collapses it.
 */
function pickBody(filteredInput: number[], uniqueSortedDesc: number[]): number {
  const counts = new Map<number, number>();
  for (const v of filteredInput) counts.set(v, (counts.get(v) ?? 0) + 1);

  const median =
    uniqueSortedDesc[Math.floor(uniqueSortedDesc.length / 2)] ?? uniqueSortedDesc[0] ?? 16;

  let bestVal = median;
  let bestCount = -1;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const v of uniqueSortedDesc) {
    const c = counts.get(v) ?? 0;
    const distance = Math.abs(v - median);
    if (
      c > bestCount ||
      (c === bestCount && distance < bestDistance) ||
      (c === bestCount && distance === bestDistance && v < bestVal)
    ) {
      bestCount = c;
      bestDistance = distance;
      bestVal = v;
    }
  }
  return bestVal;
}

export function inferTypeRamp(fontSizes: number[]): TypeRamp | null {
  const filtered = fontSizes.filter(
    (n) => Number.isFinite(n) && n >= MIN_SIZE_PX && n <= MAX_SIZE_PX,
  );
  const unique = Array.from(new Set(filtered));
  if (unique.length < 3) return null;
  const sortedDesc = [...unique].sort((a, b) => b - a);
  // Degenerate guard — Set already dedupes so this only fires for length<2,
  // already filtered above; keep the check explicit anyway.
  if (sortedDesc[0] === sortedDesc[sortedDesc.length - 1]) return null;

  const body = pickBody(filtered, sortedDesc);
  const h1 = snap(body * 2, unique);
  const h2 = snap(body * 1.5, unique);
  const h3 = snap(body * 1.25, unique);
  const small = snap(body * 0.85, unique);

  return { h1, h2, h3, body, small, baseUnit: body };
}
