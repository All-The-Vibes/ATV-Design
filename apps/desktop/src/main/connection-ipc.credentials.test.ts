import {
  CodesignError,
  type Config,
  ERROR_CODES,
  GITHUB_COPILOT_MODELS_HINT,
  GITHUB_COPILOT_PROVIDER_ID,
  hydrateConfig,
} from '@atv-design/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./electron-runtime', () => ({
  ipcMain: { handle: vi.fn() },
}));

const { getCachedConfigMock, getApiKeyForProviderMock, getCopilotSessionTokenMock } = vi.hoisted(
  () => ({
    getCachedConfigMock: vi.fn<() => Config | null>(),
    getApiKeyForProviderMock: vi.fn<(providerId: string) => string>(),
    getCopilotSessionTokenMock: vi.fn<() => Promise<string>>(),
  }),
);

vi.mock('./onboarding-ipc', () => ({
  getCachedConfig: getCachedConfigMock,
  getApiKeyForProvider: getApiKeyForProviderMock,
}));

vi.mock('./codex-oauth-ipc', () => ({
  getCodexTokenStore: () => ({
    getValidAccessToken: vi.fn(async () => 'codex-token'),
    read: vi.fn(async () => null),
  }),
}));

vi.mock('./copilot-oauth-ipc', () => ({
  getCopilotSessionToken: getCopilotSessionTokenMock,
}));

import { resolveActiveCredentials, resolveCredentialsForProvider } from './connection-ipc';

function makeCfg(): Config {
  return hydrateConfig({
    version: 3,
    activeProvider: 'claude-shell',
    activeModel: 'claude-sonnet-4-6',
    providers: {
      'claude-shell': {
        id: 'claude-shell',
        name: 'Claude (shell env)',
        builtin: false,
        wire: 'anthropic',
        baseUrl: 'https://api.anthropic.com',
        defaultModel: 'claude-sonnet-4-6',
        envKey: 'ANTHROPIC_AUTH_TOKEN',
      },
    },
    secrets: {},
  });
}

function makeCopilotCfg(): Config {
  return hydrateConfig({
    version: 3,
    activeProvider: GITHUB_COPILOT_PROVIDER_ID,
    activeModel: GITHUB_COPILOT_MODELS_HINT[0],
    providers: {
      [GITHUB_COPILOT_PROVIDER_ID]: {
        id: GITHUB_COPILOT_PROVIDER_ID,
        name: 'GitHub Copilot',
        builtin: false,
        wire: 'openai-chat',
        baseUrl: 'https://api.githubcopilot.com',
        defaultModel: GITHUB_COPILOT_MODELS_HINT[0],
        modelsHint: [...GITHUB_COPILOT_MODELS_HINT],
        httpHeaders: {
          'Editor-Version': 'atv-design/1.2.3',
          'Copilot-Integration-Id': 'vscode-chat',
        },
        requiresApiKey: false,
        capabilities: {
          supportsKeyless: true,
          supportsModelsEndpoint: false,
          modelDiscoveryMode: 'static-hint',
        },
      },
    },
    secrets: {},
  });
}

describe('connection credential resolution via envKey fallback', () => {
  beforeEach(() => {
    getCachedConfigMock.mockReset();
    getApiKeyForProviderMock.mockReset();
    getCopilotSessionTokenMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('resolveCredentialsForProvider delegates to getApiKeyForProvider for env-backed imported providers', async () => {
    getCachedConfigMock.mockReturnValue(makeCfg());
    getApiKeyForProviderMock.mockReturnValue('sk-from-env');

    const result = await resolveCredentialsForProvider('claude-shell');

    expect(getApiKeyForProviderMock).toHaveBeenCalledWith('claude-shell');
    expect(result).toMatchObject({
      provider: 'claude-shell',
      wire: 'anthropic',
      apiKey: 'sk-from-env',
      baseUrl: 'https://api.anthropic.com',
      capabilities: {
        supportsReasoning: true,
        supportsModelsEndpoint: true,
      },
    });
  });

  it('resolveActiveCredentials also reaches env-backed imported providers without a stored secret', async () => {
    getCachedConfigMock.mockReturnValue(makeCfg());
    getApiKeyForProviderMock.mockReturnValue('sk-from-env');

    const result = await resolveActiveCredentials();

    expect(getApiKeyForProviderMock).toHaveBeenCalledWith('claude-shell');
    expect(result).toMatchObject({
      provider: 'claude-shell',
      wire: 'anthropic',
      apiKey: 'sk-from-env',
      baseUrl: 'https://api.anthropic.com',
      capabilities: {
        supportsReasoning: true,
        supportsModelsEndpoint: true,
      },
    });
  });

  it('resolveCredentialsForProvider uses the Copilot session-token path for GitHub Copilot', async () => {
    getCachedConfigMock.mockReturnValue(makeCopilotCfg());
    getCopilotSessionTokenMock.mockResolvedValue('copilot-session-token');

    const result = await resolveCredentialsForProvider(GITHUB_COPILOT_PROVIDER_ID);

    expect(getCopilotSessionTokenMock).toHaveBeenCalledTimes(1);
    expect(getApiKeyForProviderMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      provider: GITHUB_COPILOT_PROVIDER_ID,
      wire: 'openai-chat',
      apiKey: 'copilot-session-token',
      baseUrl: 'https://api.githubcopilot.com',
      httpHeaders: {
        'Editor-Version': 'atv-design/1.2.3',
        'Copilot-Integration-Id': 'vscode-chat',
      },
      capabilities: {
        supportsKeyless: true,
        supportsModelsEndpoint: false,
      },
    });
  });

  it('maps missing Copilot auth to the dedicated 401 hint', async () => {
    getCachedConfigMock.mockReturnValue(makeCopilotCfg());
    getCopilotSessionTokenMock.mockRejectedValue(
      new CodesignError('GitHub Copilot session expired', ERROR_CODES.PROVIDER_AUTH_MISSING),
    );

    const result = await resolveActiveCredentials();

    expect(result).toEqual({
      ok: false,
      code: '401',
      message: 'GitHub Copilot session expired',
      hint: 'GitHub Copilot sign-in expired. Re-login from Settings.',
    });
  });
});
