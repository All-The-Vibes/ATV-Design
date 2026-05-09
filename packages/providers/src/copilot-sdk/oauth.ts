import { createHash, randomBytes } from 'node:crypto';
import {
  copilotNetworkError,
  copilotOAuthConsentDeniedError,
  mapCopilotResponseError,
} from './errors.js';

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
 * registered OAuth App client_id without recompiling. Prefer the rebranded
 * ATV Design name, but keep the legacy open-codesign env name as a
 * compatibility fallback.
 */
const CLIENT_ID_ENV_KEYS = [
  'ATV_DESIGN_GITHUB_CLIENT_ID',
  'OPEN_CODESIGN_GITHUB_CLIENT_ID',
] as const;

function resolveClientId(explicit?: string): string {
  if (explicit !== undefined && explicit.length > 0) return explicit;
  for (const envKey of CLIENT_ID_ENV_KEYS) {
    const env = process.env[envKey];
    if (typeof env === 'string' && env.length > 0) return env;
  }
  return FALLBACK_CLIENT_ID;
}

// ---------------------------------------------------------------------------
// Endpoint constants
// ---------------------------------------------------------------------------

export const AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
export const DEVICE_CODE_URL = 'https://github.com/login/device/code';
export const TOKEN_URL = 'https://github.com/login/oauth/access_token';
const DEVICE_CODE_GRANT_TYPE = 'urn:ietf:params:oauth:grant-type:device_code';

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

export interface DeviceCodeResponse {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  verificationUriComplete?: string | null;
  expiresIn: number;
  interval: number;
}

function deviceFlowAbortError(): Error {
  return new Error('GitHub device flow aborted by signal');
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw deviceFlowAbortError();
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  throwIfAborted(signal);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);

    const onAbort = () => {
      clearTimeout(timer);
      cleanup();
      reject(deviceFlowAbortError());
    };

    const cleanup = () => {
      signal?.removeEventListener('abort', onAbort);
    };

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export async function requestDeviceCode(opts?: {
  clientId?: string;
  scope?: string;
  signal?: AbortSignal;
  fetch?: typeof fetch;
}): Promise<DeviceCodeResponse> {
  const clientId = resolveClientId(opts?.clientId);
  const fetchImpl = opts?.fetch ?? fetch;
  const body = new URLSearchParams({
    client_id: clientId,
    scope: opts?.scope ?? SCOPE,
  });

  let response: Response;
  try {
    response = await fetchImpl(DEVICE_CODE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body,
      signal: opts?.signal ?? null,
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
    device_code?: string;
    user_code?: string;
    verification_uri?: string;
    verification_uri_complete?: string;
    expires_in?: number;
    interval?: number;
  };

  return {
    deviceCode: json.device_code ?? '',
    userCode: json.user_code ?? '',
    verificationUri: json.verification_uri ?? '',
    verificationUriComplete: json.verification_uri_complete ?? null,
    expiresIn: json.expires_in ?? 900,
    interval: json.interval ?? 5,
  };
}

export async function pollDeviceAccessToken(opts: {
  deviceCode: string;
  clientId?: string;
  interval?: number;
  expiresIn?: number;
  signal?: AbortSignal;
  fetch?: typeof fetch;
}): Promise<TokenResponse> {
  const clientId = resolveClientId(opts.clientId);
  const fetchImpl = opts.fetch ?? fetch;
  const startedAt = Date.now();
  const expiresAt = startedAt + Math.max(1, opts.expiresIn ?? 900) * 1000;
  let intervalMs = Math.max(1, opts.interval ?? 5) * 1000;

  while (true) {
    throwIfAborted(opts.signal);
    if (Date.now() >= expiresAt) {
      throw new Error('GitHub device login expired before completion');
    }

    const body = new URLSearchParams({
      client_id: clientId,
      device_code: opts.deviceCode,
      grant_type: DEVICE_CODE_GRANT_TYPE,
    });

    let response: Response;
    try {
      response = await fetchImpl(TOKEN_URL, {
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

    let json: {
      access_token?: string;
      token_type?: string;
      scope?: string;
      error?: string;
      error_description?: string;
    };

    try {
      json = (await response.json()) as typeof json;
    } catch {
      json = {};
    }

    if (!response.ok) {
      throw mapCopilotResponseError(response, json);
    }

    if (typeof json.access_token === 'string' && json.access_token.length > 0) {
      return {
        accessToken: json.access_token,
        tokenType: json.token_type ?? 'bearer',
        scope: json.scope ?? '',
        obtainedAt: Date.now(),
      };
    }

    if (json.error === 'authorization_pending') {
      await sleep(intervalMs, opts.signal);
      continue;
    }

    if (json.error === 'slow_down') {
      intervalMs += 5_000;
      await sleep(intervalMs, opts.signal);
      continue;
    }

    if (json.error === 'access_denied') {
      throw copilotOAuthConsentDeniedError(new Error('GitHub device login was denied'));
    }

    if (json.error === 'expired_token') {
      throw new Error('GitHub device login expired before completion');
    }

    const detail =
      typeof json.error_description === 'string' && json.error_description.length > 0
        ? json.error_description
        : typeof json.error === 'string' && json.error.length > 0
          ? json.error
          : 'unknown device-flow response';
    throw new Error(`GitHub device login failed: ${detail}`);
  }
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
 *
 * The optional `fetch` parameter exists for test injection; production callers
 * leave it undefined to use global fetch. Injection lives here (not in a
 * shadow function) so the production path and the tested path are identical.
 */
export async function exchangeCode(opts: {
  code: string;
  verifier: string;
  redirectUri: string;
  clientId?: string;
  signal?: AbortSignal;
  fetch?: typeof fetch;
}): Promise<TokenResponse> {
  const clientId = resolveClientId(opts.clientId);
  const fetchImpl = opts.fetch ?? fetch;

  const body = new URLSearchParams({
    client_id: clientId,
    code: opts.code,
    code_verifier: opts.verifier,
    redirect_uri: opts.redirectUri,
  });

  let response: Response;
  try {
    response = await fetchImpl(TOKEN_URL, {
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
