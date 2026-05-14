import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_DESIGN_SYSTEM_FILE,
  createDefaultDesignSystemSnapshot,
  ensureWorkspaceDesignSystem,
} from './default-design-system';

const tempDirs: string[] = [];

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'atv-design-default-ds-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('default design system', () => {
  it('creates a default DESIGN.md for a new design workspace', async () => {
    const workspace = await makeTempDir();

    const resultPath = await ensureWorkspaceDesignSystem(workspace, 'Launch Card');

    expect(resultPath).toBe(path.join(workspace, DEFAULT_DESIGN_SYSTEM_FILE));
    const body = await readFile(resultPath, 'utf8');
    expect(body).toContain('# DESIGN.md');
    expect(body).toContain('Design: Launch Card');
    expect(body).toContain('--color-accent');
    expect(body).toContain('packages/ui/src/tokens.css');
  });

  it('does not overwrite an existing per-design DESIGN.md', async () => {
    const workspace = await makeTempDir();
    const designSystemPath = path.join(workspace, DEFAULT_DESIGN_SYSTEM_FILE);
    await writeFile(designSystemPath, '# Custom system\n\n--color-accent: #123456;\n', 'utf8');

    await ensureWorkspaceDesignSystem(workspace, 'Ignored Name');

    await expect(readFile(designSystemPath, 'utf8')).resolves.toBe(
      '# Custom system\n\n--color-accent: #123456;\n',
    );
  });

  it('returns a default snapshot when no workspace design system is available', () => {
    const snapshot = createDefaultDesignSystemSnapshot();

    expect(snapshot.rootPath).toBe('atv-design-default');
    expect(snapshot.sourceFiles).toEqual([DEFAULT_DESIGN_SYSTEM_FILE]);
    expect(snapshot.summary).toContain('ATV Design default');
    expect(snapshot.colors).toContain('oklch(0.62 0.16 35)');
  });
});
