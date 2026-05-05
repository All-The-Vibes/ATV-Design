# ATV Design M1 Convergence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the M1 fork mission by delivering a fully rebranded `atv-design` repository with normalized GitHub Copilot OAuth, a complete additive `ui-ux-pro-max` bundle, and repo/docs/CI truth aligned to the shipped code.

**Architecture:** The work is a convergence pass, not a greenfield build. The implementation proceeds in bounded lanes: rename the workspace package graph, rename import/runtime identity surfaces, rebrand repo/site metadata, complete the additive skill bundle in a loader-compatible shape, then reconcile docs and verification. `ui-ux-pro-max` is additive and preserved as a source bundle under `skills/ui-ux-pro-max/`, while flattened builtin skill entrypoints remain the loader-facing runtime surface.

**Tech Stack:** pnpm workspace, Turborepo, Electron, Vite, React, Tailwind, strict TypeScript, Vitest, Biome, PowerShell, git worktree on `codex/atv-design-m1`

---

## File Map

- `package.json`
  Root scripts, root workspace dev dependencies, docs filter rename, release commands.
- `apps/desktop/package.json`
  Desktop package name and workspace dependency edges.
- `packages/*/package.json`
  Internal package names and intra-workspace references.
- `website/package.json`
  Website package identity for `pnpm --filter`.
- `.github/workflows/*.yml`
  Package filters, release repo guards, website build target names.
- `apps/**` and `packages/**` files containing `@open-codesign/`
  Internal import specifiers and package-entry comments.
- `apps/desktop/src/main/diagnostics-ipc.ts`, `apps/desktop/src/main/diagnostics-ipc.test.ts`, `apps/desktop/src/main/open-external.test.ts`, `packages/exporters/src/html.ts`, `packages/exporters/src/zip.ts`
  Runtime repo URLs and generated product strings.
- `website/.vitepress/config.ts`, `website/.vitepress/theme/SmartDownload.vue`, `website/**/*.md`, `website/public/*`
  Public-facing brand/repo/release links and product naming.
- `skills/ui-ux-pro-max/**`
  Preserved additive source bundle copied from upstream `ui-ux-pro-max-skill`.
- `packages/core/src/skills/builtin/uipromax-*.md`
  Loader-facing flattened entrypoints that reference the preserved bundle.
- `packages/core/src/skills/loader.test.ts`
  Builtin bundle verification.
- `.gitignore`
  Tracking rules for `docs/oauth-setup.md` and `docs/known-issues.md`.
- `README.md`, `docs/adr/0001-byok-oauth-posture.md`, `docs/skill-loader.md`, `.omc/HANDOFF.md`
  Product truth and migration from stale phase language.
- `docs/oauth-setup.md`, `docs/known-issues.md`
  New tracked M1 support docs; currently present only as ignored local drafts in the main checkout.

### Package Rename Map

```text
@open-codesign/desktop    -> @atv-design/desktop
@open-codesign/artifacts  -> @atv-design/artifacts
@open-codesign/core       -> @atv-design/core
@open-codesign/exporters  -> @atv-design/exporters
@open-codesign/i18n       -> @atv-design/i18n
@open-codesign/providers  -> @atv-design/providers
@open-codesign/runtime    -> @atv-design/runtime
@open-codesign/shared     -> @atv-design/shared
@open-codesign/templates  -> @atv-design/templates
@open-codesign/ui         -> @atv-design/ui
open-codesign-website     -> atv-design-website
```

## Task 1: Rebrand Workspace Package Graph And Filters

**Files:**
- Modify: `package.json`
- Modify: `apps/desktop/package.json`
- Modify: `packages/artifacts/package.json`
- Modify: `packages/core/package.json`
- Modify: `packages/exporters/package.json`
- Modify: `packages/i18n/package.json`
- Modify: `packages/providers/package.json`
- Modify: `packages/runtime/package.json`
- Modify: `packages/shared/package.json`
- Modify: `packages/templates/package.json`
- Modify: `packages/ui/package.json`
- Modify: `website/package.json`
- Modify: `.github/workflows/ci.yml`
- Modify: `.github/workflows/deploy-website.yml`
- Modify: `.github/workflows/packaging-smoke.yml`
- Modify: `.github/workflows/release.yml`
- Test: `package.json`
- Test: `apps/desktop/package.json`
- Test: `packages/*/package.json`
- Test: `website/package.json`
- Test: `.github/workflows/*.yml`
- Test: `pnpm-lock.yaml`

