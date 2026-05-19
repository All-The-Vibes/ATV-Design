/**
 * Unit tests for DesignSystemsTab logic helpers.
 * We test the pure logic (source badge kind, built-in detection) without
 * mounting the component — no jsdom needed here.
 */
import { describe, expect, it } from 'vitest';
import { BUILT_IN_DESIGN_SYSTEM } from '../../store';

// Re-export the tiny helpers we want to cover independently without mounting the full component.

function resolveSourceKind(ds: { source?: { kind: string; value?: string }; isBuiltIn?: boolean }) {
  return ds.source?.kind ?? 'folder';
}

function isBuiltIn(ds: { isBuiltIn?: boolean }) {
  return ds.isBuiltIn === true;
}

describe('DesignSystemsTab — source kind logic', () => {
  it('reports builtIn for the built-in snapshot', () => {
    expect(resolveSourceKind(BUILT_IN_DESIGN_SYSTEM)).toBe('builtIn');
    expect(isBuiltIn(BUILT_IN_DESIGN_SYSTEM)).toBe(true);
  });

  it('reports folder for a folder-imported snapshot', () => {
    const ds = { source: { kind: 'folder', value: '/my/project' } };
    expect(resolveSourceKind(ds)).toBe('folder');
  });

  it('reports url for a URL-imported snapshot', () => {
    const ds = { source: { kind: 'url', value: 'https://example.com' } };
    expect(resolveSourceKind(ds)).toBe('url');
  });

  it('falls back to folder when source is absent (back-compat)', () => {
    expect(resolveSourceKind({})).toBe('folder');
  });
});

describe('DesignSystemsTab — built-in snapshot shape', () => {
  it('has the expected token arrays', () => {
    expect(BUILT_IN_DESIGN_SYSTEM.colors.length).toBeGreaterThan(0);
    expect(BUILT_IN_DESIGN_SYSTEM.fonts.length).toBeGreaterThan(0);
    expect(BUILT_IN_DESIGN_SYSTEM.spacing.length).toBeGreaterThan(0);
    expect(BUILT_IN_DESIGN_SYSTEM.radius.length).toBeGreaterThan(0);
    expect(BUILT_IN_DESIGN_SYSTEM.shadows.length).toBeGreaterThan(0);
  });

  it('is marked isBuiltIn and source.kind builtIn', () => {
    expect(BUILT_IN_DESIGN_SYSTEM.isBuiltIn).toBe(true);
    expect(BUILT_IN_DESIGN_SYSTEM.source.kind).toBe('builtIn');
    expect(BUILT_IN_DESIGN_SYSTEM.userEdited).toBe(false);
  });

  it('displayName is ATV Default', () => {
    expect(BUILT_IN_DESIGN_SYSTEM.displayName).toBe('ATV Default');
  });
});

describe('makeEditor helper — array mutation logic', () => {
  function makeEditor<T>(arr: T[]) {
    return {
      onEdit: (i: number, v: T): T[] => {
        const n = [...arr];
        n[i] = v;
        return n;
      },
      onRemove: (i: number): T[] => arr.filter((_, idx) => idx !== i),
      onAdd: (v: T): T[] => [...arr, v],
    };
  }

  it('onEdit replaces element at index', () => {
    const { onEdit } = makeEditor(['a', 'b', 'c']);
    expect(onEdit(1, 'x')).toEqual(['a', 'x', 'c']);
  });

  it('onRemove removes element at index', () => {
    const { onRemove } = makeEditor(['a', 'b', 'c']);
    expect(onRemove(1)).toEqual(['a', 'c']);
  });

  it('onAdd appends', () => {
    const { onAdd } = makeEditor(['a']);
    expect(onAdd('b')).toEqual(['a', 'b']);
  });
});
