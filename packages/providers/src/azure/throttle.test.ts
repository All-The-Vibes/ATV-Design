import { describe, expect, it } from 'vitest';
import {
  AZURE_OPAQUE_FAILURE_SENTINEL,
  type AzureResponseSignal,
  enrichAzureThrottleError,
  isOpaqueAzureFailure,
  parseRetryAfterSeconds,
} from './throttle';

describe('isOpaqueAzureFailure', () => {
  it("matches pi-ai's opaque response.failed sentinel", () => {
    expect(isOpaqueAzureFailure(AZURE_OPAQUE_FAILURE_SENTINEL)).toBe(true);
    expect(isOpaqueAzureFailure('Unknown error (no error details in response)')).toBe(true);
  });

  it('matches even when wrapped with a leading status code', () => {
    // pi-ai / our remap sometimes prefix the HTTP code.
    expect(isOpaqueAzureFailure('200 Unknown error (no error details in response)')).toBe(true);
  });

  it('does not match a normal, already-descriptive error', () => {
    expect(isOpaqueAzureFailure('rate_limit_exceeded: too many tokens')).toBe(false);
    expect(isOpaqueAzureFailure('401 invalid api key')).toBe(false);
    expect(isOpaqueAzureFailure('')).toBe(false);
  });
});

describe('parseRetryAfterSeconds', () => {
  it('reads a numeric retry-after header (seconds)', () => {
    expect(parseRetryAfterSeconds({ 'retry-after': '42' })).toBe(42);
  });

  it('reads x-ratelimit-reset-requests / tokens style when retry-after absent', () => {
    expect(parseRetryAfterSeconds({ 'x-ratelimit-reset-tokens': '17s' })).toBe(17);
    expect(parseRetryAfterSeconds({ 'x-ratelimit-reset-requests': '5' })).toBe(5);
  });

  it('is case-insensitive over header names', () => {
    expect(parseRetryAfterSeconds({ 'Retry-After': '9' })).toBe(9);
  });

  it('returns undefined when no usable header is present', () => {
    expect(parseRetryAfterSeconds({})).toBeUndefined();
    expect(parseRetryAfterSeconds({ 'retry-after': 'not-a-number' })).toBeUndefined();
  });
});

describe('enrichAzureThrottleError', () => {
  it('rewrites the opaque sentinel into an actionable throttle message when the response carried throttle signals', () => {
    const signal: AzureResponseSignal = {
      status: 200,
      headers: { 'x-ms-fe-error': 'true', 'retry-after': '30' },
    };
    const out = enrichAzureThrottleError(AZURE_OPAQUE_FAILURE_SENTINEL, signal);
    expect(out).not.toBe(AZURE_OPAQUE_FAILURE_SENTINEL);
    expect(out.toLowerCase()).toContain('rate');
    expect(out).toContain('30'); // retry-after surfaced
    // Actionable remediation about capacity / TPM is surfaced.
    expect(out.toLowerCase()).toMatch(/capacity|tpm|quota|tokens-per-minute/);
  });

  it('still enriches the opaque sentinel even without captured headers (capacity throttle is the dominant Azure cause)', () => {
    const out = enrichAzureThrottleError(AZURE_OPAQUE_FAILURE_SENTINEL, undefined);
    expect(out).not.toBe(AZURE_OPAQUE_FAILURE_SENTINEL);
    expect(out.toLowerCase()).toMatch(/capacity|tpm|quota|rate|throttl/);
    // Must not fabricate a retry-after it never saw.
    expect(out).not.toMatch(/retry in \d/i);
  });

  it('surfaces an explicit x-ms-fe-error throttle flag as a rate-limit cause', () => {
    const signal: AzureResponseSignal = {
      status: 200,
      headers: { 'x-ms-fe-error': 'true' },
    };
    const out = enrichAzureThrottleError(AZURE_OPAQUE_FAILURE_SENTINEL, signal);
    expect(out.toLowerCase()).toContain('rate');
  });

  it('leaves a non-opaque message untouched (no false enrichment)', () => {
    const descriptive = 'content_policy_violation: the request was filtered';
    expect(enrichAzureThrottleError(descriptive, { status: 400, headers: {} })).toBe(descriptive);
  });

  it('does not redact or mangle — output stays a plain string', () => {
    const out = enrichAzureThrottleError(AZURE_OPAQUE_FAILURE_SENTINEL, {
      status: 200,
      headers: {},
    });
    expect(typeof out).toBe('string');
    expect(out.length).toBeGreaterThan(AZURE_OPAQUE_FAILURE_SENTINEL.length);
  });
});
