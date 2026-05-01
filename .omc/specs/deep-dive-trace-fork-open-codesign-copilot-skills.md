# Deep Dive Trace: fork-open-codesign-copilot-skills

## Observed Result
User wants to fork `OpenCoworkAI/open-codesign`, port opinionated skills/agents from `nextlevelbuilder/ui-ux-pro-max-skill` and `emilkowalski/skill` (emil-design-eng), and have everything "powered by GitHub Copilot OAuth."

## Ranked Hypotheses
| Rank | Hypothesis | Confidence | Evidence Strength | Why it leads |
|------|------------|------------|-------------------|--------------|
| 1 | **Lane 3 — Copilot OAuth is the wrong primitive.** Copilot's inference endpoint is undocumented (`copilot_internal/v2/token` → `api.githubcopilot.com`) and the per-seat license forbids using it to power a redistributable third-party agent product. | High | Strong (multiple OSS clients confirm endpoint behavior; ToS / Product Specific Terms quote per-seat language; AUP forbids commercial resale) | This invalidates the user's premise. Every other decision depends on resolving the auth backbone first. A working `gh-copilot`-style OAuth implementation is technically feasible but legally and operationally fragile. |
| 2 | **Lane 2 — Skill ports are mostly trivial, but `emil-design-eng` has no LICENSE.** Both source repos use Anthropic-spec `SKILL.md`. ui-ux-pro-max is MIT and drop-in. emil-design-eng has no license file → default "all rights reserved" under GitHub ToS, blocking redistribution in a fork. | High | Strong (raw skill.json shows MIT for ui-ux-pro-max; emilkowalski/skill repo has no LICENSE file in any fetched listing) | Format compatibility is solved; the blocker is licensing on one of two source repos plus implicit Radix/Framer-Motion stack assumptions in emil's prescriptive animation rules. |
| 3 | **Lane 1 — open-codesign is a clean fork target.** MIT-licensed Electron + TypeScript + React 19 monorepo with file-driven `SKILL.md` extension, BYOK provider abstraction (`@mariozechner/pi-ai`), and existing OAuth scaffolding for ChatGPT/Codex. v0.2 roadmap adds an agentic loop with `ask`/`scaffold`/`skill` tools. | Medium | Moderate (README + repo listing confirmed; actual skill loader source path / runtime contract not inspected) | Architecturally welcoming, but the v0.1 vs v0.2 gap matters: today's loader contract is unverified, so "drop in a SKILL.md from another repo" may need a thin adapter. |

## Evidence Summary by Hypothesis

- **Lane 3 (Copilot OAuth):** GitHub's first-party clients (gh CLI, VS Code Copilot plugin) use OAuth device flow → exchange GitHub user token at `api.github.com/copilot_internal/v2/token` for a ~30-min Copilot session token → call `api.githubcopilot.com/...` (OpenAI-compatible). Models exposed include GPT-4o/4.1, o1/o3-mini, Claude 3.5/3.7, Gemini 2.0/2.5 — list rotates. Multiple reverse-engineered clients (B00TK1D/copilot-api, ericc-ch/copilot-api, copilot.vim, aider's Copilot backend) prove reachability. **GitHub Models API** (`models.github.ai`) is a separate, *officially-supported* OAuth-gated chat endpoint, decoupled from Copilot subscription — clean substitute.
- **Lane 2 (Skill source repos):** ui-ux-pro-max ships 67 UI styles / 161 palettes / 57 font pairings / 161 product reasoning rules / 99 UX guidelines / 25 chart types via `skill.json` + `.claude/skills/ui-ux-pro-max/SKILL.md` + `src/.../data/` JSON. MIT licensed. Has its own `uipro-cli` and a hard dependency on a "shadcn/ui MCP." emil-design-eng is one prose-heavy SKILL.md with strict animation rules (transform+opacity only, ease-out for entries, never ease-in, scale(0.95), `:active { scale: .97 }`, durations <300ms for most UI), implicitly assumes Radix + Framer Motion.
- **Lane 1 (open-codesign):** Electron + TypeScript + React 19 + Vite 6 + Tailwind v4, pnpm/turbo monorepo, MIT. 12 built-in design skill modules. BYOK across Anthropic / OpenAI / Gemini / DeepSeek / Kimi / GLM / Ollama via `@mariozechner/pi-ai`. Credentials at `~/.config/open-codesign/config.toml` (mode 0600). One-click import from Claude Code / Codex configs. v0.2 "Agentic Design" loop is on roadmap, not shipped — adds tools `ask`, `scaffold`, `skill`, plus fs primitives + `preview`/`gen_image`.

## Evidence Against / Missing Evidence

