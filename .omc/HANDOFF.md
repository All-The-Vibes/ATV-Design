# atv-design — Resume Handoff

> **Historical note (2026-05-04):** The remainder of this file is an April 30 pre-convergence snapshot. It does **not** describe the current repo state. Current truth: ATV Design has the rebranded package/runtime surfaces, GitHub Copilot OAuth uses loopback HTTP `http://127.0.0.1:<random-port>/oauth-callback`, and the additive `ui-ux-pro-max` bundle now ships under `skills/ui-ux-pro-max/`. Use the current `README.md`, `docs/oauth-setup.md`, and verification gates before following any phased instructions below.

**Snapshot date:** 2026-04-30
**Snapshot author:** autopilot session that started Phase 0 and pivoted to artifact-only mode after a network throttle blocked the upstream clone.
**State:** Phase 0 partial. Phase 1a not started. Phase 1b not started. Phases 2 / 3 / 4 / 5 partially pre-staged as artifact-only files.

This document is the runbook for the **next** session — human or agent — that picks atv-design up. It tells you exactly what's done, what's in this directory, what to run, and what to verify.

---

## What's in `.omc/` (planning artifacts — do not delete)

| Path | What it is | Authoritative? |
|------|-----------|----------------|
| `.omc/specs/deep-dive-trace-fork-open-codesign-copilot-skills.md` | 3-lane parallel trace investigation (open-codesign architecture, skill source repos, Copilot OAuth feasibility) | Yes, ground truth from /deep-dive Phase 3 |
| `.omc/specs/deep-dive-fork-open-codesign-copilot-skills.md` | Crystallized requirements spec (10 acceptance criteria A1–A10, ~15% ambiguity) | Yes, the contract |
| `.omc/plans/ralplan-fork-open-codesign-copilot-skills-final.md` | Consensus plan — RALPLAN-DR deliberate mode, Architect+Critic approved, Option E sequencing | Yes, the execution blueprint |
| `.omc/state/ralplan-state.json` | Ralplan state, set to `active=false` at handoff time | No, lifecycle marker |

The plan supersedes draft-1 (which had Option A serial sequencing). All plan-linked work uses the FINAL revision.

---

## What's been written into the working directory (in-place artifacts)

These files have been authored by the autopilot session and are ready for either (a) overlay onto an upstream clone, or (b) standalone use until the clone happens.

| Path | Phase | What it is |
|------|-------|-----------|
| `ATTRIBUTION.md` | 0 | Credits all three upstream sources; pointer to NOTICE for verbatim license text. |
| `NOTICE` | 0 | Full MIT license text from upstream open-codesign + ui-ux-pro-max + atv-design's own MIT line + the inspired-by note for emilkowalski/skill. **Required by MIT's notice-preservation clause.** |
| `docs/adr/0001-byok-oauth-posture.md` | 0 | The BYOK ADR. Default = fork-published public client ID + PKCE; alternative = self-registration. **Per Architect feedback: must be committed BEFORE Phase 1b begins.** |
| `skills/emil-design-eng-inspired/SKILL.md` | 3 | Original-prose skill capturing emil's animation principles. Zero verbatim text from upstream. |
| `skills/emil-design-eng-inspired/README.md` | 3 | Per-bundle README explaining the inspired-by posture. |
| `docs/security-checklist.md` | 5 | Encodes Spec Principle 2 (forbid `copilot_internal`) and Risk R11. |
| `.github/workflows/forbidden-endpoints.yml` | 5 | CI grep enforcing the forbidden-endpoints rules. |
| `docs/oauth-setup.md` | 5 | Per-OS OAuth setup guide; default + self-registration paths. |
| `docs/known-issues.md` | 5 | M1 known limitations (no binaries, model fallback, config migration). |
| `docs/skill-loader-probe-plan.md` | 1a | Runbook for the loader probe — exact greps, what to look for, decision tree. |
| `.omc/HANDOFF.md` | meta | This file. |

**These artifacts are written to be self-contained.** They reference paths that don't exist yet (e.g., `package.json`, `apps/main/src/...`); those paths show up after the upstream clone overlays this tree.

---

## What still needs to happen

### Step 1: Get the upstream working tree

