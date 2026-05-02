/**
 * index.test.ts — Integration tests for registerCopilotProvider.
 *
 * Uses the REAL startCallbackServer (loopback-only).
 * GitHub OAuth and Copilot session-token endpoints are mocked via injected fetch.
 *
 * PRINCIPLES: no console.*, no secret values asserted in log fields.
 */

import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CopilotProviderError } from './errors.js';
import type { CopilotProviderLogger } from './index.js';
import { registerCopilotProvider } from './index.js';
import { CopilotTokenStore } from './token-store.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTmpStore(): CopilotTokenStore {
  const filePath = join(tmpdir(), `copilot-test-${randomUUID()}.json`);
  return new CopilotTokenStore({ filePath });
}

function makeLogger(): {
  logger: CopilotProviderLogger;
  calls: Array<[string, string, Record<string, unknown> | undefined]>;
} {
  const calls: Array<[string, string, Record<string, unknown> | undefined]> = [];
  const logger: CopilotProviderLogger = {
    info: (key, fields) => {
      calls.push(['info', key, fields]);
    },
    warn: (key, fields) => {
      calls.push(['warn', key, fields]);
    },
    error: (key, fields) => {
      calls.push(['error', key, fields]);
    },
  };
  return { logger, calls };
}

/** Builds a mock fetch that handles the GitHub token URL. */
function makeTokenFetch(opts: {
  accessToken?: string;
  statusCode?: number;
}): typeof fetch {
  const accessToken = opts.accessToken ?? 'gho_testtoken';
  const statusCode = opts.statusCode ?? 200;

  return vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
    if (statusCode !== 200) {
      return new Response(JSON.stringify({ error: 'access_denied' }), {
        status: statusCode,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response(
      JSON.stringify({ access_token: accessToken, token_type: 'bearer', scope: 'read:user' }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }) as unknown as typeof fetch;
}

/** Simulates the browser redirect by GETting the callback URL with the given params. */
async function simulateBrowserCallback(
  authorizeUrl: string,
  params: { code?: string; state?: string; error?: string },
): Promise<void> {
  // Extract redirect_uri from the authorize URL
  const parsed = new URL(authorizeUrl);
  const redirectUri = parsed.searchParams.get('redirect_uri');
  if (!redirectUri) throw new Error('No redirect_uri in authorize URL');

  const state = params.state ?? parsed.searchParams.get('state') ?? '';

  const callbackUrl = new URL(redirectUri);
  if (params.error) {
    callbackUrl.searchParams.set('error', params.error);
  } else {
    callbackUrl.searchParams.set('code', params.code ?? 'test_code_123');
    callbackUrl.searchParams.set('state', state);
  }

  await fetch(callbackUrl.toString());
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('registerCopilotProvider', () => {
  let store: CopilotTokenStore;

  beforeEach(() => {
    store = makeTmpStore();
  });

  afterEach(async () => {
    await store.clear();
  });

  // -------------------------------------------------------------------------
  // signIn happy path
  // -------------------------------------------------------------------------
  it('signIn happy path — saves token and emits all 4 log keys', async () => {
    const { logger, calls } = makeLogger();
    const mockFetch = makeTokenFetch({ accessToken: 'gho_happy' });

    const provider = registerCopilotProvider({
      tokenStore: store,
      logger,
      fetch: mockFetch,
    });

    let capturedUrl = '';
    const openBrowser = async (url: string) => {
      capturedUrl = url;
      // Simulate browser redirect asynchronously after a tick
      setImmediate(() => simulateBrowserCallback(url, { code: 'code_xyz' }));
    };

    await provider.signIn({ openBrowser });

    // Token stored
    const stored = await store.load();
    expect(stored).not.toBeNull();
    expect(stored?.githubAccessToken).toBe('gho_happy');

    // All 4 log keys fired
    const loggedKeys = calls.map(([, key]) => key);
    expect(loggedKeys).toContain('oauth.start');
    expect(loggedKeys).toContain('oauth.code_received');
    expect(loggedKeys).toContain('oauth.token_exchanged');
    expect(loggedKeys).toContain('oauth.token_stored');

    // Browser was opened
    expect(capturedUrl).toContain('client_id=');

    // SECRET ASSERTION: no log field contains the code or access token values
    for (const [, , fields] of calls) {
      if (!fields) continue;
      const fieldValues = Object.values(fields).map(String);
      for (const val of fieldValues) {
        expect(val).not.toContain('code_xyz');
        expect(val).not.toContain('gho_happy');
      }
    }
  });

  // -------------------------------------------------------------------------
  // signIn state mismatch
  // -------------------------------------------------------------------------
  it('signIn state mismatch — throws CopilotProviderError, no token saved', async () => {
    const mockFetch = makeTokenFetch({});

    const provider = registerCopilotProvider({ tokenStore: store, fetch: mockFetch });

    const openBrowser = async (url: string) => {
      setImmediate(() => simulateBrowserCallback(url, { code: 'code_abc', state: 'WRONG_STATE' }));
    };

    await expect(provider.signIn({ openBrowser })).rejects.toBeInstanceOf(CopilotProviderError);

    // No token should have been saved
    const stored = await store.load();
    expect(stored).toBeNull();
  });

  // -------------------------------------------------------------------------
  // signIn AbortSignal propagation
  // -------------------------------------------------------------------------
  it('signIn AbortSignal propagation — rejects when aborted before callback', async () => {
    const mockFetch = makeTokenFetch({});
    const provider = registerCopilotProvider({ tokenStore: store, fetch: mockFetch });

    const controller = new AbortController();

    const openBrowser = async (_url: string) => {
      // Abort immediately without simulating callback
      controller.abort();
    };

    await expect(provider.signIn({ signal: controller.signal, openBrowser })).rejects.toThrow();

    // No token saved
    const stored = await store.load();
    expect(stored).toBeNull();
  });

  // -------------------------------------------------------------------------
  // signIn openBrowser called with authorize URL
  // -------------------------------------------------------------------------
  it('signIn openBrowser receives URL with client_id and code_challenge', async () => {
    const mockFetch = makeTokenFetch({});
    const provider = registerCopilotProvider({
      tokenStore: store,
      fetch: mockFetch,
      clientId: 'test_client_id',
    });

    const receivedUrls: string[] = [];

    const openBrowser = async (url: string) => {
      receivedUrls.push(url);
      setImmediate(() => simulateBrowserCallback(url, { code: 'code_ok' }));
    };

    await provider.signIn({ openBrowser });

    expect(receivedUrls).toHaveLength(1);
    const url = receivedUrls[0] ?? '';
    expect(url).toContain('client_id=test_client_id');
    expect(url).toContain('code_challenge=');
    expect(url).toContain('code_challenge_method=S256');
  });

  // -------------------------------------------------------------------------
  // isSignedIn / signOut
  // -------------------------------------------------------------------------
  it('isSignedIn and signOut round-trip', async () => {
    const provider = registerCopilotProvider({ tokenStore: store });

    // Not signed in initially
    expect(await provider.isSignedIn()).toBe(false);

    // Manually save a token
    await store.save({
      githubAccessToken: 'gho_manual',
      githubTokenType: 'bearer',
      githubScope: 'read:user',
      githubObtainedAt: Date.now(),
      copilotSessionToken: null,
      copilotSessionExpiresAt: null,
    });

    expect(await provider.isSignedIn()).toBe(true);

    await provider.signOut();

    expect(await provider.isSignedIn()).toBe(false);
  });

  // -------------------------------------------------------------------------
  // complete uses cached session token when fresh
  // -------------------------------------------------------------------------
  it('complete uses cached session token when fresh — no fetch to session-token endpoint', async () => {
    const sessionToken = 'cop_cached_fresh';
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes from now

    await store.save({
      githubAccessToken: 'gho_base',
      githubTokenType: 'bearer',
      githubScope: 'read:user',
      githubObtainedAt: Date.now() - 60_000,
      copilotSessionToken: sessionToken,
      copilotSessionExpiresAt: expiresAt,
    });

    let sessionTokenCalls = 0;
    let chatCalls = 0;
    let observedAuthHeader: string | null = null;

    const mockFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString();
      const headers = new Headers(init?.headers ?? {});

      if (url.includes('api.github.com')) {
        sessionTokenCalls++;
        throw new Error('session-token endpoint must NOT be called when cached token is fresh');
      }

      if (url.includes('api.githubcopilot.com')) {
        chatCalls++;
        observedAuthHeader = headers.get('authorization');
        return new Response(
          JSON.stringify({
            id: 'cmpl-1',
            model: 'gpt-4.1',
            choices: [{ message: { role: 'assistant', content: 'hello' }, finish_reason: 'stop' }],
            usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }

      throw new Error(`unexpected fetch URL: ${url}`);
    }) as unknown as typeof fetch;

    const provider = registerCopilotProvider({ tokenStore: store, fetch: mockFetch });

    const result = await provider.complete({
      model: 'gpt-4.1',
      messages: [{ role: 'user', content: 'hi' }],
    });

    // Real assertions: cached path used, no refresh, correct Bearer header
    expect(sessionTokenCalls).toBe(0);
    expect(chatCalls).toBe(1);
    expect(observedAuthHeader).toBe(`Bearer ${sessionToken}`);
    expect(result.content).toBe('hello');

    // Store unchanged
    const storedAfter = await store.load();
    expect(storedAfter?.copilotSessionToken).toBe(sessionToken);
    expect(storedAfter?.copilotSessionExpiresAt).toBe(expiresAt);
  });

  // -------------------------------------------------------------------------
  // complete refreshes session token when expired
  // -------------------------------------------------------------------------
  it('complete refreshes session token when near-expiry — calls session-token exchange once', async () => {
    const oldSessionToken = 'cop_about_to_expire';
    const expiredAt = Date.now() + 30_000; // only 30s left — within 60s skew → must refresh

    await store.save({
      githubAccessToken: 'gho_base2',
      githubTokenType: 'bearer',
      githubScope: 'read:user',
      githubObtainedAt: Date.now() - 60_000,
      copilotSessionToken: oldSessionToken,
      copilotSessionExpiresAt: expiredAt,
    });

    const newSessionToken = 'cop_fresh_session';
    const newExpiresAtSeconds = Math.floor(Date.now() / 1000) + 1800;
    const newExpiresAtMs = newExpiresAtSeconds * 1000;

    let sessionTokenCalls = 0;
    let chatCalls = 0;
    let observedChatAuth: string | null = null;

    const mockFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString();
      const headers = new Headers(init?.headers ?? {});

      if (url.includes('api.github.com')) {
        sessionTokenCalls++;
        // GitHub uses 'token <pat>' (not Bearer) for the session-token exchange
        expect(headers.get('authorization')).toBe('token gho_base2');
        return new Response(
          JSON.stringify({
            token: newSessionToken,
            expires_at: newExpiresAtSeconds,
            refresh_in: 1500,
            endpoints: { api: 'https://api.githubcopilot.com' },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }

      if (url.includes('api.githubcopilot.com')) {
        chatCalls++;
        observedChatAuth = headers.get('authorization');
        return new Response(
          JSON.stringify({
            id: 'cmpl-2',
            model: 'gpt-4.1',
            choices: [
              { message: { role: 'assistant', content: 'refreshed' }, finish_reason: 'stop' },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }

      throw new Error(`unexpected fetch URL: ${url}`);
    }) as unknown as typeof fetch;

    const provider = registerCopilotProvider({ tokenStore: store, fetch: mockFetch });

    const result = await provider.complete({
      model: 'gpt-4.1',
      messages: [{ role: 'user', content: 'hi' }],
    });

    // Real assertions: refresh fired exactly once, chat used the NEW token
    expect(sessionTokenCalls).toBe(1);
    expect(chatCalls).toBe(1);
    expect(observedChatAuth).toBe(`Bearer ${newSessionToken}`);
    expect(result.content).toBe('refreshed');

    // Store persisted the refreshed token
    const storedAfter = await store.load();
    expect(storedAfter?.copilotSessionToken).toBe(newSessionToken);
    expect(storedAfter?.copilotSessionExpiresAt).toBe(newExpiresAtMs);
    // GitHub access token unchanged
    expect(storedAfter?.githubAccessToken).toBe('gho_base2');
  });

  // -------------------------------------------------------------------------
  // complete throws when not signed in
  // -------------------------------------------------------------------------
  it('complete throws CopilotProviderError when not signed in', async () => {
    const provider = registerCopilotProvider({ tokenStore: store });

    await expect(
      provider.complete({ model: 'gpt-4.1', messages: [{ role: 'user', content: 'hi' }] }),
    ).rejects.toBeInstanceOf(CopilotProviderError);
  });
});
