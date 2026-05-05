import { randomBytes } from 'node:crypto';
import { mkdir, readFile, readdir, stat, unlink, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import { join } from 'node:path';
import { ERROR_CODES } from '@atv-design/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CopilotProviderError } from './errors';
import { CopilotTokenStore, type StoredCopilotAuth } from './token-store';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NOW = 1_700_000_000_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const createdPaths: string[] = [];

function tempDir(): string {
  const p = join(os.tmpdir(), `copilot-token-test-${randomBytes(8).toString('hex')}`);
  createdPaths.push(p);
  return p;
}

function tempFilePath(): string {
  const p = join(os.tmpdir(), `copilot-token-test-${randomBytes(8).toString('hex')}.json`);
  createdPaths.push(p);
  return p;
}

function baseAuth(
  overrides: Partial<Omit<StoredCopilotAuth, 'schemaVersion' | 'updatedAt'>> = {},
): Omit<StoredCopilotAuth, 'schemaVersion' | 'updatedAt'> {
  return {
    githubAccessToken: 'gho_test_access_token',
    githubTokenType: 'bearer',
    githubScope: 'copilot',
    githubObtainedAt: NOW - 1000,
    copilotSessionToken: 'ghs_copilot_session_token',
    copilotSessionExpiresAt: NOW + 60 * 60 * 1000, // 1h from now
    ...overrides,
  };
}

function makeStore(opts: ConstructorParameters<typeof CopilotTokenStore>[0] = {}) {
  const filePath = opts.filePath ?? tempFilePath();
  const store = new CopilotTokenStore({ ...opts, filePath });
  return { store, filePath };
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

afterEach(async () => {
  while (createdPaths.length > 0) {
    const p = createdPaths.pop();
    if (!p) continue;
    try {
      await unlink(p);
    } catch {
      // best-effort; dirs are ignored
    }
  }
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CopilotTokenStore', () => {
  // --- Roundtrip ---

  it('save → load roundtrip preserves all fields with schemaVersion=1 and updatedAt>0', async () => {
    const { store, filePath } = makeStore({ now: () => NOW });
    const auth = baseAuth();
    const saved = await store.save(auth);

    expect(saved.schemaVersion).toBe(1);
    expect(saved.updatedAt).toBe(NOW);
    expect(saved.githubAccessToken).toBe(auth.githubAccessToken);
    expect(saved.copilotSessionToken).toBe(auth.copilotSessionToken);

    // Load from a fresh store to bypass cache.
    const store2 = new CopilotTokenStore({ filePath, now: () => NOW });
    const loaded = await store2.load();
    expect(loaded).toEqual(saved);
  });

  // --- File mode (POSIX only) ---

  it('save writes with mode 0600 on POSIX; file exists on Windows', async () => {
    const { store, filePath } = makeStore({ now: () => NOW });
    await store.save(baseAuth());

    if (process.platform !== 'win32') {
      const s = await stat(filePath);
      expect(s.mode & 0o777).toBe(0o600);
    } else {
      // On Windows chmod is best-effort — just assert the file exists.
      await expect(stat(filePath)).resolves.toBeDefined();
    }
  });

  // --- Atomic write / no .tmp lingering ---

  it('save leaves no .tmp file in the directory after resolving', async () => {
    // Use a dedicated subdir so the readdir scan is not polluted by OS temp files.
    const dir = tempDir();
    const filePath = join(dir, 'copilot-auth.json');
    createdPaths.push(filePath);
    const store = new CopilotTokenStore({ filePath, now: () => NOW });

    await store.save(baseAuth());
    await store.save(baseAuth({ githubAccessToken: 'gho_second' }));

    const entries = await readdir(dir);
    const leftovers = entries.filter((n) => n.includes('.tmp.'));
    expect(leftovers).toEqual([]);
  });

  // --- Corrupt JSON ---

  it('load throws CopilotProviderError for schemaVersion mismatch', async () => {
    const { store, filePath } = makeStore();
    await mkdir(
      filePath.substring(0, Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'))),
      { recursive: true },
    );
    await writeFile(filePath, JSON.stringify({ schemaVersion: 999 }), 'utf8');
    await expect(store.load()).rejects.toBeInstanceOf(CopilotProviderError);
  });

  // --- Truly malformed (not JSON) ---

  it('load wraps SyntaxError in CopilotProviderError for non-JSON content', async () => {
    const { store, filePath } = makeStore();
    await mkdir(
      filePath.substring(0, Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'))),
      { recursive: true },
    );
    await writeFile(filePath, 'not-json', 'utf8');
    const err = await store.load().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(CopilotProviderError);
    // Must not leak a raw SyntaxError.
    expect(err).not.toBeInstanceOf(SyntaxError);
  });

  // --- Missing file ---

  it('load returns null when file does not exist (ENOENT)', async () => {
    const { store } = makeStore();
    await expect(store.load()).resolves.toBeNull();
  });

  // --- clear() idempotency ---

  it('clear() is idempotent — second call must not throw', async () => {
    const { store } = makeStore({ now: () => NOW });
    await store.save(baseAuth());
    await store.clear();
    await expect(store.clear()).resolves.toBeUndefined();
  });

  it('clear() removes the file from disk', async () => {
    const { store, filePath } = makeStore({ now: () => NOW });
    await store.save(baseAuth());
    await store.clear();
    await expect(readFile(filePath, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
  });

  // --- getCurrent without refresh ---

  it('getCurrent returns stored object without calling refreshFn when session token is not near expiry', async () => {
    const refreshFn = vi.fn();
    const { store } = makeStore({
      now: () => NOW,
      refreshFn,
    });
    await store.save(baseAuth({ copilotSessionExpiresAt: NOW + 60 * 60 * 1000 }));

    const result = await store.getCurrent();
    expect(result.githubAccessToken).toBe('gho_test_access_token');
    expect(refreshFn).not.toHaveBeenCalled();
  });

  // --- getCurrent triggers refresh ---

  it('getCurrent calls refreshFn once and saves result when session token is within 5-min buffer', async () => {
    const refreshedAuth = baseAuth({
      copilotSessionToken: 'ghs_refreshed_token',
      copilotSessionExpiresAt: NOW + 60 * 60 * 1000,
    });
    const refreshFn = vi.fn().mockResolvedValue({
      schemaVersion: 1 as const,
      ...refreshedAuth,
      updatedAt: NOW,
    });

    const { store, filePath } = makeStore({ now: () => NOW, refreshFn });
    const original = baseAuth({ copilotSessionExpiresAt: NOW + 60_000 }); // 1 min — within buffer
    await store.save(original);

    const result = await store.getCurrent();

    expect(refreshFn).toHaveBeenCalledTimes(1);
    // refreshFn receives the prior auth object
    expect(refreshFn.mock.calls[0]?.[0].githubAccessToken).toBe('gho_test_access_token');
    expect(result.copilotSessionToken).toBe('ghs_refreshed_token');

    // Persisted to disk
    const persisted = JSON.parse(await readFile(filePath, 'utf8')) as StoredCopilotAuth;
    expect(persisted.copilotSessionToken).toBe('ghs_refreshed_token');
  });

  // --- getCurrent refresh failure ---

  it('getCurrent rethrows refresh failure as CopilotProviderError', async () => {
    const refreshFn = vi.fn().mockRejectedValue(new Error('upstream timeout'));
    const { store } = makeStore({ now: () => NOW, refreshFn });
    await store.save(baseAuth({ copilotSessionExpiresAt: NOW + 60_000 }));

    const err = await store.getCurrent().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(CopilotProviderError);
    expect((err as CopilotProviderError).code).toBe(ERROR_CODES.PROVIDER_ERROR);
  });

  // --- getCurrent on missing file ---

  it('getCurrent throws auth-missing CopilotProviderError when no credentials stored', async () => {
    const { store } = makeStore();
    const err = await store.getCurrent().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(CopilotProviderError);
    expect((err as CopilotProviderError).code).toBe(ERROR_CODES.PROVIDER_AUTH_MISSING);
  });

  // --- XDG_CONFIG_HOME respected ---

  describe('XDG_CONFIG_HOME', () => {
    let originalXdg: string | undefined;

    beforeEach(() => {
      originalXdg = process.env['XDG_CONFIG_HOME'];
    });

    afterEach(() => {
      if (originalXdg === undefined) {
        Reflect.deleteProperty(process.env, 'XDG_CONFIG_HOME');
      } else {
        process.env['XDG_CONFIG_HOME'] = originalXdg;
      }
    });

    it('places auth file under $XDG_CONFIG_HOME/atv-design/ when env is set', async () => {
      const xdgBase = tempDir();
      process.env['XDG_CONFIG_HOME'] = xdgBase;

      // Instantiate without configDir or filePath — should pick up XDG.
      const store = new CopilotTokenStore({ now: () => NOW });
      await store.save(baseAuth());

      const expectedPath = join(xdgBase, 'atv-design', 'copilot-auth.json');
      createdPaths.push(expectedPath);
      const content = await readFile(expectedPath, 'utf8');
      const parsed = JSON.parse(content) as StoredCopilotAuth;
      expect(parsed.schemaVersion).toBe(1);
      expect(parsed.githubAccessToken).toBe('gho_test_access_token');
    });
  });

  // --- Cache hit ---

  it('getCurrent does not re-read disk on second call after save (cache hit)', async () => {
    // Behavioral proof: after save() populates the cache, we delete the file
    // from disk. If getCurrent() re-read disk it would throw ENOENT; cache
    // means it should return the in-memory value without touching the file.
    const { store, filePath } = makeStore({ now: () => NOW });
    await store.save(baseAuth());

    // Remove the file — cache should make disk access unnecessary.
    await unlink(filePath);
    createdPaths.splice(createdPaths.indexOf(filePath), 1); // already gone

    const result = await store.getCurrent();
    expect(result.githubAccessToken).toBe('gho_test_access_token');
  });

  // --- Auto-creates parent directory ---

  it('save auto-creates the parent directory', async () => {
    const dir = tempDir();
    const filePath = join(dir, 'deep', 'nested', 'copilot-auth.json');
    createdPaths.push(filePath);
    const store = new CopilotTokenStore({ filePath, now: () => NOW });
    await store.save(baseAuth());
    const content = JSON.parse(await readFile(filePath, 'utf8')) as StoredCopilotAuth;
    expect(content.schemaVersion).toBe(1);
  });

  // --- Null Copilot session token (lazy population) ---

  it('save and load handle null copilotSessionToken and copilotSessionExpiresAt', async () => {
    const { store } = makeStore({ now: () => NOW });
    const auth = baseAuth({ copilotSessionToken: null, copilotSessionExpiresAt: null });
    const saved = await store.save(auth);
    expect(saved.copilotSessionToken).toBeNull();
    expect(saved.copilotSessionExpiresAt).toBeNull();

    await store.clear();
    const loaded = await store.load();
    expect(loaded).toBeNull(); // file removed
  });

  // --- getCurrent skips refresh when no refreshFn provided ---

  it('getCurrent returns auth without refresh when session token is near expiry but no refreshFn provided', async () => {
    const { store } = makeStore({ now: () => NOW }); // no refreshFn
    await store.save(baseAuth({ copilotSessionExpiresAt: NOW + 60_000 }));

    const result = await store.getCurrent();
    // Should return as-is without throwing.
    expect(result.copilotSessionToken).toBe('ghs_copilot_session_token');
  });
});
