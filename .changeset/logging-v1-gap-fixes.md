---
'@open-codesign/desktop': patch
'@open-codesign/shared': patch
'@open-codesign/i18n': patch
---

fix: close v1.0-blocking gaps in the logging / diagnostics pipeline

Addresses every "must ship before v1.0" item surfaced by the adversarial review, plus a handful of close-to-free UX polish.

**Main-process hardening:**
- Boot-phase dialog now gates on `app.isReady()` — calling `dialog.showMessageBoxSync` before the framework is ready on Win/Linux is undefined; if we're pre-ready we write the path to stderr instead and let the user find the boot-errors.log manually.
- Post-init listeners (`app.on('activate', …)`) now route `createWindow()` throws through the same boot-fallback writer + gated dialog instead of silently swallowing.
- `reported-fingerprints.json` writes are atomic (`writeFileSync(tmp) → renameSync`) so a crash between truncate and write, or two concurrent Electron instances, can no longer clobber the file.
- Redaction regex in `summary.md` generation now covers Windows drive-letter, UNC, `~/…`, `/root`, `/opt`, `/Applications`; URL regex adds `wss?:` and `file:`. Negative test guards against false-positives on dates and ratios.

**Renderer polish:**
- Unread-error badge `lastReadTs` is now persisted via the preferences IPC, so marking diagnostics read survives a restart.
- Error toasts cap at 3 — a new error drops the oldest to prevent the viewport filling with sticky stacks.
- Badge above 99 renders as `99+` so the TopBar doesn't widen unboundedly.
- Report dialog's four redaction toggles now carry inline hints explaining what each one reveals.

**Internal:**
- `providerContext` store extracted into its own module with direct test coverage.
