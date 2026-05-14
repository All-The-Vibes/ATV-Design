/**
 * Tests for read-brand tool.
 *
 * Live network / browser tests are intentionally skipped here — those are the
 * eyeball acceptance pass done manually. These tests cover the parts that run
 * in CI without network access.
 */

import { StoredDesignSystem } from '@atv-design/shared';
import { describe, expect, it } from 'vitest';
import type { DesignToken } from '../brand/index.js';
import { makeReadBrandTool, synthesizeBrand } from './read-brand.js';

// ── synthesizeBrand ───────────────────────────────────────────────────────────

describe('synthesizeBrand', () => {
  const baseTokens: DesignToken[] = [
    { schemaVersion: 1, type: 'color', name: '--primary', value: '#0070f3', origin: 'css-vars' },
    { schemaVersion: 1, type: 'color', name: '--bg', value: '#000000', origin: 'css-vars' },
    {
      schemaVersion: 1,
      type: 'fontFamily',
      name: 'font-body',
      value: 'Inter, sans-serif',
      origin: 'css-vars',
    },
    { schemaVersion: 1, type: 'spacing', name: '--space-4', value: '1rem', origin: 'css-vars' },
    { schemaVersion: 1, type: 'radius', name: '--radius-md', value: '8px', origin: 'css-vars' },
    {
      schemaVersion: 1,
      type: 'shadow',
      name: '--shadow-sm',
      value: '0 1px 3px rgba(0,0,0,0.1)',
      origin: 'css-vars',
    },
  ];

  it('produces a valid StoredDesignSystem from tokens', () => {
    const result = synthesizeBrand(baseTokens, { sourceValue: 'https://example.com' });
    expect(() => StoredDesignSystem.parse(result)).not.toThrow();
  });

  it('buckets tokens into the correct arrays', () => {
    const result = synthesizeBrand(baseTokens, { sourceValue: 'test' });
    expect(result.colors).toContain('#0070f3');
    expect(result.colors).toContain('#000000');
    expect(result.fonts).toContain('Inter, sans-serif');
    expect(result.spacing).toContain('1rem');
    expect(result.radius).toContain('8px');
    expect(result.shadows).toContain('0 1px 3px rgba(0,0,0,0.1)');
  });

  it('caps arrays at schema limits', () => {
    const manyColors: DesignToken[] = Array.from({ length: 30 }, (_, i) => ({
      schemaVersion: 1 as const,
      type: 'color' as const,
      name: `--color-${i}`,
      value: `#${i.toString(16).padStart(6, '0')}`,
      origin: 'css-vars' as const,
    }));
    const result = synthesizeBrand(manyColors, { sourceValue: 'test' });
    expect(result.colors.length).toBeLessThanOrEqual(24);
    expect(() => StoredDesignSystem.parse(result)).not.toThrow();
  });

  it('sets schemaVersion, extractedAt, and summary', () => {
    const result = synthesizeBrand([], { sourceValue: 'https://stripe.com' });
    expect(result.schemaVersion).toBe(1);
    expect(result.summary).toContain('stripe.com');
    expect(result.extractedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('sets rootPath from opts.workspacePath', () => {
    const result = synthesizeBrand([], {
      sourceValue: 'test',
      workspacePath: '/home/user/designs/my-project',
    });
    expect(result.rootPath).toBe('/home/user/designs/my-project');
  });

  it('handles empty token list gracefully', () => {
    const result = synthesizeBrand([], { sourceValue: 'test' });
    expect(result.colors).toEqual([]);
    expect(result.fonts).toEqual([]);
    expect(() => StoredDesignSystem.parse(result)).not.toThrow();
  });

  it('includes sourceFiles up to 24', () => {
    const files = Array.from({ length: 30 }, (_, i) => `file-${i}.css`);
    const result = synthesizeBrand([], { sourceValue: 'test', sourceFiles: files });
    expect(result.sourceFiles.length).toBeLessThanOrEqual(24);
  });
});

// ── makeReadBrandTool — descriptor ─────────────────��──────────────────────────

describe('makeReadBrandTool descriptor', () => {
  const mockDeps = {
    workspacePath: '/tmp/workspace',
    fs: null,
    log: { info: () => undefined, warn: () => undefined, error: () => undefined },
  };

  it('returns expected name and label', () => {
    const tool = makeReadBrandTool(mockDeps);
    expect(tool.name).toBe('read_brand');
    expect(tool.label).toBe('Read brand from external source');
  });

  it('has a parameters schema with source.kind', () => {
    const tool = makeReadBrandTool(mockDeps);
    expect(tool.parameters).toBeDefined();
    // TypeBox schema has properties
    const props = (tool.parameters as { properties?: unknown }).properties as Record<
      string,
      unknown
    >;
    expect(props).toHaveProperty('source');
  });
});

// ── Repo fetcher with mocked FS (DTCG tokens.json) ───────────────────────────

describe('repo fetcher via execute (local path)', () => {
  it('extracts tokens from a DTCG tokens.json in a fake directory', async () => {
    const { mkdtemp, writeFile, rm } = await import('node:fs/promises');
    const { join } = await import('node:path');
    const { tmpdir } = await import('node:os');

    // Create a temp dir with a minimal DTCG tokens.json
    const tempDir = await mkdtemp(join(tmpdir(), 'atv-test-'));
    const dtcgContent = JSON.stringify({
      color: {
        primary: { $value: '#635BFF', $type: 'color' },
        background: { $value: '#0A2540', $type: 'color' },
      },
      font: {
        body: { $value: 'Inter, sans-serif', $type: 'fontFamily' },
      },
    });
    await writeFile(join(tempDir, 'tokens.json'), dtcgContent, 'utf-8');

    // In-memory FS for DESIGN.md writing
    const memFs: Record<string, string> = {};
    const mockFs = {
      readFile: async (p: string) => memFs[p] ?? '',
      writeFile: async (p: string, content: string) => {
        memFs[p] = content;
      },
      exists: async (p: string) => p in memFs,
    };

    const tool = makeReadBrandTool({
      workspacePath: tempDir,
      fs: mockFs,
      log: { info: () => undefined, warn: () => undefined, error: () => undefined },
    });

    const result = await tool.execute(
      'test-id',
      {
        source: { kind: 'repo', value: tempDir },
      },
      undefined,
    );

    // Should have extracted colors from DTCG file
    expect((result.details as { colorsFound: number } | undefined)?.colorsFound).toBeGreaterThan(0);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(result.content[0]?.type).toBe('text');

    // DESIGN.md should be written
    const mdPath = join(tempDir, 'DESIGN.md');
    expect(memFs[mdPath]).toBeDefined();
    expect(memFs[mdPath]).toContain('## Colors');

    await rm(tempDir, { recursive: true, force: true });
  });
});

// ── Merge into DESIGN.md ──────────────────────────────────────────────────────

describe('merge into existing DESIGN.md', () => {
  it('replaces ## Colors section without touching other content', async () => {
    const { mkdtemp, writeFile, rm } = await import('node:fs/promises');
    const { join } = await import('node:path');
    const { tmpdir } = await import('node:os');

    // Use a real temp dir as workspacePath so path.join is platform-consistent
    const workspaceDir = await mkdtemp(join(tmpdir(), 'atv-ws-merge-'));

    const existing = `# Design System

> Existing summary

## Colors

- \`#old-color-1\`
- \`#old-color-2\`

## Typography

Body font: Helvetica

## Custom Notes

This content must survive the merge.
`;

    const memFs: Record<string, string> = {};
    const mdKey = join(workspaceDir, 'DESIGN.md');
    memFs[mdKey] = existing;

    const mockFs = {
      readFile: async (p: string) => memFs[p] ?? '',
      writeFile: async (p: string, content: string) => {
        memFs[p] = content;
      },
      exists: async (p: string) => p in memFs,
    };

    const tool = makeReadBrandTool({
      workspacePath: workspaceDir,
      fs: mockFs,
      log: { info: () => undefined, warn: () => undefined, error: () => undefined },
    });

    const tempDir = await mkdtemp(join(tmpdir(), 'atv-merge-test-'));
    await writeFile(
      join(tempDir, 'tokens.json'),
      JSON.stringify({
        color: {
          brand: { $value: '#FF4500', $type: 'color' },
        },
      }),
      'utf-8',
    );

    await tool.execute(
      'test-id',
      {
        source: { kind: 'repo', value: tempDir },
        mergeMode: 'merge',
      },
      undefined,
    );

    const result = memFs[mdKey];
    expect(result).toBeDefined();
    // New color should be present
    expect(result).toContain('#FF4500');
    // Old color should be gone (replaced)
    expect(result).not.toContain('#old-color-1');
    // Unrelated sections must survive
    expect(result).toContain('## Typography');
    expect(result).toContain('This content must survive the merge.');

    await Promise.all([
      rm(tempDir, { recursive: true, force: true }),
      rm(workspaceDir, { recursive: true, force: true }),
    ]);
  });

  it('creates DESIGN.md from scratch when none exists (replace mode)', async () => {
    const { mkdtemp, writeFile, rm } = await import('node:fs/promises');
    const { join } = await import('node:path');
    const { tmpdir } = await import('node:os');

    // Use a real temp dir as workspacePath so path.join is platform-consistent
    const workspaceDir = await mkdtemp(join(tmpdir(), 'atv-ws-test-'));
    const tempDir = await mkdtemp(join(tmpdir(), 'atv-new-test-'));
    await writeFile(
      join(tempDir, 'tokens.json'),
      JSON.stringify({
        color: { main: { $value: '#123456', $type: 'color' } },
      }),
      'utf-8',
    );

    const memFs: Record<string, string> = {};
    const mockFs = {
      readFile: async (p: string) => memFs[p] ?? '',
      writeFile: async (p: string, content: string) => {
        memFs[p] = content;
      },
      exists: async (p: string) => p in memFs,
    };

    const tool = makeReadBrandTool({
      workspacePath: workspaceDir,
      fs: mockFs,
      log: { info: () => undefined, warn: () => undefined, error: () => undefined },
    });

    await tool.execute(
      'test-id',
      {
        source: { kind: 'repo', value: tempDir },
        mergeMode: 'replace',
      },
      undefined,
    );

    const mdPath = join(workspaceDir, 'DESIGN.md');
    expect(memFs[mdPath]).toContain('# Design System');
    expect(memFs[mdPath]).toContain('#123456');

    await Promise.all([
      rm(tempDir, { recursive: true, force: true }),
      rm(workspaceDir, { recursive: true, force: true }),
    ]);
  });
});

// ── Image fetcher stub ──────────────────────────────��─────────────────────────

describe('image fetcher stub', () => {
  it('returns a helpful warning about the v1 stub', async () => {
    const tool = makeReadBrandTool({
      workspacePath: null,
      fs: null,
      log: { info: () => undefined, warn: () => undefined, error: () => undefined },
    });

    const result = await tool.execute(
      'test-id',
      {
        source: { kind: 'image', value: '/path/to/screenshot.png' },
      },
      undefined,
    );

    const c0 = result.content[0];
    const text =
      c0 !== undefined && c0.type === 'text' ? (c0 as { type: 'text'; text: string }).text : '';
    expect(text).toContain('Warnings');
    expect(result.details?.warnings.length).toBeGreaterThan(0);
    expect(result.details?.warnings[0]).toContain('v1 stub');
  });
});
