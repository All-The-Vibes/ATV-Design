import { type IncomingMessage, type Server, type ServerResponse, createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  type CopilotProviderError,
  copilotOAuthConsentDeniedError,
  copilotOAuthStateMismatchError,
} from './errors.js';

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

export interface CallbackResult {
  code: string;
  state: string;
}

export interface CallbackServerHandle {
  /** Full redirect URI to pass to the GitHub authorize URL, e.g. http://127.0.0.1:49152/oauth-callback */
  redirectUri: string;
  /**
   * Waits for the GitHub callback to arrive. Resolves with the code+state pair
   * on success; rejects with a CopilotProviderError on state-mismatch, missing
   * code, timeout, abort, or server close.
   *
   * @param opts.state - The CSRF state value to match against the incoming callback.
   * @param opts.signal - Optional AbortSignal to cancel the wait early.
   * @param opts.timeoutMs - Max wait time in ms (default 120 000 per ADR-0001 §L64).
   */
  waitForCode(opts: {
    state: string;
    signal?: AbortSignal;
    timeoutMs?: number;
  }): Promise<CallbackResult>;
  /** Idempotent: closes the HTTP server and rejects any pending waiter. */
  close(): Promise<void>;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const CALLBACK_PATH = '/oauth-callback';
const DEFAULT_TIMEOUT_MS = 120_000; // 2 minutes — mandated by ADR-0001 lines 51–80

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function successPage(): string {
  return '<html><body style="font-family:system-ui;padding:40px;max-width:560px;margin:0 auto"><h1 style="color:#0f766e;margin-bottom:8px">Sign-in complete</h1><p style="color:#475569">You can close this window and return to the app.</p></body></html>';
}

function errorPage(title: string, detail: string): string {
  return `<html><body style="font-family:system-ui;padding:40px;max-width:560px;margin:0 auto"><h1 style="color:#b91c1c;margin-bottom:8px">${escapeHtml(title)}</h1><p style="color:#475569">${escapeHtml(detail)}</p></body></html>`;
}

function bindServer(host: string): Promise<{ server: Server; port: number }> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    const onError = (err: NodeJS.ErrnoException) => {
      server.removeListener('listening', onListening);
      reject(err);
    };
    const onListening = () => {
      server.removeListener('error', onError);
      const addr = server.address() as AddressInfo;
      resolve({ server, port: addr.port });
    };
    server.once('error', onError);
    server.once('listening', onListening);
    // Port 0 → OS assigns a free ephemeral port (random, per ADR-0001 §L51)
    server.listen(0, host);
  });
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Starts a loopback HTTP callback server on a random OS-assigned port.
 *
 * The server binds to `host ?? '127.0.0.1'` on port 0. After `listen()` the
 * OS-assigned port is read from `server.address()`. This satisfies ADR-0001
 * lines 51–60: loopback-only, random port, no fixed port collisions.
 */
export async function startCallbackServer(opts?: {
  host?: string;
}): Promise<CallbackServerHandle> {
  const host = opts?.host ?? '127.0.0.1';
  const { server, port } = await bindServer(host);

  const redirectUri = `http://127.0.0.1:${port}${CALLBACK_PATH}`;

  // Pending waiter state — at most one concurrent waitForCode is allowed
  let pending: {
    state: string;
    resolve: (result: CallbackResult) => void;
    reject: (err: CopilotProviderError) => void;
    cleanup: () => void;
  } | null = null;

  let closed = false;

  // -------------------------------------------------------------------------
  // Request handler
  // -------------------------------------------------------------------------
  const handleRequest = (req: IncomingMessage, res: ServerResponse): void => {
    try {
      const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`);

      if (req.method !== 'GET' || url.pathname !== CALLBACK_PATH) {
        res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8', connection: 'close' });
        res.end('Not found');
        return;
      }

      const params = url.searchParams;
      const incomingCode = params.get('code');
      const incomingState = params.get('state');

      // State mismatch — possible CSRF
      if (pending === null || incomingState === null || incomingState !== pending.state) {
        res.writeHead(400, { 'content-type': 'text/html; charset=utf-8', connection: 'close' });
        res.end(
          errorPage(
            'OAuth state mismatch',
            'The state parameter did not match. The request may have been tampered with.',
          ),
        );
        const err = copilotOAuthStateMismatchError();
        pending?.reject(err);
        pending = null;
        return;
      }

      // Missing code
      if (!incomingCode) {
        res.writeHead(400, { 'content-type': 'text/html; charset=utf-8', connection: 'close' });
        res.end(
          errorPage('Missing code', 'The callback is missing the authorization code parameter.'),
        );
        const err = copilotOAuthConsentDeniedError(new Error('missing code'));
        pending.reject(err);
        pending = null;
        return;
      }

      // Success
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', connection: 'close' });
      res.end(successPage());
      const result: CallbackResult = { code: incomingCode, state: incomingState };
      pending.cleanup();
      pending.resolve(result);
      pending = null;
    } catch {
      // Never crash the server process on handler errors
      try {
        res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8', connection: 'close' });
        res.end('Internal error');
      } catch {
        // response already sent or socket dead — ignore
      }
    }
  };

  server.on('request', handleRequest);

  // -------------------------------------------------------------------------
  // waitForCode
  // -------------------------------------------------------------------------
  const waitForCode = (waitOpts: {
    state: string;
    signal?: AbortSignal;
    timeoutMs?: number;
  }): Promise<CallbackResult> => {
    if (closed) {
      return Promise.reject(copilotOAuthConsentDeniedError(new Error('server already closed')));
    }

    if (pending !== null) {
      return Promise.reject(
        copilotOAuthConsentDeniedError(new Error('waitForCode already pending')),
      );
    }

    const { signal } = waitOpts;
    const timeoutMs = waitOpts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    // Already-aborted signal: reject immediately
    if (signal?.aborted) {
      return Promise.reject(
        copilotOAuthConsentDeniedError(new Error('AbortSignal already aborted')),
      );
    }

    return new Promise<CallbackResult>((resolve, reject) => {
      let settled = false;

      const settle = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
      };

      const rejectOnce = (err: CopilotProviderError) => {
        settle();
        pending = null;
        reject(err);
      };

      const resolveOnce = (result: CallbackResult) => {
        settle();
        pending = null;
        resolve(result);
      };

      const timer = setTimeout(() => {
        rejectOnce(
          copilotOAuthConsentDeniedError(
            new Error(`GitHub OAuth callback timeout after ${timeoutMs}ms`),
          ),
        );
      }, timeoutMs);

      const onAbort = () => {
        rejectOnce(
          copilotOAuthConsentDeniedError(new Error('GitHub OAuth callback aborted by signal')),
        );
      };

      signal?.addEventListener('abort', onAbort, { once: true });

      pending = {
        state: waitOpts.state,
        resolve: resolveOnce,
        reject: rejectOnce,
        cleanup: settle,
      };
    });
  };

  // -------------------------------------------------------------------------
  // close — idempotent
  // -------------------------------------------------------------------------
  const close = (): Promise<void> => {
    if (closed) return Promise.resolve();
    closed = true;

    if (pending !== null) {
      pending.reject(
        copilotOAuthConsentDeniedError(new Error('GitHub OAuth callback server closed')),
      );
      pending = null;
    }

    return new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  };

  return { redirectUri, waitForCode, close };
}
