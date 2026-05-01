---
'@open-codesign/providers': minor
'@open-codesign/core': patch
'@open-codesign/shared': patch
---

feat: normalize provider errors into structured log events

- `normalizeProviderError(err, provider, retryCount)` produces a flat `NormalizedProviderError` object capturing `upstream_status`, `upstream_code`, `upstream_request_id`, `retry_count`, and the first 512 bytes of the response body with API keys / bearer tokens redacted.
- `completeWithRetry` emits `provider.error` on each retried attempt and `provider.error.final` when retries are exhausted, via an injected logger. The `runId` set by PR1's `AsyncLocalStorage` automatically joins every event.
- New `PROVIDER_UPSTREAM_ERROR` code in the shared registry for errors that reach the final throw without a more specific classification.
- Net effect: triaging a user-reported 4xx/5xx now works from the log alone — no follow-up request needed for `request-id` or response body.

Also includes two PR1 follow-ups: corrects two misplaced `biome-ignore` comments (`ChatMessageList.tsx`, `chat-ui.jsx`) and makes `logger.rotation.test.ts` path-separator portable for future Windows CI.
