/**
 * client.test.ts — unit tests for createCopilotClient.
 */

import { ERROR_CODES } from '@atv-design/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCopilotClient } from './client';
import { CopilotProviderError } from './errors';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeResponse(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeClient(overrides?: {
  sessionTokenProvider?: () => Promise<string>;
  baseUrl?: string;
  userAgent?: string;
}) {
  return createCopilotClient({
    sessionTokenProvider: async () => 'sess_token_abc',
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createCopilotClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('calls session token provider once per request and adds Bearer header', async () => {
    const provider = vi.fn().mockResolvedValue('my_session_token');
    const fetchSpy = vi.fn().mockResolvedValue(makeResponse(200, { ok: true }));
    vi.stubGlobal('fetch', fetchSpy);

    const client = createCopilotClient({ sessionTokenProvider: provider });
    await client.fetch('/chat/completions', { method: 'POST', body: '{}' });

    expect(provider).toHaveBeenCalledOnce();
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer my_session_token');
  });

  it('caller headers override defaults', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(makeResponse(200, {}));
    vi.stubGlobal('fetch', fetchSpy);

    const client = makeClient();
    await client.fetch('/some/path', {
      method: 'GET',
      headers: { Accept: 'text/plain', 'X-Custom': 'yes' },
    });

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['Accept']).toBe('text/plain');
    expect(headers['X-Custom']).toBe('yes');
    // Authorization default still present (caller did not override it)
    expect(headers['Authorization']).toBe('Bearer sess_token_abc');
  });

  it('retry: 503 once then 200 → exactly 2 fetch calls, returns 200', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(makeResponse(503, { message: 'unavailable' }))
      .mockResolvedValueOnce(makeResponse(200, { ok: true }));
    vi.stubGlobal('fetch', fetchSpy);

    const client = makeClient();
    const res = await client.fetch('/chat/completions', { method: 'POST', body: '{}' });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(res.status).toBe(200);
  });

  it('401 → throws CopilotProviderError, no retry (auth errors are non-transient)', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(makeResponse(401, { message: 'Unauthorized' }));
    vi.stubGlobal('fetch', fetchSpy);

    const client = makeClient();
    const err = await client
      .fetch('/chat/completions', { method: 'POST', body: '{}' })
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(CopilotProviderError);
    expect((err as CopilotProviderError).status).toBe(401);
    expect((err as CopilotProviderError).code).toBe(ERROR_CODES.PROVIDER_AUTH_MISSING);
    // auth errors must NOT be retried
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it('pre-aborted AbortSignal causes immediate throw without making a request', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(makeResponse(200, {}));
    vi.stubGlobal('fetch', fetchSpy);

    const controller = new AbortController();
    controller.abort();

    const client = makeClient();
    await expect(
      client.fetch('/chat/completions', { method: 'POST', signal: controller.signal }),
    ).rejects.toThrow();
  });

  it('builds URL from baseUrl + path', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(makeResponse(200, {}));
    vi.stubGlobal('fetch', fetchSpy);

    const client = createCopilotClient({
      sessionTokenProvider: async () => 'tok',
      baseUrl: 'https://custom.example.com',
    });
    await client.fetch('/v1/test', { method: 'GET' });

    const [calledUrl] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toBe('https://custom.example.com/v1/test');
  });
});