- [ ] **Step 1: Record the failing package/filter inventory**

Run:

```powershell
git grep -n "@open-codesign\|open-codesign-website" -- package.json apps/desktop/package.json packages/*/package.json website/package.json .github/workflows
```

Expected: hits in root scripts, every workspace manifest, and workflow `pnpm --filter` commands.

- [ ] **Step 2: Update manifest names and workspace dependency edges**

Apply the rename map to every workspace manifest and the root devDependencies/scripts:

```powershell
$renameMap = @{
  '@open-codesign/desktop' = '@atv-design/desktop'
  '@open-codesign/artifacts' = '@atv-design/artifacts'
  '@open-codesign/core' = '@atv-design/core'
  '@open-codesign/exporters' = '@atv-design/exporters'
  '@open-codesign/i18n' = '@atv-design/i18n'
  '@open-codesign/providers' = '@atv-design/providers'
  '@open-codesign/runtime' = '@atv-design/runtime'
  '@open-codesign/shared' = '@atv-design/shared'
  '@open-codesign/templates' = '@atv-design/templates'
  '@open-codesign/ui' = '@atv-design/ui'
  'open-codesign-website' = 'atv-design-website'
}

$manifestPaths = @(
  'package.json',
  'apps/desktop/package.json',
  'packages/artifacts/package.json',
  'packages/core/package.json',
  'packages/exporters/package.json',
  'packages/i18n/package.json',
  'packages/providers/package.json',
  'packages/runtime/package.json',
  'packages/shared/package.json',
  'packages/templates/package.json',
  'packages/ui/package.json',
  'website/package.json'
)

foreach ($path in $manifestPaths) {
  $raw = Get-Content $path -Raw
  foreach ($key in $renameMap.Keys) {
    $raw = $raw.Replace($key, $renameMap[$key])
  }
  Set-Content $path $raw -NoNewline
}
```

The root `package.json` should end with:

```json
"scripts": {
  "docs:dev": "pnpm --filter atv-design-website dev",
  "docs:build": "pnpm --filter atv-design-website build",
  "docs:preview": "pnpm --filter atv-design-website preview"
},
"devDependencies": {
  "@atv-design/core": "workspace:*",
  "@atv-design/shared": "workspace:*"
}
```

- [ ] **Step 3: Update workflow filters and release guards**

Make the workflow package filters match the renamed packages:

```yaml
# .github/workflows/ci.yml
- name: Build smoke (electron-vite bundle)
  run: pnpm --filter @atv-design/desktop exec electron-vite build

# .github/workflows/deploy-website.yml
- name: Build website
  run: pnpm --filter atv-design-website build

# .github/workflows/packaging-smoke.yml
- name: Build workspace
  run: pnpm --filter '!@atv-design/desktop' -r build

- name: Package Linux (AppImage + deb + rpm)
  run: pnpm --filter @atv-design/desktop release

# .github/workflows/release.yml
if: github.repository == 'All-The-Vibes/ATV-Design'
```

- [ ] **Step 4: Refresh workspace metadata**

Run:

```powershell
pnpm install
```

Expected: workspace links and `pnpm-lock.yaml` are regenerated for the renamed package graph.

- [ ] **Step 5: Re-run the inventory check until it is clean**

Run:

```powershell
git grep -n "@open-codesign\|open-codesign-website" -- package.json apps/desktop/package.json packages/*/package.json website/package.json .github/workflows
```

Expected: no output.

- [ ] **Step 6: Commit**

