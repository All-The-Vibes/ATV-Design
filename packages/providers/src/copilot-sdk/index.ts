/**
 * index.ts — Public surface for the GitHub Copilot SDK provider.
 *
 * Re-exports all primitives from sub-modules and exposes the high-level
 * `registerCopilotProvider` factory that wires PKCE OAuth, the loopback
 * callback server, token storage, and session-token refresh into a single
 * `CopilotProviderHandle`.
 *
 * PRINCIPLES: no console.* (CLAUDE.md ban for packages/providers/**).
 *             No secret values in log fields.
 */

import { randomBytes } from 'node:crypto';
import type { ChatCompletion, ChatMessage } from './chat.js';
import { complete as chatComplete } from './chat.js';
import { createCopilotClient } from './client.js';
import { exchangeForSessionToken } from './copilot-token.js';
import { copilotOAuthStateMismatchError, copilotUnauthorizedError } from './errors.js';
import { startCallbackServer } from './oauth-server.js';
import { buildAuthorizeUrl, exchangeCode, generatePkce } from './oauth.js';
import type { StoredCopilotAuth } from './token-store.js';
import type { CopilotTokenStore } from './token-store.js';

// ---------------------------------------------------------------------------
// Re-exports (primitives from sub-modules)
// ---------------------------------------------------------------------------

export * from './chat.js';
export * from './client.js';
export * from './copilot-token.js';
export * from './errors.js';
export * from './models.js';
export * from './oauth.js';
export * from './oauth-server.js';
export * from './token-store.js';

// ---------------------------------------------------------------------------
// Logger interface
// ---------------------------------------------------------------------------

export interface CopilotProviderLogger {
  info(key: string, fields?: Record<string, unknown>): void;
  warn(key: string, fields?: Record<string, unknown>): void;
  error(key: string, fields?: Record<string, unknown>): void;
}

const noopLogger: CopilotProviderLogger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

// ---------------------------------------------------------------------------
// CopilotProviderHandle
// ---------------------------------------------------------------------------

export interface CopilotProviderHandle {
  signIn(opts?: {
    signal?: AbortSignal;
    openBrowser?: (url: string) => Promise<void> | void;
  }): Promise<void>;
  signOut(): Promise<void>;
  isSignedIn(): Promise<boolean>;
  complete(opts: {
    model: string;
    messages: ChatMessage[];
    signal?: AbortSignal;
  }): Promise<ChatCompletion>;
}

// ---------------------------------------------------------------------------
// RegisterCopilotProviderOptions
// ---------------------------------------------------------------------------

