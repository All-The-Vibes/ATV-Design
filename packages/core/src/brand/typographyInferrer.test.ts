import { describe, expect, it } from 'vitest';
import { inferTypeRamp } from './typographyInferrer.js';

describe('inferTypeRamp()', () => {
  it('returns null for empty input', () => {
    expect(inferTypeRamp([])).toBeNull();
  });

  it('returns null for 1-2 sizes (insufficient signal)', () => {
    expect(inferTypeRamp([16])).toBeNull();
    expect(inferTypeRamp([14, 24])).toBeNull();
  });

  it('returns null when every size is identical', () => {
    expect(inferTypeRamp([16, 16, 16, 16])).toBeNull();
  });

  it('drops out-of-range outliers (>96 or <8)', () => {
    // 6 is too small, 200 is too large; remaining [14, 16, 24] → valid
    const ramp = inferTypeRamp([6, 14, 16, 24, 200]);
    expect(ramp).not.toBeNull();
    expect(ramp?.body).toBeGreaterThanOrEqual(8);
    expect(ramp?.body).toBeLessThanOrEqual(96);
  });

  it('snaps derived ratios to nearby input sizes when within 15%', () => {
    // body=16 (most frequent in input) → h1=32, h2=24, h3=20, small=13.6
    // All derived values have input candidates within 15%, so they snap.
    const ramp = inferTypeRamp([14, 16, 16, 16, 20, 24, 32]);
    expect(ramp).not.toBeNull();
    expect(ramp?.body).toBe(16);
    expect(ramp?.h1).toBe(32);
    expect(ramp?.h2).toBe(24);
    expect(ramp?.h3).toBe(20);
    // small=13.6 → 14 is within 3% so it should snap
    expect(ramp?.small).toBe(14);
  });

  it('returns computed ratio (rounded to 1dp) when no input is within 15%', () => {
    // body=16 (most common) but no other sizes close to 16*2=32, 16*1.5=24, etc.
    const ramp = inferTypeRamp([16, 16, 60, 80]);
    expect(ramp).not.toBeNull();
    expect(ramp?.body).toBe(16);
    // h1 computed at 32 — no candidate within 15% (60 is too far) → keep 32
    expect(ramp?.h1).toBe(32);
  });

  it('picks body as the most common size when frequency varies', () => {
    // 16 appears 3x — it dominates regardless of position in the scale.
    const ramp = inferTypeRamp([12, 16, 16, 16, 24, 48]);
    expect(ramp?.body).toBe(16);
    expect(ramp?.baseUnit).toBe(16);
  });

  it('breaks frequency ties by closest-to-median', () => {
    // All-unique input → ties everywhere; median of unique should win.
    const ramp = inferTypeRamp([14, 16, 20, 24, 32]);
    expect(ramp).not.toBeNull();
    // median of [32, 24, 20, 16, 14] is 20
    expect(ramp?.body).toBe(20);
  });

  it('produces a TypeRamp where baseUnit equals body', () => {
    const ramp = inferTypeRamp([12, 14, 16, 20, 24, 32, 48]);
    expect(ramp).not.toBeNull();
    expect(ramp?.baseUnit).toBe(ramp?.body);
  });

  it('handles 3 well-spaced sizes (boundary case)', () => {
    const ramp = inferTypeRamp([14, 18, 24]);
    expect(ramp).not.toBeNull();
    // Median of [24, 18, 14] → 18
    expect(ramp?.body).toBe(18);
  });
});
