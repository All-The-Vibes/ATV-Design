/**
 * Unit tests for RecentTab pure selection logic — filtering, empty-state
 * decisions, and the hide-empty persistence key. Tested without mounting the
 * component (apps/desktop renderer convention: cover pure logic, no jsdom).
 */
import type { Design } from '@atv-design/shared';
import { describe, expect, it } from 'vitest';
import {
  HIDE_EMPTY_KEY,
  countEmpty,
  selectRecent,
  shouldOfferHideEmpty,
  shouldShowAllHiddenHint,
} from './RecentTab';

function design(id: string, snapshotCount: number, updatedAt: string): Design {
  return {
    id,
    name: id,
    updatedAt,
    createdAt: updatedAt,
    deletedAt: null,
    snapshotCount,
  } as unknown as Design;
}

describe('RecentTab — selectRecent', () => {
  it('keeps only designs with snapshots when hideEmpty is on', () => {
    const designs = [
      design('a', 2, '2026-07-01T00:00:00Z'),
      design('b', 0, '2026-07-02T00:00:00Z'),
    ];
    const out = selectRecent(designs, true, 6);
    expect(out.map((d) => d.id)).toEqual(['a']);
  });

  it('keeps every live design when hideEmpty is off', () => {
    const designs = [
      design('a', 2, '2026-07-01T00:00:00Z'),
      design('b', 0, '2026-07-02T00:00:00Z'),
    ];
    const out = selectRecent(designs, false, 6);
    expect(out.map((d) => d.id).sort()).toEqual(['a', 'b']);
  });

  it('excludes soft-deleted designs regardless of hideEmpty', () => {
    const deleted = design('d', 3, '2026-07-03T00:00:00Z');
    (deleted as { deletedAt: string | null }).deletedAt = '2026-07-04T00:00:00Z';
    const out = selectRecent([deleted], false, 6);
    expect(out).toHaveLength(0);
  });

  it('sorts by updatedAt descending and caps at the limit', () => {
    const designs = [
      design('old', 1, '2026-07-01T00:00:00Z'),
      design('new', 1, '2026-07-05T00:00:00Z'),
      design('mid', 1, '2026-07-03T00:00:00Z'),
    ];
    const out = selectRecent(designs, false, 2);
    expect(out.map((d) => d.id)).toEqual(['new', 'mid']);
  });

  it('treats a missing snapshotCount as empty (back-compat)', () => {
    const legacy = { id: 'x', updatedAt: '2026-07-01T00:00:00Z', deletedAt: null } as Design;
    expect(selectRecent([legacy], true, 6)).toHaveLength(0);
    expect(selectRecent([legacy], false, 6)).toHaveLength(1);
  });
});

describe('RecentTab — countEmpty', () => {
  it('counts live designs with no snapshots', () => {
    const designs = [
      design('a', 2, '2026-07-01T00:00:00Z'),
      design('b', 0, '2026-07-02T00:00:00Z'),
      design('c', 0, '2026-07-03T00:00:00Z'),
    ];
    expect(countEmpty(designs)).toBe(2);
  });
});

describe('RecentTab — shouldShowAllHiddenHint', () => {
  it('is true only when hiding empties collapses the whole list', () => {
    const designs = [design('b', 0, '2026-07-02T00:00:00Z')];
    // hideEmpty on, everything filtered out, but there ARE live designs.
    expect(shouldShowAllHiddenHint(designs, true, 6)).toBe(true);
  });

  it('is false when hideEmpty is off', () => {
    const designs = [design('b', 0, '2026-07-02T00:00:00Z')];
    expect(shouldShowAllHiddenHint(designs, false, 6)).toBe(false);
  });

  it('is false when at least one non-empty design survives the filter', () => {
    const designs = [
      design('a', 2, '2026-07-01T00:00:00Z'),
      design('b', 0, '2026-07-02T00:00:00Z'),
    ];
    expect(shouldShowAllHiddenHint(designs, true, 6)).toBe(false);
  });

  it('is false when there are no live designs at all', () => {
    expect(shouldShowAllHiddenHint([], true, 6)).toBe(false);
  });
});

describe('RecentTab — shouldOfferHideEmpty', () => {
  const LIMIT = 6;

  it('offers the switch when hiding empties changes the visible Recent set', () => {
    const designs = [
      design('a', 2, '2026-07-01T00:00:00Z'),
      design('b', 0, '2026-07-02T00:00:00Z'),
    ];
    expect(shouldOfferHideEmpty(designs, LIMIT)).toBe(true);
  });

  it('does NOT offer the switch when the only empty designs sit outside the visible window', () => {
    // 6 newer non-empty designs fill the Recent grid; 1 older empty design is
    // never visible, so toggling hide-empty would be a no-op. Codex round-3 bug.
    const designs = [
      design('n1', 1, '2026-07-10T00:00:00Z'),
      design('n2', 1, '2026-07-09T00:00:00Z'),
      design('n3', 1, '2026-07-08T00:00:00Z'),
      design('n4', 1, '2026-07-07T00:00:00Z'),
      design('n5', 1, '2026-07-06T00:00:00Z'),
      design('n6', 1, '2026-07-05T00:00:00Z'),
      design('oldEmpty', 0, '2026-07-01T00:00:00Z'),
    ];
    expect(shouldOfferHideEmpty(designs, LIMIT)).toBe(false);
  });

  it('does NOT offer the switch when there are no empty designs at all', () => {
    const designs = [design('a', 2, '2026-07-01T00:00:00Z')];
    expect(shouldOfferHideEmpty(designs, LIMIT)).toBe(false);
  });

  it('offers the switch when an empty design is within the visible window', () => {
    const designs = [
      design('n1', 1, '2026-07-10T00:00:00Z'),
      design('emptyRecent', 0, '2026-07-09T00:00:00Z'),
      design('n2', 1, '2026-07-08T00:00:00Z'),
    ];
    expect(shouldOfferHideEmpty(designs, LIMIT)).toBe(true);
  });
});

describe('RecentTab — persistence key', () => {
  it('exposes a stable localStorage key', () => {
    expect(HIDE_EMPTY_KEY).toBe('hub:recent:hideEmpty');
  });
});
