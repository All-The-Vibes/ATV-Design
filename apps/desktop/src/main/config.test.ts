import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  BUILTIN_PROVIDERS,
  GITHUB_COPILOT_MODELS_HINT,
  GITHUB_COPILOT_PROVIDER_ID,
} from '@atv-design/shared';
import { parse as parseToml, stringify as stringifyToml } from 'smol-toml';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getActiveStorageLocationsMock } = vi.hoisted(() => ({
  getActiveStorageLocationsMock: vi.fn<() => { configDir?: string }>(() => ({})),
}));

vi.mock('./storage-settings', () => ({
  getActiveStorageLocations: getActiveStorageLocationsMock,
}));

const tempRoots: string[] = [];
let previousXdgConfigHome: string | undefined;

beforeEach(() => {
  previousXdgConfigHome = process.env['XDG_CONFIG_HOME'];
  getActiveStorageLocationsMock.mockReset();
  getActiveStorageLocationsMock.mockReturnValue({});
});

afterEach(async () => {
  vi.resetModules();
  if (previousXdgConfigHome === undefined) process.env['XDG_CONFIG_HOME'] = undefined;
  else process.env['XDG_CONFIG_HOME'] = previousXdgConfigHome;
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function makeTempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'atv-design-config-'));
  tempRoots.push(root);
  return root;
}

function setXdgConfigHome(root: string): void {
  process.env['XDG_CONFIG_HOME'] = root;
}

function makePersistedConfig(overrides?: {
  activeProvider?: string;
  activeModel?: string;
  providers?: Record<string, (typeof BUILTIN_PROVIDERS)[keyof typeof BUILTIN_PROVIDERS]>;
}): Record<string, unknown> {
  const activeProvider = overrides?.activeProvider ?? 'openai';
  const activeModel = overrides?.activeModel ?? 'gpt-4o';
  const providers = overrides?.providers ?? { openai: BUILTIN_PROVIDERS.openai };
  return {
    version: 3,
    activeProvider,
    activeModel,
    secrets: {},
    providers,
  };
}

async function writeTomlConfig(path: string, config: Record<string, unknown>): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, stringifyToml(config), 'utf8');
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(value, null, 2), 'utf8');
}

async function loadConfigModule() {
  return await import('./config');
}

