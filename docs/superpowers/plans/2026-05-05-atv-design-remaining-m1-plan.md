# ATV Design Remaining M1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining M1 gaps by auto-migrating legacy `open-codesign` config/auth state, shipping the preserved `ui-ux-pro-max` bundle inside packaged desktop builds, wiring GitHub Copilot OAuth into the desktop runtime, aligning docs, and proving the flow with a real design-system plus mock banking app generation pass.

**Architecture:** Keep the current single generation stack. Do not add a second completion path for Copilot. Instead, resolve a refreshed Copilot session token as the active bearer credential, reuse the existing `openai-chat` wire plus Copilot-specific headers, and let the existing generation / connection / model-selection plumbing do the rest. Handle legacy migration once at boot by reading `~/.config/open-codesign/` only when the new `~/.config/atv-design/` state is absent, then copy forward config and OAuth sidecars into the rebranded location.

**Tech Stack:** pnpm workspace, Turborepo, Electron, React, strict TypeScript, Vitest, Biome, PowerShell, Python helper scripts under `skills/ui-ux-pro-max/`

---

## File Map

- `apps/desktop/src/main/config.ts`
  Read/write config, choose active config dir, and perform legacy-dir migration.
- `apps/desktop/src/main/config.test.ts`
  New focused tests for legacy migration and sidecar copy behavior.
- `apps/desktop/src/main/onboarding-ipc.ts`
  Boot-time config loading seam; should pick up migrated config transparently.
- `apps/desktop/electron-builder.yml`
  Package the preserved `skills/ui-ux-pro-max/` bundle as app resources.
- `packages/shared/src/config.ts`
  Shared provider ids/capabilities for Copilot and shared config parsing helpers.
- `packages/shared/src/config.test.ts`
  Shared config/provider capability tests for Copilot constants and capability defaults.
- `apps/desktop/src/main/copilot-oauth-ipc.ts`
  New main-process GitHub Copilot OAuth bridge, token-store access, provider persistence, and login/logout IPC.
- `apps/desktop/src/main/copilot-oauth-ipc.test.ts`
  Main-process happy-path/cancel/error/logout tests for the Copilot bridge.
- `apps/desktop/src/main/resolve-api-key.ts`
  Active credential resolution; must recognize Copilot session tokens alongside ChatGPT Codex OAuth.
- `apps/desktop/src/main/resolve-api-key.test.ts`
  Regression coverage for Copilot credential resolution.
- `apps/desktop/src/main/provider-settings.ts`
  Keyless-provider row rendering and active-provider resolution.
- `apps/desktop/src/main/provider-settings.test.ts`
  Coverage for Copilot provider rows and keyless handling.
- `apps/desktop/src/main/connection-ipc.ts`
  Stored-provider connection tests and model discovery; Copilot should flow through static hints + inference probing.
- `apps/desktop/src/main/connection-ipc.credentials.test.ts`
  Stored-credential resolution tests for Copilot.
- `apps/desktop/src/main/index.ts`
  Register Copilot IPC and keep generation path on the existing shared stack.
- `apps/desktop/src/preload/index.ts`
  Expose Copilot OAuth bridge to the renderer.
- `apps/desktop/src/renderer/src/components/CopilotLoginCard.tsx`
  New Settings card for GitHub Copilot sign-in/out.
- `apps/desktop/src/renderer/src/components/CopilotLoginCard.test.tsx`
  Renderer behavior tests for fetch/login/logout/error states.
- `apps/desktop/src/renderer/src/components/Settings.tsx`
  Mount the Copilot card and refresh provider rows after auth changes.
- `apps/desktop/src/renderer/src/components/Settings.test.ts`
  Minimal settings integration assertion if the existing coverage needs a new branch.
- `packages/i18n/src/locales/en.json`
- `packages/i18n/src/locales/zh-CN.json`
  Localized strings for the new Copilot card and any updated docs copy.
- `packages/core/src/skills/builtin/uipromax-*.md`
  Remove stale “source-checkout only” wording once packaged bundle parity is true.
- `README.md`
- `docs/known-issues.md`
- `docs/oauth-setup.md`
  Update M1 truth and testing instructions.

## Task 1: Auto-Migrate Legacy Config And OAuth Sidecars

**Files:**
- Modify: `apps/desktop/src/main/config.ts`
- Create: `apps/desktop/src/main/config.test.ts`
- Test: `apps/desktop/src/main/config.test.ts`

- [ ] **Step 1: Write failing migration tests**

Cover these cases:

```ts
it('reads legacy open-codesign config when atv-design config is absent', async () => {});
it('copies config.toml and known auth sidecars into the new config dir once', async () => {});
it('prefers the new atv-design config when both dirs exist', async () => {});
it('does not overwrite an existing new-path sidecar during migration', async () => {});
```

