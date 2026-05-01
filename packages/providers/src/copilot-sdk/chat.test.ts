/**
 * chat.test.ts — unit tests for complete().
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { complete } from './chat';
import type { CopilotClient } from './client';
import { CopilotProviderError } from './errors';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeWireResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeWireBody(overrides: Record<string, unknown> = {}) {
  return {
    id: 'chatcmpl-abc123',
    model: 'gpt-4.1',
    choices: [
      {
        message: { role: 'assistant', content: 'Hello there!' },
        finish_reason: 'stop',
      },
    ],
    usage: {
      prompt_tokens: 10,
      completion_tokens: 5,
      total_tokens: 15,
    },
    ...overrides,
  };
}

function makeMockClient(
  responseBody: unknown = makeWireBody(),
  status = 200,
): {
  client: CopilotClient;
  fetchSpy: ReturnType<typeof vi.fn>;
} {
  const fetchSpy = vi.fn().mockResolvedValue(makeWireResponse(responseBody, status));
  const client: CopilotClient = { fetch: fetchSpy };
  return { client, fetchSpy };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('complete', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('happy path: parses content, model, finishReason, usage from wire response', async () => {
    const { client } = makeMockClient();

    const result = await complete({
      client,
      modelId: 'gpt-4.1',
      messages: [{ role: 'user', content: 'hi' }],
    });

    expect(result.content).toBe('Hello there!');
    expect(result.model).toBe('gpt-4.1');
    expect(result.finishReason).toBe('stop');
    expect(result.id).toBe('chatcmpl-abc123');
    expect(result.usage).toEqual({
      promptTokens: 10,
      completionTokens: 5,
      totalTokens: 15,
    });
  });

  it('default model: no modelId/tier → body sends model: gpt-4.1', async () => {
    const { client, fetchSpy } = makeMockClient();

    await complete({
      client,
      messages: [{ role: 'user', content: 'hello' }],
    });

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as { model: string };
    expect(body.model).toBe('gpt-4.1');
  });

  it('tier fallback: tier=medium + availableModels=[gpt-4o, gpt-4o-mini] → gpt-4o (lexical sort)', async () => {
    const { client, fetchSpy } = makeMockClient(makeWireBody({ model: 'gpt-4o' }));

    await complete({
      client,
      tier: 'medium',
      availableModels: ['gpt-4o', 'gpt-4o-mini'],
      messages: [{ role: 'user', content: 'test' }],
    });

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as { model: string };
    // gpt-4o is the only medium-tier registry entry; lexical sort picks it
    expect(body.model).toBe('gpt-4o');
  });

  it('unknown modelId → throws CopilotProviderError before HTTP call', async () => {
    const { client, fetchSpy } = makeMockClient();

    const err = await complete({
      client,
      modelId: 'nonexistent-model-xyz',
      messages: [{ role: 'user', content: 'hi' }],
    }).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(CopilotProviderError);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('POSTs to /chat/completions with stream: false', async () => {
    const { client, fetchSpy } = makeMockClient();

    await complete({
      client,
      modelId: 'gpt-4.1',
      messages: [{ role: 'user', content: 'hi' }],
    });

    const [path, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(path).toBe('/chat/completions');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string) as { stream: boolean };
    expect(body.stream).toBe(false);
  });

  it('passes messages through to request body', async () => {
    const { client, fetchSpy } = makeMockClient();
    const messages = [
      { role: 'system' as const, content: 'You are helpful.' },
      { role: 'user' as const, content: 'What is 2+2?' },
    ];

    await complete({ client, modelId: 'gpt-4.1', messages });

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as { messages: typeof messages };
    expect(body.messages).toEqual(messages);
  });
});