describe('readConfig legacy migration', () => {
  it('reads legacy open-codesign config when atv-design config is absent', async () => {
    const root = await makeTempRoot();
    setXdgConfigHome(root);
    await writeTomlConfig(
      join(root, 'open-codesign', 'config.toml'),
      makePersistedConfig({
        activeProvider: 'openrouter',
        activeModel: 'anthropic/claude-sonnet-4.6',
        providers: { openrouter: BUILTIN_PROVIDERS.openrouter },
      }),
    );

    const { readConfig } = await loadConfigModule();
    const config = await readConfig();

    expect(config?.activeProvider).toBe('openrouter');
    expect(config?.activeModel).toBe('anthropic/claude-sonnet-4.6');
    await expect(readFile(join(root, 'atv-design', 'config.toml'), 'utf8')).resolves.toContain(
      'activeProvider = "openrouter"',
    );
  });

  it('copies config.toml and known sidecars into the new config dir once', async () => {
    const root = await makeTempRoot();
    setXdgConfigHome(root);
    await writeTomlConfig(join(root, 'open-codesign', 'config.toml'), makePersistedConfig());
    await writeJson(join(root, 'open-codesign', 'codex-auth.json'), { accessToken: 'legacy' });
    await writeJson(join(root, 'open-codesign', 'copilot-auth.json'), { githubAccessToken: 'gh' });
    await writeJson(join(root, 'open-codesign', 'preferences.json'), { updateChannel: 'beta' });
    await writeJson(join(root, 'open-codesign', 'locale.json'), { locale: 'zh-CN' });
    await writeJson(join(root, 'open-codesign', 'random.json'), { shouldNotCopy: true });

    const { readConfig } = await loadConfigModule();
    await readConfig();

    await expect(readFile(join(root, 'atv-design', 'codex-auth.json'), 'utf8')).resolves.toContain(
      '"accessToken": "legacy"',
    );
    await expect(
      readFile(join(root, 'atv-design', 'copilot-auth.json'), 'utf8'),
    ).resolves.toContain('"githubAccessToken": "gh"');
    await expect(readFile(join(root, 'atv-design', 'preferences.json'), 'utf8')).resolves.toContain(
      '"updateChannel": "beta"',
    );
    await expect(readFile(join(root, 'atv-design', 'locale.json'), 'utf8')).resolves.toContain(
      '"locale": "zh-CN"',
    );
    await expect(readFile(join(root, 'atv-design', 'random.json'), 'utf8')).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('prefers the new atv-design config when both dirs exist', async () => {
    const root = await makeTempRoot();
    setXdgConfigHome(root);
    await writeTomlConfig(
      join(root, 'atv-design', 'config.toml'),
      makePersistedConfig({
        activeProvider: 'openrouter',
        activeModel: 'anthropic/claude-sonnet-4.6',
        providers: { openrouter: BUILTIN_PROVIDERS.openrouter },
      }),
    );
    await writeTomlConfig(join(root, 'open-codesign', 'config.toml'), makePersistedConfig());
    await writeJson(join(root, 'open-codesign', 'copilot-auth.json'), { githubAccessToken: 'gh' });

    const { readConfig } = await loadConfigModule();
    const config = await readConfig();

    expect(config?.activeProvider).toBe('openrouter');
    await expect(
      readFile(join(root, 'atv-design', 'copilot-auth.json'), 'utf8'),
    ).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('does not overwrite an existing new-path sidecar during migration', async () => {
    const root = await makeTempRoot();
    setXdgConfigHome(root);
    await writeTomlConfig(join(root, 'open-codesign', 'config.toml'), makePersistedConfig());
    await writeJson(join(root, 'open-codesign', 'codex-auth.json'), { accessToken: 'legacy' });
    await writeJson(join(root, 'open-codesign', 'copilot-auth.json'), { githubAccessToken: 'gh' });
    await writeJson(join(root, 'atv-design', 'codex-auth.json'), { accessToken: 'new' });

    const { readConfig } = await loadConfigModule();
    await readConfig();

    const codexAuth = JSON.parse(
      await readFile(join(root, 'atv-design', 'codex-auth.json'), 'utf8'),
    );
    const copilotAuth = JSON.parse(
      await readFile(join(root, 'atv-design', 'copilot-auth.json'), 'utf8'),
    );
    expect(codexAuth).toEqual({ accessToken: 'new' });
    expect(copilotAuth).toEqual({ githubAccessToken: 'gh' });
  });

  it('does not use legacy fallback when a custom configDir is configured', async () => {
    const root = await makeTempRoot();
    setXdgConfigHome(root);
    const customConfigDir = join(root, 'custom-config');
    getActiveStorageLocationsMock.mockReturnValue({ configDir: customConfigDir });
    await writeTomlConfig(join(root, 'open-codesign', 'config.toml'), makePersistedConfig());

    const { readConfig } = await loadConfigModule();
    const config = await readConfig();

    expect(config).toBeNull();
    await expect(readFile(join(customConfigDir, 'config.toml'), 'utf8')).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });
});

describe('readConfig new-path precedence', () => {
  it('writes a parseable migrated config at the new location', async () => {
    const root = await makeTempRoot();
    setXdgConfigHome(root);
    await writeTomlConfig(join(root, 'open-codesign', 'config.toml'), makePersistedConfig());

    const { readConfig } = await loadConfigModule();
    await readConfig();

    const migrated = parseToml(await readFile(join(root, 'atv-design', 'config.toml'), 'utf8')) as {
      version?: number;
      activeProvider?: string;
      activeModel?: string;
    };
    expect(migrated.version).toBe(3);
    expect(migrated.activeProvider).toBe('openai');
    expect(migrated.activeModel).toBe('gpt-4o');
  });

  it('refreshes stored GitHub Copilot providers to live model discovery defaults', async () => {
    const root = await makeTempRoot();
    setXdgConfigHome(root);
    await writeTomlConfig(join(root, 'atv-design', 'config.toml'), {
      version: 3,
      activeProvider: GITHUB_COPILOT_PROVIDER_ID,
      activeModel: 'gpt-4.1',
      secrets: {},
      providers: {
        [GITHUB_COPILOT_PROVIDER_ID]: {
          id: GITHUB_COPILOT_PROVIDER_ID,
          name: 'GitHub Copilot',
          builtin: false,
          wire: 'openai-chat',
          baseUrl: 'https://api.githubcopilot.com',
          defaultModel: 'gpt-4.1',
          modelsHint: ['gpt-4.1', 'gpt-4o', 'gpt-4o-mini'],
          requiresApiKey: false,
          capabilities: {
            supportsKeyless: true,
            supportsModelsEndpoint: false,
            modelDiscoveryMode: 'static-hint',
          },
        },
      },
    });

    const { readConfig } = await loadConfigModule();
    const config = await readConfig();

    expect(config?.activeModel).toBe(GITHUB_COPILOT_MODELS_HINT[0]);
    expect(config?.providers[GITHUB_COPILOT_PROVIDER_ID]).toMatchObject({
      defaultModel: GITHUB_COPILOT_MODELS_HINT[0],
      modelsHint: [...GITHUB_COPILOT_MODELS_HINT],
      capabilities: {
        supportsKeyless: true,
        supportsModelsEndpoint: true,
        modelDiscoveryMode: 'models',
      },
    });

    const persisted = parseToml(
      await readFile(join(root, 'atv-design', 'config.toml'), 'utf8'),
    ) as {
      activeModel?: string;
      providers?: Record<
        string,
        {
          defaultModel?: string;
          modelsHint?: string[];
          capabilities?: {
            supportsModelsEndpoint?: boolean;
            modelDiscoveryMode?: string;
          };
        }
      >;
    };
    expect(persisted.activeModel).toBe(GITHUB_COPILOT_MODELS_HINT[0]);
    expect(persisted.providers?.[GITHUB_COPILOT_PROVIDER_ID]?.defaultModel).toBe(
      GITHUB_COPILOT_MODELS_HINT[0],
    );
    expect(persisted.providers?.[GITHUB_COPILOT_PROVIDER_ID]?.modelsHint).toEqual([
      ...GITHUB_COPILOT_MODELS_HINT,
    ]);
    expect(
      persisted.providers?.[GITHUB_COPILOT_PROVIDER_ID]?.capabilities?.supportsModelsEndpoint,
    ).toBe(true);
    expect(
      persisted.providers?.[GITHUB_COPILOT_PROVIDER_ID]?.capabilities?.modelDiscoveryMode,
    ).toBe('models');
  });
});
