/**
 * CopilotProviderError — typed error variants for the GitHub Copilot SDK provider.
 *
 * Maps GitHub/Copilot HTTP status codes and OAuth failure modes to structured
 * error instances that consumers can `instanceof`-check or switch on `.code`.
 *
 * PRINCIPLES: no console.*, no secrets in messages (CLAUDE.md ban).
 * Extends CodesignError (from @open-codesign/shared) so the project-wide
 * error handling infra (diagnostic events, normalizeProviderError) works
 * without modification.
 */

import { CodesignError, ERROR_CODES } from '@open-codesign/shared';

// ---------------------------------------------------------------------------
// Core error class
// ---------------------------------------------------------------------------

export interface CopilotProviderErrorOptions {
  /** HTTP status code, undefined for network/non-HTTP failures. */
  status: number | undefined;
  /** Value of the `x-github-request-id` response header, when present. */
  requestId: string | undefined;
  /** One of ERROR_CODES.* — must be a known registry code. */
  code: string;
  /** Original thrown value for debugging (never serialised to user-facing strings). */
  cause?: unknown;
}

export class CopilotProviderError extends CodesignError {
  public readonly status: number | undefined;
  public readonly requestId: string | undefined;

  constructor(message: string, options: CopilotProviderErrorOptions) {
    super(message, options.code, { cause: options.cause });
    this.name = 'CopilotProviderError';
    this.status = options.status;
    this.requestId = options.requestId;
  }
}

// ---------------------------------------------------------------------------
// Typed factory helpers (one per Copilot error case)
// ---------------------------------------------------------------------------

/** 401 — token expired or not present. */
export function copilotUnauthorizedError(
  requestId: string | undefined,
  cause?: unknown,
): CopilotProviderError {
  return new CopilotProviderError('GitHub Copilot token is expired or missing', {
    status: 401,
    requestId,
    code: ERROR_CODES.PROVIDER_AUTH_MISSING,
    cause,
  });
}

/** 403 — Copilot subscription missing, insufficient tier, or app type rejected. */
export function copilotForbiddenError(
  requestId: string | undefined,
  cause?: unknown,
): CopilotProviderError {
  return new CopilotProviderError(
    'GitHub Copilot subscription is missing or insufficient for this request',
    {
      status: 403,
      requestId,
      code: ERROR_CODES.PROVIDER_HTTP_4XX,
      cause,
    },
  );
}

/** 429 — rate-limited; retryAfterSeconds parsed from Retry-After header. */
export function copilotRateLimitedError(
  requestId: string | undefined,
  retryAfterSeconds: number | undefined,
  cause?: unknown,
): CopilotProviderError {
  const detail = retryAfterSeconds !== undefined ? ` (retry after ${retryAfterSeconds}s)` : '';
  return new CopilotProviderError(`GitHub Copilot rate limit exceeded${detail}`, {
    status: 429,
    requestId,
    code: ERROR_CODES.PROVIDER_RETRY_EXHAUSTED,
    cause,
  });
}

/** 5xx — upstream server failure from GitHub/Copilot infrastructure. */
export function copilotUpstreamError(
  status: number,
  requestId: string | undefined,
  cause?: unknown,
): CopilotProviderError {
  return new CopilotProviderError(`GitHub Copilot upstream error (status ${status})`, {
    status,
    requestId,
    code: ERROR_CODES.PROVIDER_UPSTREAM_ERROR,
    cause,
  });
}

/** Network failure — fetch threw before a Response was received. */
export function copilotNetworkError(cause?: unknown): CopilotProviderError {
  return new CopilotProviderError('Network error communicating with GitHub Copilot', {
    status: undefined,
    requestId: undefined,
    code: ERROR_CODES.PROVIDER_ERROR,
    cause,
  });
}

/** OAuth consent denied by user in browser. */
export function copilotOAuthConsentDeniedError(cause?: unknown): CopilotProviderError {
  return new CopilotProviderError('GitHub OAuth consent was denied', {
    status: undefined,
    requestId: undefined,
    code: ERROR_CODES.PROVIDER_AUTH_MISSING,
    cause,
  });
}

/** OAuth state mismatch — possible CSRF; must not silently swallow. */
export function copilotOAuthStateMismatchError(cause?: unknown): CopilotProviderError {
  return new CopilotProviderError('GitHub OAuth state mismatch — request may have been tampered', {
    status: undefined,
    requestId: undefined,
    code: ERROR_CODES.PROVIDER_AUTH_MISSING,
    cause,
  });
}

/** Model not available at the user's Copilot tier (Scenario 4 / R3). */
export function copilotModelUnavailableError(
  modelId: string,
  cause?: unknown,
): CopilotProviderError {
  return new CopilotProviderError(
    `Model "${modelId}" is not available at your GitHub Copilot tier`,
    {
      status: undefined,
      requestId: undefined,
      code: ERROR_CODES.PROVIDER_MODEL_UNKNOWN,
      cause,
    },
  );
}

// ---------------------------------------------------------------------------
// Response → error mapper (call after receiving a non-ok Response)
// ---------------------------------------------------------------------------

const GITHUB_REQUEST_ID_HEADER = 'x-github-request-id';
const RETRY_AFTER_HEADER = 'retry-after';

function readRequestId(response: Response): string | undefined {
  const value = response.headers.get(GITHUB_REQUEST_ID_HEADER);
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function readRetryAfter(response: Response): number | undefined {
  const raw = response.headers.get(RETRY_AFTER_HEADER);
  if (raw === null) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

/**
 * Maps a non-ok Fetch Response (and optional parsed body) to the appropriate
 * typed CopilotProviderError variant.
 *
 * Callers are responsible for awaiting the response body before passing it in;
 * this function is synchronous to keep error paths simple.
 */
export function mapCopilotResponseError(
  response: Response,
  // body is accepted but intentionally not surfaced in error messages (no secret leakage)
  _body: unknown,
): CopilotProviderError {
  const requestId = readRequestId(response);
  const { status } = response;

  if (status === 401) {
    return copilotUnauthorizedError(requestId);
  }
  if (status === 403) {
    return copilotForbiddenError(requestId);
  }
  if (status === 429) {
    return copilotRateLimitedError(requestId, readRetryAfter(response));
  }
  if (status >= 500 && status < 600) {
    return copilotUpstreamError(status, requestId);
  }
  // Catch-all for unexpected 4xx or other codes
  return new CopilotProviderError(`GitHub Copilot request failed (status ${status})`, {
    status,
    requestId,
    code: ERROR_CODES.PROVIDER_HTTP_4XX,
  });
}
