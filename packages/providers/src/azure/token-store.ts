import { CodesignError, ERROR_CODES } from '@atv-design/shared';

/**
 * Azure Entra ID token cache for Azure OpenAI / AI Foundry.
 *
 * Unlike the Codex store, @azure/identity (AzureCliCredential /
 * DefaultAzureCredential) owns the real refresh and on-disk credential cache,
 * so this store is intentionally thin: an in-memory cache over an injected
 * getToken() with the same 5-minute skew buffer and single-flight
 * de-duplication the Codex store uses. There is no persisted refresh token and
 * no file I/O here — the underlying credential handles durability.
 *
 * Entra access tokens for the cognitiveservices scope live ~60–90 minutes; the
 * agent's per-turn getApiKey() hook calls getValidAccessToken() each round so a
 * long tool-using run silently rotates the bearer.
 *
 * PRINCIPLES: no console.*, no secrets logged.
 */

/** Minimal shape of an @azure/identity AccessToken (token + epoch-ms expiry). */
export interface AzureAccessToken {
  token: string;
  expiresOnTimestamp: number;
}

export interface AzureEntraTokenStoreOptions {
  /**
   * Mints an Entra access token for the cognitiveservices scope. In production
   * this wraps `credential.getToken('https://cognitiveservices.azure.com/.default')`;
   * tests inject a fake.
   */
  getToken: () => Promise<AzureAccessToken>;
  now?: () => number;
}

const EXPIRY_BUFFER_MS = 5 * 60 * 1000;

export class AzureEntraTokenStore {
  private readonly getToken: () => Promise<AzureAccessToken>;
  private readonly now: () => number;
  private cache: AzureAccessToken | null = null;
  private refreshPromise: Promise<string> | null = null;

  constructor(opts: AzureEntraTokenStoreOptions) {
    this.getToken = opts.getToken;
    this.now = opts.now ?? Date.now;
  }

  /**
   * Returns a valid bearer token, minting a fresh one when the cache is empty
   * or within the skew buffer of expiry. Safe to call on every agent turn.
   */
  async getValidAccessToken(): Promise<string> {
    if (this.cache !== null && this.now() < this.cache.expiresOnTimestamp - EXPIRY_BUFFER_MS) {
      return this.cache.token;
    }
    return this.runRefresh();
  }

  /** Forces a new token even when the cached one is still valid. */
  async forceRefresh(): Promise<string> {
    return this.runRefresh();
  }

  /** Drops the cached token; the next read re-mints. */
  clear(): void {
    this.cache = null;
  }

  private runRefresh(): Promise<string> {
    // Single-flight: concurrent callers share one in-flight mint. The promise
    // is cleared in finally() so a rejection never poisons later calls.
    if (this.refreshPromise !== null) return this.refreshPromise;
    const p = this.doRefresh().finally(() => {
      this.refreshPromise = null;
    });
    this.refreshPromise = p;
    return p;
  }

  private async doRefresh(): Promise<string> {
    let next: AzureAccessToken;
    try {
      next = await this.getToken();
    } catch (cause) {
      this.cache = null;
      const detail = cause instanceof Error ? cause.message : String(cause);
      throw new CodesignError(
        `Azure sign-in required: could not acquire an Entra token (${detail})`,
        ERROR_CODES.PROVIDER_AUTH_MISSING,
        { cause },
      );
    }
    if (!next || typeof next.token !== 'string' || next.token.length === 0) {
      this.cache = null;
      throw new CodesignError(
        'Azure sign-in returned an empty Entra token',
        ERROR_CODES.PROVIDER_AUTH_MISSING,
      );
    }
    this.cache = next;
    return next.token;
  }
}
