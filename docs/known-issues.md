# Known Issues

## Current M1 realities

- The default GitHub Copilot OAuth path depends on a maintainer-controlled public client ID. Use `ATV_DESIGN_GITHUB_CLIENT_ID` if you need ATV Design to authenticate with your own OAuth app instead.
- Local packaging stays unsigned by default. Release CI now supports credential-gated code signing and macOS notarization, but wider installer polish is still M2 work.
- The Copilot client-ID override is env-only today; there is no dedicated UI field in the app yet.

## Comment Mode

Inline element comments are shipped but easy to miss. The entry point is the **Comment mode** toggle at the right end of the preview toolbar (`MessageSquare` icon).

The actual flow is **staged, not instant**:

1. Click **Comment mode** in the preview toolbar to enter element-selection mode.
2. Click any element in the rendered preview — a pin drops and an inline composer bubble opens anchored to that element.
3. Type your note and submit. The comment is saved as a *pending edit* — the model does **not** regenerate yet.
4. A chip appears in the **CommentChipBar** above the prompt composer.
5. Click **Apply** on the chip bar to flush all pending edits in one batch. The model rewrites the artifact using the staged comments as enriched prompt context (`buildEnrichedPrompt`).

Why staged instead of instant: lets you collect multiple changes across the artifact before paying one regeneration round-trip. Each chip has an `×` to discard individual edits without applying.

### Known limitations

- **SQLite dependency.** The Comment Mode IPC handlers (`comments:v1:*`) read and write directly to the v0.1 `designs.db` SQLite database. If `safeInitSnapshotsDb` fails at boot, the handlers register as unavailable and Comment Mode silently no-ops. A Phase B migration to the JSON sidecar at `<workspacePath>/<designId>/.codesign/comments.json` is planned — the sidecar is already written fire-and-forget on every comment create via `snapshots-db.appendComment(...).catch(...)`, but reads still hit SQLite.
- **Anchor drift on major regenerations.** Comments are anchored by CSS selector + outerHTML fingerprint. When the model significantly restructures the DOM (renames classes, reorders sections, swaps tag types), pins can lose their target. The chip remains pending and the pin disappears from the preview — you can still apply, but the model only has the original `outerHTML` snapshot as context.

## Brand & web capture

- `read_brand` with `kind: 'image'` is best-effort — extraction quality depends on the vision capability of the configured model. Prefer `kind: 'url'` or `kind: 'repo'` when possible (they parse computed CSS or design-token files directly).
- Both `read_brand` and the new `capture_element` tool require **system Chrome** discoverable via the shared `findSystemChrome()` (PATH, default install paths, or `CODESIGN_CHROME_PATH` env override). They do not bundle Chromium (HC #1).