```powershell
git add package.json pnpm-lock.yaml apps/desktop/package.json packages/*/package.json website/package.json .github/workflows/ci.yml .github/workflows/deploy-website.yml .github/workflows/packaging-smoke.yml .github/workflows/release.yml
git commit -m "chore: rename workspace package graph to atv-design" -m "Constraint: Full internal rebrand was explicitly requested`nScope-risk: broad`nDirective: Keep package names, workspace edges, and workflow filters in lockstep`nTested: package/filter inventory grep; pnpm install"
```

## Task 2: Rebrand Source Import Specifiers And Runtime Identity Strings

**Files:**
- Modify: every tracked file returned by `git grep -l "@open-codesign/" -- apps packages`
- Modify: `apps/desktop/src/main/diagnostics-ipc.ts`
- Modify: `apps/desktop/src/main/diagnostics-ipc.test.ts`
- Modify: `apps/desktop/src/main/open-external.test.ts`
- Modify: `packages/exporters/src/html.ts`
- Modify: `packages/exporters/src/zip.ts`
- Test: `apps/**`
- Test: `packages/**`

- [ ] **Step 1: Capture the failing import/runtime inventory**

Run:

```powershell
git grep -n "@open-codesign/" -- apps packages
git grep -n "OpenCoworkAI/open-codesign\|open-codesign-cache" -- apps packages
```

Expected: many import specifiers plus a few runtime identity strings still reference `open-codesign`.

- [ ] **Step 2: Replace import specifiers with the renamed package scope**

Run:

```powershell
$files = git grep -l "@open-codesign/" -- apps packages
foreach ($file in $files) {
  $content = Get-Content $file -Raw
  $content = $content.Replace('@open-codesign/', '@atv-design/')
  Set-Content $file $content -NoNewline
}
```

Representative results:

```ts
import { useT } from '@atv-design/i18n';
import type { Design } from '@atv-design/shared';
import { buildSrcdoc } from '@atv-design/runtime';
```

- [ ] **Step 3: Rebrand repo-local runtime literals that are not import specifiers**

Update the remaining internal identity strings:

```ts
// apps/desktop/src/main/diagnostics-ipc.ts
const GITHUB_REPO_URL = 'https://github.com/All-The-Vibes/ATV-Design';

// packages/exporters/src/html.ts
'Generated by atv-design — https://github.com/All-The-Vibes/ATV-Design';

// packages/exporters/src/zip.ts
This bundle was exported from [atv-design](https://github.com/All-The-Vibes/ATV-Design).
```

And rename any remaining local cache/test prefixes:

```text
/tmp/open-codesign-cache -> /tmp/atv-design-cache
open-codesign-codex-     -> atv-design-codex-
open-codesign-gemini-    -> atv-design-gemini-
open-codesign-opencode-  -> atv-design-opencode-
```

- [ ] **Step 4: Run the package-level correctness gates**

Run:

```powershell
pnpm typecheck
pnpm test
```

Expected: type and test failures, if any, now reflect real code issues instead of unresolved package imports.

- [ ] **Step 5: Re-run the import/runtime inventory**

Run:

```powershell
git grep -n "@open-codesign/" -- apps packages
git grep -n "OpenCoworkAI/open-codesign\|open-codesign-cache" -- apps packages
```

Expected: no output, except acceptable provenance text that intentionally remains outside `apps/` and `packages/`.

- [ ] **Step 6: Commit**

```powershell
git add apps packages
git commit -m "refactor: rebrand internal source imports and runtime identity" -m "Constraint: Package rename must remain internally coherent after the workspace graph migration`nScope-risk: broad`nDirective: Internal imports should never drift back to @open-codesign after this commit`nTested: pnpm typecheck; pnpm test; import/runtime inventory grep"
```

## Task 3: Rebrand Website, Issue Templates, And Public Repo Metadata

**Files:**
- Modify: `.github/ISSUE_TEMPLATE/bug_report.yml`
- Modify: `.github/ISSUE_TEMPLATE/config.yml`
- Modify: `.github/ISSUE_TEMPLATE/feature_request.yml`
- Modify: `README.md`
- Modify: `website/.vitepress/config.ts`
- Modify: `website/.vitepress/theme/SmartDownload.vue`
- Modify: `website/architecture.md`
- Modify: `website/bolt-alternative.md`
- Modify: `website/claude-design-alternative.md`
- Modify: `website/faq.md`
- Modify: `website/figma-ai-alternative.md`
- Modify: `website/index.md`
- Modify: `website/lovable-alternative.md`
- Modify: `website/public/llms-full.txt`
- Modify: `website/public/llms.txt`
- Modify: `website/public/og.svg`
- Modify: `website/quickstart.md`
- Modify: `website/v0-alternative.md`
- Modify: `website/zh/claude-design-alternative.md`
- Modify: `website/zh/faq.md`
- Modify: `website/zh/index.md`
- Modify: `website/zh/quickstart.md`
- Test: `.github/ISSUE_TEMPLATE/*`
- Test: `website/**`
- Test: `README.md`

- [ ] **Step 1: Record the failing public-surface inventory**

Run:

```powershell
git grep -n "OpenCoworkAI/open-codesign\|~/.config/open-codesign\|opencodesign" -- README.md .github/ISSUE_TEMPLATE website
```

Expected: upstream repo links, upstream product naming, and config-dir references still appear across public surfaces.

- [ ] **Step 2: Rebrand issue templates and GitHub destinations**

Apply the repo URL replacement:

```powershell
$repoFiles = @(
  '.github/ISSUE_TEMPLATE/bug_report.yml',
  '.github/ISSUE_TEMPLATE/config.yml',
  '.github/ISSUE_TEMPLATE/feature_request.yml'
)

foreach ($file in $repoFiles) {
  $content = Get-Content $file -Raw
  $content = $content.Replace('https://github.com/OpenCoworkAI/open-codesign', 'https://github.com/All-The-Vibes/ATV-Design')
  Set-Content $file $content -NoNewline
}
```

Expected result:

```yaml
url: https://github.com/All-The-Vibes/ATV-Design/issues
```

- [ ] **Step 3: Rebrand the website configuration and generated assets**

Update the core site settings:

```ts
// website/.vitepress/config.ts
const SITE_BASE = '/ATV-Design/';
title: 'ATV Design'
titleTemplate: ':title — ATV Design'
socialLinks: [{ icon: 'github', link: 'https://github.com/All-The-Vibes/ATV-Design' }]
```

And update the release/download URLs everywhere:

```text
https://github.com/OpenCoworkAI/open-codesign/releases
-> https://github.com/All-The-Vibes/ATV-Design/releases
```

- [ ] **Step 4: Rewrite README and website copy so it describes the fork truthfully**

Bring all user-facing product naming to `ATV Design`, while preserving explicit attribution to upstream in origin/license sections.

Representative README changes:

```md
| Config dir | `~/.config/open-codesign/` | `~/.config/atv-design/` |
| Skill bundles | 12 built-in design modules | 12 built-in modules + additive `ui-ux-pro-max` + `emil-design-eng-inspired` |
| OAuth scheme | (upstream's) | loopback HTTP `http://127.0.0.1:<random-port>/oauth-callback` |
```

Representative quickstart change:

```bash
git clone https://github.com/All-The-Vibes/ATV-Design.git atv-design
cd atv-design
```

- [ ] **Step 5: Build the website after the rename**

Run:

```powershell
pnpm --filter atv-design-website build
```

Expected: the VitePress build succeeds with the renamed package filter and updated site config.

- [ ] **Step 6: Commit**

```powershell
git add README.md .github/ISSUE_TEMPLATE website
git commit -m "docs: rebrand public website and repo metadata to ATV Design" -m "Constraint: Upstream attribution must remain explicit while current product identity becomes ATV Design`nScope-risk: moderate`nDirective: Keep public repo/release/support links pointed at the fork, not upstream, unless the text is explicit provenance`nTested: public-surface inventory grep; pnpm --filter atv-design-website build"
```

## Task 4: Complete The Additive `ui-ux-pro-max` Bundle

**Files:**
- Create: `skills/ui-ux-pro-max/README.md`
- Create: `skills/ui-ux-pro-max/LICENSE.txt`
- Create: `skills/ui-ux-pro-max/SKILL.md`
- Create: `skills/ui-ux-pro-max/data/**`
- Create: `skills/ui-ux-pro-max/scripts/**`
- Create: `skills/ui-ux-pro-max/templates/**`
- Create: `skills/ui-ux-pro-max/banner-design/SKILL.md`
- Create: `skills/ui-ux-pro-max/banner-design/references/**`
- Create: `skills/ui-ux-pro-max/brand/SKILL.md`
- Create: `skills/ui-ux-pro-max/brand/references/**`
- Create: `skills/ui-ux-pro-max/brand/scripts/**`
- Create: `skills/ui-ux-pro-max/brand/templates/**`
- Create: `skills/ui-ux-pro-max/design-system/SKILL.md`
- Create: `skills/ui-ux-pro-max/design-system/data/**`
- Create: `skills/ui-ux-pro-max/design-system/references/**`
- Create: `skills/ui-ux-pro-max/design-system/scripts/**`
- Create: `skills/ui-ux-pro-max/design-system/templates/**`
- Create: `skills/ui-ux-pro-max/design/SKILL.md`
- Create: `skills/ui-ux-pro-max/design/data/**`
- Create: `skills/ui-ux-pro-max/design/references/**`
- Create: `skills/ui-ux-pro-max/design/scripts/**`
- Create: `skills/ui-ux-pro-max/slides/SKILL.md`
- Create: `skills/ui-ux-pro-max/slides/references/**`
- Create: `skills/ui-ux-pro-max/ui-styling/LICENSE.txt`
- Create: `skills/ui-ux-pro-max/ui-styling/SKILL.md`
- Create: `skills/ui-ux-pro-max/ui-styling/canvas-fonts/**`
- Create: `skills/ui-ux-pro-max/ui-styling/references/**`
- Create: `skills/ui-ux-pro-max/ui-styling/scripts/**`
- Modify: `packages/core/src/skills/builtin/uipromax-banner-design.md`
- Modify: `packages/core/src/skills/builtin/uipromax-brand.md`
- Modify: `packages/core/src/skills/builtin/uipromax-core.md`
- Modify: `packages/core/src/skills/builtin/uipromax-design-system.md`
- Modify: `packages/core/src/skills/builtin/uipromax-design.md`
- Modify: `packages/core/src/skills/builtin/uipromax-slides.md`
- Modify: `packages/core/src/skills/builtin/uipromax-ui-styling.md`
- Modify: `packages/core/src/skills/loader.test.ts`
- Test: `packages/core/src/skills/loader.test.ts`

- [ ] **Step 1: Record the failing bundle inventory**

Run:

```powershell
git ls-files "skills/ui-ux-pro-max/**/*"
git grep -n "not ported in M1" -- packages/core/src/skills/builtin/uipromax*.md
```

Expected: no preserved bundle files are tracked yet, and builtin skill entrypoints still claim the support content was not ported.

- [ ] **Step 2: Clone the upstream bundle to a temp path and copy the preserved source bundle**

Run:

```powershell
$upstream = Join-Path $env:TEMP 'ui-ux-pro-max-skill-atv-m1'
if (Test-Path $upstream) { Remove-Item -LiteralPath $upstream -Recurse -Force }
git clone --depth 1 https://github.com/nextlevelbuilder/ui-ux-pro-max-skill.git $upstream

