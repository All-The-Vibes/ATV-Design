# ATV Design M1 Convergence Design

Date: 2026-05-04
Status: Approved design captured from the current session
Branch: `codex/atv-design-m1`

## Goal

Finish the M1 fork mission by converging this repository into a coherent
`atv-design` product built on `OpenCoworkAI/open-codesign`, with:

- a full internal and user-facing `atv-design` rebrand
- GitHub Copilot OAuth retained and normalized as a first-class provider
- the existing built-in skill surfaces preserved
- `emil-design-eng-inspired` preserved
- a full additive `ui-ux-pro-max` port shipped in a loader-compatible form
- repository docs, tests, and CI aligned with the actual shipped state

## Context

The repository is already beyond the initial fork stage. It contains:

- working GitHub Copilot provider and OAuth code under
  `packages/providers/src/copilot-sdk/`
- existing additive skill work, including
  `skills/emil-design-eng-inspired/`
- partial or adapted `uipromax-*` built-in skill files under
  `packages/core/src/skills/builtin/`
- stale or contradictory docs that still describe earlier phases as pending
- incomplete internal rebrand work, with workspace packages and filters still
  using `@open-codesign/*` and `open-codesign-website`

This is not a greenfield build. It is a convergence pass that must finish the
fork cleanly without regressing the current codebase.

## Repo Facts That Shape The Design

### 1. Full internal rebrand is required

User-facing naming alone is not sufficient. M1 requires the fork to read as
`atv-design` throughout the repository wherever practical, including:

- workspace package names
- intra-workspace dependency names
- package-manager filters and scripts
- repository metadata and homepage URLs
- Electron/app identity strings
- config paths and docs references

Attribution and provenance references to upstream `open-codesign` remain where
they describe origin, license, or source material rather than current product
identity.

### 2. `ui-ux-pro-max` must be additive, not a replacement

The existing built-in skills and the current design-oriented skill surfaces are
already valuable and must remain intact. `ui-ux-pro-max` is an additional
bundled capability, not a wholesale replacement for the host skill system.

### 3. The skill loader is flat and non-recursive

`docs/skill-loader.md` confirms that the current loader only discovers
top-level `*.md` files from:

- project: `<project>/.codesign/skills/`
- user: `~/.config/atv-design/skills/`
- builtin: `packages/core/src/skills/builtin/`

It does not recurse into nested bundle directories. That means a literal port
shaped like `skills/ui-ux-pro-max/SKILL.md` would not load.

Therefore the M1 design must preserve the full `ui-ux-pro-max` content while
adapting its entrypoints to the host loader's flat discovery model.

### 4. Copilot OAuth should use the loopback flow as the source of truth

The current provider implementation uses a loopback HTTP callback server.
Stale docs still reference a custom URL scheme. M1 should treat the implemented
loopback flow as canonical and update docs/ADR language to match it unless a
code-level gap proves otherwise.

## Design Decisions

### Decision 1: Converge all practical product identity to `atv-design`

The repository will move from mixed branding to a single product identity.

This includes:

- root package metadata
- workspace package names from `@open-codesign/*` to `@atv-design/*`
- website package naming from `open-codesign-website` to an `atv-design`
  equivalent
- import specifiers, workspace references, filters, scripts, and tests affected
  by those package renames
- desktop app/repo metadata, URLs, config-path language, and onboarding copy

This work is intentionally broad because the user explicitly requested a full
internal rebrand, not just a cosmetic one.

### Decision 2: Keep the current Copilot provider path and normalize it

The Copilot implementation already exists and tests pass. M1 will not redesign
that provider; it will normalize it.

Normalization means:

- align naming, labels, docs, and config references with `atv-design`
- remove stale docs that still describe pre-implementation phases
- ensure OAuth documentation matches the loopback callback implementation
- verify provider behavior still passes existing tests after the rebrand

### Decision 3: Ship `ui-ux-pro-max` as a full additive bundle with a
compatibility entry layer

The source bundle should be preserved as fully as practical, including
supporting data and documentation, but the discovery layer must match the host
loader.

The preferred M1 shape is:

- discovery-compatible top-level builtin skill files under
  `packages/core/src/skills/builtin/` with stable `uipromax-*` naming
- a preserved source/provenance bundle under `skills/ui-ux-pro-max/` holding
  supporting data, templates, scripts, README text, and license-facing metadata
- source/provenance notes that clearly map the ported files back to the
  upstream `ui-ux-pro-max-skill` origins

This satisfies the "full standalone port" intent while respecting the loader
contract instead of pretending the host supports nested `SKILL.md` bundles.

### Decision 4: Preserve and normalize the existing additive skills

`emil-design-eng-inspired` remains part of the shipped skill surface.
If loader compatibility requires moving or flattening its entry file, that is a
compatibility adaptation, not a product change.

