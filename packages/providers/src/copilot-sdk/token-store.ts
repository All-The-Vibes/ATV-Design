/**
 * CopilotTokenStore — persistent two-token storage for the GitHub Copilot provider.
 *
 * Stores:
 *  - GitHub OAuth access token (long-lived; re-auth required when it expires)
 *  - Copilot session token (short-lived; refreshed proactively via refreshFn)
 *
 * File: ~/.config/atv-design/copilot-auth.json (mode 0600)
 * Atomic writes: write to <path>.tmp.<pid>.<uuid>, then rename.
 *
 * PRINCIPLES: no console.*, no secret leakage in error messages (CLAUDE.md ban).
 */

import { randomUUID } from 'node:crypto';
import { chmod, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { ERROR_CODES } from '@open-codesign/shared';
import { CopilotProviderError } from './errors';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StoredCopilotAuth {
  schemaVersion: 1;
  githubAccessToken: string;
  githubTokenType: string;
  githubScope: string;
  githubObtainedAt: number;
  /** Copilot session token — null until T4 (chat code) populates it lazily. */
  copilotSessionToken: string | null;
  /** Unix ms expiry for the Copilot session token; null when token not yet cached. */
  copilotSessionExpiresAt: number | null;
  updatedAt: number;
}

export interface CopilotTokenStoreOptions {
  /** Override the config directory (defaults to XDG_CONFIG_HOME/atv-design or ~/.config/atv-design). */
  configDir?: string;
  /** Override the full file path directly (takes precedence over configDir). */
  filePath?: string;
  /**
   * Called by getCurrent() when the Copilot session token is within EXPIRY_BUFFER_MS
   * of expiring. Receives the current stored auth and returns the updated auth.
   * Not providing this means no proactive session-token refresh occurs.
   */
  refreshFn?: (auth: StoredCopilotAuth) => Promise<StoredCopilotAuth>;
  /** Injectable clock for testing. Defaults to Date.now. */
  now?: () => number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Refresh the Copilot session token when it has 5 minutes or less remaining. */
const EXPIRY_BUFFER_MS = 5 * 60_000;

const DEFAULT_APP_DIR = 'atv-design';
const AUTH_FILENAME = 'copilot-auth.json';

// ---------------------------------------------------------------------------
// Schema guard
// ---------------------------------------------------------------------------

function isStoredCopilotAuth(value: unknown): value is StoredCopilotAuth {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    v['schemaVersion'] === 1 &&
    typeof v['githubAccessToken'] === 'string' &&
    typeof v['githubTokenType'] === 'string' &&
    typeof v['githubScope'] === 'string' &&
    typeof v['githubObtainedAt'] === 'number' &&
    (v['copilotSessionToken'] === null || typeof v['copilotSessionToken'] === 'string') &&
    (v['copilotSessionExpiresAt'] === null || typeof v['copilotSessionExpiresAt'] === 'number') &&
    typeof v['updatedAt'] === 'number'
  );
}

// ---------------------------------------------------------------------------
// Path resolution
// ---------------------------------------------------------------------------

function resolveConfigDir(configDir: string | undefined): string {
  if (configDir !== undefined) return configDir;
  const xdg = process.env['XDG_CONFIG_HOME'];
  if (xdg && xdg.length > 0) {
    return path.join(xdg, DEFAULT_APP_DIR);
  }
  return path.join(os.homedir(), '.config', DEFAULT_APP_DIR);
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export class CopilotTokenStore {
  private readonly filePath: string;
  private readonly refreshFn: ((auth: StoredCopilotAuth) => Promise<StoredCopilotAuth>) | undefined;
  private readonly now: () => number;
  private _cache: StoredCopilotAuth | null = null;

  constructor(opts: CopilotTokenStoreOptions = {}) {
    if (opts.filePath !== undefined) {
      this.filePath = opts.filePath;
    } else {
      const configDir = resolveConfigDir(opts.configDir);
      this.filePath = path.join(configDir, AUTH_FILENAME);
    }
    this.refreshFn = opts.refreshFn;
    this.now = opts.now ?? Date.now;
  }

  /**
   * Read and validate the stored auth from disk.
   * Returns null when the file does not exist (ENOENT).
   * Throws CopilotProviderError for corrupt / schema-mismatch JSON.
   */
  async load(): Promise<StoredCopilotAuth | null> {
    let body: string;
    try {
      body = await readFile(this.filePath, 'utf8');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        this._cache = null;
        return null;
      }
      throw new CopilotProviderError(`Failed to read Copilot auth file at ${this.filePath}`, {
        status: undefined,
        requestId: undefined,
        code: ERROR_CODES.PROVIDER_ERROR,
        cause: err,
      });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch (cause) {
      throw new CopilotProviderError(`Copilot auth file is not valid JSON at ${this.filePath}`, {
        status: undefined,
        requestId: undefined,
        code: ERROR_CODES.PROVIDER_ERROR,
        cause,
      });
    }

    if (!isStoredCopilotAuth(parsed)) {
      throw new CopilotProviderError(
        `Copilot auth file has an unrecognised schema at ${this.filePath}`,
        {
          status: undefined,
          requestId: undefined,
          code: ERROR_CODES.PROVIDER_ERROR,
        },
      );
    }

    this._cache = parsed;
    return parsed;
  }

  /**
   * Atomically write the auth file (mode 0600) and update the in-memory cache.
   * Injects schemaVersion and updatedAt automatically.
   */
  async save(
    auth: Omit<StoredCopilotAuth, 'schemaVersion' | 'updatedAt'>,
  ): Promise<StoredCopilotAuth> {
    const full: StoredCopilotAuth = {
      schemaVersion: 1,
      ...auth,
      updatedAt: this.now(),
    };

    const dir = path.dirname(this.filePath);
    await mkdir(dir, { recursive: true, mode: 0o700 });

    const tmpPath = `${this.filePath}.tmp.${process.pid}.${randomUUID()}`;
    const body = JSON.stringify(full, null, 2);

    try {
      await writeFile(tmpPath, body, { encoding: 'utf8', mode: 0o600 });
      await rename(tmpPath, this.filePath);
    } catch (err) {
      try {
        await unlink(tmpPath);
      } catch {
        // ignore — tmp may not exist if writeFile itself failed
      }
      throw err;
    }

    // On POSIX, tighten mode on the destination in case umask loosened it.
    if (process.platform !== 'win32') {
      try {
        await chmod(this.filePath, 0o600);
      } catch {
        // best-effort — EPERM is common in restricted CI environments
      }
    }

    this._cache = full;
    return full;
  }

  /**
   * Delete the auth file and clear the cache.
   * Idempotent — ignores ENOENT.
   */
  async clear(): Promise<void> {
    this._cache = null;
    try {
      await unlink(this.filePath);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
  }

  /**
   * Return the current stored auth, optionally refreshing the Copilot session
   * token when it is within EXPIRY_BUFFER_MS of expiry and a refreshFn was provided.
   *
   * Throws:
   *  - CopilotProviderError(PROVIDER_AUTH_MISSING) when no credentials are stored.
   *  - CopilotProviderError(PROVIDER_ERROR) when refresh fails.
   */
  async getCurrent(opts?: { signal?: AbortSignal }): Promise<StoredCopilotAuth> {
    // Use cache if available; otherwise read from disk.
    let auth = this._cache;
    if (auth === null) {
      auth = await this.load();
    }

    if (auth === null) {
      throw new CopilotProviderError('GitHub Copilot is not authenticated — please sign in', {
        status: undefined,
        requestId: undefined,
        code: ERROR_CODES.PROVIDER_AUTH_MISSING,
      });
    }

    // Proactively refresh Copilot session token when near expiry.
    const { copilotSessionToken, copilotSessionExpiresAt } = auth;
    if (
      copilotSessionToken !== null &&
      copilotSessionExpiresAt !== null &&
      this.now() >= copilotSessionExpiresAt - EXPIRY_BUFFER_MS &&
      this.refreshFn !== undefined
    ) {
      opts?.signal?.throwIfAborted?.();

      let refreshed: StoredCopilotAuth;
      try {
        refreshed = await this.refreshFn(auth);
      } catch (err) {
        throw new CopilotProviderError('Failed to refresh GitHub Copilot session token', {
          status: undefined,
          requestId: undefined,
          code: ERROR_CODES.PROVIDER_ERROR,
          cause: err,
        });
      }
      return this.save({
        githubAccessToken: refreshed.githubAccessToken,
        githubTokenType: refreshed.githubTokenType,
        githubScope: refreshed.githubScope,
        githubObtainedAt: refreshed.githubObtainedAt,
        copilotSessionToken: refreshed.copilotSessionToken,
        copilotSessionExpiresAt: refreshed.copilotSessionExpiresAt,
      });
    }

    return auth;
  }
}