New-Item -ItemType Directory -Force 'skills/ui-ux-pro-max' | Out-Null
Copy-Item "$upstream/LICENSE" 'skills/ui-ux-pro-max/LICENSE.txt'
Copy-Item "$upstream/.claude/skills/ui-ux-pro-max/SKILL.md" 'skills/ui-ux-pro-max/SKILL.md'
Copy-Item "$upstream/src/ui-ux-pro-max/data" 'skills/ui-ux-pro-max/data' -Recurse
Copy-Item "$upstream/src/ui-ux-pro-max/scripts" 'skills/ui-ux-pro-max/scripts' -Recurse
Copy-Item "$upstream/src/ui-ux-pro-max/templates" 'skills/ui-ux-pro-max/templates' -Recurse
```

- [ ] **Step 3: Copy the auxiliary subskills and support assets that the flattened builtin entries rely on**

Run:

```powershell
$subskills = @('banner-design','brand','design-system','design','slides','ui-styling')
foreach ($name in $subskills) {
  New-Item -ItemType Directory -Force "skills/ui-ux-pro-max/$name" | Out-Null
  Copy-Item "$upstream/.claude/skills/$name/SKILL.md" "skills/ui-ux-pro-max/$name/SKILL.md"
}

Copy-Item "$upstream/.claude/skills/banner-design/references" "skills/ui-ux-pro-max/banner-design/references" -Recurse
Copy-Item "$upstream/.claude/skills/brand/references" "skills/ui-ux-pro-max/brand/references" -Recurse
Copy-Item "$upstream/.claude/skills/brand/scripts" "skills/ui-ux-pro-max/brand/scripts" -Recurse
Copy-Item "$upstream/.claude/skills/brand/templates" "skills/ui-ux-pro-max/brand/templates" -Recurse
Copy-Item "$upstream/.claude/skills/design-system/data" "skills/ui-ux-pro-max/design-system/data" -Recurse
Copy-Item "$upstream/.claude/skills/design-system/references" "skills/ui-ux-pro-max/design-system/references" -Recurse
Copy-Item "$upstream/.claude/skills/design-system/scripts" "skills/ui-ux-pro-max/design-system/scripts" -Recurse
Copy-Item "$upstream/.claude/skills/design-system/templates" "skills/ui-ux-pro-max/design-system/templates" -Recurse
Copy-Item "$upstream/.claude/skills/design/data" "skills/ui-ux-pro-max/design/data" -Recurse
Copy-Item "$upstream/.claude/skills/design/references" "skills/ui-ux-pro-max/design/references" -Recurse
Copy-Item "$upstream/.claude/skills/design/scripts" "skills/ui-ux-pro-max/design/scripts" -Recurse
Copy-Item "$upstream/.claude/skills/slides/references" "skills/ui-ux-pro-max/slides/references" -Recurse
Copy-Item "$upstream/.claude/skills/ui-styling/LICENSE.txt" "skills/ui-ux-pro-max/ui-styling/LICENSE.txt"
Copy-Item "$upstream/.claude/skills/ui-styling/canvas-fonts" "skills/ui-ux-pro-max/ui-styling/canvas-fonts" -Recurse
Copy-Item "$upstream/.claude/skills/ui-styling/references" "skills/ui-ux-pro-max/ui-styling/references" -Recurse
Copy-Item "$upstream/.claude/skills/ui-styling/scripts" "skills/ui-ux-pro-max/ui-styling/scripts" -Recurse
```

- [ ] **Step 4: Rewrite the flattened builtin entrypoints to acknowledge the preserved bundle**

Replace the stale “not ported in M1” note in every `uipromax-*.md` file with a live local bundle note:

```md
_Ported from https://github.com/nextlevelbuilder/ui-ux-pro-max-skill (MIT). The preserved source bundle, support data, scripts, templates, references, and font assets live under `skills/ui-ux-pro-max/`. The runtime loader uses this flattened builtin entrypoint file; the nested bundle is preserved for provenance and tool-friendly local lookup._
```

Also add a human-readable bundle README:

```md
# skills/ui-ux-pro-max