export interface RegisterCopilotProviderOptions {
  /** Override the GitHub OAuth App client_id. Omit to use env or fallback. */
  clientId?: string;
  /** Token storage instance (caller owns the path). */
  tokenStore: CopilotTokenStore;
  /** Structured logger. Defaults to no-op. MUST NOT log secret values. */
  logger?: CopilotProviderLogger;
  /**
   * Injected fetch for tests. Threaded into oauth.exchangeCode,
   * copilot-token.exchangeForSessionToken, and createCopilotClient so
   * the production path and the tested path are identical.
   */
  fetch?: typeof fetch;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Wires together the OAuth flow, loopback callback server, token store, and
 * session-token refresh into a single `CopilotProviderHandle`.
 *
 * Callers (e.g. the Electron main process) supply:
 *   - `tokenStore` pointing at the desired file path
 *   - `openBrowser` using `shell.openExternal` for the system browser
 *   - `logger` using the project logger
 */
export function registerCopilotProvider(
  opts: RegisterCopilotProviderOptions,
): CopilotProviderHandle {
  const { clientId, tokenStore } = opts;
  const logger = opts.logger ?? noopLogger;
  const injectedFetch = opts.fetch;

  const signIn: CopilotProviderHandle['signIn'] = async (signInOpts) => {
    const signal = signInOpts?.signal;
    const openBrowser = signInOpts?.openBrowser ?? ((_url: string) => undefined);

    logger.info('oauth.start');

    // PKCE pair scoped to this signIn closure — concurrent invocations
    // get independent verifier/challenge pairs.
    const { verifier, challenge } = generatePkce();
    const state = randomBytes(16).toString('hex');

    const server = await startCallbackServer();

    // try/finally guarantees server.close() runs once on every exit path
    // without losing the original error cause (which the prior catch+rethrow
    // pattern threatened if close() itself rejected).
    try {
      const authorizeUrl = buildAuthorizeUrl({
        redirectUri: server.redirectUri,
        state,
        challenge,
        ...(clientId !== undefined ? { clientId } : {}),
      });

      await openBrowser(authorizeUrl);

      const callbackResult = await server.waitForCode({
        state,
        ...(signal !== undefined ? { signal } : {}),
      });

      logger.info('oauth.code_received');

      if (callbackResult.state !== state) {
        throw copilotOAuthStateMismatchError();
      }

      const tokenResponse = await exchangeCode({
        code: callbackResult.code,
        verifier,
        redirectUri: server.redirectUri,
        ...(clientId !== undefined ? { clientId } : {}),
        ...(signal !== undefined ? { signal } : {}),
        ...(injectedFetch !== undefined ? { fetch: injectedFetch } : {}),
      });

      logger.info('oauth.token_exchanged');

      await tokenStore.save({
        githubAccessToken: tokenResponse.accessToken,
        githubTokenType: tokenResponse.tokenType,
        githubScope: tokenResponse.scope,
        githubObtainedAt: tokenResponse.obtainedAt,
        copilotSessionToken: null,
        copilotSessionExpiresAt: null,
      });

      logger.info('oauth.token_stored');
    } finally {
      await server.close();
    }
  };

  const signOut: CopilotProviderHandle['signOut'] = async () => {
    await tokenStore.clear();
    logger.info('oauth.signed_out');
  };

  const isSignedIn: CopilotProviderHandle['isSignedIn'] = async () => {
    const stored = await tokenStore.load();
    return stored !== null && stored.githubAccessToken.length > 0;
  };

  const complete: CopilotProviderHandle['complete'] = async (completeOpts) => {
    const { model, messages, signal } = completeOpts;

    // Session-token provider: returns a cached token if fresh, otherwise
    // exchanges the GitHub access token for a new Copilot session token and
    // persists the result. Token leakage prevention: never logs token VALUES.
    const sessionTokenProvider = async (): Promise<string> => {
      const stored = await tokenStore.load();
      if (stored === null || stored.githubAccessToken.length === 0) {
        throw copilotUnauthorizedError(undefined);
      }

      const SKEW_MS = 60_000;
      if (
        stored.copilotSessionToken !== null &&
        stored.copilotSessionExpiresAt !== null &&
        stored.copilotSessionExpiresAt > Date.now() + SKEW_MS
      ) {
        return stored.copilotSessionToken;
      }

      const sessionTokenResult = await exchangeForSessionToken({
        githubAccessToken: stored.githubAccessToken,
        ...(signal !== undefined ? { signal } : {}),
        ...(injectedFetch !== undefined ? { fetch: injectedFetch } : {}),
      });

      const updated: Omit<StoredCopilotAuth, 'schemaVersion' | 'updatedAt'> = {
        githubAccessToken: stored.githubAccessToken,
        githubTokenType: stored.githubTokenType,
        githubScope: stored.githubScope,
        githubObtainedAt: stored.githubObtainedAt,
        copilotSessionToken: sessionTokenResult.token,
        copilotSessionExpiresAt: sessionTokenResult.expiresAt,
      };
      await tokenStore.save(updated);

      return sessionTokenResult.token;
    };

    const client = createCopilotClient({
      sessionTokenProvider,
      ...(injectedFetch !== undefined ? { fetch: injectedFetch } : {}),
    });

    return chatComplete({
      client,
      modelId: model,
      messages,
      ...(signal !== undefined ? { signal } : {}),
    });
  };

  return { signIn, signOut, isSignedIn, complete };
}
