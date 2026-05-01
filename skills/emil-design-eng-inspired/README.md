# skills/emil-design-eng-inspired

> **Status:** Inspired-by, not verbatim.
> **Inspiration source:** https://github.com/emilkowalski/skill (specifically `skills/emil-design-eng/SKILL.md`)
> **Author of this fork's prose:** atv-design contributors, 2026-04-30

## Why this skill exists

The upstream skill, authored by Emil Kowalski, captures a tightly-opinionated set of motion-design principles for production web UI. It is widely respected in the React/Radix/Framer-Motion community for prescribing concrete defaults — easing curves by direction, duration ranges by component class, the transform-and-opacity restriction, the scale-from-0.95 rule, the reduced-motion handling — that most teams arrive at independently after years of iteration. Rather than re-derive those principles, atv-design embraces the same conclusions.

## Why this is a paraphrase, not a port

At the time of forking (2026-04-30), the upstream repository `emilkowalski/skill` carried no LICENSE file. Under default GitHub copyright, that means no permission was granted to redistribute the upstream prose. Copying the SKILL.md into this fork verbatim would be infringement.

atv-design's response: keep the *principles*, write fresh prose around them. The SKILL.md in this directory was authored by atv-design contributors with the upstream open in a separate window for cross-checking that the prescriptions match — but no sentences, phrases, or examples were copied. Verification rule applied: `git diff` against the upstream SKILL.md must show zero verbatim phrases of more than 15 words. (This rule was committed as acceptance criterion A7 in the consensus plan at `.omc/plans/ralplan-fork-open-codesign-copilot-skills-final.md`.)

## What changes if upstream adds a license

If `emilkowalski/skill` adds an MIT, CC0, or similarly permissive license, atv-design may swap this paraphrase for a direct attribution + verbatim port, since direct prose with explicit credit is usually clearer than a paraphrase. There is an open issue tracking this on the upstream:

- _Issue link:_ to be filled in when the issue is opened. Until then, this README serves as the public statement of intent.

## How to use this skill

The skill activates when the agent or user is producing motion: transitions, hover/active states, modal entrances, list reorderings, popover positioning, and similar. It prescribes concrete defaults rather than abstract guidance — see the SKILL.md in this directory for the full set of rules.

## Differences in scope vs. the upstream

- **Same:** the easing-curve-by-direction rules, the duration bands, the transform/opacity restriction, the scale floor at 0.95, the press feedback at 0.97, the prefers-reduced-motion handling, the hover-media-query gate, the popover origin rule, the interruptibility argument for transitions over keyframes.
- **Slight extensions in this fork:** the "motion budget per interaction" guideline (one load-bearing motion per click), the "things that look like motion but are really layout" callout (FLIP for reorders, max-height for accordions), and the "when the rules conflict" tiebreaker. These extend the upstream's principles rather than contradicting them.
- **Different:** word choice, examples, ordering of sections, and organizational framing throughout — by design, since the prose had to be original.

## License

The prose in `skills/emil-design-eng-inspired/SKILL.md` and in this README is licensed under the MIT License of the atv-design fork (see root `NOTICE`). The *principles* it captures are not copyrightable as such, but credit to Emil Kowalski for popularizing this particular configuration of them is given here, in the SKILL.md, and in the root `ATTRIBUTION.md`.
