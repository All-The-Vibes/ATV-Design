---
'@open-codesign/desktop': patch
'@open-codesign/shared': patch
'@open-codesign/i18n': patch
---

fix: logging / diagnostics follow-ups from adversarial review

Addresses 11 bugs and UX gaps found in an adversarial review of PR1-5:

**Data correctness:**
- Provider error context (upstream_request_id, upstream_status, retry_count, redacted_body_head) is now carried from the transient retry rows through to the final event row that users actually Report on — previously it lived only on a hidden sibling row.
- `generateTitle` now routes through `completeWithRetry`, so title-generation failures emit the same structured `provider.error` events as regular generations instead of bubbling as raw exceptions.
- The Report button on error toasts now resolves the exact event by `runId` rather than falling back to "the most recent diagnostic event" — so with multiple errors in flight each toast opens the right dialog. When no matching event is recorded yet, the button is disabled with a tooltip.
- ErrorBoundary's Report button captures a timestamp on fallback mount and only accepts events recorded after it — render crashes no longer report whatever unrelated old error happened to be at index 0.

**Privacy:**
- Dropped the `请` / length-based heuristic in `looksLikePrompt` that was wiping out any Chinese error message longer than 200 chars containing the common word "请". Detection is now purely structural (JSON-key / field-marker patterns).
- Log tail inside `summary.md` now scrubs prompt JSON per-line when `includePromptText` is off, rather than only replacing whole lines that matched a coarse heuristic.

**UX:**
- Diagnostics panel distinguishes "no events yet" from "snapshots DB unavailable" — the latter shows a warning pointing at main.log instead of cheerfully reporting zero failures.
- After clicking Open Issue / Copy summary in the Report dialog, a toast confirms where the bundle was saved and offers a "Show in folder" action so users can actually attach it to the GitHub issue.
- Report dialog auto-focuses the notes textarea on open and traps Tab/Shift-Tab within the dialog.

**Defense in depth:**
- Main-process IPC now caps `notes` at 4000 chars and `timeline` at 100 entries — a compromised renderer can no longer push 50 MB payloads.

**Housekeeping:**
- Cleaned stale TODO referencing the now-shipped Settings surface.
