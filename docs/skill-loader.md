# Skill Loader Contract — Empirical Findings

**Probed:** 2026-04-30
**Source:** `packages/core/src/skills/loader.ts` and `packages/shared/src/skills.ts` from upstream `OpenCoworkAI/open-codesign@main`
**Status:** **PASSED** — A9 acceptance criterion met. The working assumption that v0.1's loader is Anthropic-spec compatible is **confirmed empirically**. Phase 2 (skill bundle ports) can proceed without an adapter.

This document is the empirical answer to the consensus plan's Phase 1a critical-unknown probe. The runbook that produced it is at `docs/skill-loader-probe-plan.md`.

---

## Discovery rules

The loader auto-discovers `*.md` files (only the `.md` extension; `.markdown`, `.mdx`, etc. are ignored) from a flat directory listing. There is **no recursion**: nested directories are not walked. The skill `id` is the basename of the file without the extension.

Discovery happens at three tiers, in priority order **project > user > builtin**. When two skills share the same `id`, the higher-priority tier wins (later wins via `Map.set`):

| Tier | Path | Source label |
|------|------|-------------|
| `project` | `<project>/.codesign/skills/` | `'project'` |
| `user` | `~/.config/atv-design/skills/` (post-rebrand; was `open-codesign`) | `'user'` |
| `builtin` | `packages/core/src/skills/builtin/` | `'builtin'` |

For atv-design, this means:

- **ui-ux-pro-max bundle (Phase 2):** copy upstream `nextlevelbuilder/ui-ux-pro-max-skill` into `packages/core/src/skills/builtin/ui-ux-pro-max/` is **wrong** — the loader does not recurse, so files inside that subdirectory would be invisible. Correct landing path is to **flatten the bundle**: each ported `.md` file lives directly under `packages/core/src/skills/builtin/` with a name-spaced filename (e.g., `ui-ux-pro-max-palettes.md`, `ui-ux-pro-max-styles.md`). Alternative: ship them as a `user`-tier bundle the user copies into their config directory.
- **emil-design-eng-inspired (Phase 3):** the same flattening rule. Land it at `packages/core/src/skills/builtin/emil-design-eng-inspired.md`. Our currently-authored skill at `skills/emil-design-eng-inspired/SKILL.md` needs to move (and the file rename: `SKILL.md` becomes `emil-design-eng-inspired.md` since the `id` is the basename).

This is a **plan amendment**: the consensus plan assumed nested SKILL.md files in `skills/<bundle>/SKILL.md` would be discovered. They will not be. The flattening is mechanical.

## Frontmatter schema (Zod)

The full schema lives in `packages/shared/src/skills.ts`:

```ts
export const SkillFrontmatterV1 = z.object({
  schemaVersion: z.literal(1).default(1),
  name: z.string().min(1),
  description: z.string().min(1).max(1536),
  trigger: z
    .object({
      providers: z.array(z.string()).default(['*']),
      scope: z.enum(['system', 'prefix']).default('system'),
    })
    .default({}),
  disable_model_invocation: z.boolean().default(false),
  user_invocable: z.boolean().default(true),
  allowed_tools: z.array(z.string()).optional(),
});
```

What this means for ports:

- **Required fields:** `name` and `description`. Description is capped at **1536 characters** — porting `nextlevelbuilder/ui-ux-pro-max-skill`'s SKILL.md description verbatim may overflow this; verify.
- **Optional with defaults:** everything else. `schemaVersion: 1`, `trigger.providers: ['*']`, `trigger.scope: 'system'`, `disable_model_invocation: false`, `user_invocable: true`, `allowed_tools: undefined`.
- **Anthropic-spec compatibility:** an Anthropic-style frontmatter with just `name` + `description` will pass validation. The Zod defaults fill in the rest.
- **Filename fallback for `name`:** the loader also passes `name: id` (the file basename) into the merged frontmatter as a default, so a SKILL.md missing `name` in its YAML still validates as long as the filename matches.

### Beyond Anthropic-spec

These fields are atv-design-specific (inherited from upstream open-codesign) and have no Anthropic equivalent:

- **`trigger.providers`** — array of provider IDs the skill applies to. `['*']` means all providers (Anthropic, OpenAI, Gemini, Copilot SDK, etc.). To restrict a skill to a subset, list IDs explicitly.
- **`trigger.scope`** — `'system'` injects the skill into the system prompt; `'prefix'` prepends it to the user message. `'system'` is the right default for almost all skills.
- **`disable_model_invocation`** — when `true`, the LLM cannot self-invoke this skill; it can only be invoked by the user via UI.
- **`user_invocable`** — when `false`, the skill is invisible to the user-facing skill picker but still available to model-driven invocation.
- **`allowed_tools`** — optional whitelist of tool names this skill is allowed to call. If absent, all tools are allowed.

## YAML parsing

The loader uses an **inline custom YAML parser**, not `gray-matter` or `js-yaml`. The supported subset:

