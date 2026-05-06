import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  type Config,
  GITHUB_COPILOT_MODELS_HINT,
  GITHUB_COPILOT_PROVIDER_ID,
} from '@atv-design/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const handlers = new Map<string, (...args: unknown[]) => unknown>();

vi.mock('./electron-runtime', () => ({
  app: { getVersion: vi.fn(() => '1.2.3') },
  ipcMain: {
    handle: (channel: string, fn: (...args: unknown[]) => unknown) => {
      handlers.set(channel, fn);
    },
  },
  shell: { openExternal: vi.fn(async () => true) },
}));

vi.mock('electron-log/main', () => ({
  default: {
    scope: () => ({ warn: vi.fn(), info: vi.fn(), error: vi.fn() }),
    transports: {
      file: { resolvePathFn: null, maxSize: 0, format: '' },
      console: { level: 'info', format: '' },
    },
    errorHandler: { startCatching: vi.fn() },
    eventLogger: { startLogging: vi.fn() },
    info: vi.fn(),
  },
}));

vi.mock('./logger', () => ({
  getLogger: () => ({ warn: vi.fn(), info: vi.fn(), error: vi.fn() }),
}));

const writeConfigMock = vi.fn(async () => {});
vi.mock('./config', () => ({
  configDir: () => tmpConfigDir,
  writeConfig: writeConfigMock,
}));

let fakeCachedConfig: Config | null = null;
vi.mock('./onboarding-ipc', () => ({
  getCachedConfig: () => fakeCachedConfig,
  setCachedConfig: (cfg: Config | null) => {
    fakeCachedConfig = cfg;
  },
}));

const buildAuthorizeUrlMock = vi.fn(
  () => 'https://github.com/login/oauth/authorize?client_id=test',
);
const exchangeCodeMock = vi.fn();
const exchangeForSessionTokenMock = vi.fn();
const generatePkceMock = vi.fn(() => ({ challenge: 'pkce-challenge', verifier: 'pkce-verifier' }));
const waitForCodeMock = vi.fn();
const closeMock = vi.fn(async () => {});
const startCallbackServerMock = vi.fn(async () => ({
  redirectUri: 'http://127.0.0.1:1455/oauth-callback',
  waitForCode: waitForCodeMock,
  close: closeMock,
}));

vi.mock('@atv-design/providers/copilot-sdk', async () => {
  const actual = await vi.importActual<typeof import('@atv-design/providers/copilot-sdk')>(
    '@atv-design/providers/copilot-sdk',
  );
  return {
    ...actual,
    buildAuthorizeUrl: buildAuthorizeUrlMock,
    exchangeCode: exchangeCodeMock,
    exchangeForSessionToken: exchangeForSessionTokenMock,
    generatePkce: generatePkceMock,
    startCallbackServer: startCallbackServerMock,
  };
});

let tmpConfigDir: string;

beforeEach(() => {
  tmpConfigDir = mkdtempSync(join(tmpdir(), 'copilot-oauth-ipc-'));
  fakeCachedConfig = null;
  handlers.clear();
  writeConfigMock.mockClear();
  buildAuthorizeUrlMock.mockClear();
  exchangeCodeMock.mockReset();
  exchangeForSessionTokenMock.mockReset();
  generatePkceMock.mockClear();
  waitForCodeMock.mockReset();
  closeMock.mockReset();
  startCallbackServerMock.mockClear();
});

afterEach(async () => {
  const mod = await import('./copilot-oauth-ipc');
  mod.__resetCopilotTokenStoreForTests();
  rmSync(tmpConfigDir, { recursive: true, force: true });
});

async function register() {
  const { registerCopilotOAuthIpc } = await import('./copilot-oauth-ipc');
  registerCopilotOAuthIpc();
}

describe('copilot-oauth:v1:status', () => {
  it('returns loggedIn: false when no token file is present', async () => {
    await register();
    const result = await handlers.get('copilot-oauth:v1:status')?.();
    expect(result).toMatchObject({
      loggedIn: false,
      githubScope: null,
      sessionExpiresAt: null,
    });
  });
});