The autopilot session was blocked by network throttling at ~30 KB/sec on `codeload.github.com`. This is environment-bound, not code-bound. When you have a network that can pull the upstream:

```bash
# From the project root (this directory)
cd /tmp && rm -rf open-codesign-upstream
git clone https://github.com/OpenCoworkAI/open-codesign.git open-codesign-upstream

# OR, faster if your network is throttled on git but not curl:
curl -L -o /tmp/open-codesign-main.tar.gz \
  https://codeload.github.com/OpenCoworkAI/open-codesign/tar.gz/refs/heads/main
mkdir -p /tmp/open-codesign-extracted
tar -xzf /tmp/open-codesign-main.tar.gz -C /tmp/open-codesign-extracted
mv /tmp/open-codesign-extracted/open-codesign-main /tmp/open-codesign-upstream
```

### Step 2: Overlay onto this directory

Copy upstream working tree on top of the current cwd, **preserving** `.omc/`, `.remember/`, and all the artifacts written above. Using `rsync` is the safest:

```bash
rsync -av --exclude='.git' --exclude='.omc' --exclude='.remember' \
  /tmp/open-codesign-upstream/ ./
```

The `rsync` preserves files we wrote (NOTICE, ATTRIBUTION.md, skills/emil-design-eng-inspired/, docs/, .github/workflows/forbidden-endpoints.yml) because they don't exist in upstream. If upstream happens to ship a NOTICE / ATTRIBUTION.md of its own, you'll get a conflict; resolve by hand-merging — atv-design's text MUST be preserved for legal compliance.

### Step 3: Initialize fresh git history

The plan calls for a hard fork with new git history (not a tracking fork). After overlay:

```bash
git init
git add -A
git commit -m "chore: fork from OpenCoworkAI/open-codesign and rebrand to atv-design

- Apply atv-design rebrand: NOTICE, ATTRIBUTION.md, BYOK ADR
- Add emil-design-eng-inspired skill (paraphrase, original prose)
- Add forbidden-endpoints CI grep
- Add docs/security-checklist.md, docs/oauth-setup.md, docs/known-issues.md
- Add docs/skill-loader-probe-plan.md (runbook for Phase 1a)

Spec: .omc/specs/deep-dive-fork-open-codesign-copilot-skills.md
Plan: .omc/plans/ralplan-fork-open-codesign-copilot-skills-final.md
"
```

### Step 4: Apply the rebrand to upstream-shipped files

The autopilot session couldn't do this because the upstream tree wasn't on disk. After overlay:

- `package.json` — change `name` to `atv-design`, version to `0.1.0`.
- All `apps/*/package.json` and `packages/*/package.json` — update names if they reference open-codesign.
- `README.md` — replace upstream README with one that points to the atv-design fork (or merge).
- Any Electron `BrowserWindow` title or `app.setName` call — update to `atv-design`.
- OAuth callback plumbing — use the loopback HTTP callback flow documented in ADR 0001, not a custom URL scheme.
- Config directory references — change `~/.config/open-codesign/` to `~/.config/atv-design/`.

Verify with `git grep -i 'open-codesign\|opencodesign\|opencoworkai'` and audit each hit.

### Step 5: Run Phase 1a (skill loader probe)

Follow the runbook at `docs/skill-loader-probe-plan.md`. Output: `docs/skill-loader.md`.

### Step 6: Run Phase 1b (Copilot SDK provider scaffold)

This is where **you** (the human) need to act, because it requires:

1. **Register a GitHub OAuth app** at https://github.com/settings/developers (Path A in `docs/oauth-setup.md`):
   - Name: `atv-design`
   - Homepage URL: your fork's URL.
   - Authorization callback URL: current repo uses the loopback callback flow documented in `docs/oauth-setup.md`
   - **Do not generate a client secret.** PKCE only.
   - Copy the resulting Client ID into the source as `DEFAULT_GITHUB_OAUTH_CLIENT_ID` (path TBD post-Phase-1b).

2. **Verify your Copilot subscription** — any paid tier works.

3. **Implement the provider** following the consensus plan's Phase 1b steps. The provider abstraction's actual API will be revealed during Phase 1b step 1's "probe-and-escalate" (Risk R7 mitigation): you call the existing abstraction's registration entrypoint with a stub provider; if it accepts, proceed; if it rejects, escalate to user before further work.

