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
import {
  detectTokenConflicts,
  dimensionToPx,
  makeReadBrandTool,
  parseDesignMdFrontmatter,
  synthesizeBrand,
} from './read-brand.js';

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

// ── Image fetcher stub ────────────────────────────────────────────────────────

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

  it('parses a JSON value into tokens and feeds the normal pipeline', async () => {
    const { mkdtemp, rm } = await import('node:fs/promises');
    const { join } = await import('node:path');
    const { tmpdir } = await import('node:os');

    const workspaceDir = await mkdtemp(join(tmpdir(), 'atv-image-json-'));
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

    const json = JSON.stringify({
      colors: ['#1a73e8', '#202124'],
      fonts: ['Inter', 'Helvetica'],
      spacings: [4, 8, 16, 24, 32],
    });

    const result = await tool.execute(
      'test-id',
      {
        source: { kind: 'image', value: json },
      },
      undefined,
    );

    expect(result.details?.colorsFound).toBe(2);
    expect(result.details?.fontsFound).toBe(2);
    expect(result.details?.spacingFound).toBe(5);

    const mdPath = join(workspaceDir, 'DESIGN.md');
    expect(memFs[mdPath]).toBeDefined();
    expect(memFs[mdPath]).toContain('#1a73e8');
    expect(memFs[mdPath]).toContain('Inter');

    await rm(workspaceDir, { recursive: true, force: true });
  });

  it('falls back to vision stub on malformed JSON without crashing', async () => {
    const tool = makeReadBrandTool({
      workspacePath: null,
      fs: null,
      log: { info: () => undefined, warn: () => undefined, error: () => undefined },
    });

    const result = await tool.execute(
      'test-id',
      {
        // Starts with { so we attempt JSON.parse, but it's malformed.
        source: { kind: 'image', value: '{not valid json' },
      },
      undefined,
    );

    expect(result.details?.warnings.some((w) => w.includes('JSON'))).toBe(true);
    // And we still emit the fallback stub message
    expect(result.details?.warnings.some((w) => w.includes('v1 stub'))).toBe(true);
  });
});

// ── detectTokenConflicts ──────────────────────────────────────────────────────

describe('detectTokenConflicts()', () => {
  it('returns empty when no name collisions exist', () => {
    const tokens: DesignToken[] = [
      { schemaVersion: 1, type: 'color', name: 'a', value: '#fff', origin: 'css-vars' },
      { schemaVersion: 1, type: 'color', name: 'b', value: '#000', origin: 'css-vars' },
    ];
    expect(detectTokenConflicts(tokens)).toEqual([]);
  });

  it('returns empty when same name has the same value across sources', () => {
    const tokens: DesignToken[] = [
      { schemaVersion: 1, type: 'color', name: 'a', value: '#fff', origin: 'css-vars' },
      { schemaVersion: 1, type: 'color', name: 'a', value: '#fff', origin: 'dtcg-json' },
    ];
    expect(detectTokenConflicts(tokens)).toEqual([]);
  });

  it('reports a conflict when one name has two distinct values', () => {
    const tokens: DesignToken[] = [
      { schemaVersion: 1, type: 'color', name: '--primary', value: '#1a73e8', origin: 'css-vars' },
      {
        schemaVersion: 1,
        type: 'color',
        name: '--primary',
        value: '#1e88e5',
        origin: 'dtcg-json',
      },
    ];
    const conflicts = detectTokenConflicts(tokens);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.name).toBe('--primary');
    expect(conflicts[0]?.values).toHaveLength(2);
    const sources = conflicts[0]?.values.map((v) => v.source) ?? [];
    expect(sources).toContain('css-vars');
    expect(sources).toContain('dtcg-json');
  });

  it('sorts conflicts by name for stable output', () => {
    const tokens: DesignToken[] = [
      { schemaVersion: 1, type: 'color', name: 'z', value: '#1', origin: 'css-vars' },
      { schemaVersion: 1, type: 'color', name: 'z', value: '#2', origin: 'dtcg-json' },
      { schemaVersion: 1, type: 'color', name: 'a', value: '#3', origin: 'css-vars' },
      { schemaVersion: 1, type: 'color', name: 'a', value: '#4', origin: 'dtcg-json' },
    ];
    const conflicts = detectTokenConflicts(tokens);
    expect(conflicts.map((c) => c.name)).toEqual(['a', 'z']);
  });
});

// ── dimensionToPx ─────────────────────────────────────────────────────────────

