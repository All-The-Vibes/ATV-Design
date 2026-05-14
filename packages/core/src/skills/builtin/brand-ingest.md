---
schemaVersion: 1
name: brand-ingest
description: >
  Activate when the user names a brand, aesthetic, or design reference before
  requesting a design. Instructs the agent to call read_brand first to populate
  DESIGN.md with extracted tokens, then generate against those tokens.
trigger:
  providers: ['*']
  scope: system
disable_model_invocation: false
user_invocable: true
---

# Brand Ingest

Activate this skill when the user references an external brand, aesthetic, or design inspiration before requesting a design artifact.

## When to Activate

This skill triggers on phrases like:
- "Stripe-style", "Linear-aesthetic", "Vercel-style", "Notion-style"
- "Build something like {Brand}"
- "Match {company}'s design", "similar to {brand}"
- "Brand from {url}", "ingest brand from {url}", "read brand from {url}"
- "Fetch the brand from {url}"
- "This site's design", "screenshot of {brand}"
- "{brand} aesthetic", "{brand} palette", "{brand} color scheme"

## Protocol

**Before generating any design artifact when a brand or reference URL is named:**

1. **Call `read_brand` first.** Pass the brand's primary URL or the user-supplied URL/path:
   ```
   read_brand({ source: { kind: "url", value: "https://stripe.com" } })
   ```
   Or for a local repo:
   ```
   read_brand({ source: { kind: "repo", value: "/path/to/repo" } })
   ```

2. **Wait for DESIGN.md to be updated.** The tool writes extracted tokens (colors, fonts, spacing, radius, shadows) to `DESIGN.md` in the workspace.

3. **Call `read_design_system`** to load the freshly-written tokens into context.

4. **Generate the design artifact** using the tokens from DESIGN.md as the source of truth.

## Why This Matters

Per Hard Constraint #8: **Brand values are data, not model memory.** Do not invent brand colors or typography from training data. Always extract from the live source and persist to DESIGN.md before generation.

Relying on memorized brand values leads to:
- Incorrect hex values (Stripe's blue is not `#0070f3` in their current system)
- Stale type stacks (brands update typography)
- Legal risk from invented brand identities

## Fallback Behavior

If `read_brand` returns warnings (e.g. Chrome not found for URL extraction, or Git not available), communicate the limitation to the user, then offer alternatives:
- Ask the user to supply a local repo path instead of a URL
- Ask the user to paste brand CSS variables directly
- Ask the user to attach a screenshot (kind:"image" — v1 returns guidance on next steps)

## Token Priority

When generating, apply DESIGN.md tokens with this priority:
1. Colors → CSS custom properties on `:root`
2. Fonts → `font-family` on body and headings
3. Spacing → padding/gap values matching the extracted scale
4. Radius → `border-radius` tokens
5. Shadows → `box-shadow` tokens

Do not invent additional colors or fonts beyond what's in DESIGN.md unless the extracted set is genuinely too sparse (< 2 colors, no fonts) — in that case, note the gap and ask the user to confirm defaults.
