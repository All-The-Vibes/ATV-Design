import { describe, expect, it } from 'vitest';
import { EXAMPLES } from './index';
import { EXAMPLE_PREVIEWS, getExamplePreview } from './previews';

describe('example previews', () => {
  it('provides a real HTML preview for every example', () => {
    for (const ex of EXAMPLES) {
      const preview = getExamplePreview(ex.id);
      expect(preview, `missing preview for ${ex.id}`).toBeDefined();
      expect(preview).toMatch(/^<!doctype html>/i);
      // Non-trivial document, not a stub.
      expect((preview ?? '').length).toBeGreaterThan(400);
    }
  });

  it('every preview is self-contained (no external network references)', () => {
    for (const ex of EXAMPLES) {
      const preview = getExamplePreview(ex.id) ?? '';
      expect(preview, `${ex.id} loads external http`).not.toMatch(/https?:\/\//i);
      expect(preview, `${ex.id} has a <script>`).not.toMatch(/<script/i);
    }
  });

  it('has no orphan preview keys that do not map to an example', () => {
    const ids = new Set(EXAMPLES.map((e) => e.id));
    for (const key of Object.keys(EXAMPLE_PREVIEWS)) {
      expect(ids.has(key), `orphan preview key "${key}"`).toBe(true);
    }
  });

  it('returns undefined for unknown ids', () => {
    expect(getExamplePreview('does-not-exist')).toBeUndefined();
  });
});
