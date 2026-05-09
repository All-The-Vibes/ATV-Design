import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  type Config,
  GITHUB_COPILOT_MODELS_HINT,
  GITHUB_COPILOT_PROVIDER_ID,
} from '@atv-design/shared';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const handlers = new Map<string, (...args: unknown[]) => unknown>();

vi.mock('./electron-runtime', () => ({
  app: { getVersion: vi.fn(() => '1.2.3') },
  clipboard: { writeText: vi.fn() },
  dialog: {
    showMessageBox: vi.fn(async () => ({ response: 0 })),
  },
  ipcMain: {
    handle: (channel: string, fn: (...args: unknown[]) => unknown) => {
      handlers.set(channel, fn);
    },
  },
  shell: { openExternal: vi.fn(async () => true) },
}));

vi.mock('electron-log/main.js', () => ({
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

const exchangeForSessionTokenMock = vi.fn();
const requestDeviceCodeMock = vi.fn();
const pollDeviceAccessTokenMock = vi.fn();

vi.mock('@atv-design/providers/copilot-sdk', async () => {
  const actual = await vi.importActual<typeof import('@atv-design/providers/copilot-sdk')>(
    '@atv-design/providers/copilot-sdk',
  );
  return {
    ...actual,
    exchangeForSessionToken: exchangeForSessionTokenMock,
    pollDeviceAccessToken: pollDeviceAccessTokenMock,
    requestDeviceCode: requestDeviceCodeMock,
  };
});

let tmpConfigDir: string;
let copilotOAuthIpc: typeof import('./copilot-oauth-ipc');

beforeAll(async () => {
  copilotOAuthIpc = await import('./copilot-oauth-ipc');
}, 30_000);

beforeEach(() => {
  tmpConfigDir = mkdtempSync(join(tmpdir(), 'copilot-oauth-ipc-'));
  fakeCachedConfig = null;
  handlers.clear();
  writeConfigMock.mockClear();
  exchangeForSessionTokenMock.mockReset();
  requestDeviceCodeMock.mockReset();
  pollDeviceAccessTokenMock.mockReset();
});

afterAll(() => {
  copilotOAuthIpc.__resetCopilotTokenStoreForTests();
});

afterEach(() => {
  copilotOAuthIpc.__resetCopilotTokenStoreForTests();
  rmSync(tmpConfigDir, { recursive: true, force: true });
});

async function register() {
  copilotOAuthIpc.registerCopilotOAuthIpc();
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
  it('runs the happy path: starts device flow, stores auth, injects provider, persists config', async () => {
    const { clipboard, dialog, shell } = await import('./electron-runtime');
    const clipboardWrite = clipboard.writeText as ReturnType<typeof vi.fn>;
    const showMessageBox = dialog.showMessageBox as ReturnType<typeof vi.fn>;
    const shellOpen = shell.openExternal as ReturnType<typeof vi.fn>;
    clipboardWrite.mockClear();
    showMessageBox.mockClear();
    shellOpen.mockClear();

    requestDeviceCodeMock.mockResolvedValue({
      deviceCode: 'device-code-123',
      userCode: 'ABCD-EFGH',
      verificationUri: 'https://github.com/login/device',
      verificationUriComplete: 'https://github.com/login/device?user_code=ABCD-EFGH',
      expiresIn: 900,
      interval: 5,
    });
    pollDeviceAccessTokenMock.mockResolvedValue({
      accessToken: 'github-access-token',
      tokenType: 'bearer',
      scope: 'read:user copilot',
      obtainedAt: 123_456,
    });

    await register();
    const result = await handlers.get('copilot-oauth:v1:login')?.();

    expect(requestDeviceCodeMock).toHaveBeenCalledWith({
      signal: expect.any(AbortSignal),
    });
    expect(shellOpen).toHaveBeenCalledWith('https://github.com/login/device?user_code=ABCD-EFGH');
    expect(clipboardWrite).toHaveBeenCalledWith('ABCD-EFGH');
    expect(showMessageBox).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'GitHub Copilot Sign-In',
      }),
    );
    expect(pollDeviceAccessTokenMock).toHaveBeenCalledWith({
      deviceCode: 'device-code-123',
      interval: 5,
      expiresIn: 900,
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

    const stored = await copilotOAuthIpc.getCopilotTokenStore().load();
    expect(stored).toMatchObject({
      githubAccessToken: 'github-access-token',
      githubTokenType: 'bearer',
      githubScope: 'read:user copilot',
      copilotSessionToken: null,
      copilotSessionExpiresAt: null,
    });
  });

  it('aborts an in-flight login when cancel-login is invoked', async () => {
    requestDeviceCodeMock.mockResolvedValue({
      deviceCode: 'device-code-123',
      userCode: 'ABCD-EFGH',
      verificationUri: 'https://github.com/login/device',
      verificationUriComplete: null,
      expiresIn: 900,
      interval: 5,
    });
    pollDeviceAccessTokenMock.mockImplementation(
      async ({ signal }: { signal?: AbortSignal }) =>
        await new Promise<never>((_resolve, reject) => {
          if (signal?.aborted) {
            reject(new Error('GitHub device flow aborted by signal'));
            return;
          }
          signal?.addEventListener(
            'abort',
            () => reject(new Error('GitHub device flow aborted by signal')),
            { once: true },
          );
        }),
    );

    await register();
    const loginPromise = handlers.get('copilot-oauth:v1:login')?.() as Promise<unknown>;

    await expect(handlers.get('copilot-oauth:v1:cancel-login')?.()).resolves.toBe(true);
    await expect(loginPromise).rejects.toThrow(/GitHub Copilot login cancelled/);
    expect(writeConfigMock).not.toHaveBeenCalled();
  });
});

describe('copilot-oauth:v1:logout', () => {
  it('clears stored auth and removes github-copilot from providers', async () => {
    await copilotOAuthIpc.getCopilotTokenStore().save({
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
        [GITHUB_COPILOT_PROVIDER_ID]: copilotOAuthIpc.buildCopilotProviderEntry(),
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
    await expect(copilotOAuthIpc.getCopilotTokenStore().load()).resolves.toBeNull();
  });
});
