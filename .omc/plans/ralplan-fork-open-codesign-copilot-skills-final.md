# RALPLAN: Fork open-codesign with Copilot SDK + Opinionated Skill Bundles

**Slug:** `fork-open-codesign-copilot-skills`
**Mode:** Consensus (RALPLAN-DR **deliberate**)
**Spec:** `.omc/specs/deep-dive-fork-open-codesign-copilot-skills.md`
**Trace:** `.omc/specs/deep-dive-trace-fork-open-codesign-copilot-skills.md`
**Generated:** 2026-04-30
**Status:** REVISION 1 — incorporates Architect pass-1 feedback. Awaiting Architect pass-2 + Critic.

---

## RALPLAN-DR Summary

### Principles (5)

1. **Compatibility before customization.** Verify open-codesign v0.1's actual extension surfaces empirically (skill loader, provider abstraction) before designing around them. Acceptance criterion A9 makes this load-bearing.
2. **Sanctioned auth only.** Use the documented Copilot SDK OAuth flow. Never call undocumented `copilot_internal` endpoints, even if reverse-engineered alternatives appear easier or expose more models. Encode this prohibition into the security review checklist so future contributors can't quietly regress it.
3. **License hygiene is non-negotiable.** ui-ux-pro-max ports verbatim with attribution; emil-design-eng is paraphrased only (no LICENSE on source). MIT requires preserving full license text from upstream open-codesign and ui-ux-pro-max in NOTICE — not just credits in ATTRIBUTION.md. Per-bundle READMEs in each `skills/<bundle>/` directory.
4. **BYOK end-to-end with one decision committed up front.** No shared secrets in the binary. Default to a fork-published *public* GitHub OAuth client ID with PKCE (no client secret); document self-registration as the privacy/sovereignty alternative. Decision committed in Phase 0 ADR — not deferred.
5. **Local dev demo over polish, with auth proven early.** M1 is a working `pnpm dev` round-trip. Risk-reduction sequencing must not push user-visible feature work past day 3. Auth + loader unknowns are gated *in parallel*, not serially.

### Decision Drivers (top 3)

1. **Legal defensibility.** Three external repos with three license postures (MIT, MIT, none). One bad attribution choice and the fork is unreleasable. MIT's notice-preservation requirement is mandatory, not optional.
2. **Empirical risk on two parallel unknowns.** Both the skill loader contract *and* the Copilot SDK OAuth posture (especially `gpt-4.1` tier availability + Electron deep-link cross-OS behavior) are unverified. Plan must front-load *both* in parallel.
3. **Cross-platform OAuth UX.** Electron URL-scheme registration differs sharply across macOS / Windows / Linux. Failing OAuth on the user's actual OS = M1 failure.

### Viable Options (>=2)

#### Option E — Two Parallel Gates, Convergence Before Ports (RECOMMENDED — replaces draft-1's Option A)

> Run loader probe and Copilot SDK provider scaffold in parallel as twin gates. Skill bundle ports begin only after *both* gates clear smoke tests.

**Phases:**
1. **Phase 0 — Bootstrap + BYOK ADR commit** (rebrand, NOTICE with full upstream MIT text, public-OAuth-client-ID-with-PKCE decision committed).
2. **Phase 1a (parallel) — Loader probe** → `docs/skill-loader.md` + probe SKILL.md round-trip.
3. **Phase 1b (parallel) — Copilot SDK provider scaffold** → OAuth round-trip + `gpt-4.1` chat completion on maintainer OS.
4. **Convergence gate.** Port work cannot begin until both 1a and 1b have passing smoke tests. If either fails, the dependent path pauses; the other continues to its endpoint.
5. **Phase 2 — ui-ux-pro-max bulk port** (mechanical, internally parallelizable).
6. **Phase 3 — emil-design-eng-inspired paraphrase** (sequential; requires care).
7. **Phase 4 — End-to-end smoke** (A5).
8. **Phase 5 — Repo health** (A10, including config migration note + cross-OS OAuth matrix).

