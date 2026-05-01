# Attribution

This project, **atv-design**, is a hard fork of [OpenCoworkAI/open-codesign](https://github.com/OpenCoworkAI/open-codesign) with extensions. The full text of every upstream MIT license is preserved in [`NOTICE`](./NOTICE).

## Direct Fork Base

### OpenCoworkAI/open-codesign

- **Source:** https://github.com/OpenCoworkAI/open-codesign
- **License:** MIT
- **Description (upstream):** "Open-source Claude Design alternative. One-click import your Claude Code / Codex API key. Prompt → prototype / slides / PDF. Multi-model (Claude, GPT, Gemini, Kimi, GLM, Ollama). BYOK, local-first, MIT."
- **What atv-design changes vs upstream:**
  - Hard rebrand (project name, window title, config dir)
  - New provider: official GitHub Copilot SDK with OAuth + PKCE
  - Ported skill bundle: `skills/ui-ux-pro-max/`
  - Original-prose skill inspired by Emil Kowalski's animation principles: `skills/emil-design-eng-inspired/`
  - Hardened security checklist forbidding undocumented Copilot endpoints

## Bundled Skill — Verbatim Port

### nextlevelbuilder/ui-ux-pro-max-skill

- **Source:** https://github.com/nextlevelbuilder/ui-ux-pro-max-skill
- **License:** MIT
- **Use:** Verbatim port. The skill files, palettes, font pairings, product reasoning rules, UX guidelines, and chart taxonomies are imported under the upstream MIT license, with the full upstream license text preserved in [`NOTICE`](./NOTICE) and a per-bundle README at [`skills/ui-ux-pro-max/README.md`](./skills/ui-ux-pro-max/README.md).
- **What atv-design did NOT take:** the `uipro-cli` shim and the shadcn/ui MCP integration are not part of this fork. Only the skill content + supporting data was ported.

## Inspired-By, Not Verbatim

### emilkowalski/skill (skills/emil-design-eng/SKILL.md)

- **Source:** https://github.com/emilkowalski/skill (specifically `skills/emil-design-eng/SKILL.md`)
- **License at time of fork (2026-04-30):** **No LICENSE file present in the upstream repository.**
- **Implication:** Default GitHub copyright applies — no permission is granted to redistribute upstream prose.
- **What atv-design did:** authored a NEW SKILL.md ([`skills/emil-design-eng-inspired/SKILL.md`](./skills/emil-design-eng-inspired/SKILL.md)) capturing the same animation *principles* in original prose. **Zero verbatim text from the upstream SKILL.md was copied.** The original repository is credited as inspiration in the SKILL.md body and in the per-bundle README.
- **Open question (tracked):** an issue has been opened on `emilkowalski/skill` requesting a permissive license (MIT or CC0). If granted, this fork can swap from paraphrase to direct attribution + verbatim if doing so improves the developer experience.

## Trademarks

GitHub®, Copilot®, and any other third-party names referenced in this fork are trademarks of their respective owners. Their mention in atv-design's documentation, configuration files, or UI strings is purely descriptive and does not imply endorsement.
