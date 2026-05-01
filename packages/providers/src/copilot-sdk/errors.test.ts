import { ERROR_CODES } from '@open-codesign/shared';
import { describe, expect, it } from 'vitest';
import { CopilotProviderError, copilotNetworkError, mapCopilotResponseError } from './errors';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeResponse(status: number, headers: Record<string, string> = {}): Response {
  return new Response(null, { status, headers });
}

// ---------------------------------------------------------------------------
// mapCopilotResponseError — status code mapping
// ---------------------------------------------------------------------------

describe('mapCopilotResponseError', () => {
  it('maps 401 to PROVIDER_AUTH_MISSING', () => {
    const err = mapCopilotResponseError(makeResponse(401), null);
    expect(err).toBeInstanceOf(CopilotProviderError);
    expect(err.status).toBe(401);
    expect(err.code).toBe(ERROR_CODES.PROVIDER_AUTH_MISSING);
  });

  it('maps 403 to PROVIDER_HTTP_4XX', () => {
    const err = mapCopilotResponseError(makeResponse(403), null);
    expect(err).toBeInstanceOf(CopilotProviderError);
    expect(err.status).toBe(403);
    expect(err.code).toBe(ERROR_CODES.PROVIDER_HTTP_4XX);
  });

  it('maps 429 to PROVIDER_RETRY_EXHAUSTED and includes retry-after', () => {
    const err = mapCopilotResponseError(makeResponse(429, { 'retry-after': '30' }), null);
    expect(err).toBeInstanceOf(CopilotProviderError);
    expect(err.status).toBe(429);
    expect(err.code).toBe(ERROR_CODES.PROVIDER_RETRY_EXHAUSTED);
    expect(err.message).toContain('30s');
  });

  it('maps 429 without retry-after header gracefully', () => {
    const err = mapCopilotResponseError(makeResponse(429), null);
    expect(err.status).toBe(429);
    expect(err.code).toBe(ERROR_CODES.PROVIDER_RETRY_EXHAUSTED);
    expect(err.message).not.toContain('retry after');
  });

  it('maps 500 to PROVIDER_UPSTREAM_ERROR', () => {
    const err = mapCopilotResponseError(makeResponse(500), null);
    expect(err).toBeInstanceOf(CopilotProviderError);
    expect(err.status).toBe(500);
    expect(err.code).toBe(ERROR_CODES.PROVIDER_UPSTREAM_ERROR);
  });

  it('maps 503 to PROVIDER_UPSTREAM_ERROR', () => {
    const err = mapCopilotResponseError(makeResponse(503), null);
    expect(err.status).toBe(503);
    expect(err.code).toBe(ERROR_CODES.PROVIDER_UPSTREAM_ERROR);
  });

  // -------------------------------------------------------------------------
  // requestId extraction
  // -------------------------------------------------------------------------

  it('captures x-github-request-id header when present', () => {
    const err = mapCopilotResponseError(
      makeResponse(401, { 'x-github-request-id': 'req-abc-123' }),
      null,
    );
    expect(err.requestId).toBe('req-abc-123');
  });

  it('leaves requestId undefined when header is absent', () => {
    const err = mapCopilotResponseError(makeResponse(401), null);
    expect(err.requestId).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // Network error (fetch threw — no Response)
  // -------------------------------------------------------------------------

  it('copilotNetworkError produces PROVIDER_ERROR with undefined status', () => {
    const networkErr = new TypeError('Failed to fetch');
    const err = copilotNetworkError(networkErr);
    expect(err).toBeInstanceOf(CopilotProviderError);
    expect(err.status).toBeUndefined();
    expect(err.requestId).toBeUndefined();
    expect(err.code).toBe(ERROR_CODES.PROVIDER_ERROR);
  });

  // -------------------------------------------------------------------------
  // Redaction safety — no bearer token in any error message
  // -------------------------------------------------------------------------

  it('does not leak a sample bearer token into any error message', () => {
    const FAKE_TOKEN = 'ghp_FAKETOKEN_DO_NOT_USE';

    // Passing a body object that contains the token — must not appear in message
    const errWith401 = mapCopilotResponseError(
      makeResponse(401, { 'x-github-request-id': 'rid-1' }),
      { authorization: `Bearer ${FAKE_TOKEN}` },
    );
    expect(errWith401.message).not.toContain(FAKE_TOKEN);

    const errWith403 = mapCopilotResponseError(makeResponse(403), { token: FAKE_TOKEN });
    expect(errWith403.message).not.toContain(FAKE_TOKEN);

    const errWith429 = mapCopilotResponseError(makeResponse(429), { hint: FAKE_TOKEN });
    expect(errWith429.message).not.toContain(FAKE_TOKEN);

    const errWith500 = mapCopilotResponseError(makeResponse(500), { debug: FAKE_TOKEN });
    expect(errWith500.message).not.toContain(FAKE_TOKEN);
  });
});