- Top-level `key: value` pairs.
- Folded (`>`) and literal (`|`) block scalars.
- Nested block mappings (indented sub-keys).
- Inline sequences: `key: [a, b, c]`.
- Block sequences: `  - item`.
- Scalar types: string, number, boolean, null.

**Not supported:** anchors (`&`/`*`), multi-document streams (`---` mid-file), tagged scalars (`!!str`), complex types.

For ported skills this is a non-issue: Anthropic-spec frontmatter never uses anchors or multi-doc streams. But if a contributor later writes a SKILL.md with YAML anchors, it will silently break in subtle ways.

## Body format

After the closing `---`, everything is the body. The loader stores it as-is (trimmed) in `LoadedSkill.body`. There is no markdown processing in the loader — the body is plain text from the loader's perspective. Downstream code in `packages/providers/src/skill-injector.ts` is what actually renders / templates the body for prompt injection.

## Error handling

- `ENOENT` on the directory itself → empty array (the directory simply not existing is not an error; the loader gracefully returns `[]`).
- Invalid frontmatter (Zod parse failure) → throws `CodesignError` with code `SKILL_LOAD_FAILED` and a list of issues per file.
- Malformed YAML → caught and reported with the file path.

## Provider abstraction notes (R7/R8 follow-up)

Adjacent finding (not strictly Phase 1a): `packages/providers/src/index.ts` is a thin wrapper around `@mariozechner/pi-ai`. The wrapper documents in its top-of-file comment:

> "App code MUST go through this package - never import a provider SDK directly."

This confirms Spec assumption AS1 — the provider abstraction exists and is extensible. Existing providers (Codex OAuth, ChatGPT OAuth, Anthropic, OpenAI, Gemini, etc.) all live under `packages/providers/src/`, with the OAuth-bearing ones following the pattern in `packages/providers/src/codex/` (which contains `oauth.ts`, `oauth-server.ts`, `token-store.ts` and tests for each).

**Pattern for the Copilot SDK provider:** copy `packages/providers/src/codex/` to `packages/providers/src/copilot-sdk/`, replace token-exchange URLs and shape, add PKCE helpers per `docs/adr/0001-byok-oauth-posture.md`.

**Plan amendment — OAuth flow style:** The Codex provider uses a **local loopback HTTP server** (`oauth-server.ts`), not a custom URL scheme. This is a meaningful deviation from the consensus plan's design (which assumed `atvdesign://oauth-callback`). The loopback pattern is more portable across OSes (no `setAsDefaultProtocolClient`, no Windows registry write, no Linux `.desktop` MimeType — just a temporary `http://localhost:RANDOM_PORT/callback`). Recommendation: **adopt the loopback pattern for the Copilot SDK provider too**. It eliminates Pre-mortem Scenario 2 entirely (no packaging-time URL-scheme registration risk). Update ADR 0001 and `docs/oauth-setup.md` accordingly.

## Decision

- **Drop-in compatible** for the Anthropic-spec content we already authored or plan to port. ✅
- **Adapter not needed.** ✅
- **Loader patch not needed.** ✅
- **Filename and path adjustment needed:** flatten `skills/<bundle>/SKILL.md` to `packages/core/src/skills/builtin/<bundle>-name.md`. (Or ship as user-tier bundle.) Mechanical change.
- **OAuth pattern revision:** loopback HTTP server, not custom URL scheme. ADR 0001 follow-up.

## Verification (the gate test that closes A9)

The plan calls for landing one trivial probe SKILL.md, starting the app, and confirming runtime pickup. Because Phase 1b OAuth round-trip is still pending (and `pnpm install` is yet to run), the runtime gate cannot fire today. **Planned verification:**

```bash
mkdir -p packages/core/src/skills/builtin
cat > packages/core/src/skills/builtin/loader-probe-test.md << 'EOF'
---
name: loader-probe-test
description: Trivial skill used to verify atv-design Phase 1a loader probe. Triggered by the literal user prompt "PROBE_LOADER_TEST_TOKEN_42".
---

# Loader Probe Test

If you can read this skill at runtime, the upstream loader is Anthropic-spec compatible and Phase 2 ports succeed.
EOF

pnpm install
pnpm --filter @open-codesign/core test -- skills/loader.test
```

The unit test at `packages/core/src/skills/loader.test.ts` already exercises the loader against fixtures; if it passes after we drop the probe file in, A9 is closed. Convert the runtime gate (start the app) to a follow-up after Phase 1b.

## Cross-references

- Probe runbook: `docs/skill-loader-probe-plan.md`
- BYOK ADR (will need amendment for loopback flow): `docs/adr/0001-byok-oauth-posture.md`
- Consensus plan: `.omc/plans/ralplan-fork-open-codesign-copilot-skills-final.md`
- Spec: `.omc/specs/deep-dive-fork-open-codesign-copilot-skills.md`
