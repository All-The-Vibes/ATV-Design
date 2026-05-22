import { describe, expect, it } from 'vitest';
import { inferSpacingScale } from './spacingInferrer.js';

describe('inferSpacingScale()', () => {
  it('returns null for empty input', () => {
    expect(inferSpacingScale([])).toBeNull();
  });

  it('returns null for fewer than 3 unique values', () => {
    expect(inferSpacingScale([8])).toBeNull();
    expect(inferSpacingScale([8, 16])).toBeNull();
    // duplicates do not count as unique
    expect(inferSpacingScale([8, 8, 8, 8])).toBeNull();
  });

  it('picks 8 as the base when 8-multiples dominate', () => {
    const result = inferSpacingScale([8, 16, 24, 32, 8, 16]);
    expect(result).not.toBeNull();
    expect(result?.baseUnit).toBe(8);
    expect(result?.scale).toEqual([8, 16, 32, 48, 64]);
  });

  it('picks 4 as the base for tight scales', () => {
    const result = inferSpacingScale([4, 8, 12, 4, 4]);
    expect(result).not.toBeNull();
    expect(result?.baseUnit).toBe(4);
    expect(result?.scale).toEqual([4, 8, 16, 24, 32]);
  });

  it('caps the scale at 64', () => {
    const result = inferSpacingScale([16, 32, 64, 16, 16]);
    expect(result).not.toBeNull();
    expect(result?.scale.every((v) => v <= 64)).toBe(true);
  });

  it('snaps near-base values to canonical bases', () => {
    // 9, 17, 25 should all snap to 8, 16, 24 → base=8 still wins
    const result = inferSpacingScale([9, 17, 25, 8]);
    expect(result?.baseUnit).toBe(8);
  });

  it('ignores zero and negative values', () => {
    const result = inferSpacingScale([0, -4, 8, 16, 24]);
    expect(result).not.toBeNull();
    expect(result?.baseUnit).toBe(8);
  });

  it('ignores non-finite values', () => {
    const result = inferSpacingScale([Number.NaN, Number.POSITIVE_INFINITY, 8, 16, 24]);
    expect(result).not.toBeNull();
    expect(result?.baseUnit).toBe(8);
  });

  it('returns a 5-step scale by default', () => {
    const result = inferSpacingScale([8, 16, 24, 32]);
    expect(result?.scale.length).toBeGreaterThanOrEqual(4);
    expect(result?.scale.length).toBeLessThanOrEqual(5);
  });
});