This directory preserves the additive `ui-ux-pro-max` source bundle for ATV Design.
The runtime loader still reads the flattened builtin skill entrypoints under
`packages/core/src/skills/builtin/uipromax-*.md`.
```

- [ ] **Step 5: Add a regression test that asserts the preserved bundle is shipped**

Extend `packages/core/src/skills/loader.test.ts` with a bundle-presence check:

```ts
it('ships the preserved ui-ux-pro-max bundle alongside the flattened builtin entrypoints', async () => {
  const repoRoot = fileURLToPath(new URL('../../../..', import.meta.url));
  await expect(access(join(repoRoot, 'skills/ui-ux-pro-max/SKILL.md'))).resolves.toBeUndefined();
  await expect(access(join(repoRoot, 'skills/ui-ux-pro-max/scripts/search.py'))).resolves.toBeUndefined();
  await expect(access(join(repoRoot, 'skills/ui-ux-pro-max/design-system/data/slide-layouts.csv'))).resolves.toBeUndefined();
});
```

- [ ] **Step 6: Run the targeted skill tests**

Run:

```powershell
pnpm --filter @atv-design/core test
git grep -n "not ported in M1" -- packages/core/src/skills/builtin/uipromax*.md
```

Expected: core tests pass and the stale “not ported in M1” note is gone.

- [ ] **Step 7: Commit**

```powershell
git add skills/ui-ux-pro-max packages/core/src/skills/builtin/uipromax-*.md packages/core/src/skills/loader.test.ts
git commit -m "feat: ship the additive ui-ux-pro-max source bundle" -m "Constraint: The current loader is flat and non-recursive, so the preserved nested bundle must remain additive while the flattened builtin entrypoints stay loader-facing`nScope-risk: moderate`nDirective: Keep the preserved source bundle and flattened uipromax entrypoints semantically aligned`nTested: pnpm --filter @atv-design/core test; stale-note inventory grep"
```

## Task 5: Track Missing Support Docs And Reconcile Repo Truth

**Files:**
- Modify: `.gitignore`
- Modify: `README.md`
- Modify: `docs/adr/0001-byok-oauth-posture.md`
- Modify: `docs/skill-loader.md`
- Modify: `.omc/HANDOFF.md`
- Create: `docs/oauth-setup.md`
- Create: `docs/known-issues.md`
- Test: `.gitignore`
- Test: `README.md`
- Test: `docs/adr/0001-byok-oauth-posture.md`
- Test: `docs/skill-loader.md`
- Test: `.omc/HANDOFF.md`
- Test: `docs/oauth-setup.md`
- Test: `docs/known-issues.md`

- [ ] **Step 1: Record the failing truth inventory**

Run:

```powershell
git ls-files docs
git grep -n "Phase 2 .* pending\|Phase 4 .* pending\|atvdesign://oauth-callback" -- README.md docs .omc/HANDOFF.md
```

Expected: `docs/oauth-setup.md` and `docs/known-issues.md` are missing from tracked docs, and public/docs surfaces still describe stale phase or redirect-uri state.

- [ ] **Step 2: Unignore the tracked M1 docs**

Add these lines to `.gitignore` immediately after the existing `!docs/skill-loader.md` rule:

```gitignore
!docs/oauth-setup.md
!docs/known-issues.md
```

- [ ] **Step 3: Create tracked `docs/oauth-setup.md` and `docs/known-issues.md`**

The OAuth setup doc must make loopback HTTP canonical:

```md
# GitHub Copilot OAuth Setup

