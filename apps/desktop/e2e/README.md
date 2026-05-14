# E2E Test Suite — Open CoDesign Desktop

Playwright + Electron end-to-end tests for the `@atv-design/desktop` app.

## Running Tests

```bash
# From the repo root — builds the app first, then runs all E2E specs
pnpm test:e2e

# From the desktop package directly
pnpm --filter @atv-design/desktop test:e2e

# Skip the build (use if out/main/index.js already exists)
pnpm --filter @atv-design/desktop test:e2e:norebuild
```

The `test:e2e` script calls `pnpm build && node scripts/e2e-run.cjs`.

`scripts/e2e-run.cjs` is a thin cross-platform wrapper that sets
`PW_DISABLE_TS_ESM=1` **before** spawning the Playwright process via
`spawnSync`. This is necessary because:

> **Why `PW_DISABLE_TS_ESM=1`?**  
> Playwright 1.52 + Node 25's ESM loader conflict causes the Playwright
> process to hang silently unless `PW_DISABLE_TS_ESM=1` is in the environment
> at startup.  Setting it inside `playwright.config.ts` is too late — the
> loader runs before the config is evaluated.  The `e2e-run.cjs` wrapper
> injects it at the right moment and works on both Windows cmd.exe and bash
> (the Unix `VAR=value cmd` syntax does not work on Windows).

## Viewing the HTML Report

After a run, open the interactive HTML report:

```bash
pnpm --filter @atv-design/desktop exec playwright show-report
```

Or directly:
```bash
npx playwright show-report apps/desktop/playwright-report
```

## Screenshots

Every spec takes at least one screenshot during the test.  Screenshots land in:

```
apps/desktop/test-results/screenshots/<spec-name>-<scenario>.png
```

They are committed when meaningful (e.g. smoke-launch.png) and gitignored for
CI-generated runs (see `.gitignore`).

## State Isolation

Each test gets a **fresh temp directory** as its Electron `userData` path
(`ELECTRON_USER_DATA_DIR`).  The directory is deleted after the test completes.
This means:

- No test can read another test's config, sessions, or logs.
- No test modifies the developer's real `~/.config/atv-design/` directory.

## Fixtures

### `test` (base fixture — `e2e/fixtures/electron-app.ts`)

Launches Electron with an empty temp dir.  The app boots into the
**unauthenticated / first-launch state** (login cards visible).

Used by: `smoke.spec.ts`, `onboarding.spec.ts`

### `testOnboarded` (onboarded fixture)

Before Electron launches, calls `seedOnboardedPreferences(tempDir)` which
writes:

- `storage-settings.json` — redirects `configDir` into the temp dir
- `config.toml` — v3 config with the built-in `ollama` keyless provider

The keyless provider satisfies `isKeylessProviderAllowed()` so
`getOnboardingState()` returns `{ hasKey: true }`.  The renderer skips the
login-card gate and renders the full app shell.

**No real network calls are made** — the test suite never sends a prompt.

Used by: `main-window.spec.ts`, `sidebar.spec.ts`, `dialogs.spec.ts`,
`hub.spec.ts`, `workspace.spec.ts`, `model-switcher.spec.ts`,
`settings.spec.ts`

## Spec Files

| File | Fixture | Description |
|------|---------|-------------|
| `smoke.spec.ts` | `test` | App launches, no console errors, version exposed |
| `onboarding.spec.ts` | `test` | First-launch login cards visible |
| `main-window.spec.ts` | `testOnboarded` | TopBar, hub view default |
| `sidebar.spec.ts` | `testOnboarded` | Collapse, resize, new-design button |
| `dialogs.spec.ts` | `testOnboarded` | NewDesignDialog, Settings panel open/close |
| `hub.spec.ts` | `testOnboarded` | HubView renders, design grid or empty state |
| `workspace.spec.ts` | `testOnboarded` | PreviewPane in workspace view |
| `model-switcher.spec.ts` | `testOnboarded` | ModelSwitcher renders, opens list |
| `settings.spec.ts` | `testOnboarded` | Settings panel tabs, provider section, language toggle |
| `comments.spec.ts` | `testOnboarded` | **All skipped** — requires design session |
| `files.spec.ts` | `testOnboarded` | **All skipped** — requires workspace + design |

## Skip Policy

Tests that cannot find a selector without `data-testid` attributes are
marked `.skip()` with an explanatory comment rather than adding testids to
renderer source.  Testids are planned for Cycle 3.

## Cycle 3 TODO

- Add `data-testid` / `aria-label` to: sidebar collapse button, model
  switcher, hub tab bar, language toggle, new-design button
- Add DB-seeding fixture to bootstrap a real design session for comments,
  files, and workspace tests
- Extend `workspace.spec.ts` once `snapshots.createDesign` is exposed on
  the preload bridge
