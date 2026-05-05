/**
 * copilot-token.test.ts — unit tests for exchangeForSessionToken.
 *
 * Regression guards:
 *   - URL must be exactly COPILOT_SESSION_TOKEN_URL (R11 carve-out).
 *   - Authorization header must use `token` type, NOT `Bearer`.
 *   - Error mapping for 401, 403, 5xx.
 */

import { ERROR_CODES } from '@atv-design/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { COPILOT_SESSION_TOKEN_URL, exchangeForSessionToken } from './copilot-token';
import { CopilotProviderError } from './errors';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('exchangeForSessionToken', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('happy path: returns parsed CopilotSessionToken with expiresAt in ms', async () => {
    const serverPayload = {
      token: 'tok_xyz',
      expires_at: 1700000000,
      refresh_in: 1500,
      endpoints: { api: 'https://api.githubcopilot.com' },
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse(200, serverPayload)));

    const result = await exchangeForSessionToken({ githubAccessToken: 'gh_test_token' });

    expect(result.token).toBe('tok_xyz');
    // expiresAt must be seconds * 1000
    expect(result.expiresAt).toBe(1700000000 * 1000);
    expect(result.refreshIn).toBe(1500);
    expect(result.endpoints.api).toBe('https://api.githubcopilot.com');
  });

  it('R11 regression guard: request URL is exactly COPILOT_SESSION_TOKEN_URL', async () => {
    const serverPayload = {
      token: 'tok_abc',
      expires_at: 1700000000,
      refresh_in: 1500,
      endpoints: { api: 'https://api.githubcopilot.com' },
    };
    const fetchSpy = vi.fn().mockResolvedValue(makeResponse(200, serverPayload));
    vi.stubGlobal('fetch', fetchSpy);

    await exchangeForSessionToken({ githubAccessToken: 'gh_test' });

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [calledUrl] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toBe('https://api.github.com/copilot_internal/v2/token');
    // Constant must also equal the URL (regression guard for refactors)
    expect(COPILOT_SESSION_TOKEN_URL).toBe('https://api.github.com/copilot_internal/v2/token');
  });

  it('uses Authorization: token (not Bearer) and includes required headers', async () => {
    const serverPayload = {
      token: 'tok_hdr',
      expires_at: 1700000001,
      refresh_in: 1500,
      endpoints: { api: 'https://api.githubcopilot.com' },
    };
    const fetchSpy = vi.fn().mockResolvedValue(makeResponse(200, serverPayload));
    vi.stubGlobal('fetch', fetchSpy);

    await exchangeForSessionToken({ githubAccessToken: 'my_gh_access_token' });

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;

    expect(headers['Authorization']).toBe('token my_gh_access_token');
    expect(headers['Authorization']).not.toMatch(/^Bearer /);
    expect(headers['Editor-Version']).toBeTruthy();
    expect(headers['Copilot-Integration-Id']).toBeTruthy();
  });

  it('401 → throws CopilotProviderError with PROVIDER_AUTH_MISSING code', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          makeResponse(401, { message: 'Bad credentials' }, { 'x-github-request-id': 'req-401' }),
        ),
    );

    await expect(exchangeForSessionToken({ githubAccessToken: 'bad_token' })).rejects.toMatchObject(
      {
        name: 'CopilotProviderError',
        status: 401,
        code: ERROR_CODES.PROVIDER_AUTH_MISSING,
      },
    );
  });

  it('403 → throws CopilotProviderError (subscription-insufficient)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse(403, { message: 'Forbidden' })));

    const err = await exchangeForSessionToken({ githubAccessToken: 'no_sub' }).catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(CopilotProviderError);
    expect((err as CopilotProviderError).status).toBe(403);
  });

  it('5xx → throws CopilotProviderError with upstream error code', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(makeResponse(503, { message: 'Service Unavailable' })),
    );

    const err = await exchangeForSessionToken({ githubAccessToken: 'any' }).catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(CopilotProviderError);
    expect((err as CopilotProviderError).status).toBe(503);
    expect((err as CopilotProviderError).code).toBe(ERROR_CODES.PROVIDER_UPSTREAM_ERROR);
  });
});