**Pros:**
- Both load-bearing unknowns surface in week 1, not just one.
- User-visible feature work (auth round-trip) appears within 2 days, honoring Principle 5.
- Convergence gate forbids the deadlock-prone overlap that killed draft-1's Option B.
- Honors all five principles simultaneously.

**Cons:**
- Two engineers (or two parallel agent lanes) needed for Phase 1; serial fallback re-introduces draft-1's slow-start problem.
- Slightly more coordination overhead at the convergence gate.

#### Option A — Verify-First Sequencing (REJECTED in revision)

> Loader probe first, then everything else.

**Pros:** Single sequential gate; simplest coordination.

**Cons:**
- Defers auth risk that the trace already revised once (Lane 3 mid-interview revision is the empirical signal that auth is the higher-variance branch).
- No user-visible feature for ~1 day.
- Plan's own Pre-mortem Scenario 2 (Windows OAuth packaging break) is silently downgraded to "M2 known issue" rather than treated as load-bearing for M1.

**Invalidation rationale:** Architect's pass-1 review correctly identified that auth has empirically shifted under pressure (Trace Lane 3 was revised mid-interview when the user cited the official SDK docs); the loader unknown has not. Sequencing the lower-variance unknown first hides the higher-variance unknown longer than necessary.

#### Option B — Parallel Tracks From Day One (REJECTED, unchanged)

> Provider integration, loader probe, and skill ports concurrently with three workers from day one.

**Invalidation rationale:** Bulk port work in parallel with loader verification trades known schedule risk for unknown rework risk. Convergence gate in Option E captures the parallelism benefit without the deadlock risk. Option B remains rejected.

#### Option C — Defer Skill Bundles to M2 (REJECTED, unchanged)

> Ship M1 as just rebrand + Copilot provider; defer ui-ux-pro-max + emil to M2.

**Invalidation rationale:** Spec is the contract. User chose "Full bundle (max opinion)" in deep-dive Round 5. Re-opening the spec is out of scope for the planning skill.

---

## Pre-Mortem (Deliberate Mode — 4 Scenarios)

### Scenario 1: "Loader contract is incompatible — discovered when ports start failing"
**Failure mode:** v0.1's loader expects a non-Anthropic schema (custom YAML field, TypeScript registration call, hardcoded build manifest). Ported SKILL.md files are invisible at runtime.

**Mitigations:**
- Phase 1a's probe SKILL.md gate-test catches this before Phase 2 begins.
- A9 restated as gating: phase 1a cannot complete until `docs/skill-loader.md` exists *and* the probe SKILL.md is loaded successfully.
- Adapter or loader-patch path documented as a Phase 1a.5 step if needed.

### Scenario 2: "GitHub OAuth redirect breaks on Windows in production builds (works in dev)"
**Failure mode:** `atvdesign://oauth-callback` registers via `app.setAsDefaultProtocolClient` in `pnpm dev` but fails in packaged builds (Squirrel/NSIS installer registration not wired). M1 dev demo passes; first packaged build user gets stuck.

**Mitigations:**
- Non-Goal: M1 ships no binaries. Document this gap in `docs/known-issues.md`.
- Phase 1b uses `electron-deeplink` (battle-tested) not hand-rolled URL-scheme code.
- E1 acceptance includes a per-OS smoke matrix: maintainer OS mandatory; the other two documented as "manual smoke step expected" with `docs/oauth-setup.md` per-OS notes.
- Linux requires explicit `.desktop` file with `MimeType=x-scheme-handler/atvdesign` — call this out in `docs/oauth-setup.md`.

### Scenario 3a: "emil paraphrase too close to the original"
**Failure mode:** Emil judges the paraphrase derivative; DMCAs the fork.

