/**
 * copilot-token.ts — GitHub Copilot session-token exchange.
 *
 * ADR-0001 amendment (2026-05-01) R11 carve-out:
 * -----------------------------------------------------------------------
 * The URL below — `https://api.github.com/copilot_internal/v2/token` — is
 * the SOLE sanctioned undocumented endpoint used by this codebase. It is
 * explicitly whitelisted by the ADR-0001 Decision Update (2026-05-01)
 * because it is the documented GitHub endpoint for exchanging a GitHub
 * OAuth access token for a short-lived Copilot session token used against
 * api.githubcopilot.com/chat/completions.
 *
 * ALL other variants are forbidden per R11 and enforced by
 * `.github/workflows/forbidden-endpoints.yml` — the workflow's grep filter
 * permits only matches that contain `copilot_internal/v2/token`.
 * -----------------------------------------------------------------------
 */

import { copilotForbiddenError, copilotUnauthorizedError, mapCopilotResponseError } from './errors';

/**
 * The sole sanctioned undocumented endpoint per ADR-0001 R11 carve-out.
 * Any other variant of this endpoint is forbidden by CI enforcement.
 */
export const COPILOT_SESSION_TOKEN_URL = 'https://api.github.com/copilot_internal/v2/token';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CopilotSessionToken {
  /** Short-lived Copilot session token for use as Authorization: Bearer. */
  token: string;
  /** Unix timestamp in milliseconds when this token expires. */
  expiresAt: number;
  /** Number of seconds before the token should be refreshed. */
  refreshIn: number;
  /** Endpoint base URLs returned by the GitHub token service. */
  endpoints: {
    api: string;
  };
}

interface RawTokenResponse {
  token?: unknown;
  expires_at?: unknown;
  refresh_in?: unknown;
  endpoints?: {
    api?: unknown;
  };
}

// ---------------------------------------------------------------------------
// Exchange function
// ---------------------------------------------------------------------------

/**
 * Exchanges a GitHub OAuth access token for a short-lived Copilot session token.
 *
 * Uses `Authorization: token <githubAccessToken>` (not Bearer) per GitHub's
 * documented session-token exchange protocol.
 *
 * HTTP error mapping:
 *   401 → token revoked or scope insufficient (auth-missing)
 *   403 → no Copilot subscription or insufficient tier
 *   5xx → upstream error
 */
export async function exchangeForSessionToken(opts: {
  githubAccessToken: string;
  signal?: AbortSignal;
  /** Injected for tests; defaults to Date.now. */
  now?: () => number;
  /** Injected for tests; defaults to global fetch. */
  fetch?: typeof fetch;
}): Promise<CopilotSessionToken> {
  const { githubAccessToken, signal } = opts;
  const now = opts.now ?? Date.now;
  const fetchImpl = opts.fetch ?? fetch;

  let response: Response;
  try {
    const fetchInit: RequestInit = {
      method: 'GET',
      headers: {
        Authorization: `token ${githubAccessToken}`,
        Accept: 'application/json',
        'Editor-Version': 'atv-design/0.1.0',
        'Copilot-Integration-Id': 'vscode-chat',
      },
    };
    if (signal !== undefined) fetchInit.signal = signal;
    response = await fetchImpl(COPILOT_SESSION_TOKEN_URL, fetchInit);
  } catch (cause) {
    // Re-throw as CopilotProviderError using the network-error factory
    const { copilotNetworkError } = await import('./errors');
    throw copilotNetworkError(cause);
  }

  if (!response.ok) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = undefined;
    }

    // Specialise 401 and 403 before the generic mapper
    if (response.status === 401) {
      const requestId = response.headers.get('x-github-request-id') ?? undefined;
      throw copilotUnauthorizedError(requestId);
    }
    if (response.status === 403) {
      const requestId = response.headers.get('x-github-request-id') ?? undefined;
      throw copilotForbiddenError(requestId);
    }

    throw mapCopilotResponseError(response, body);
  }

  const raw = (await response.json()) as RawTokenResponse;

  const token = typeof raw.token === 'string' ? raw.token : '';
  const expiresAtSeconds =
    typeof raw.expires_at === 'number' ? raw.expires_at : now() / 1000 + 1800;
  const refreshIn = typeof raw.refresh_in === 'number' ? raw.refresh_in : 1500;
  const apiEndpoint =
    typeof raw.endpoints?.api === 'string' ? raw.endpoints.api : 'https://api.githubcopilot.com';

  return {
    token,
    expiresAt: expiresAtSeconds * 1000,
    refreshIn,
    endpoints: { api: apiEndpoint },
  };
}