## Default path
- Click **Sign in with GitHub**
- The app starts a one-shot loopback callback server on `http://127.0.0.1:<random-port>/oauth-callback`
- GitHub redirects back to that local URL after consent

## Self-registration
- Create your own OAuth app in GitHub developer settings
- Use loopback HTTP redirect URIs, not `atvdesign://oauth-callback`
- Paste your client ID into `~/.config/atv-design/config.toml`
```

The known-issues doc must describe current reality:

```md
# Known Issues

- No auto-migration from `~/.config/open-codesign/` to `~/.config/atv-design/`
- Default GitHub OAuth app dependency remains a maintainer-controlled risk
- Packaging/release polish beyond the current CI smoke is still M2 territory
```

- [ ] **Step 4: Rewrite stale phase and redirect-language in the tracked docs**

Update these facts:

```md
# README.md
> Status: GitHub Copilot OAuth shipped. Additive `ui-ux-pro-max` bundle shipped. M1 convergence is validated by the current repo state and verification gates.

# docs/adr/0001-byok-oauth-posture.md
Redirect URI: `http://127.0.0.1:<random-port>/oauth-callback`

# docs/skill-loader.md
The additive `ui-ux-pro-max` bundle is now preserved under `skills/ui-ux-pro-max/`, while the runtime entrypoints remain flattened under `packages/core/src/skills/builtin/`.