**Mitigations:**
- Principles-not-prose rubric: capture *what* (transform+opacity, ease-out for entries, durations <300ms) without copying *how* it's said.
- `git diff` against upstream emil SKILL.md must show no >15-word verbatim phrases (encoded in A7 verification).
- Pre-clearance: open issue on emilkowalski/skill requesting MIT/CC0 license before publishing the rebrand.

### Scenario 3b: "ui-ux-pro-max attribution incomplete"
**Failure mode:** NOTICE missing required MIT text; original author claims license violation.

**Mitigations:**
- NOTICE includes full MIT license text from `nextlevelbuilder/ui-ux-pro-max-skill` reproduced verbatim.
- NOTICE also includes full MIT license text from `OpenCoworkAI/open-codesign` (mandatory for the fork itself, not just its dependencies).
- `skills/ui-ux-pro-max/README.md` per-bundle (not just root) credits author + license + source URL.
- Original copyright lines preserved in any copied JSON files that contain them.

### Scenario 4 (NEW per Architect): "Copilot SDK rejects our app type or `gpt-4.1` is gated above maintainer's tier"
**Failure mode:** GitHub's Copilot SDK OAuth flow refuses an OSS desktop app's registration; OR `gpt-4.1` is exposed only to Business/Enterprise tiers but the maintainer is on Individual/Pro.

**Mitigations:**
- Phase 1b's smoke test catches both before any port work begins.
- Fallback model selection rule: if `gpt-4.1` is unavailable at maintainer's tier, query `api.githubcopilot.com/models` (or the SDK's documented model list endpoint) and pick the lowest-common-denominator model exposed at the Individual tier as the default. Document the choice in `docs/known-issues.md` and the README.
- App-type rejection contingency: GitHub permits public OAuth client IDs for desktop apps via PKCE — document this explicitly in the OAuth app registration steps. If the SDK still refuses, escalate to user before continuing M1 (this would be a spec invalidation event).

---

## Expanded Test Plan (Deliberate Mode)

