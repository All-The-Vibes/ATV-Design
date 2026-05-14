import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { STORED_DESIGN_SYSTEM_SCHEMA_VERSION, type StoredDesignSystem } from '@atv-design/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_DESIGN_SYSTEM_FILE } from './default-design-system';
import { resolveDesignSystemForDesign } from './design-system-resolver';
import { createDesign, initInMemoryDb, updateDesignWorkspace } from './snapshots-db';

const tempDirs: string[] = [];

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'atv-design-resolved-ds-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

function linkedFallback(): StoredDesignSystem {
  return {
    schemaVersion: STORED_DESIGN_SYSTEM_SCHEMA_VERSION,
    rootPath: '/linked/fallback',
    sourceFiles: ['tokens.css'],
    colors: ['#abcdef'],
    fonts: [],
    spacing: [],
    radius: [],
    shadows: [],
    summary: 'Linked fallback system',
    extractedAt: '2026-05-12T00:00:00.000Z',
  };
}

describe('resolveDesignSystemForDesign', () => {
  it('creates and scans a per-design DESIGN.md for a workspace-backed design', async () => {
    const db = initInMemoryDb();
    const design = createDesign(db, 'Workspace First');
    const workspace = await makeTempDir();
    updateDesignWorkspace(db, design.id, workspace);
    await writeFile(path.join(workspace, 'tokens.css'), ':root { --color-accent: #999999; }');

    const resolved = await resolveDesignSystemForDesign(db, design.id, null);

    const body = await readFile(path.join(workspace, DEFAULT_DESIGN_SYSTEM_FILE), 'utf8');
    expect(body).toContain('Design: Workspace First');
    expect(resolved.rootPath).toBe(workspace);
    expect(resolved.sourceFiles[0]).toBe(DEFAULT_DESIGN_SYSTEM_FILE);
    expect(resolved.sourceFiles).toContain(DEFAULT_DESIGN_SYSTEM_FILE);
    expect(resolved.colors).toContain('oklch(0.62 0.16 35)');
  });

  it('uses an existing per-design DESIGN.md instead of overwriting it', async () => {
    const db = initInMemoryDb();
    const design = createDesign(db, 'Custom System');
    const workspace = await makeTempDir();
    updateDesignWorkspace(db, design.id, workspace);
    await writeFile(
      path.join(workspace, DEFAULT_DESIGN_SYSTEM_FILE),
      '# Custom system\n\n:root { --color-accent: #123456; }\nfont-family: Inter, sans-serif;\n',
      'utf8',
    );

    const resolved = await resolveDesignSystemForDesign(db, design.id, linkedFallback());

    expect(await readFile(path.join(workspace, DEFAULT_DESIGN_SYSTEM_FILE), 'utf8')).toContain(
      '# Custom system',
    );
    expect(resolved.rootPath).toBe(workspace);
    expect(resolved.colors).toContain('#123456');
    expect(resolved.fonts.some((font) => font.includes('Inter'))).toBe(true);
  });

  it('uses the linked fallback when the design has no workspace', async () => {
    const db = initInMemoryDb();
    const design = createDesign(db, 'Legacy');
    const fallback = linkedFallback();

    await expect(resolveDesignSystemForDesign(db, design.id, fallback)).resolves.toBe(fallback);
  });

  it('uses the built-in default when there is no design workspace or linked fallback', async () => {
    const db = initInMemoryDb();

    const resolved = await resolveDesignSystemForDesign(db, 'missing-design', null);

    expect(resolved.rootPath).toBe('atv-design-default');
    expect(resolved.sourceFiles).toEqual([DEFAULT_DESIGN_SYSTEM_FILE]);
  });
});
