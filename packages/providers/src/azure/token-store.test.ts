import { describe, expect, it, vi } from 'vitest';
import { AzureEntraTokenStore } from './token-store';

/**
 * The Azure store differs from Codex: @azure/identity owns the real refresh +
 * disk cache, so this store is a thin in-memory cache over an injected
 * getToken() with a 5-min skew buffer and single-flight de-duplication. No
 * persisted refresh token, no file I/O in the unit under test.
 */

function tokenFn(token: string, expiresAtMs: number) {
  return vi.fn(async () => ({ token, expiresOnTimestamp: expiresAtMs }));
}

describe('AzureEntraTokenStore', () => {
  it('returns a freshly minted token on first call', async () => {
    const now = () => 1_000_000;
    const get = tokenFn('tok-1', 1_000_000 + 60 * 60 * 1000);
    const store = new AzureEntraTokenStore({ getToken: get, now });

    expect(await store.getValidAccessToken()).toBe('tok-1');
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('caches the token and does not re-mint while comfortably valid', async () => {
    const now = () => 1_000_000;
    const get = tokenFn('tok-1', 1_000_000 + 60 * 60 * 1000);
    const store = new AzureEntraTokenStore({ getToken: get, now });

    await store.getValidAccessToken();
    await store.getValidAccessToken();
    await store.getValidAccessToken();

    expect(get).toHaveBeenCalledTimes(1);
  });

  it('re-mints when within the 5-minute skew buffer of expiry', async () => {
    const clock = 1_000_000;
    const now = () => clock;
    // expires 4 minutes out → inside the 5-min buffer → must refresh
    const get = vi
      .fn()
      .mockResolvedValueOnce({ token: 'tok-1', expiresOnTimestamp: clock + 4 * 60 * 1000 })
      .mockResolvedValueOnce({ token: 'tok-2', expiresOnTimestamp: clock + 60 * 60 * 1000 });
    const store = new AzureEntraTokenStore({ getToken: get, now });

    expect(await store.getValidAccessToken()).toBe('tok-1');
    // still the same clock; tok-1 is inside the buffer, so the next call refreshes
    expect(await store.getValidAccessToken()).toBe('tok-2');
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('re-mints after the token has fully expired', async () => {
    let clock = 1_000_000;
    const now = () => clock;
    const get = vi
      .fn()
      .mockResolvedValueOnce({ token: 'tok-1', expiresOnTimestamp: clock + 60 * 60 * 1000 })
      .mockResolvedValueOnce({ token: 'tok-2', expiresOnTimestamp: clock + 2 * 60 * 60 * 1000 });
    const store = new AzureEntraTokenStore({ getToken: get, now });

    expect(await store.getValidAccessToken()).toBe('tok-1');
    clock += 61 * 60 * 1000; // jump past expiry
    expect(await store.getValidAccessToken()).toBe('tok-2');
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('de-duplicates concurrent refreshes (single-flight)', async () => {
    const now = () => 1_000_000;
    let resolve!: (v: { token: string; expiresOnTimestamp: number }) => void;
    const get = vi.fn(
      () =>
        new Promise<{ token: string; expiresOnTimestamp: number }>((r) => {
          resolve = r;
        }),
    );
    const store = new AzureEntraTokenStore({ getToken: get, now });

    const a = store.getValidAccessToken();
    const b = store.getValidAccessToken();
    resolve({ token: 'tok-1', expiresOnTimestamp: 1_000_000 + 60 * 60 * 1000 });

    expect(await a).toBe('tok-1');
    expect(await b).toBe('tok-1');
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('forceRefresh mints a new token even when the cached one is still valid', async () => {
    const now = () => 1_000_000;
    const get = vi
      .fn()
      .mockResolvedValueOnce({ token: 'tok-1', expiresOnTimestamp: now() + 60 * 60 * 1000 })
      .mockResolvedValueOnce({ token: 'tok-2', expiresOnTimestamp: now() + 60 * 60 * 1000 });
    const store = new AzureEntraTokenStore({ getToken: get, now });

    expect(await store.getValidAccessToken()).toBe('tok-1');
    expect(await store.forceRefresh()).toBe('tok-2');
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('propagates a clear auth error when the credential fails', async () => {
    const now = () => 1_000_000;
    const get = vi.fn(async () => {
      throw new Error('AADSTS700003: device auth required');
    });
    const store = new AzureEntraTokenStore({ getToken: get, now });

    await expect(store.getValidAccessToken()).rejects.toThrow(/Azure/i);
  });

  it('recovers on the next call after a transient failure (no poisoned single-flight)', async () => {
    const now = () => 1_000_000;
    const get = vi
      .fn()
      .mockRejectedValueOnce(new Error('network blip'))
      .mockResolvedValueOnce({ token: 'tok-ok', expiresOnTimestamp: now() + 60 * 60 * 1000 });
    const store = new AzureEntraTokenStore({ getToken: get, now });

    await expect(store.getValidAccessToken()).rejects.toThrow();
    expect(await store.getValidAccessToken()).toBe('tok-ok');
    expect(get).toHaveBeenCalledTimes(2);
  });
});
