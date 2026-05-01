import { afterEach, describe, expect, it, vi } from 'vitest';
import { CopilotProviderError } from './errors.js';
import { type CallbackServerHandle, startCallbackServer } from './oauth-server.js';

// ---------------------------------------------------------------------------
// Cleanup tracking
// ---------------------------------------------------------------------------

const handles: CallbackServerHandle[] = [];

async function open(): Promise<CallbackServerHandle> {
  const h = await startCallbackServer();
  handles.push(h);
  return h;
}

afterEach(async () => {
  // Close all open servers after each test (idempotent)
  while (handles.length > 0) {
    const h = handles.pop();
    try {
      await h?.close();
    } catch {
      // ignore — already closed
    }
  }
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// startCallbackServer
// ---------------------------------------------------------------------------

describe('startCallbackServer', () => {
  it('returns redirectUri matching http://127.0.0.1:<port>/oauth-callback', async () => {
    const h = await open();
    expect(h.redirectUri).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/oauth-callback$/);
    const port = Number(new URL(h.redirectUri).port);
    expect(port).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // Happy path
  // -------------------------------------------------------------------------

  it('happy path: waitForCode resolves with code + state', async () => {
    const h = await open();
    const waiter = h.waitForCode({ state: 'abc' });

    const res = await fetch(`${h.redirectUri}?code=xyz&state=abc`);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('Sign-in complete');

    await expect(waiter).resolves.toEqual({ code: 'xyz', state: 'abc' });
  });

  // -------------------------------------------------------------------------
  // State mismatch
  // -------------------------------------------------------------------------

  it('rejects when state does not match', async () => {
    const h = await open();
    const waiter = h.waitForCode({ state: 'abc' });

    const assertion = expect(waiter).rejects.toBeInstanceOf(CopilotProviderError);
    const res = await fetch(`${h.redirectUri}?code=xyz&state=def`);
    expect(res.status).toBe(400);
    const body = await res.text();
    expect(body).toContain('state mismatch');

    await assertion;
  });

  // -------------------------------------------------------------------------
  // Missing code
  // -------------------------------------------------------------------------

  it('rejects when code is missing from callback', async () => {
    const h = await open();
    const waiter = h.waitForCode({ state: 'abc' });

    const assertion = expect(waiter).rejects.toBeInstanceOf(CopilotProviderError);
    const res = await fetch(`${h.redirectUri}?state=abc`);
    expect(res.status).toBe(400);
    await assertion;
  });

  // -------------------------------------------------------------------------
  // 404 for other paths
  // -------------------------------------------------------------------------

  it('returns 404 for paths other than /oauth-callback', async () => {
    const h = await open();
    const port = new URL(h.redirectUri).port;
    const res = await fetch(`http://127.0.0.1:${port}/other`);
    expect(res.status).toBe(404);
  });

  // -------------------------------------------------------------------------
  // Timeout
  // -------------------------------------------------------------------------

  it('rejects after timeoutMs with CopilotProviderError', async () => {
    const h = await open();
    const start = Date.now();
    await expect(h.waitForCode({ state: 'abc', timeoutMs: 50 })).rejects.toBeInstanceOf(
      CopilotProviderError,
    );
    // Should not wait more than 500ms total
    expect(Date.now() - start).toBeLessThan(500);
  });

  it('default timeout is ~120 000ms (via fake timers)', async () => {
    vi.useFakeTimers();
    const h = await open();
    const waiter = h.waitForCode({ state: 'abc' });
    const assertion = expect(waiter).rejects.toBeInstanceOf(CopilotProviderError);
    await vi.advanceTimersByTimeAsync(120_000 + 1);
    await assertion;
  });

  // -------------------------------------------------------------------------
  // AbortSignal
  // -------------------------------------------------------------------------

  it('rejects immediately when signal is already aborted', async () => {
    const h = await open();
    const controller = new AbortController();
    controller.abort();
    await expect(h.waitForCode({ state: 'abc', signal: controller.signal })).rejects.toBeInstanceOf(
      CopilotProviderError,
    );
  });

  it('rejects when signal is aborted mid-wait', async () => {
    const h = await open();
    const controller = new AbortController();
    const waiter = h.waitForCode({ state: 'abc', signal: controller.signal });
    controller.abort();
    await expect(waiter).rejects.toBeInstanceOf(CopilotProviderError);
  });

  // -------------------------------------------------------------------------
  // close() — idempotent, rejects pending waiter
  // -------------------------------------------------------------------------

  it('close() rejects a pending waiter with CopilotProviderError', async () => {
    const h = await startCallbackServer(); // not tracked — we close it manually
    const waiter = h.waitForCode({ state: 'abc' });
    await h.close();
    await expect(waiter).rejects.toBeInstanceOf(CopilotProviderError);
  });

  it('close() is idempotent — calling twice does not throw', async () => {
    const h = await open();
    await h.close();
    await expect(h.close()).resolves.toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // Concurrent waitForCode guard
  // -------------------------------------------------------------------------

  it('rejects a second concurrent waitForCode call', async () => {
    const h = await open();
    const first = h.waitForCode({ state: 'abc' });
    await expect(h.waitForCode({ state: 'xyz' })).rejects.toBeInstanceOf(CopilotProviderError);
    // Clean up first waiter
    await h.close();
    await expect(first).rejects.toBeInstanceOf(CopilotProviderError);
  });
});
