# Deep Dive Spec: fork-open-codesign-copilot-skills

**Slug:** `fork-open-codesign-copilot-skills`
**Generated:** 2026-04-30
**Source:** `/deep-dive` (trace + interview pipeline)
**Trace artifact:** `.omc/specs/deep-dive-trace-fork-open-codesign-copilot-skills.md`
**Final ambiguity:** ~15% (below 20% threshold)
**Interview rounds:** 5
**Project type:** Greenfield (new fork; reference repos are brownfield)

---

## Goal

Hard-fork `OpenCoworkAI/open-codesign` under a new name (project-local cwd suggests `atv-design`), authenticate users with the **official GitHub Copilot SDK OAuth flow** ([docs](https://docs.github.com/en/copilot/how-tos/copilot-sdk/set-up-copilot-sdk/github-oauth)), and extend it with the full opinionated bundle from `nextlevelbuilder/ui-ux-pro-max-skill` plus a paraphrased rendering of `emilkowalski/skill/skills/emil-design-eng`. Distribution posture is **public open-source, BYOK** — each end user supplies their own GitHub OAuth + Copilot subscription. Milestone 1 ships a runnable local-dev demo only; release/packaging is out of scope for M1.

## Constraints

1. **Auth backbone is the official Copilot SDK OAuth flow**, not the undocumented `api.githubcopilot.com` `copilot_internal` token-exchange path that reverse-engineered clients use. Token endpoint: `https://github.com/login/oauth/access_token`. Org verification: `api.github.com/user/orgs`.
2. **Each end user is BYOK.** The fork ships no shared/embedded credentials. Users must register their own GitHub OAuth app (or use a documented public client ID for the fork — to be decided in implementation) and have an active Copilot subscription.
3. **Skill format = Anthropic-spec `SKILL.md`** (YAML frontmatter with `name` + `description`, markdown body). Working assumption: open-codesign v0.1's loader is Anthropic-spec compatible. If breakage surfaces during implementation, fix forward — do not pre-emptively wait for v0.2 or rewrite the loader.
4. **Licensing posture:**
   - open-codesign: MIT — clean to fork.
   - ui-ux-pro-max-skill: MIT — clean to port verbatim with attribution.
   - emil-design-eng: **no LICENSE** → **paraphrase only**, no verbatim copy. New SKILL.md authored by the fork maintainers, citing the original repo as inspiration. An issue should be opened on `emilkowalski/skill` requesting a license; if granted, the SKILL.md can later be updated to direct attribution + verbatim if desired.
5. **Provider abstraction:** integrate Copilot SDK into open-codesign's existing `@mariozechner/pi-ai` provider layer (or whatever provider abstraction the v0.1 codebase exposes). Do not bypass the abstraction.
6. **Hard fork posture:** rebrand the project. No upstream-PR pressure. Diverge intentionally.
7. **Stack inherited from open-codesign:** Electron + TypeScript + React 19 + Vite 6 + Tailwind v4, pnpm/turbo monorepo. Do not migrate the stack as part of M1.

## Non-Goals (M1)

- No tagged GitHub release. No prebuilt binaries for macOS/Windows/Linux.
- No npm publish.
- No hosted/SaaS deployment.
- No migration to v0.2 "Agentic Design" loop. Build against whatever loader v0.1 ships.
- No replacement of open-codesign's existing 12 built-in design skill modules — they remain alongside the new bundles.
- No shadcn/ui MCP integration in M1 even though ui-ux-pro-max-skill references it as a complementary integration. Defer.
- No `uipro-cli` shim. The CLI from ui-ux-pro-max is not needed inside an Electron app fork.
- No support for multiple GitHub OAuth apps simultaneously. Single configured app per fork build.
- No upstream contribution back to `OpenCoworkAI/open-codesign` as an M1 deliverable.

## Acceptance Criteria (M1 — Local Dev Demo)

A1. **Repo bootstrapped:** the fork exists at the cwd (`code/atv-design`) with the upstream open-codesign HEAD imported, `pnpm install` succeeds, and `pnpm dev` launches the Electron app on macOS, Windows, and Linux (developer's working OS at minimum).

A2. **Rebrand applied:** product name in package.json, README headline, app window title, and any visible UI strings reflects the new fork name (no longer "open-codesign"). License retained as MIT with attribution to upstream.

A3. **Copilot SDK provider added:** a new provider in the `@mariozechner/pi-ai` (or equivalent) abstraction implements GitHub OAuth authorization-code flow against `https://github.com/login/oauth/access_token` and uses the resulting token to call the documented Copilot SDK chat endpoint. The provider is selectable from the same provider-picker UI that today exposes Anthropic / OpenAI / Gemini / etc.

A4. **OAuth round-trip succeeds in local dev:** clicking "Sign in with GitHub" in the running Electron app opens the GitHub OAuth consent screen, returns to the app with an access token, and at least one `gpt-4.1`-class chat completion is successfully fetched from the Copilot SDK endpoint.

A5. **Prompt-to-design round-trip:** with the Copilot provider selected, a user prompt produces a design artifact (one of: prototype, slide, PDF — same artifact types open-codesign already supports). End-to-end latency, model choice, and quality bar do not need to match the existing providers in M1.

A6. **ui-ux-pro-max bundle ported in full:** every artifact under `nextlevelbuilder/ui-ux-pro-max-skill`'s `.claude/skills/ui-ux-pro-max/` and `src/ui-ux-pro-max/data/` directories (67 styles, 161 palettes, 57 font pairings, 161 product reasoning rules, 99 UX guidelines, 25 chart types) is copied into the fork at the path the open-codesign loader discovers, with a top-level NOTICE / attribution file crediting nextlevelbuilder. License preserved as MIT.

A7. **emil-design-eng paraphrased:** a new `skills/emil-design-eng-inspired/SKILL.md` exists, authored by the fork maintainers, capturing the same animation principles (transform+opacity only, ease-out for entries, easing curve rules, duration caps, `prefers-reduced-motion` handling, `:active { scale: .97 }` etc.) in original prose. README references the original `emilkowalski/skill` repo as inspiration. **No verbatim text copied.**

A8. **Skill discoverability:** the three skill sources (open-codesign's 12 built-ins, ported ui-ux-pro-max bundle, paraphrased emil-design-eng-inspired) all show up in whatever skill-picker / skill-list UI v0.1 exposes (or, if the loader is purely runtime-implicit, all three are correctly invoked when their trigger conditions match in agent dialog).

A9. **Loader assumption verified or corrected:** if the working assumption that v0.1's loader is Anthropic-spec compatible turns out wrong, the spec is updated and the actual contract is documented in the fork's `docs/skill-loader.md`. Acceptance criterion is "the discovery story is documented and works," not "the assumption was right."

A10. **Repo health:** README updated with (a) what changed vs. upstream, (b) GitHub OAuth app registration steps users must do once, (c) attribution to OpenCoworkAI/open-codesign, nextlevelbuilder/ui-ux-pro-max-skill, and emilkowalski/skill (as inspiration), (d) license retention notes.

## Assumptions Exposed

- **AS1.** The `@mariozechner/pi-ai` (or whatever open-codesign actually uses) provider abstraction can accept a new provider without forking that package. If it can't, M1 includes a small wrapper layer; the spec does not require contributing upstream to `pi-ai`.
- **AS2.** open-codesign v0.1's skill loader auto-discovers `SKILL.md` files matching Anthropic frontmatter — verified empirically in M1 (A9).
- **AS3.** GitHub Copilot SDK's `gpt-4.1` model is exposed to subscribers at all paid tiers (Individual / Pro / Business / Enterprise). If only some tiers expose it, README documents the requirement; spec is unchanged.
- **AS4.** The fork's Electron build can register a custom URL-scheme handler (`atvdesign://oauth-callback` or similar) for OAuth redirect, on all three OSes. Standard Electron capability.
- **AS5.** Porting 161 palettes etc. as JSON data does not exceed any open-codesign asset-size limit. ui-ux-pro-max's `src/.../data/` is JSON, shouldn't be large.
- **AS6.** The user (project owner) controls the rebrand name. Default to `atv-design` matching the cwd; user can override during implementation.

## Technical Context

**Target repo (fork base):**
- `OpenCoworkAI/open-codesign` — MIT
- Electron + TypeScript + React 19 + Vite 6 + Tailwind v4
- pnpm/turbo monorepo
- Existing providers via `@mariozechner/pi-ai`: Anthropic, OpenAI, Gemini, DeepSeek, Kimi, GLM, Ollama, OpenAI-compatible
- Existing OAuth scaffolding for ChatGPT/Codex (model for new Copilot SDK provider)
- Credentials at `~/.config/open-codesign/config.toml`, mode 0600
- 12 built-in design skill modules (paths to be discovered during implementation)

**Auth backbone:**
- [GitHub Copilot SDK OAuth docs](https://docs.github.com/en/copilot/how-tos/copilot-sdk/set-up-copilot-sdk/github-oauth)
- Token endpoint: `https://github.com/login/oauth/access_token`
- Org verification (when applicable): `https://api.github.com/user/orgs`
- Documented eligibility: multi-user apps, internal tools, SaaS products. OSS clients not excluded.
- Each user needs own active Copilot subscription.

**Source skill bundles:**
- `nextlevelbuilder/ui-ux-pro-max-skill` — MIT, Anthropic-spec SKILL.md + skill.json + data/. Drop-in compatible.
- `emilkowalski/skill/skills/emil-design-eng/SKILL.md` — **NO LICENSE**, default GitHub copyright. Paraphrase only.

## Ontology

| Term | Meaning in this spec |
|------|---------------------|
| **Fork** | A hard fork — divergent rebrand, not a tracking fork. |
| **Skill** | A `SKILL.md` file with YAML frontmatter (`name`, `description`) and markdown body, in Anthropic-spec format. |
| **Skill bundle** | A directory of related Skills + supporting data (palettes, fonts, etc.) shipped together. |
| **Provider** | An entry in open-codesign's LLM-provider abstraction. Copilot SDK becomes one new provider. |
| **BYOK** | Bring-your-own-key — but specifically here means each end user supplies their own GitHub OAuth + Copilot subscription. |
| **Local dev demo** | `pnpm dev` launches the app on the maintainer's machine and acceptance criteria pass. No release/binaries. |
| **Paraphrase** | Reauthor the principles in original prose; cite the inspiration; do not copy text verbatim. |
| **v0.1 loader** | The skill discovery/loading code path that ships in open-codesign at the time of fork. Contract unverified pre-implementation. |

## Ontology Convergence

Stable. No term changed meaning across rounds. The one term that *almost* drifted was "Copilot OAuth" — Round 1 ambiguity ("does this mean undocumented endpoint or sign-in UX?") was resolved in Round 2 by the user citing the official Copilot SDK OAuth docs, which decisively pinned the term to the documented SDK flow.

## Trace Findings

The trace ran 3 parallel lanes producing this synthesis (full artifact at `.omc/specs/deep-dive-trace-fork-open-codesign-copilot-skills.md`):

- **Lane 1 (open-codesign architecture)** — High evidence-strength. open-codesign is MIT, Electron + TS + React 19, BYOK with existing OAuth scaffolding for ChatGPT/Codex, 12 built-in skill modules, Anthropic-style `SKILL.md` extension model. Critical unknown surfaced: v0.1's exact loader contract. **Spec resolves** by adopting Anthropic-spec compatibility as a working assumption with empirical verification baked into A9.
- **Lane 2 (skill source repos)** — High evidence-strength. ui-ux-pro-max is MIT and drop-in compatible. emil-design-eng has **no LICENSE** — verbatim port is restricted by default GitHub copyright. **Spec resolves** by porting ui-ux-pro-max in full and **paraphrasing** emil into a new SKILL.md authored by the fork maintainers.
- **Lane 3 (Copilot OAuth)** — Initial Lane-3 finding was that Copilot OAuth is "the wrong primitive" because the only Lane 3 found was the undocumented `copilot_internal` endpoint. **Trace was revised mid-interview** when the user cited the official Copilot SDK OAuth docs, which Lane 3 missed. The official SDK OAuth flow is documented, sanctioned for SaaS/multi-user/internal-tool use cases, and matches a public OSS BYOK posture cleanly. **Spec resolves** by targeting the official SDK, not the gh-copilot-style endpoint.

The trace's overall value: it identified the emil license issue (which would have caused a copyright problem post-launch), surfaced the wrong-endpoint risk (which the user's later citation refined into the right endpoint), and preempted assumptions about open-codesign's skill loader by making A9 an empirical-verification criterion instead of a premise.

## Interview Transcript

**Round 1 — Goal (distribution intent), seeded by Lane 3 critical unknown.**
Q: Personal use, public OSS BYOK, hosted SaaS, or undecided?
A: Public open-source fork, BYOK.

**Round 2 — Constraints (auth meaning), seeded by Lane 3 critical unknown.**
Q: Of {GitHub OAuth UX, GitHub Models API, gh-copilot-style undocumented inference, Copilot Extension platform}, which did you mean by "Copilot OAuth"?
A: User cited https://docs.github.com/en/copilot/how-tos/copilot-sdk/set-up-copilot-sdk/github-oauth — the official Copilot SDK OAuth flow. (None of the four pre-defined options exactly matched; user supplied a fifth, which became the canonical answer. Trace was revised in response.)

**Round 3 — Constraints (skill loader strategy), seeded by Lane 1 critical unknown.**
Q: Inspect v0.1 loader first / assume Anthropic-spec compatibility / target v0.2 / build from scratch?
A: Assume Anthropic-spec compatibility.

**Round 4 — Constraints (emil port mode), seeded by Lane 2 critical unknown.**
Q: Paraphrase + license request / verbatim with risk / skip emil / block on permission?
A: Paraphrase + request license.

**Round 5 — Goal+Identity (scope and rebrand posture).**
Q: Scope = full bundle / lean / curated / deferred? Identity = same name / rebrand / contribute upstream / hard-fork-share-back?
A: Full bundle + rebrand as hard fork.

**Round 6 — Acceptance criteria (M1 shape).**
Q: Local dev only / tagged release+binaries / two milestones / skip gating?
A: Local dev only.

**Convergence:** ambiguity ≤ 20% threshold reached at Round 6. No challenge agents were invoked because the trace pre-empted most of the contrarian/simplifier angles by surfacing license + endpoint risks before the interview started.

---

*Spec generated by `/deep-dive`. Hand off to `/omc-plan --consensus --direct`, `/autopilot`, `/ralph`, or `/team` via the execution bridge.*