describe('copilot-oauth:v1:login', () => {
  it('runs the happy path: opens browser, stores auth, injects provider, persists config', async () => {
    const { shell } = await import('./electron-runtime');
    const shellOpen = shell.openExternal as ReturnType<typeof vi.fn>;
    shellOpen.mockClear();

    waitForCodeMock.mockImplementation(async ({ state }: { state: string }) => ({
      code: 'AUTH_CODE',
      state,
    }));
    exchangeCodeMock.mockResolvedValue({
      accessToken: 'github-access-token',
      tokenType: 'bearer',
      scope: 'read:user copilot',
      obtainedAt: 123_456,
    });

    await register();
    const result = await handlers.get('copilot-oauth:v1:login')?.();

    expect(buildAuthorizeUrlMock).toHaveBeenCalledWith({
      redirectUri: 'http://127.0.0.1:1455/oauth-callback',
      state: expect.any(String),
      challenge: 'pkce-challenge',
    });
    expect(shellOpen).toHaveBeenCalledWith(
      'https://github.com/login/oauth/authorize?client_id=test',
    );
    expect(exchangeCodeMock).toHaveBeenCalledWith({
      code: 'AUTH_CODE',
      verifier: 'pkce-verifier',
      redirectUri: 'http://127.0.0.1:1455/oauth-callback',
      signal: expect.any(AbortSignal),
    });
    expect(result).toMatchObject({
      loggedIn: true,
      githubScope: 'read:user copilot',
      sessionExpiresAt: null,
    });
    expect(writeConfigMock).toHaveBeenCalledTimes(2);
    expect(fakeCachedConfig?.providers[GITHUB_COPILOT_PROVIDER_ID]).toMatchObject({
      id: GITHUB_COPILOT_PROVIDER_ID,
      name: 'GitHub Copilot',
      wire: 'openai-chat',
      baseUrl: 'https://api.githubcopilot.com',
      defaultModel: GITHUB_COPILOT_MODELS_HINT[0],
      modelsHint: [...GITHUB_COPILOT_MODELS_HINT],
      httpHeaders: {
        'Editor-Version': 'atv-design/1.2.3',
        'Copilot-Integration-Id': 'vscode-chat',
      },
      requiresApiKey: false,
    });
    expect(fakeCachedConfig?.activeProvider).toBe(GITHUB_COPILOT_PROVIDER_ID);
    expect(fakeCachedConfig?.activeModel).toBe(GITHUB_COPILOT_MODELS_HINT[0]);

    const { getCopilotTokenStore } = await import('./copilot-oauth-ipc');
    const stored = await getCopilotTokenStore().load();
    expect(stored).toMatchObject({
      githubAccessToken: 'github-access-token',
      githubTokenType: 'bearer',
      githubScope: 'read:user copilot',
      copilotSessionToken: null,
      copilotSessionExpiresAt: null,
    });
    expect(closeMock).toHaveBeenCalledTimes(1);
  });

  it('aborts an in-flight login when cancel-login is invoked', async () => {
    waitForCodeMock.mockImplementation(
      async ({ signal }: { signal?: AbortSignal }) =>
        await new Promise<never>((_resolve, reject) => {
          if (signal?.aborted) {
            reject(new Error('GitHub OAuth callback aborted by signal'));
            return;
          }
          signal?.addEventListener(
            'abort',
            () => reject(new Error('GitHub OAuth callback aborted by signal')),
            { once: true },
          );
        }),
    );

    await register();
    const loginPromise = handlers.get('copilot-oauth:v1:login')?.() as Promise<unknown>;

    await expect(handlers.get('copilot-oauth:v1:cancel-login')?.()).resolves.toBe(true);
    await expect(loginPromise).rejects.toThrow(/GitHub Copilot login cancelled/);
    expect(closeMock).toHaveBeenCalledTimes(1);
    expect(writeConfigMock).not.toHaveBeenCalled();
  });
});

describe('copilot-oauth:v1:logout', () => {
  it('clears stored auth and removes github-copilot from providers', async () => {
    const { buildCopilotProviderEntry, getCopilotTokenStore } = await import('./copilot-oauth-ipc');
    await getCopilotTokenStore().save({
      githubAccessToken: 'github-access-token',
      githubTokenType: 'bearer',
      githubScope: 'read:user copilot',
      githubObtainedAt: 123_456,
      copilotSessionToken: 'copilot-session-token',
      copilotSessionExpiresAt: 999_999,
    });
    fakeCachedConfig = {
      version: 3,
      provider: GITHUB_COPILOT_PROVIDER_ID,
      modelPrimary: GITHUB_COPILOT_MODELS_HINT[0],
      activeProvider: GITHUB_COPILOT_PROVIDER_ID,
      activeModel: GITHUB_COPILOT_MODELS_HINT[0],
      secrets: {},
      baseUrls: {
        [GITHUB_COPILOT_PROVIDER_ID]: { baseUrl: 'https://api.githubcopilot.com' },
      },
      providers: {
        [GITHUB_COPILOT_PROVIDER_ID]: buildCopilotProviderEntry(),
      },
    };

    await register();
    const result = await handlers.get('copilot-oauth:v1:logout')?.();

    expect(result).toMatchObject({
      loggedIn: false,
      githubScope: null,
      sessionExpiresAt: null,
    });
    expect(writeConfigMock).toHaveBeenCalledTimes(2);
    expect(fakeCachedConfig?.providers[GITHUB_COPILOT_PROVIDER_ID]).toBeUndefined();
    expect(fakeCachedConfig?.activeProvider).toBe('');
    expect(fakeCachedConfig?.activeModel).toBe('');
    await expect(getCopilotTokenStore().load()).resolves.toBeNull();
  });
});