Existing built-in skill behavior should remain available throughout the M1
convergence work. Any `ui-ux-pro-max` additions must be non-breaking.

### Decision 5: Docs must describe code reality, not roadmap history

After the code and naming are converged, docs must be rewritten to match what
actually ships.

This includes at minimum:

- `README.md`
- `.omc/HANDOFF.md`
- `docs/known-issues.md`
- `docs/oauth-setup.md`
- `docs/adr/0001-byok-oauth-posture.md` if it still describes the wrong callback
  posture
- attribution and licensing references when the `ui-ux-pro-max` port shape is
  finalized

## Execution Boundaries

Implementation is split into five bounded lanes:

### Lane 1: Rebrand convergence

Converge naming and identifiers across:

- root and workspace package manifests
- workspace dependency references
- scripts, filters, and build tooling references
- app metadata and visible strings
- repository/homepage metadata
- config-path and docs references

### Lane 2: Copilot provider normalization

Keep the existing GitHub Copilot provider implementation and ensure:

- naming and docs match `atv-design`
- stale assumptions about callback style are removed
- tests continue to prove the provider behavior

### Lane 3: Additive `ui-ux-pro-max` completion

Finish the additive port by:

- auditing what is already present in `uipromax-*` files
- filling missing source content where the current port is incomplete
- storing the full preserved source bundle under `skills/ui-ux-pro-max/`
- adding supporting data/assets/scripts/templates where compatible
- keeping provenance, license, and README metadata intact
- making sure the final entrypoints are loader-compatible

### Lane 4: Repository truth cleanup

Remove contradictions between the shipped code and the docs/handoff material.
The repository should not simultaneously say Phase 1b is shipped and not
started, or claim CI smoke is missing when it already exists.

### Lane 5: Verification and stabilization

Run and fix fallout from:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- build/package smoke already supported by the repo

No lane is complete until its verification evidence exists.

## Non-Goals

The M1 convergence pass does not include:

- a broad redesign of the upstream product direction beyond the fork mission
- replacing the host skill system with `ui-ux-pro-max`
- new hosted services, new telemetry, or a departure from the local-first/BYOK
  posture
- unrelated refactors outside the convergence lanes above

## Acceptance Criteria

M1 is complete when all of the following are true:

1. A fresh clone reads as `atv-design` both externally and internally, except
   where `open-codesign` must remain for provenance or attribution.
2. Workspace package names and references have been rebranded to the final
   internal naming scheme and the repo still builds/tests.
3. GitHub Copilot OAuth remains functional in code and accurately documented
   under the `atv-design` identity.
4. Existing built-in skills still load and remain usable.
5. `emil-design-eng-inspired` remains usable in a loader-compatible location.
6. `ui-ux-pro-max` is present as a full additive bundled capability, with
   compatibility adaptations required by the current loader model, flattened
   builtin entrypoints, and a preserved source/provenance bundle under
   `skills/ui-ux-pro-max/`.
7. README, handoff, ADR/security docs, and known-issues pages no longer
   contradict the codebase.
8. The repo passes lint, typecheck, test, and build/package smoke appropriate
   to the currently wired CI/runtime flows.

## Testing And Verification Strategy

Verification should scale with each lane:

- Rebrand lane: targeted grep/inventory plus full lint/typecheck/test/build to
  catch broken specifiers and filters.
- Copilot lane: existing provider tests and any affected desktop/provider
  integration tests.
- Skill lane: loader-facing tests where available, plus structural verification
  that all ported entry files sit in discovery-compatible locations.
- Docs lane: no contradictions against code reality after the implementation is
  known.
- Final gate: repo-wide `pnpm lint`, `pnpm typecheck`, `pnpm test`, and build
  smoke.

## Risks And Mitigations

### Risk: Rebrand churn breaks imports or workspace filters

Mitigation: do the rename as a systematic package-graph pass, not as scattered
string edits, and run full repo verification immediately after.

### Risk: "Full standalone port" conflicts with the actual loader contract

Mitigation: preserve the bundle content, but adapt the discovery surface to the
flat loader model explicitly and document that compatibility layer.

### Risk: Docs get updated before code reality is known

Mitigation: docs are a late convergence lane, not the first move.

### Risk: Existing valuable skills regress while porting `ui-ux-pro-max`

Mitigation: additive integration only; preserve existing built-ins and
`emil-design-eng-inspired` as a hard requirement.

## Summary

This design treats M1 as a convergence project:

- finish the full `atv-design` rebrand
- keep and normalize GitHub Copilot OAuth
- ship `ui-ux-pro-max` as a complete additive capability in a host-compatible
  shape
- make the repository tell the truth about what now exists
- prove completion with repository-level verification