### Step 7: Convergence gate

Both Phase 1a and Phase 1b must have passing smoke tests. If either fails, the dependent path pauses; the other continues. Both passing → Phase 2 starts.

### Step 8: Phase 2 — port `ui-ux-pro-max-skill`

```bash
git clone --depth 1 https://github.com/nextlevelbuilder/ui-ux-pro-max-skill.git /tmp/uipro
# Identify which paths the loader (per docs/skill-loader.md) discovers.
# Then copy the skill content + data into atv-design at that path:
cp -r /tmp/uipro/.claude/skills/ui-ux-pro-max <LOADER_DISCOVERY_PATH>/ui-ux-pro-max
cp -r /tmp/uipro/src/ui-ux-pro-max/data <LOADER_DISCOVERY_PATH>/ui-ux-pro-max/data
# Create per-bundle README.
# NOTICE already includes upstream MIT — confirm it's still there.
```

Do NOT port `uipro-cli` or the `.github/workflows/` from upstream.

### Step 9: Phase 3 — emil paraphrase port

Already done. The file at `skills/emil-design-eng-inspired/SKILL.md` is in place. Just confirm the loader (per docs/skill-loader.md) discovers it; if the discovery path differs, move it.

### Step 10: Phase 4 — E2E smoke

Per the consensus plan §Phase 4. The acceptance criterion is A5: a non-empty design artifact lands at the documented output path with a matching MIME type.

### Step 11: Phase 5 — finalize repo health

Mostly done in artifact-only mode. Remaining:

- Update `README.md` (the rebranded one) with the sections drafted in `docs/oauth-setup.md` and `docs/known-issues.md`.
- Add CI smoke (`pnpm install && pnpm build`) to `.github/workflows/`.

---

## Cancellation / fresh-start instructions

If you want to discard this session's work and re-plan from scratch:

1. Keep `.omc/` (the deep-dive trace + spec + consensus plan are valuable independent of this fork attempt).
2. Delete: `ATTRIBUTION.md`, `NOTICE`, `docs/`, `skills/`, `.github/workflows/forbidden-endpoints.yml`, this file.
3. Re-run `/deep-dive` if requirements have changed; otherwise `/ralplan` against the existing spec.

If you want to restart only Phase 1+ but keep Phase 0 artifacts: skip step 2's deletes and just re-run from "Step 1: Get the upstream working tree" above.

---

## Health check

A future autopilot session resuming from this state should verify:

```bash
# Confirm planning artifacts intact
test -f .omc/specs/deep-dive-fork-open-codesign-copilot-skills.md
test -f .omc/plans/ralplan-fork-open-codesign-copilot-skills-final.md

# Confirm Phase 0 artifacts written
test -f ATTRIBUTION.md
test -f NOTICE
test -f docs/adr/0001-byok-oauth-posture.md

# Confirm Phase 3 paraphrase
test -f skills/emil-design-eng-inspired/SKILL.md
test -f skills/emil-design-eng-inspired/README.md

# Confirm Phase 5 docs
test -f docs/security-checklist.md
test -f docs/oauth-setup.md
test -f docs/known-issues.md
test -f docs/skill-loader-probe-plan.md
test -f .github/workflows/forbidden-endpoints.yml

echo "✅ All atv-design pre-clone artifacts present."
```

Then check whether upstream has been overlaid:

```bash
test -f package.json && echo "✅ Upstream overlaid." || echo "❌ Upstream NOT yet overlaid — see Step 1 above."
```

---

## Provenance summary

| Artifact | Authored when | Authored by |
|----------|--------------|-------------|
| `.omc/specs/deep-dive-trace-*.md` | /deep-dive Phase 3 | 3 parallel general-purpose subagents + synthesis |
| `.omc/specs/deep-dive-*.md` | /deep-dive Phase 4 | 6-round Socratic interview |
| `.omc/plans/ralplan-*-final.md` | /omc-plan --consensus --direct | Planner→Architect (×2)→Critic→Planner revisions |
| Everything else listed above | autopilot Phase 0+3+5 (artifact-only mode after network throttle) | Single autopilot session with explanatory output style |
