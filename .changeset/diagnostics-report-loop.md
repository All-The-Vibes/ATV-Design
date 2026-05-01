---
'@open-codesign/desktop': minor
'@open-codesign/shared': minor
'@open-codesign/i18n': minor
---

feat: diagnostics panel + Report bug flow + i18n error codes

Closes the user → maintainer triage loop that PR1/PR2/PR3 built the foundation for.

**Users see:**
- New Settings → Diagnostics tab listing recent errors (code, scope, runId, message preview) with filter for retried-then-succeeded transient errors.
- Error toasts no longer auto-dismiss and carry a Report button that opens a preview dialog.
- Report dialog shows the event + free-text notes field + redaction toggles (include prompt / paths / URLs / 60 s action timeline — sensible defaults: timeline ON, others OFF).
- One click on Open Issue launches a GitHub new-issue URL pre-filled with the summary (error code, fingerprint, env, upstream request-id, stack top 5 frames, user notes). Zip bundle with the full log + redacted config + summary.md is saved to Downloads for manual attachment.
- Topbar shows an unread-error badge that jumps to the Diagnostics tab.
- Every error toast / dialog copy is translated into zh-CN.

**Plumbing:**
- Renderer action timeline (last 40 entries / 60 s): forbids prompt text / paths / URLs by schema. Populated from `store.ts` at prompt submit, cancel, retry, provider/skill switch, design export, connection test, onboarding.
- Two new IPC channels: `diagnostics:v1:listEvents`, `diagnostics:v1:reportEvent`.
- `context_json` column added to `diagnostic_events` (additive migration) so provider errors persist `upstream_request_id` / status / retry_count alongside the row — the Report dialog renders them without reparsing main.log.
- Markdown composer `composeSummaryMarkdown` is pure + unit-tested — re-used for both bundle and issue body.
- `userFacingKey` field on every ERROR_CODE_DESCRIPTIONS entry pairs with i18n `err.<CODE>` keys in both locales.

**Foundation fixes merged in:**
- Fingerprint degeneracy: provider errors now use a synthetic `at provider (<status>:<code>)` frame so the Diagnostics panel groups sensibly.
- Duplicate fingerprinting: retry's `provider.error.final` no longer persists a separate row; the outer handler's `recordFinalError` is the single final-error write path.
- `generateTitle` / `applyComment` errors now use distinct scopes (`title`, `apply-comment`) instead of being indistinguishable from real generations.