### Unit
- **U1.** Copilot SDK provider class: token-exchange function returns valid access token shape (test against recorded fixture; use `nock`/`msw` for HTTP mocking).
- **U2.** Provider class: chat-completion call assembles correct headers (`Authorization: Bearer`, model = `gpt-4.1` or fallback per Scenario 4).
- **U3.** Skill loader compatibility shim (if needed): given an Anthropic-spec SKILL.md, returns expected internal skill object.
- **U4.** Frontmatter parser: rejects malformed YAML; accepts spec-compliant YAML; tolerates the actual fields ui-ux-pro-max + emil-design-eng-inspired use.
- **U5.** Rebrand asset replacement: `package.json` `name`, app window title, README headline all match new fork name.
- **U6 (NEW):** Config migration check: when `~/.config/open-codesign/` exists, the app emits a documented warning or one-shot import (per A10's migration note).

### Integration
- **I1.** Provider abstraction: new Copilot SDK provider registers and is selectable from the provider-picker UI alongside existing providers.
- **I2.** Skill discovery: 12 built-ins + ui-ux-pro-max bundle + emil-design-eng-inspired all enumerable from the runtime skill registry.
- **I3.** Config persistence: GitHub OAuth tokens written to `~/.config/atv-design/config.toml` (renamed from `open-codesign`) with mode 0600.
- **I4.** OAuth callback handling: simulate URL-scheme callback (`atvdesign://oauth-callback?code=...`); verify the app exchanges the code (with PKCE verifier) and stores the token.
- **I5 (NEW):** PKCE flow: code-verifier/code-challenge pair correctly generated, sent in the authorization URL, and supplied at token exchange.

### End-to-End
- **E1.** **OAuth round-trip (A4):** start `pnpm dev`, click "Sign in with GitHub", complete consent in real browser, return to app, confirm token stored and one chat completion succeeds against `gpt-4.1` (or documented fallback). Manual test on the maintainer's working OS. **Per-OS smoke matrix** in `docs/oauth-setup.md`: maintainer OS mandatory M1; other two documented as deferred-but-expected.
- **E2.** **Prompt-to-design round-trip (A5):** with Copilot provider selected, type a prompt, observe a design artifact (prototype/slide/PDF) is produced.
- **E3.** **Skill invocation (A8):** trigger one skill from each of the three sources (built-in, ui-ux-pro-max, emil-inspired). Confirm each renders or guides the LLM as documented.
- **E4.** **Cold install (A1):** wipe `node_modules` and `~/.config/atv-design`, run `pnpm install` then `pnpm dev`, confirm the app launches and presents the OAuth screen.

### Observability
- **O1.** Structured logs at every OAuth step: `oauth.start`, `oauth.code_received`, `oauth.token_exchanged`, `oauth.token_stored`. Each carries a correlation ID. **Tokens, `code` values, and PKCE verifiers MUST be redacted.**
- **O2.** Skill registry log on app start: count of skills by source (built-in / ui-ux-pro-max / emil-inspired). Useful for confirming A8 in dev console.
- **O3.** Provider call log: model requested, tokens consumed (from response), latency. Surfaced in dev tools panel.
- **O4.** Error surface: every OAuth failure mode (consent denied, network failure, Copilot subscription missing, expired token, model unavailable per Scenario 4) produces a user-visible error with a remediation hint.

---

## Implementation Plan

### Phase 0 — Repo Bootstrap + BYOK ADR commit (A1, A2, partial A10)

**Estimated effort:** 1 day (was 0.5 — added ADR + NOTICE work).

**Steps:**
1. Clone `OpenCoworkAI/open-codesign` HEAD into `C:\Users\shyamsridhar\code\atv-design`.
2. Update `package.json` `name` to `atv-design`, version reset to `0.1.0`.
3. Update root README headline + replace user-visible `open-codesign` strings (find via grep).
4. Update Electron app `BrowserWindow` title.
5. **Create `NOTICE` file containing:**
   - Full MIT license text from `OpenCoworkAI/open-codesign` reproduced verbatim with copyright line.
   - (Pre-staged) full MIT license text from `nextlevelbuilder/ui-ux-pro-max-skill` (added in Phase 2).
6. Create `ATTRIBUTION.md` with structured credit blocks for all three upstream sources (open-codesign, ui-ux-pro-max, emil-design-eng-inspired-by).
7. **Add ADR file `docs/adr/0001-byok-oauth-posture.md`:** decision = fork-published public GitHub OAuth client ID with PKCE; alternative = self-registration documented in `docs/oauth-setup.md`. Commit *before* Phase 1b begins.
8. Run `pnpm install`. Run `pnpm dev`. Confirm app launches.
9. Commit: `chore: fork from OpenCoworkAI/open-codesign and rebrand to atv-design (BYOK ADR committed)`.

**Files touched:** `package.json`, `pnpm-workspace.yaml`, `README.md`, `ATTRIBUTION.md` (new), `NOTICE` (new), `docs/adr/0001-byok-oauth-posture.md` (new), `apps/*/package.json`, main process files.

**Acceptance:** A1, A2 pass. Partial A10 (NOTICE + ATTRIBUTION + ADR exist).

### Phase 1a (parallel) — Skill Loader Probe (A9, gating)

**Estimated effort:** 1 day.

**Steps:**
1. Locate skill loader source — Grep for `SKILL.md`, `loadSkill`, `skill_loader`, `skills/`.
2. Read loader code end-to-end. Document file-discovery rules, frontmatter schema, tool/capability surface, runtime invocation path.
3. Write `docs/skill-loader.md`.
4. **Gate test:** create `skills/loader-probe-test/SKILL.md` with minimal Anthropic-spec frontmatter; confirm runtime pickup.
5. Decision branch: compatible / needs adapter / needs loader patch. If adapter or patch needed, add Phase 1a.5 step before convergence gate.

**Acceptance:** A9 passes.

### Phase 1b (parallel) — Copilot SDK Provider Scaffold (partial A3, A4)

**Estimated effort:** 2 days.

**Steps:**
1. Locate existing provider abstraction (`@mariozechner/pi-ai` *or* whatever v0.1 actually uses — Architect flagged this as Lane 1 evidence-strength gap R8). Read existing ChatGPT/Codex OAuth provider as model.
2. Register the fork's GitHub OAuth app (public client ID, PKCE only, no client secret) per the Phase 0 ADR.
3. Implement `CopilotSDKProvider`:
   - OAuth authorization-code flow with PKCE against `https://github.com/login/oauth/access_token`.
   - Custom URL-scheme handler `atvdesign://oauth-callback` via `electron-deeplink`.
   - Token storage at `~/.config/atv-design/config.toml` (mode 0600).
   - Chat-completion call with default model `gpt-4.1` *or* the documented fallback (per Scenario 4).
   - Model-availability probe at first sign-in: query the SDK's model list and persist the chosen default per-tier.
4. Wire provider into provider-picker UI.
5. Manual smoke E1 on maintainer OS.
6. Add unit tests U1, U2; integration tests I1, I3, I4, I5.
7. **Convergence-gate criterion:** OAuth round-trip + one chat completion + model fallback rule documented all pass before Phase 2 begins.

**Acceptance:** A3 partial (provider visible/selectable), A4 passes.

### Convergence Gate

**Both Phase 1a and Phase 1b smoke tests must pass.** If either fails, the dependent phase pauses; the other continues to its endpoint. Failure of *both* triggers user escalation (spec invalidation territory).

### Phase 2 — ui-ux-pro-max Bulk Port (A6, partial A8)

**Estimated effort:** 1 day.

**Steps:**
1. Clone (or download tarball of) `nextlevelbuilder/ui-ux-pro-max-skill`.
2. Copy `.claude/skills/ui-ux-pro-max/SKILL.md` and `src/ui-ux-pro-max/data/*` into the fork at the loader-discovered path.
3. Add `skills/ui-ux-pro-max/README.md` (per-bundle): credit author, MIT license, source URL.
4. Append full MIT license text from upstream into root `NOTICE`.
5. Preserve original copyright lines in any copied JSON files that contain them.
6. Add integration test I2.

**Acceptance:** A6 passes.

### Phase 3 — emil-design-eng-inspired Paraphrase (A7, partial A8)

**Estimated effort:** 0.5 day.

**Steps:**
1. Author NEW `skills/emil-design-eng-inspired/SKILL.md` capturing principles in original prose:
   - transform+opacity only; ease-out for entries; ease-in-out on-screen; never ease-in.
   - Durations capped (buttons 100–160ms, dropdowns 150–250ms, modals 200–500ms, most UI <300ms).
   - `scale(0.95)` not `scale(0)`; `:active { scale: .97 }`.
   - `prefers-reduced-motion` respect; gate `:hover` behind `@media (hover: hover) and (pointer: fine)`.
2. Cite `https://github.com/emilkowalski/skill` as inspiration in SKILL.md body.
3. Add `skills/emil-design-eng-inspired/README.md` (per-bundle): inspiration source, paraphrase rationale, no-LICENSE note.
4. Open issue on emilkowalski/skill requesting MIT/CC0 license.
5. Verification: `git diff` vs. upstream emil SKILL.md shows no >15-word verbatim phrases.

**Acceptance:** A7 passes.

### Phase 4 — End-to-End Smoke (A5, A8 final)

**Estimated effort:** 0.5 day.

**Steps:**
1. Fire canonical prompt-to-design test with Copilot provider selected.
2. Confirm one design artifact (prototype/slide/PDF) renders.
3. Trigger one skill from each of the three sources; confirm each works (E3).
4. Add E2E tests E2, E3, E4.
5. Document quality gaps in `docs/known-issues.md`.

**Acceptance:** A5, A8 pass.

### Phase 5 — Repo Health (A10 complete)

**Estimated effort:** 0.5 day.

**Steps:**
1. README sections: "What is atv-design", "What changed vs. upstream", "Setup" (with OAuth registration), "Attribution" (full credits), "License".
2. `docs/oauth-setup.md`: step-by-step OAuth app creation; per-OS notes (macOS `Info.plist`, Windows registry, Linux `.desktop`); fork-published-vs-self-registered options per Phase 0 ADR.
3. `docs/known-issues.md`: packaged-build OAuth gap (Scenario 2); model-availability fallback (Scenario 4); config migration UX gap.
4. **Config migration note** in README + A10: behavior when an existing `~/.config/open-codesign/` exists. M1 default = "no migration; reauthenticate" (documented). Future: optional one-shot import.
5. Add CI smoke (optional M1): `pnpm install && pnpm build` in GitHub Actions.

**Acceptance:** A10 passes.

### Sequencing Diagram

```
Phase 0 (Bootstrap + ADR)         [1 day, sequential]
         |
         +---- Phase 1a (Loader probe)        [1 day, parallel]
         |
         +---- Phase 1b (Copilot SDK + OAuth) [2 days, parallel]
         |
         v
   CONVERGENCE GATE (both must pass)
         |
         +---- Phase 2 (ui-ux-pro-max port)   [1 day, parallel-internal]
         |
         +---- Phase 3 (emil paraphrase)       [0.5 day, sequential]
         |
         v
Phase 4 (E2E smoke)                [0.5 day]
         |
         v
Phase 5 (Repo health)              [0.5 day]

Total wall-clock (with parallelism):  ~5 days
Total wall-clock (sequential fallback): ~7 days
```

---

## Risks and Mitigations

| ID | Risk | Severity | Likelihood | Mitigation |
|----|------|----------|------------|------------|
| R1 | Skill loader is not Anthropic-spec compatible | High | Medium | Phase 1a gates Phase 2/3. Adapter or loader-patch path documented. |
| R2 | OAuth app posture decision fragmented across phases | Medium | High (in draft-1) | **Resolved in revision:** ADR committed in Phase 0 (`docs/adr/0001-byok-oauth-posture.md`). Default = fork-published public client ID + PKCE. |
| R3 | Copilot SDK rate limits or `gpt-4.1` tier-gating differ | Medium | Medium | Pre-mortem Scenario 4 + deterministic fallback model selection rule: (1) prefer the SDK's documented default model for the user's tier; (2) if no documented default, query `api.githubcopilot.com/models`, filter to entries with `chat` capability available at Individual tier, and pick the **first by lexical sort of model id** as a deterministic tiebreaker; (3) persist the chosen default in `~/.config/atv-design/config.toml` per-tier so two runs on the same machine pick the same model. README documents the requirement and the resolved choice. |
| R4 | emil paraphrase too close to original | Medium | Low | Principles-not-prose rubric; `git diff` no-verbatim verification; pre-clearance issue. |
| R5 | ui-ux-pro-max attribution incomplete | Medium | Low (in revision) | NOTICE w/ full MIT text from BOTH upstream + ui-ux-pro-max; per-bundle README; preserve JSON copyright lines. |
| R6 | Electron OAuth UX broken on maintainer OS | High | Low | `electron-deeplink` library; manual E1 test; per-OS smoke matrix in `docs/oauth-setup.md`. |
| R7 | `@mariozechner/pi-ai` provider abstraction can't accept new providers | Medium | Low | **Probe-and-escalate.** Phase 1b step 1 includes a probe that calls the existing provider abstraction's registration entrypoint with a minimal stub provider. If the abstraction rejects non-built-in providers (or requires forking the abstraction package), Phase 1b pauses and escalates to the user as a spec invalidation event before any further provider work begins. Thin wrapper added only if the probe succeeds AND the existing pattern requires one. |
| R8 | Provider abstraction name from Lane 1 README-only evidence may be wrong | Medium | Medium | **NEW:** Phase 1b step 1 verifies the actual abstraction in v0.1 source before naming the new provider. |
| R9 | Trace did not consider Copilot SDK rejection of OSS app type | Medium | Low | **NEW:** Pre-mortem Scenario 4. Phase 1b smoke test catches this; user escalation path documented. |
| R10 | Existing open-codesign users have stale `~/.config/open-codesign/` | Low | Medium | **NEW:** A10 documents "no migration; reauthenticate" default; future one-shot import deferred to M2. |
| R11 | Future contributor "fixes" performance by swapping to undocumented `copilot_internal` endpoint | Medium | Low | **NEW:** Encode the prohibition in `verify-security` checklist + a CI grep that fails on `copilot_internal` strings. |

---

## Verification Steps

| Criterion | Verification |
|-----------|--------------|
| A1 | `pnpm install && pnpm dev` on maintainer OS launches the Electron app. |
| A2 | Visible inspection: window title, README headline, `package.json` `name` all show `atv-design`. |
| A3 | Provider picker enumerates "GitHub Copilot" alongside Anthropic/OpenAI/etc. |
| A4 | Manual E1: OAuth flow completes; one chat completion logged. **Per-OS scope: maintainer OS mandatory at Phase 1b convergence**; other two OSes documented in `docs/oauth-setup.md` as deferred-but-expected and explicitly not blocking M1. |
| A5 | Manual E2: prompt produces a non-empty design artifact at the documented output path, openable by the documented viewer (filesystem assertion: file exists, size > 0, MIME type matches the artifact type — prototype/slide/PDF). |
| A6 | Filesystem check: every artifact from upstream ui-ux-pro-max-skill exists in fork at loader-discovered path. NOTICE updated. Per-bundle README exists. |
| A7 | Filesystem: `skills/emil-design-eng-inspired/SKILL.md` exists, authored fresh. `git diff` vs. upstream shows no >15-word verbatim phrases. License-request issue link recorded. |
| A8 | Runtime: skill registry lists ≥1 entry from each source. I2 + E3 pass. |
| A9 | `docs/skill-loader.md` exists. Gate test SKILL.md loaded. Adapter/patch path documented if needed. |
| A10 | README, `docs/oauth-setup.md`, `docs/known-issues.md`, `docs/adr/0001-byok-oauth-posture.md`, NOTICE, ATTRIBUTION.md all exist with required sections. Config migration note present. |

---

## ADR (Architectural Decision Record)

### Decision
Sequence M1 work as **Bootstrap + BYOK ADR → Loader Probe (1a) AND Copilot SDK Provider (1b) in parallel → Convergence Gate → ui-ux-pro-max bulk port → emil paraphrase → E2E smoke → Repo Health**, with the convergence gate forbidding port work until both 1a and 1b have passing smoke tests.

### Drivers
1. **Legal defensibility** — three external repos, three license postures, MIT notice-preservation requirement.
2. **Two parallel empirical unknowns** — skill loader contract AND Copilot SDK OAuth posture (especially `gpt-4.1` tier availability + cross-OS Electron deep-link).
3. **Cross-platform OAuth UX** — OS-specific URL-scheme registration.

### Alternatives considered
- **Option A (verify-first sequencing):** rejected — defers higher-variance auth risk; trace's Lane 3 mid-interview revision is the empirical signal that auth is the higher-variance branch.
- **Option B (full parallel from day one):** rejected — port-vs-loader race conditions; trades known schedule risk for unknown rework.
- **Option C (defer skill bundles to M2):** rejected — violates spec contract.

### Why chosen (Option E)
Option E captures Option A's gating discipline (no port work before convergence) AND addresses the Architect pass-1 critique that auth was being deferred behind the lower-variance unknown. Convergence gate retires both unknowns in week 1; user-visible feature work appears within 2 days, honoring Principle 5.

### Consequences
- **Positive:** Both load-bearing unknowns surface in week 1. Earliest possible learning. Natural rollback boundary at every phase. License hygiene baked in from Phase 0.
- **Negative:** Two parallel agent lanes ideal for Phase 1; serial fallback re-introduces draft-1's slow-start.
- **Operational:** M1 acceptance does not include packaged binaries — known M2 gap (Pre-mortem Scenario 2). Per-OS OAuth matrix documented but not exhaustively tested.

### Follow-ups (post-M1)
- M2: Tagged release + binaries; cross-OS OAuth packaging tests with Squirrel/NSIS.
- M2: shadcn/ui MCP integration once skill loader contract is fully understood.
- M2: One-shot config import from `~/.config/open-codesign/` to `~/.config/atv-design/`.
- Ongoing: Track emilkowalski/skill license issue; if granted, swap paraphrase → direct attribution.
- Ongoing: Track open-codesign v0.2 "Agentic Design" loop; align fork's loader contract.
- Security: CI grep that fails on `copilot_internal` strings; `verify-security` checklist entry for the prohibition.

---

## Changelog

- **2026-04-30 (DRAFT 1):** Initial Planner output. Option A (verify-first sequencing).
- **2026-04-30 (REVISION 1):** Architect pass-1 verdict APPROVE-WITH-IMPROVEMENTS. 6 required changes incorporated:
  1. Adopted **Option E** (two parallel gates, convergence before ports) replacing Option A.
  2. Moved **BYOK decision** from Phase 5 into Phase 0 ADR (`docs/adr/0001-byok-oauth-posture.md`); default = fork-published public client ID with PKCE.
  3. **Strengthened Principle 3 compliance:** NOTICE now contains full MIT text from BOTH upstream open-codesign and ui-ux-pro-max (verbatim, with copyright lines). Per-bundle READMEs in `skills/<bundle>/`.
  4. Added **Pre-mortem Scenario 4** (Copilot SDK app-type rejection / `gpt-4.1` tier gating) with fallback model selection rule.
  5. Added **config migration note** to A10 + R10 (existing `~/.config/open-codesign/` handling).
  6. Added **cross-OS OAuth smoke matrix** to E1 (maintainer OS mandatory; others documented as deferred-but-expected with per-OS notes in `docs/oauth-setup.md`).
- Plus three additional improvements surfaced by Architect that are now incorporated:
  - R8 escalated (Lane 1 README-only evidence on `pi-ai` may be wrong; Phase 1b verifies actual abstraction).
  - R11 added (CI grep + `verify-security` entry blocking future regression to `copilot_internal` endpoint).
  - U6, I5 added to Test Plan (config migration check; PKCE flow).
- **2026-04-30 (REVISION 2 — FINAL):** Architect pass-2 verdict APPROVE-WITH-MINOR. Critic verdict APPROVE-WITH-IMPROVEMENTS. 4 surgical Critic edits applied:
  1. **R3 fallback rule made deterministic** — explicit tiebreaker (SDK-documented default → lexical sort of `chat`-capable models at Individual tier → persist per-tier).
  2. **R7 mitigation rewritten** as probe-and-escalate, matching R8/R9's fail-fast pattern; added Phase 1b probe step.
  3. **A5 pass criterion tightened** to filesystem assertion (file exists, size > 0, MIME type matches expected artifact type).
  4. **A4 verification clarified** — maintainer-OS mandatory at Phase 1b convergence; other OSes documented-but-deferred and explicitly non-blocking.
- Architect's N1–N3 minor concerns (convergence-gate wording, two-engineer assumption visibility, CI grep covering .md files) noted as informational; do not block execution. Will be addressed inline during Phase 1.

**Status: APPROVED. Ready for execution handoff.**