describe('dimensionToPx()', () => {
  it('parses px values', () => {
    expect(dimensionToPx('16px')).toBe(16);
    expect(dimensionToPx('  4px  ')).toBe(4);
  });

  it('converts rem to px (1rem = 16px)', () => {
    expect(dimensionToPx('1rem')).toBe(16);
    expect(dimensionToPx('1.5rem')).toBe(24);
  });

  it('converts em to px', () => {
    expect(dimensionToPx('2em')).toBe(32);
  });

  it('treats unitless numbers as px', () => {
    expect(dimensionToPx('12')).toBe(12);
  });

  it('returns null for unsupported values', () => {
    expect(dimensionToPx('100%')).toBeNull();
    expect(dimensionToPx('4px 8px')).toBeNull();
    expect(dimensionToPx('auto')).toBeNull();
    expect(dimensionToPx('')).toBeNull();
  });
});

// ── parseDesignMdFrontmatter ──────────────────────────────────────────────────

describe('parseDesignMdFrontmatter()', () => {
  it('returns null frontmatter when content has no leading ---', () => {
    const { frontmatter, body, malformed } = parseDesignMdFrontmatter('# Design System\n\nHi');
    expect(frontmatter).toBeNull();
    expect(body).toContain('# Design System');
    expect(malformed).toBe(false);
  });

  it('parses a complete frontmatter block', () => {
    const md = [
      '---',
      'schemaVersion: 1',
      'extractedAt: 2025-01-15T12:34:56.789Z',
      'sources:',
      '  - url:https://example.com',
      '  - repo:/path/to/repo',
      '---',
      '',
      '# Design System',
      'body',
    ].join('\n');
    const { frontmatter, body, malformed } = parseDesignMdFrontmatter(md);
    expect(malformed).toBe(false);
    expect(frontmatter).not.toBeNull();
    expect(frontmatter?.schemaVersion).toBe(1);
    expect(frontmatter?.extractedAt).toBe('2025-01-15T12:34:56.789Z');
    expect(frontmatter?.sources).toEqual(['url:https://example.com', 'repo:/path/to/repo']);
    expect(body.startsWith('# Design System')).toBe(true);
  });

  it('flags malformed frontmatter (missing closer) without crashing', () => {
    const md = '---\nschemaVersion: 1\n# Design System\nbody';
    const { frontmatter, malformed } = parseDesignMdFrontmatter(md);
    expect(frontmatter).toBeNull();
    expect(malformed).toBe(true);
  });

  it('flags malformed frontmatter (missing required fields)', () => {
    const md = '---\nfoo: bar\n---\n\n# Design System\n';
    const { frontmatter, malformed } = parseDesignMdFrontmatter(md);
    expect(frontmatter).toBeNull();
    expect(malformed).toBe(true);
  });
});

// ── Full execute() — frontmatter / conflicts / ramp / scale sections ─────────

