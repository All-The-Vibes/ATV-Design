import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildAppPaths,
  buildAppPathsForLocations,
  initStorageSettings,
  patchForStorageKind,
  readPersistedStorageLocations,
  storageSettingsPath,
  writeStorageLocations,
} from './storage-settings';

const tempDirs: string[] = [];

async function tempRoot(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'atv-design-storage-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('buildAppPaths', () => {
  it('returns file paths and their containing folders for config and logs', () => {
    const paths = buildAppPaths(
      '/tmp/atv-design/config.toml',
      '/tmp/atv-design/logs/main.log',
      '/tmp/atv-design',
    );

    expect(paths).toEqual({
      config: '/tmp/atv-design/config.toml',
      configFolder: '/tmp/atv-design',
      logs: '/tmp/atv-design/logs/main.log',
      logsFolder: '/tmp/atv-design/logs',
      data: '/tmp/atv-design',
    });
  });

  it('builds paths from persisted storage locations and defaults', () => {
    const configDir = join('custom', 'config');
    const dataDir = join('custom', 'data');
    const logsDir = join('default', 'logs');
    const paths = buildAppPathsForLocations(
      { configDir, dataDir },
      {
        configDir: join('default', 'config'),
        logsDir,
        dataDir: join('default', 'data'),
      },
    );

    expect(paths).toEqual({
      config: join(configDir, 'config.toml'),
      configFolder: configDir,
      logs: join(logsDir, 'main.log'),
      logsFolder: logsDir,
      data: dataDir,
    });
  });

  it('persists storage locations in the bootstrap userData directory', async () => {
    const root = await tempRoot();
    initStorageSettings(root);
    const dataDir = join(root, 'chosen-data');

    const next = await writeStorageLocations(patchForStorageKind('data', dataDir));

    expect(next).toEqual({ dataDir });
    await expect(readPersistedStorageLocations(root)).resolves.toEqual({ dataDir });
    await expect(readFile(storageSettingsPath(root), 'utf8')).resolves.toContain('"dataDir":');
  });
});
