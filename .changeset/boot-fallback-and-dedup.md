---
'@open-codesign/desktop': minor
---

feat: boot-phase failure fallback + 24h fingerprint dedup

- If the app crashes before the logger is ready (corrupt config, unreadable DB, SafeStorage init throw), we now write a sync `boot-errors.log` to the logs dir (falls back to `os.tmpdir()` if the primary location fails) and show a native three-button dialog — Copy diagnostic path / Open log folder / Quit. Previously the app would silently exit or show an opaque message.
- Before a user clicks Open Issue in the Report dialog, we check a local `reported-fingerprints.json` (scoped 24 h, mode 0600) for the event's fingerprint. If it matches a prior submission, the dialog shows a small inline note with the previous issue URL: "You reported the same issue yesterday at 14:32." The user can still proceed — the check is informational.
- After any successful `reportEvent`, the fingerprint is recorded locally. Older entries are pruned on write.
