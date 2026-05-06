/**
 * client.ts — HTTP client for api.githubcopilot.com.
 *
 * Resolves a session token on every request (provider handles caching/refresh),
 * injects required Copilot headers, and wraps transient failures with
 * withBackoff from retry.ts.
 *
 * PRINCIPLES: no console.*, no client_secret anywhere.
 */

import { classifyError, withBackoff } from '../retry';
import { mapCopilotResponseError } from './errors';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CopilotClient {
  fetch(path: string, init: RequestInit & { signal?: AbortSignal }): Promise<Response>;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates a CopilotClient that routes all HTTP calls through the provided
 * session-token provider and adds the required Copilot request headers.
 *
 * @param opts.sessionTokenProvider  Async fn that returns a valid Bearer token;
 *                                   responsible for caching and refresh (T3/T5).
 * @param opts.baseUrl               Defaults to 'https://api.githubcopilot.com'.
 * @param opts.userAgent             Injected as Editor-Version header.
 *                                   Defaults to 'atv-design/0.1.0'.
 * @param opts.fetch                 Injected for tests; defaults to global fetch.
 */
export function createCopilotClient(opts: {
  sessionTokenProvider: () => Promise<string>;
  baseUrl?: string;
  userAgent?: string;
  fetch?: typeof fetch;
}): CopilotClient {
  const baseUrl = opts.baseUrl ?? 'https://api.githubcopilot.com';
  const userAgent = opts.userAgent ?? 'atv-design/0.1.0';
  const fetchImpl = opts.fetch ?? fetch;

  return {
    async fetch(path: string, init: RequestInit & { signal?: AbortSignal }): Promise<Response> {
      const signal = init.signal;

      // Resolve token outside the retry loop so a token-fetch failure is not
      // retried (provider is responsible for its own retry / refresh logic).
      const sessionToken = await opts.sessionTokenProvider();

      // Merge default headers with caller-supplied ones (caller wins).
      const defaultHeaders: Record<string, string> = {
        Authorization: `Bearer ${sessionToken}`,
        'Editor-Version': userAgent,
        'Copilot-Integration-Id': 'vscode-chat',
        Accept: 'application/json',
      };

      const callerHeaders = headersToRecord(init.headers);
      const mergedHeaders = { ...defaultHeaders, ...callerHeaders };

      const url = `${baseUrl}${path}`;

      const backoffOpts: Parameters<typeof withBackoff>[1] = {
        maxRetries: 3,
        baseDelayMs: 500,
        classify: classifyError,
      };
      if (signal !== undefined) backoffOpts.signal = signal;

      const response = await withBackoff(async () => {
        const fetchInit: RequestInit = { ...init, headers: mergedHeaders };
        if (signal !== undefined) fetchInit.signal = signal;

        const res = await fetchImpl(url, fetchInit);

        if (!res.ok) {
          let body: unknown;
          try {
            body = await res.clone().json();
          } catch {
            body = undefined;
          }
          throw mapCopilotResponseError(res, body);
        }

        return res;
      }, backoffOpts);

      return response;
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function headersToRecord(headers: RequestInit['headers'] | undefined): Record<string, string> {
  if (headers === undefined) return {};
  if (headers instanceof Headers) {
    const record: Record<string, string> = {};
    headers.forEach((value, key) => {
      record[key] = value;
    });
    return record;
  }
  if (Array.isArray(headers)) {
    const record: Record<string, string> = {};
    for (const header of headers) {
      const [key, value] = header;
      if (key === undefined || value === undefined) continue;
      record[key] = value;
    }
    return record;
  }
  return headers as Record<string, string>;
}
