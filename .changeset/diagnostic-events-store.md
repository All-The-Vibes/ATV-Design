---
'@open-codesign/desktop': minor
'@open-codesign/shared': minor
---

feat: diagnostic events table + fingerprint-based dedup

- New `diagnostic_events` SQLite table persists error-level events from renderer crashes, provider errors (`provider.error` / `provider.error.final`), and final `CodesignError` throws from `generate` / `applyComment` / `generateTitle` handlers.
- 200 ms dedup window: repeated failures with the same fingerprint bump `count` on the existing row rather than inserting new rows, keeping the table small under retry storms.
- New `computeFingerprint({ errorCode, stack })` in `@open-codesign/shared`: 8-char sha1 over error code + top-3 normalized stack frames. Stable across different users / paths / line numbers so "the same bug" collapses to one group.
- Retry-in-flight events are marked `transient: true`; the default list view hides them (UI lands in PR4).
- Startup prunes the events table to 500 newest rows.
- New `RENDERER_ERROR` code for uncaught errors forwarded from the renderer bridge.

No user-visible behavior yet — this is the storage layer for the PR4 Diagnostics panel and "Report this" flow.
