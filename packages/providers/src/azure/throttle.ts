/**
 * Azure / Foundry throttle-error enrichment.
 *
 * pi-ai's openai-responses-shared handler throws a single opaque string when an
 * Azure `response.failed` SSE event arrives with no `response.error` body:
 *
 *     "Unknown error (no error details in response)"
 *
 * On Azure OpenAI / Foundry this failure shape is dominantly a **capacity /
 * rate-limit throttle**: the deployment's tokens-per-minute (TPM) quota is
 * smaller than the request's output-token budget, so Azure returns HTTP 200,
 * opens the SSE stream, then emits `response.failed` (often with
 * `x-ms-fe-error: true` and rate-limit headers) instead of any structured
 * error object. pi-ai flattens that to the sentinel above, and the user sees a
 * dead end with no idea their quota is the problem.
 *
 * We cannot fix pi-ai (HC #7: reuse pi primitives, don't fork), but the wire is
 * inspectable: pi-ai's `onResponse(response, model)` hook hands us the HTTP
 * status + headers before the SSE body is consumed. This module turns the
 * captured signal + the opaque sentinel into an actionable message naming the
 * real cause (capacity/TPM) and remediation, surfacing `retry-after` when the
 * response carried it.
 *
 * Trust model: pure string/record transforms, no parsing of untrusted JSON, no
 * secret handling (the caller still runs the result through normalizeProviderError
 * scrubbing). Detection is conservative — only the exact opaque sentinel is
 * rewritten, so genuinely-descriptive errors pass through untouched.
 */

/** The exact message pi-ai throws for a detail-less Azure `response.failed`. */
export const AZURE_OPAQUE_FAILURE_SENTINEL = 'Unknown error (no error details in response)';

/** HTTP status + headers captured from pi-ai's `onResponse` hook. */
export interface AzureResponseSignal {
  status: number;
  headers: Record<string, string>;
}

/**
 * Coerce pi-ai's `onResponse` headers (typed `unknown`; in practice a plain
 * record from the azure provider's `headersToRecord`, but tolerate a
 * Headers-like object too) into a flat string record for throttle inspection.
 * Shared by the `complete()` path (providers) and the agent path (core) so the
 * capture shape stays identical in both.
 */
export function normalizeResponseHeaders(headers: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!headers || typeof headers !== 'object') return out;
  const maybeIterable = headers as {
    forEach?: (cb: (value: string, key: string) => void) => void;
  };
  if (typeof maybeIterable.forEach === 'function') {
    maybeIterable.forEach((value, key) => {
      if (typeof value === 'string') out[key] = value;
    });
    return out;
  }
  for (const [key, value] of Object.entries(headers as Record<string, unknown>)) {
    if (typeof value === 'string') out[key] = value;
  }
  return out;
}

/**
 * True when `message` is pi-ai's opaque Azure `response.failed` sentinel. Match
 * is substring-based so a leading status code (e.g. "200 Unknown error …"),
 * added by our own remap layer, still qualifies.
 */
export function isOpaqueAzureFailure(message: string | undefined | null): boolean {
  if (!message) return false;
  return message.includes(AZURE_OPAQUE_FAILURE_SENTINEL);
}

function headerLookup(headers: Record<string, string>, name: string): string | undefined {
  const lower = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lower) return value;
  }
  return undefined;
}

/**
 * Extract a retry-after hint (seconds) from rate-limit response headers. Reads
 * `retry-after` first, then Azure/OpenAI's `x-ratelimit-reset-{tokens,requests}`
 * (which may carry a trailing `s`). Returns undefined when no usable numeric
 * value is present — we never fabricate a delay we did not observe.
 */
export function parseRetryAfterSeconds(
  headers: Record<string, string> | undefined,
): number | undefined {
  if (!headers) return undefined;
  const candidates = ['retry-after', 'x-ratelimit-reset-tokens', 'x-ratelimit-reset-requests'];
  for (const name of candidates) {
    const raw = headerLookup(headers, name);
    if (raw === undefined) continue;
    const match = /^(\d+(?:\.\d+)?)\s*s?$/.exec(raw.trim());
    if (match?.[1]) {
      const seconds = Number(match[1]);
      if (Number.isFinite(seconds)) return seconds;
    }
  }
  return undefined;
}

/** True when captured headers carry an explicit Azure front-end throttle flag. */
function hasAzureThrottleFlag(headers: Record<string, string> | undefined): boolean {
  if (!headers) return false;
  const flag = headerLookup(headers, 'x-ms-fe-error');
  if (flag && flag.toLowerCase() === 'true') return true;
  // Presence of rate-limit-remaining at 0 is also a throttle tell.
  const remainingTokens = headerLookup(headers, 'x-ratelimit-remaining-tokens');
  if (remainingTokens !== undefined && Number(remainingTokens) === 0) return true;
  return false;
}

const REMEDIATION =
  "This is almost always an Azure capacity/rate-limit throttle: the deployment's " +
  "tokens-per-minute (TPM) quota is lower than this request's output-token budget. " +
  'Raise the deployment capacity in the Azure/Foundry portal (Deployments → your model → ' +
  "Edit → increase Tokens per Minute Rate Limit), or lower the request's max output tokens.";

/**
 * Rewrite pi-ai's opaque Azure failure into an actionable throttle message.
 *
 * - Non-opaque messages are returned verbatim (no false enrichment).
 * - The opaque sentinel is always enriched with the capacity/TPM remediation,
 *   because that is the dominant cause of this exact failure shape on Azure —
 *   even when no headers were captured (e.g. the throttle arrived mid-SSE).
 * - When the captured response carried an explicit throttle flag or a
 *   retry-after, those concrete signals are surfaced too.
 */
export function enrichAzureThrottleError(
  message: string,
  signal: AzureResponseSignal | undefined,
): string {
  if (!isOpaqueAzureFailure(message)) return message;

  const retryAfter = parseRetryAfterSeconds(signal?.headers);
  const throttleFlag = hasAzureThrottleFlag(signal?.headers);

  const lead = throttleFlag
    ? 'Azure rate-limit / capacity throttle (the deployment reported x-ms-fe-error).'
    : 'Azure request failed mid-stream with no error body — rate-limit / capacity throttle.';

  const retryHint = retryAfter !== undefined ? ` Azure asked to retry after ${retryAfter}s.` : '';

  return `${lead}${retryHint} ${REMEDIATION}`;
}
