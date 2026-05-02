# ATV Design

**ATV Design** is a local-first design agent. Prompt → prototype, slides, or PDF. BYOK end-to-end with multi-model support (Claude, GPT, Gemini, Kimi, GLM, Ollama, and GitHub Copilot SDK with OAuth + PKCE). Ships with the full `ui-ux-pro-max` skill bundle and an original animation-design skill.

Built on [OpenCoworkAI/open-codesign](https://github.com/OpenCoworkAI/open-codesign) (MIT). See [NOTICE](./NOTICE) and [ATTRIBUTION.md](./ATTRIBUTION.md) for upstream license text and credits.

> **Status:** Phase 1b shipped (GitHub Copilot SDK provider with OAuth + PKCE). Phase 2 (ui-ux-pro-max skill bundle port) and Phase 4 (E2E smoke) pending. See `.omc/HANDOFF.md` for the full resume runbook and remaining work.

---

## What changed vs. upstream open-codesign

| Area | Upstream | atv-design |
|------|----------|-----------|
| Branding | open-codesign | atv-design |
| Config dir | `~/.config/open-codesign/` | `~/.config/atv-design/` |
| OAuth scheme | (upstream's) | `atvdesign://oauth-callback` |
| Providers | Anthropic, OpenAI, Gemini, DeepSeek, Kimi, GLM, Ollama, OpenAI-compatible (BYOK) | All of the above **plus** GitHub Copilot SDK with PKCE |
| Skill bundles | 12 built-in design modules | + `skills/ui-ux-pro-max/` (verbatim port, MIT) + `skills/emil-design-eng-inspired/` (paraphrase, original prose) |
| License hygiene | (upstream MIT) | NOTICE with full upstream MIT text from open-codesign and ui-ux-pro-max + per-bundle READMEs |
| CI | (upstream's) | + `.github/workflows/forbidden-endpoints.yml` blocking regressions to undocumented Copilot endpoints |
| Auth posture | (varies by provider) | BYOK end-to-end with one BYOK ADR committed (`docs/adr/0001-byok-oauth-posture.md`) |

The upstream stack — Electron + TypeScript + React 19 + Vite 6 + Tailwind v4, pnpm/turbo monorepo — is preserved as-is. atv-design does not migrate the stack.

---

## Setup

### Prerequisites

- An active GitHub Copilot subscription (any paid tier) — only required if you plan to use the Copilot provider; other BYOK providers work without it.
- Node.js 22 LTS (see `.nvmrc`) and pnpm 9.15+ (pinned via `packageManager` in `package.json`).
- Git.

### Quick start

```bash
git clone https://github.com/All-The-Vibes/ATV-Design.git atv-design
cd atv-design
pnpm install
pnpm dev
```

On first launch, click **Sign in with GitHub** in the provider picker. The OAuth consent screen will appear in your browser; authorize, return to the app, and you're connected. See [`docs/oauth-setup.md`](./docs/oauth-setup.md) for the per-OS notes and the self-registration alternative.

---

## Skill bundles

atv-design loads skills from three tiers — `<project>/.codesign/skills/`, `~/.config/atv-design/skills/`, and the built-in bundle — with project > user > builtin priority. The full discovery contract is documented in [`docs/skill-loader.md`](./docs/skill-loader.md).

Three sources of skills are planned for the built-in bundle:

1. **Upstream open-codesign built-ins** (12 modules: dashboards, landing pages, pricing tables, chat UIs, etc.). Inherited from upstream — *shipped*.

2. **`skills/emil-design-eng-inspired/`** — animation and micro-interaction principles. Authored fresh for atv-design from the principles in `emilkowalski/skill` (which has no LICENSE at fork time); see [`skills/emil-design-eng-inspired/README.md`](./skills/emil-design-eng-inspired/README.md) for the inspired-by-not-verbatim posture. *Shipped.*

3. **`skills/ui-ux-pro-max/`** — full port of `nextlevelbuilder/ui-ux-pro-max-skill`. 67 UI styles, 161 color palettes, 57 font pairings, 161 product reasoning rules, 99 UX guidelines, 25 chart types. MIT licensed. *Planned (Phase 2). See `.omc/HANDOFF.md` Step 8.*

---

## Architecture decisions

Important decisions are logged as ADRs under `docs/adr/`:

- [`0001-byok-oauth-posture.md`](./docs/adr/0001-byok-oauth-posture.md) — Why atv-design uses a fork-published public GitHub OAuth client ID with PKCE, and how to opt out via self-registration.

---

## Security

atv-design uses **only the documented Copilot SDK OAuth flow** ([docs](https://docs.github.com/en/copilot/how-tos/copilot-sdk/set-up-copilot-sdk/github-oauth)). The undocumented `copilot_internal` token exchange used by some reverse-engineered third-party clients is forbidden by the security checklist and blocked by the CI grep at `.github/workflows/forbidden-endpoints.yml`. See [`docs/security-checklist.md`](./docs/security-checklist.md) for the full set of rules.

To report a security issue, open a GitHub Security Advisory.

---

## Known limitations (M1)

This fork's M1 milestone explicitly does not ship:

- Tagged releases or prebuilt binaries (`pnpm dev` only).
- npm publish.
- Hosted/SaaS deployment.
- shadcn/ui MCP integration.
- `uipro-cli` shim.
- Auto-migration from `~/.config/open-codesign/` to `~/.config/atv-design/`.

See [`docs/known-issues.md`](./docs/known-issues.md) for the full catalog and the M2 follow-ups.

---

## Attribution

This fork is built on the work of:

- **OpenCoworkAI/open-codesign** — the base; MIT-licensed.
- **nextlevelbuilder/ui-ux-pro-max-skill** — bundled as a verbatim port; MIT-licensed.
- **Emil Kowalski's `emilkowalski/skill`** — inspired the `skills/emil-design-eng-inspired/` skill (paraphrase, original prose; no LICENSE on upstream at fork time).

Full attribution and license text in [`ATTRIBUTION.md`](./ATTRIBUTION.md) and [`NOTICE`](./NOTICE).

---

## License

atv-design is distributed under the [MIT License](./NOTICE). The full text of every upstream license is preserved in [`NOTICE`](./NOTICE) per MIT's notice-preservation clause.

---

## Contributing

Before opening a PR, please:

1. Read [`docs/security-checklist.md`](./docs/security-checklist.md) if your change touches auth, OAuth, providers, or Copilot.
2. Read [`ATTRIBUTION.md`](./ATTRIBUTION.md) if your change adds a new dependency or ported content.
3. Run `pnpm typecheck && pnpm lint && pnpm test` (the three gates the pre-commit hook enforces). End-to-end tests are manual on M1.

The roadmap and acceptance criteria are documented in `.omc/specs/` and `.omc/plans/`. Bug reports and feature requests go in GitHub Issues.