- [ ] **Step 2: Run the focused test file and confirm failure**

Run:

```powershell
pnpm --filter @atv-design/desktop test -- config.test.ts
```

Expected: missing legacy-fallback behavior.

- [ ] **Step 3: Implement legacy-dir discovery and one-shot migration**

Implement in `config.ts`:

```ts
const LEGACY_CONFIG_DIR_NAMES = ['open-codesign'];
const LEGACY_SIDECAR_FILES = ['codex-auth.json', 'copilot-auth.json'];
```

Behavior:
- new path remains `~/.config/atv-design`
- if `atv-design/config.toml` exists, use it
- else if `open-codesign/config.toml` exists, read it, write the parsed config back to the new path, and copy any known sidecars that are present and not already migrated
- keep legacy files in place; migration is copy-forward, not destructive

- [ ] **Step 4: Re-run the focused migration tests**

Run:

```powershell
pnpm --filter @atv-design/desktop test -- config.test.ts
```

Expected: PASS.

## Task 2: Ship The Preserved `ui-ux-pro-max` Bundle In Packaged Desktop Builds

**Files:**
- Modify: `apps/desktop/electron-builder.yml`
- Modify: `packages/core/src/skills/builtin/uipromax-banner-design.md`
- Modify: `packages/core/src/skills/builtin/uipromax-brand.md`
- Modify: `packages/core/src/skills/builtin/uipromax-core.md`
- Modify: `packages/core/src/skills/builtin/uipromax-design-system.md`
- Modify: `packages/core/src/skills/builtin/uipromax-design.md`
- Modify: `packages/core/src/skills/builtin/uipromax-slides.md`
- Modify: `packages/core/src/skills/builtin/uipromax-ui-styling.md`
- Modify: `docs/known-issues.md`
- Test: `packages/core/src/skills/loader.test.ts`
- Test: packaged desktop output inspection in Task 5

- [ ] **Step 1: Confirm the current limitation copy is still present**

Run:

```powershell
git grep -n "Packaged M1 apps currently ship this flattened builtin entrypoint only\|source-checkout helper today" -- packages/core/src/skills/builtin docs/known-issues.md
```

Expected: matches in the `uipromax-*` preambles and `docs/known-issues.md`.

- [ ] **Step 2: Add packaged-resource copying**

Update `electron-builder.yml` to copy the preserved source bundle into resources, for example:

```yaml
extraResources:
  - from: ../../skills/ui-ux-pro-max
    to: skills/ui-ux-pro-max
```

- [ ] **Step 3: Update skill/docs wording to match reality**

Replace the stale packaged-build warning with copy that says the preserved bundle ships in both source and packaged desktop builds, while the flattened builtin entrypoints remain the loader-facing surface.

- [ ] **Step 4: Re-run the focused loader test**

Run:

```powershell
pnpm --filter @atv-design/core test -- loader.test.ts
```

Expected: PASS.

## Task 3: Wire GitHub Copilot Into The Desktop Main Process And Shared Provider Model

**Files:**
- Modify: `packages/shared/src/config.ts`
- Modify: `packages/shared/src/config.test.ts`
- Create: `apps/desktop/src/main/copilot-oauth-ipc.ts`
- Create: `apps/desktop/src/main/copilot-oauth-ipc.test.ts`
- Modify: `apps/desktop/src/main/resolve-api-key.ts`
- Modify: `apps/desktop/src/main/resolve-api-key.test.ts`
- Modify: `apps/desktop/src/main/provider-settings.ts`
- Modify: `apps/desktop/src/main/provider-settings.test.ts`
- Modify: `apps/desktop/src/main/connection-ipc.credentials.test.ts`
- Modify: `apps/desktop/src/main/index.ts`
- Test: all files above

- [ ] **Step 1: Write/extend failing backend tests**

Add failing coverage for:

```ts
it('resolves github-copilot via a refreshed Copilot session token', async () => {});
it('surfaces Copilot as a keyless provider row once signed in', async () => {});
it('registers / login / logout persist the Copilot provider entry', async () => {});
it('connection credential resolution uses the Copilot session token path', async () => {});
```

- [ ] **Step 2: Run the targeted backend tests and confirm failure**

Run:

```powershell
pnpm --filter @atv-design/desktop test -- resolve-api-key.test.ts provider-settings.test.ts connection-ipc.credentials.test.ts copilot-oauth-ipc.test.ts
pnpm --filter @atv-design/shared test -- config.test.ts
```

Expected: failures due to missing Copilot provider id / IPC / credential handling.

- [ ] **Step 3: Implement the Copilot provider contract**

Required behavior:
- add shared `GITHUB_COPILOT_PROVIDER_ID`
- persist provider entry with:
  - `wire: 'openai-chat'`
  - `baseUrl: 'https://api.githubcopilot.com'`
  - static `modelsHint` from the existing Copilot registry/current supported set
  - `requiresApiKey: false`
  - Copilot headers in `httpHeaders`:

```ts
{
  'Editor-Version': 'atv-design/<app-version>',
  'Copilot-Integration-Id': 'vscode-chat',
}
```

- use the existing GitHub OAuth access token only to refresh a Copilot session token
- generation / connection tests must use the Copilot **session token** as the bearer credential
- do not build a Copilot-only generate path; reuse the generic active-provider stack

- [ ] **Step 4: Register the new IPC module**

Hook `registerCopilotOAuthIpc()` into `apps/desktop/src/main/index.ts`.

- [ ] **Step 5: Re-run the targeted backend tests**

Run:

```powershell
pnpm --filter @atv-design/desktop test -- resolve-api-key.test.ts provider-settings.test.ts connection-ipc.credentials.test.ts copilot-oauth-ipc.test.ts
pnpm --filter @atv-design/shared test -- config.test.ts
```

Expected: PASS.

## Task 4: Expose GitHub Copilot In Preload, Settings, And I18n

**Files:**
- Modify: `apps/desktop/src/preload/index.ts`
- Create: `apps/desktop/src/renderer/src/components/CopilotLoginCard.tsx`
- Create: `apps/desktop/src/renderer/src/components/CopilotLoginCard.test.tsx`
- Modify: `apps/desktop/src/renderer/src/components/Settings.tsx`
- Modify: `apps/desktop/src/renderer/src/components/Settings.test.ts`
- Modify: `packages/i18n/src/locales/en.json`
- Modify: `packages/i18n/src/locales/zh-CN.json`

- [ ] **Step 1: Mirror the ChatGPT card coverage with a failing Copilot card test**

Cover:
- initial status fetch
- login success
- login error toast
- logout confirmation
- row refresh callback after auth mutation

- [ ] **Step 2: Run the targeted renderer tests and confirm failure**

Run:

```powershell
pnpm --filter @atv-design/desktop test -- ChatgptLoginCard.test.tsx CopilotLoginCard.test.tsx Settings.test.ts
```

Expected: Copilot tests fail until the new preload API and card exist.

- [ ] **Step 3: Implement the preload API and settings card**

Mirror the existing `codexOAuth` surface with a `copilotOAuth` surface and mount a new `CopilotLoginCard` next to `ChatgptLoginCard`.

- [ ] **Step 4: Add localized copy**

Add matching string groups under:

```json
"settings": {
  "providers": {
    "copilotLogin": { ... }
  }
}
```

- [ ] **Step 5: Re-run the targeted renderer tests**

Run:

```powershell
pnpm --filter @atv-design/desktop test -- ChatgptLoginCard.test.tsx CopilotLoginCard.test.tsx Settings.test.ts
```

Expected: PASS.

## Task 5: Align Docs And Prove The Flow End To End

**Files:**
- Modify: `README.md`
- Modify: `docs/known-issues.md`
- Modify: `docs/oauth-setup.md`
- Output evidence under a temporary workspace outside the repo or a dedicated ignored folder

- [ ] **Step 1: Remove the stale M1 limitation callouts**

Update docs so they no longer claim:
- no auto-migration from `~/.config/open-codesign/`
- packaged apps miss the preserved `ui-ux-pro-max` bundle
- GitHub Copilot desktop auth is unsupported

- [ ] **Step 2: Run full repo verification**

Run:

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm --filter @atv-design/desktop build:dir
```

Expected: all commands exit 0.

- [ ] **Step 3: Inspect the packaged output for the preserved bundle**

Run a packaged-output check against the build directory produced above and confirm `skills/ui-ux-pro-max/` exists under app resources.

- [ ] **Step 4: Generate a real banking design system artifact**

Run:

```powershell
py -3 skills/ui-ux-pro-max/scripts/search.py "mock banking mobile dashboard trustworthy fintech" --design-system --persist -p "Mock Banking" --page dashboard
```

Expected artifacts:
- `design-system/mock-banking/MASTER.md`
- `design-system/mock-banking/pages/dashboard.md`

- [ ] **Step 5: Run a real generation pass for a mock banking app**

Use the actual configured provider stack (prefer GitHub Copilot once wired) to generate a new mock banking app into a real workspace. Minimum evidence:
- generated `index.html`
- any emitted `assets/*`
- runtime verification result (host verifier or equivalent artifact validation)
- the exact provider + model used

If the desktop GUI path is not automatable in-repo, drive the same generation stack programmatically via the exported core/main generate path with real credentials and the linked design-system context.

- [ ] **Step 6: Record evidence in the final report**

Report:
- changed files
- verification commands and their exit status
- generated design-system paths
- generated banking-app workspace paths
- remaining risks, if any
