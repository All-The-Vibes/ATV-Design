import type { ProviderCapabilities } from '@atv-design/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { buildAuthHeadersForWireMock, fetchWithTimeoutMock } = vi.hoisted(() => ({
  buildAuthHeadersForWireMock: vi.fn(),
  fetchWithTimeoutMock: vi.fn(),
}));

vi.mock('./auth-headers', () => ({
  buildAuthHeadersForWire: buildAuthHeadersForWireMock,
}));

vi.mock('./connection-ipc', () => ({
  CONNECTION_FETCH_TIMEOUT_MS: 10_000,
  fetchWithTimeout: fetchWithTimeoutMock,
}));

import {
  _clearCopilotModelEndpointCache,
  extractCopilotSupportedEndpoints,
  pickCopilotWireForModel,
  resolveCopilotTransportForModel,
} from './copilot-models';

describe('copilot model transport resolution', () => {
  beforeEach(() => {
    buildAuthHeadersForWireMock.mockReset();
    fetchWithTimeoutMock.mockReset();
    buildAuthHeadersForWireMock.mockReturnValue({
      authorization: 'Bearer test-token',
      'editor-version': 'atv-design/test',
      'copilot-integration-id': 'vscode-chat',
    });
    _clearCopilotModelEndpointCache();
  });

  afterEach(() => {
    vi.clearAllMocks();
    _clearCopilotModelEndpointCache();
  });

  it('extracts supported endpoints from Copilot /models payloads', () => {
    const endpoints = extractCopilotSupportedEndpoints({
      data: [
        { id: 'gpt-5.5', supported_endpoints: ['/responses', 'ws:/responses'] },
        { id: 'claude-opus-4.7', supported_endpoints: ['/v1/messages', '/chat/completions'] },
        { id: 'skip-me' },
      ],
    });

    expect(endpoints.get('gpt-5.5')).toEqual(['/responses', 'ws:/responses']);
    expect(endpoints.get('claude-opus-4.7')).toEqual(['/v1/messages', '/chat/completions']);
    expect(endpoints.has('skip-me')).toBe(false);
  });

  it('uses /responses for GPT-5-only Copilot models and chat completions for Claude/Gemini', () => {
    expect(pickCopilotWireForModel('gpt-5.5', ['/responses'])).toEqual({
      wire: 'openai-responses',
      source: 'live-models',
      supportedEndpoints: ['/responses'],
    });
    expect(
      pickCopilotWireForModel('claude-opus-4.7', ['/v1/messages', '/chat/completions']),
    ).toEqual({
      wire: 'openai-chat',
      source: 'live-models',
      supportedEndpoints: ['/v1/messages', '/chat/completions'],
    });
    expect(pickCopilotWireForModel('gemini-3.1-pro-preview', ['/chat/completions'])).toEqual({
      wire: 'openai-chat',
      source: 'live-models',
      supportedEndpoints: ['/chat/completions'],
    });
  });

  it('falls back heuristically when Copilot /models is unavailable', async () => {
    fetchWithTimeoutMock.mockRejectedValue(new Error('network down'));

    await expect(
      resolveCopilotTransportForModel({
        modelId: 'gpt-5.5',
        apiKey: 'copilot-session-token',
        baseUrl: 'https://api.githubcopilot.com',
      }),
    ).resolves.toMatchObject({
      wire: 'openai-responses',
      source: 'heuristic',
      supportedEndpoints: [],
      capabilities: {
        supportsResponsesApi: true,
        supportsChatCompletions: false,
      },
    });

    await expect(
      resolveCopilotTransportForModel({
        modelId: 'claude-opus-4.7',
        apiKey: 'copilot-session-token',
        baseUrl: 'https://api.githubcopilot.com',
      }),
    ).resolves.toMatchObject({
      wire: 'openai-chat',
      source: 'heuristic',
      supportedEndpoints: [],
      capabilities: {
        supportsResponsesApi: false,
        supportsChatCompletions: true,
      },
    });
  });

  it('uses live Copilot supported_endpoints to resolve GPT, Claude, and Gemini transports', async () => {
    fetchWithTimeoutMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: [
          { id: 'gpt-5.5', supported_endpoints: ['/responses', 'ws:/responses'] },
          { id: 'claude-opus-4.7', supported_endpoints: ['/v1/messages', '/chat/completions'] },
          { id: 'gemini-3.1-pro-preview', supported_endpoints: ['/chat/completions'] },
        ],
      }),
    });

    const explicitCapabilities: ProviderCapabilities = {
      supportsModelsEndpoint: true,
      supportsKeyless: true,
      modelDiscoveryMode: 'models',
    };

    const gpt = await resolveCopilotTransportForModel({
      modelId: 'gpt-5.5',
      apiKey: 'copilot-session-token',
      baseUrl: 'https://api.githubcopilot.com',
      httpHeaders: { 'Editor-Version': 'atv-design/test', 'Copilot-Integration-Id': 'vscode-chat' },
      explicitCapabilities,
    });
    const claude = await resolveCopilotTransportForModel({
      modelId: 'claude-opus-4.7',
      apiKey: 'copilot-session-token',
      baseUrl: 'https://api.githubcopilot.com',
      httpHeaders: { 'Editor-Version': 'atv-design/test', 'Copilot-Integration-Id': 'vscode-chat' },
      explicitCapabilities,
    });
    const gemini = await resolveCopilotTransportForModel({
      modelId: 'gemini-3.1-pro-preview',
      apiKey: 'copilot-session-token',
      baseUrl: 'https://api.githubcopilot.com',
      httpHeaders: { 'Editor-Version': 'atv-design/test', 'Copilot-Integration-Id': 'vscode-chat' },
      explicitCapabilities,
    });

    expect(gpt).toMatchObject({
      wire: 'openai-responses',
      source: 'live-models',
      supportedEndpoints: ['/responses', 'ws:/responses'],
      capabilities: {
        supportsResponsesApi: true,
        supportsChatCompletions: false,
        supportsDeveloperRole: true,
        supportsSystemRole: false,
      },
      explicitCapabilities,
    });
    expect(claude).toMatchObject({
      wire: 'openai-chat',
      source: 'live-models',
      supportedEndpoints: ['/v1/messages', '/chat/completions'],
      capabilities: {
        supportsResponsesApi: false,
        supportsChatCompletions: true,
        supportsDeveloperRole: false,
        supportsSystemRole: true,
      },
      explicitCapabilities,
    });
    expect(gemini).toMatchObject({
      wire: 'openai-chat',
      source: 'live-models',
      supportedEndpoints: ['/chat/completions'],
      capabilities: {
        supportsResponsesApi: false,
        supportsChatCompletions: true,
      },
      explicitCapabilities,
    });

    expect(fetchWithTimeoutMock).toHaveBeenCalledTimes(1);
  });
});