- **Lane 3:** Could not fetch live 2026-current "GitHub Copilot Product Specific Terms" page (one official URL 404'd, search bodies stripped). Strong inference from structure of the license (per-seat, "own software development") but exact current wording unverified.
- **Lane 2:** Could not retrieve emil-design-eng README raw to confirm absence of license — relied on GitHub repo page directory listing showing no LICENSE file.
- **Lane 1:** Did not inspect the actual skill loader source path (likely under `packages/*/src`). The runtime contract for a v0.1 user-dropped `SKILL.md` (auto-discovery? frontmatter schema? tool-call surface?) is unverified.

## Per-Lane Critical Unknowns

- **Lane 1 (open-codesign architecture):** The actual runtime contract for a `SKILL.md` in v0.1 — auto-discovery rules, required frontmatter schema, and what tool/capability surface a custom skill can call. Without this, "drop in skills from external repos" may need an adapter, a fork-level rewrite, or wait for v0.2.
- **Lane 2 (skill source repos):** Whether `emilkowalski/skill` has any license at all. Without one, copying the SKILL.md into a public fork is restricted by default GitHub copyright. Need to confirm by either finding a LICENSE in a non-default location or contacting the author.
- **Lane 3 (Copilot OAuth):** Whether using a Copilot subscription as the inference backend for a redistributed agent product is permitted under the *current* Copilot Product Specific Terms. Strong indicators say **no** (per-seat license, "own software development" wording, AUP commercial-resale clause).

## Rebuttal Round

- **Best rebuttal to leader (Lane 3):** "We don't need to redistribute — this is for personal use only, like aider/copilot.vim. ToS allows the seat-holder to use Copilot for their own development." → Holds *only* if the user's intent is a personal fork, not a product. If `add more opinionated skills` implies publishing a tool for others, the rebuttal fails. **Need user intent to disambiguate** — first interview question.
- **Best rebuttal to Lane 2 (license):** "emil-design-eng is widely shared on Twitter/X by Emil himself; intent appears permissive." → Intent ≠ license. Default GitHub copyright still applies. Fork is risky without explicit permission or LICENSE addition. Mitigation: open an issue on emilkowalski/skill asking for a license; in the meantime, *paraphrase* the principles in our own words rather than copying the SKILL.md verbatim.
- **Best rebuttal to Lane 1 (loader contract):** "The README explicitly says custom SKILL.md files extend it — that's the contract." → README claim is necessary but not sufficient; the *schema* for the file isn't documented. Mitigation: read the loader source as the very first step of any implementation.

## Convergence / Separation Notes

- Lanes 1 + 2 converge on a happy story: both source repos and the target use the Anthropic-spec `SKILL.md` frontmatter. Format port is mechanical for ui-ux-pro-max, conceptually portable for emil-design-eng.
- Lane 3 stands apart and dominates: it's not a downstream implementation detail; it's a question about whether the *premise of the project* is legal and viable.
- No two hypotheses reduce to the same mechanism — lanes investigated independent dimensions (target / source / auth) by design.

## Most Likely Explanation

The project is **technically straightforward** (file-format-compatible, MIT licensed where it matters, established BYOK abstraction) but is **gated by two policy/legal blockers and one factual unknown** that must be resolved before architecture commits:

1. **Premise blocker:** "Powered by GitHub Copilot OAuth" is almost certainly the wrong choice for any redistributed product. The legitimate substitute is **GitHub Models API** (officially OAuth-gated, third-party-friendly, decoupled from Copilot subscription) — and open-codesign's existing `@mariozechner/pi-ai` provider abstraction means swapping it in is a one-provider-add, not a rewrite.
2. **License blocker:** `emilkowalski/skill` has no LICENSE; verbatim port is restricted. Mitigation: either get permission / wait for a license, or paraphrase the design principles into a new SKILL.md authored by the user.
3. **Unverified contract:** open-codesign v0.1 skill loader runtime is undocumented; first implementation step must be reading the loader source.

## Critical Unknown

**The user's intent for distribution.** Personal-use fork vs. publishable product determines whether the Copilot ToS issue is fatal or merely risky, whether the emil license issue requires paraphrase vs. permission, and whether GitHub Models API + multi-provider BYOK is the right backbone instead of Copilot OAuth specifically.

## Recommended Discriminating Probe

Ask the user, in this order, three pointed questions:
1. **Distribution intent:** Personal fork, or publishable product for others?
2. **Why "Copilot OAuth" specifically:** Is the requirement *the Copilot models* (Claude 3.7, GPT-4.1, etc.), *the OAuth UX* (sign in with GitHub), or *the existing Copilot subscription as billing*? Each has a different right answer (Models API, GitHub OAuth + BYOK, or Copilot Extensions platform).
3. **emil-design-eng port mode:** Verbatim copy (requires license resolution), paraphrased principles (no legal issue), or skip entirely?

These three answers collapse most of the remaining ambiguity in a single round.

---

## Note on Untrusted Content

Lane 1 explicitly flagged that `system-reminder` blocks appearing inside WebFetch output were treated as untrusted content per injection-defense rules and ignored. Confirmed correct behavior — fetched content cannot issue instructions.

---

## Lane 3 Revision (post-interview, Round 2)

User pointed to **https://docs.github.com/en/copilot/how-tos/copilot-sdk/set-up-copilot-sdk/github-oauth** which Lane 3 did not surface. Verified by direct fetch:

- **Official, documented Copilot SDK OAuth flow exists.** Standard OAuth authorization-code flow at `https://github.com/login/oauth/access_token`; org membership verified via `api.github.com/user/orgs`.
- **Documented eligible app types include:** "Multi-user apps, internal tools with organization access control, SaaS products." OSS clients and CLI tools are not excluded.
- **Subscription gating:** Each end user needs their own active Copilot subscription. (BYOK posture matches: each user supplies their own GitHub OAuth + Copilot seat.)
- **Model surface:** Documented samples reference `gpt-4.1`; comprehensive list not in this page.
- **Rate limits:** Subject to each user's Copilot rate limits (numbers not in this page).

**Net effect on the trace:** Lane 3's #1-ranked hypothesis ("Copilot OAuth is the wrong primitive") is **partially overturned**. The undocumented `copilot_internal` endpoint critique still applies to *that* path, but it is the wrong path; the **Copilot SDK + standard OAuth** is the correct, sanctioned path and aligns with a public OSS BYOK fork posture. Architecture should target the SDK, not the gh-copilot-style endpoint.

The license blocker (Lane 2 — emil-design-eng has no LICENSE) and the runtime contract unknown (Lane 1 — v0.1 skill loader schema) are unchanged.