# .omc/HANDOFF.md
Add a top note that the April 30 pre-Phase snapshot is historical only and no longer reflects the current repository state.
```

- [ ] **Step 5: Re-run the truth inventory until the live docs match the code**

Run:

```powershell
git ls-files docs
git grep -n "Phase 2 .* pending\|Phase 4 .* pending\|atvdesign://oauth-callback" -- README.md docs .omc/HANDOFF.md
```

Expected: `docs/oauth-setup.md` and `docs/known-issues.md` are tracked, and stale live-doc language is gone.

- [ ] **Step 6: Commit**

```powershell
git add .gitignore README.md docs .omc/HANDOFF.md
git commit -m "docs: align repo truth with the shipped atv-design state" -m "Constraint: README and support docs must describe the implemented loopback OAuth flow and additive skill bundle, not the abandoned pre-implementation plan state`nScope-risk: moderate`nDirective: Keep live docs current; leave historical planning artifacts historical, but clearly marked as such`nTested: tracked-doc inventory; stale-phase/redirect grep"
```

## Task 6: Run Full Verification And Stabilize Fallout

**Files:**
- Modify: any files that fail lint, typecheck, test, or build smoke during this task
- Test: repository-wide

- [ ] **Step 1: Run lint and fix anything it reports**

Run:

```powershell
pnpm lint
```

Expected: zero Biome diagnostics. If there are failures, fix them before moving on.

- [ ] **Step 2: Run typecheck and fix anything it reports**

Run:

```powershell
pnpm typecheck
```

Expected: zero TypeScript errors. Fix every failure before moving on.

- [ ] **Step 3: Run the full test suite and fix anything it reports**

Run:

```powershell
pnpm test
```

Expected: all package tests pass on the renamed package graph and completed bundle layout.

- [ ] **Step 4: Run the build smokes that mirror current CI intent**

Run:

```powershell
pnpm --filter @atv-design/desktop exec electron-vite build
pnpm --filter atv-design-website build
pnpm --filter @atv-design/desktop build:dir
```

Expected: desktop bundle build passes, website build passes, and unpacked desktop packaging smoke succeeds.

- [ ] **Step 5: Run the residual identity audit**

Run:

```powershell
git grep -n "@open-codesign\|open-codesign-website\|~/.config/open-codesign\|opencodesign" -- . ":(exclude).omc/specs/*" ":(exclude).omc/plans/*" ":(exclude)NOTICE" ":(exclude)ATTRIBUTION.md"
git grep -n "OpenCoworkAI/open-codesign" -- . ":(exclude).omc/specs/*" ":(exclude).omc/plans/*" ":(exclude)NOTICE" ":(exclude)ATTRIBUTION.md"
```

Expected: only intentional provenance or historical references remain.

- [ ] **Step 6: Commit**

```powershell
git add .
git commit -m "test: verify and stabilize ATV Design M1 convergence" -m "Constraint: M1 is only complete once lint, typecheck, tests, and build smoke are green on the renamed repo`nScope-risk: broad`nDirective: Do not declare M1 done with unresolved fallout or stale identity residue outside intentional provenance`nTested: pnpm lint; pnpm typecheck; pnpm test; desktop build smoke; website build; desktop build:dir; residual identity audit"
```

## Self-Review Checklist

- Spec coverage: tasks exist for package graph rebrand, source/specifier rebrand, website/repo metadata, additive `ui-ux-pro-max` completion, doc truth cleanup, and full verification.
- Placeholder scan: no `TODO`, `TBD`, or “implement later” markers remain in the task instructions.
- Type consistency: the package rename map is used consistently as `@atv-design/*` and `atv-design-website`, and the preserved bundle path is consistently `skills/ui-ux-pro-max/`.