describe('execute() — DESIGN.md sections from new helpers', () => {
  it('writes schemaVersion frontmatter when DESIGN.md is fresh', async () => {
    const { mkdtemp, writeFile, rm } = await import('node:fs/promises');
    const { join } = await import('node:path');
    const { tmpdir } = await import('node:os');

    const workspaceDir = await mkdtemp(join(tmpdir(), 'atv-fm-'));
    const tempDir = await mkdtemp(join(tmpdir(), 'atv-fm-repo-'));
    await writeFile(
      join(tempDir, 'tokens.json'),
      JSON.stringify({
        color: { primary: { $value: '#635BFF', $type: 'color' } },
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

    await tool.execute('test-id', { source: { kind: 'repo', value: tempDir } }, undefined);

    const mdPath = join(workspaceDir, 'DESIGN.md');
    const content = memFs[mdPath] ?? '';
    expect(content.startsWith('---\n')).toBe(true);
    expect(content).toMatch(/schemaVersion: 1/);
    expect(content).toMatch(/extractedAt: \d{4}-\d{2}-\d{2}T/);
    expect(content).toMatch(/sources:/);
    expect(content).toContain(`- repo:${tempDir}`);

    await Promise.all([
      rm(tempDir, { recursive: true, force: true }),
      rm(workspaceDir, { recursive: true, force: true }),
    ]);
  });

  it('accumulates frontmatter sources across re-runs and caps at 10', async () => {
    const { mkdtemp, rm } = await import('node:fs/promises');
    const { join } = await import('node:path');
    const { tmpdir } = await import('node:os');

    const workspaceDir = await mkdtemp(join(tmpdir(), 'atv-acc-'));

    // Seed an existing DESIGN.md with 10 prior sources.
    const memFs: Record<string, string> = {};
    const mdPath = join(workspaceDir, 'DESIGN.md');
    const priorSources = Array.from({ length: 10 }, (_, i) => `repo:/prior-${i}`);
    memFs[mdPath] = [
      '---',
      'schemaVersion: 1',
      'extractedAt: 2025-01-01T00:00:00.000Z',
      'sources:',
      ...priorSources.map((s) => `  - ${s}`),
      '---',
      '',
      '# Design System',
      '',
      '> seed',
      '',
    ].join('\n');

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

    // Image kind with JSON value — avoids needing a real repo.
    await tool.execute(
      'test-id',
      {
        source: {
          kind: 'image',
          value: JSON.stringify({ colors: ['#abc123'], fonts: [], spacings: [] }),
        },
      },
      undefined,
    );

    const content = memFs[mdPath] ?? '';
    const parsed = parseDesignMdFrontmatter(content);
    expect(parsed.frontmatter).not.toBeNull();
    expect(parsed.frontmatter?.sources.length).toBe(10);
    // Oldest dropped, new one appended last.
    expect(parsed.frontmatter?.sources[0]).toBe('repo:/prior-1');
    expect(parsed.frontmatter?.sources[9]).toMatch(/^image:/);

    await rm(workspaceDir, { recursive: true, force: true });
  });

  it('emits a Conflicts section when token names disagree across origins', async () => {
    const { mkdtemp, writeFile, rm } = await import('node:fs/promises');
    const { join } = await import('node:path');
    const { tmpdir } = await import('node:os');

    const workspaceDir = await mkdtemp(join(tmpdir(), 'atv-conflict-'));
    const tempDir = await mkdtemp(join(tmpdir(), 'atv-conflict-repo-'));

    // Build a repo where tokens.json AND a CSS file both define --primary
    // with different values → fetcher emits two tokens with the same name.
    await writeFile(
      join(tempDir, 'tokens.json'),
      JSON.stringify({
        primary: { $value: '#1a73e8', $type: 'color' },
      }),
      'utf-8',
    );
    await writeFile(join(tempDir, 'app.css'), ':root {\n  --primary: #1e88e5;\n}\n', 'utf-8');

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

    await tool.execute('test-id', { source: { kind: 'repo', value: tempDir } }, undefined);

    const mdPath = join(workspaceDir, 'DESIGN.md');
    const content = memFs[mdPath] ?? '';
    expect(content).toContain('## Conflicts');
    expect(content).toContain('primary');
    expect(content).toContain('#1a73e8');
    expect(content).toContain('#1e88e5');
    // First-source-wins is unchanged: both values still appear in the Colors
    // list — Conflicts is purely informational.
    expect(content).toContain('## Colors');

    await Promise.all([
      rm(tempDir, { recursive: true, force: true }),
      rm(workspaceDir, { recursive: true, force: true }),
    ]);
  });

  it('emits Type Ramp and Spacing Scale sections when enough signal is present', async () => {
    const { mkdtemp, writeFile, rm } = await import('node:fs/promises');
    const { join } = await import('node:path');
    const { tmpdir } = await import('node:os');

    const workspaceDir = await mkdtemp(join(tmpdir(), 'atv-ramp-'));
    const tempDir = await mkdtemp(join(tmpdir(), 'atv-ramp-repo-'));

    // DTCG file with multiple font sizes (typed as dimension under a fontSize
    // group, so the importer's path-based resolver picks them up as fontSize)
    // and multiple spacing values.
    await writeFile(
      join(tempDir, 'tokens.json'),
      JSON.stringify({
        fontSize: {
          xs: { $value: '12px', $type: 'fontSize' },
          sm: { $value: '14px', $type: 'fontSize' },
          base: { $value: '16px', $type: 'fontSize' },
          lg: { $value: '20px', $type: 'fontSize' },
          xl: { $value: '24px', $type: 'fontSize' },
          xxl: { $value: '32px', $type: 'fontSize' },
        },
        spacing: {
          1: { $value: '4px', $type: 'dimension' },
          2: { $value: '8px', $type: 'dimension' },
          3: { $value: '16px', $type: 'dimension' },
          4: { $value: '24px', $type: 'dimension' },
          5: { $value: '32px', $type: 'dimension' },
        },
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

    await tool.execute('test-id', { source: { kind: 'repo', value: tempDir } }, undefined);

    const mdPath = join(workspaceDir, 'DESIGN.md');
    const content = memFs[mdPath] ?? '';
    expect(content).toContain('## Type Ramp');
    expect(content).toMatch(/h1: `\d+px`/);
    expect(content).toMatch(/body: `\d+px`/);
    expect(content).toContain('## Spacing Scale');
    expect(content).toMatch(/Base unit: `\d+px`/);

    await Promise.all([
      rm(tempDir, { recursive: true, force: true }),
      rm(workspaceDir, { recursive: true, force: true }),
    ]);
  });
});
