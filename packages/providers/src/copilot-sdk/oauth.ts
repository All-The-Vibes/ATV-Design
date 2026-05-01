import { createHash, randomBytes } from 'node:crypto';
import { CopilotProviderError, copilotNetworkError, mapCopilotResponseError } from './errors.js';

// ---------------------------------------------------------------------------
// Client ID
// ---------------------------------------------------------------------------

/**
 * TODO(phase-0-adr): replace with atv-design's registered OAuth App client_id before
 * public release. This placeholder is documented as ToS-grey in
 * docs/adr/0001-byok-oauth-posture.md. Using the gh CLI's well-known public
 * client ID only for development/prototype builds.
 */
const FALLBACK_CLIENT_ID = 'Iv1.b507a08c87ecfe98';

/**
 * Prefer the env override when present so deployments can inject their own
 * registered OAuth App client_id without recompiling.
 */
function resolveClientId(explicit?: string): string {
  if (explicit !== undefined && explicit.length > 0) return explicit;
  const env = process.env['OPEN_CODESIGN_GITHUB_CLIENT_ID'];
  if (typeof env === 'string' && env.length > 0) return env;
  return FALLBACK_CLIENT_ID;
}

// ---------------------------------------------------------------------------
// Endpoint constants
// ---------------------------------------------------------------------------

export const AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
export const TOKEN_URL = 'https://github.com/login/oauth/access_token';

/**
 * Minimum scope required for GitHub Copilot OAuth flows.
 * `read:user` lets us read the authenticated user's profile and is the
 * narrowest scope that GitHub Copilot's authorization checks accept. No
 * `repo`, `write:*`, or `admin:*` scopes are requested.
 */
export const SCOPE = 'read:user';

// ---------------------------------------------------------------------------
// PKCE
// ---------------------------------------------------------------------------

export interface PkcePair {
  verifier: string;
  challenge: string;
  method: 'S256';
}

/**
 * Generates a fresh PKCE pair using 32 random bytes (produces a 43-char
 * base64url verifier, well within the RFC 7636 43–128 char range).
 */
export function generatePkce(): PkcePair {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge, method: 'S256' };
}

// ---------------------------------------------------------------------------
// Authorize URL builder
// ---------------------------------------------------------------------------

export interface AuthorizeUrlOpts {
  redirectUri: string;
  state: string;
  challenge: string;
  clientId?: string;
}

export function buildAuthorizeUrl(opts: AuthorizeUrlOpts): string {
  const clientId = resolveClientId(opts.clientId);
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: opts.redirectUri,
    scope: SCOPE,
    state: opts.state,
    code_challenge: opts.challenge,
    code_challenge_method: 'S256',
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// Token exchange
// ---------------------------------------------------------------------------

export interface TokenResponse {
  accessToken: string;
  tokenType: string;
  scope: string;
  /** Unix ms timestamp captured immediately after a successful exchange. */
  obtainedAt: number;
}

/**
 * Exchanges an authorization code for an access token using GitHub's OAuth
 * App token endpoint.
 *
 * NOTE: GitHub OAuth Apps do NOT issue refresh tokens. The returned
 * `TokenResponse` has no `refreshToken` field. Callers that need to renew
 * access must re-run the full authorization flow.
 *
 * The POST body contains ONLY: client_id, code, code_verifier, redirect_uri.
 * There is deliberately NO client_secret — this is a public client (PKCE-only).
 */
export async function exchangeCode(opts: {
  code: string;
  verifier: string;
  redirectUri: string;
  clientId?: string;
  signal?: AbortSignal;
}): Promise<TokenResponse> {
  const clientId = resolveClientId(opts.clientId);

  const body = new URLSearchParams({
    client_id: clientId,
    code: opts.code,
    code_verifier: opts.verifier,
    redirect_uri: opts.redirectUri,
  });

  let response: Response;
  try {
    response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body,
      signal: opts.signal ?? null,
    });
  } catch (cause) {
    throw copilotNetworkError(cause);
  }

  if (!response.ok) {
    let parsed: unknown;
    try {
      parsed = await response.json();
    } catch {
      parsed = undefined;
    }
    throw mapCopilotResponseError(response, parsed);
  }

  const json = (await response.json()) as {
    access_token?: string;
    token_type?: string;
    scope?: string;
  };

  return {
    accessToken: json.access_token ?? '',
    tokenType: json.token_type ?? 'bearer',
    scope: json.scope ?? '',
    obtainedAt: Date.now(),
  };
}
