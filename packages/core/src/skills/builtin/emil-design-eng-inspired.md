---
schemaVersion: 1
name: emil-design-eng-inspired
description: Animation and micro-interaction principles for production UI. Use when reviewing or authoring transitions, hover/active states, modal entrances, list reorderings, or any motion-bearing component. Prescribes which CSS properties to animate, which easing curves to use for which direction, and what duration ranges keep an interface feeling responsive without feeling abrupt.
---

# emil-design-eng-inspired

> **About this skill.** The principles below are inspired by Emil Kowalski's `emil-design-eng` skill at https://github.com/emilkowalski/skill (specifically `skills/emil-design-eng/SKILL.md`). That upstream skill carries no LICENSE, so the prose here was authored fresh by atv-design contributors rather than copied. If the upstream adds a permissive license, this skill may be replaced with a direct port; until then, treat this file as a paraphrase with attribution.

---

## When to use this skill

Trigger any time the agent or user is producing motion: page transitions, dropdown opens, modal/dialog mounts, popover positioning, list item reorderings, mobile sheet drags, hover responses on interactive elements, focus rings, button press feedback, drag handles, accordion expands, tab switches, route changes, toast appearances, skeleton-to-content swaps. Do **not** invoke this skill for purely static layouts, color-only changes, or content that has no temporal component.

## Core principle: motion communicates state change

Animation in product UI exists to make a state change *legible*, not to draw attention to itself. A transition that is so subtle the user does not consciously register it has done its job; one the user has to wait through has failed. Optimize for clarity of cause-and-effect: the user clicked a button, therefore something moved, therefore something changed. Anything that breaks that chain — including a delay long enough to make the cause-effect link feel uncertain — is a defect.

## Property selection: animate transform and opacity, not layout

Restrict the animated CSS properties to `transform` and `opacity`. Avoid animating `width`, `height`, `top`, `left`, `right`, `bottom`, `margin`, `padding`, `border-width`, or any property that triggers a layout pass. The reason is that browsers can hand `transform` and `opacity` to the compositor, which means the animation runs on a separate thread and does not contend with the main thread for time. Layout-triggering properties force a relayout and repaint each frame; on a busy main thread (which is most product UI most of the time), that produces visible jank.

Practical consequence: if you need to animate "size," do it with `transform: scale(...)` rather than `width`/`height`. If you need to animate "position," do it with `transform: translate(...)` rather than `top`/`left`. If you need both, set the *final* layout in CSS first, then animate the visual offset with `transform` and let it settle to identity at the end.

## Easing: direction and curve

The easing curve communicates the *physical model* the user implicitly applies to the motion. Different curves for different directions:

- **Things entering the screen** (a modal mounting, a toast sliding in, a popover opening): `ease-out`. The element is decelerating toward rest. This feels like an object catching up to where the user expects it.
- **Things leaving the screen** (a modal dismissing, a toast auto-hiding, a popover closing): `ease-in` is acceptable, but a faster `ease-out` or even a linear curve under 150ms also reads well. Exit motion is less load-bearing — the user has already moved on.
- **Things moving while remaining on screen** (a list item changing rank, an accordion expanding to reveal already-visible content shifting down, a layout reflow inside a stable container): `ease-in-out`. The element is accelerating from one rest position and decelerating into another.
- **Avoid `ease-in` for entrances.** A modal that accelerates as it appears feels like it is *avoiding* the user — the motion implies departure, not arrival. Reserve `ease-in` for exits.

When in doubt, prefer `ease-out` for any motion the user causally triggered (a click, a tap, a key press) and `ease-in-out` for any motion the system schedules (a list reordering after a server response, a layout settling after a width change).

## Duration: tight upper bounds by component class

Default durations should be **short**. The longer a transition, the more time the user spends waiting for it to finish before they can interact again. Calibrated bands:

- **Buttons / press feedback / focus rings:** roughly 100–160 ms. This range is short enough to read as "instant" while long enough to confirm the action was registered.
- **Dropdowns, popovers, tooltips:** roughly 150–250 ms. The element has to travel a small distance and the user wants to engage with it the moment it stops.
- **Modals, sheets, full-screen dialogs:** roughly 200–500 ms. Larger surfaces can carry slightly longer motion without feeling slow, but anything over 500 ms starts to feel like a load screen.
- **Whole-page transitions and layout reflows:** keep under 300 ms in nearly all cases. If the change is large enough to need more time, consider whether the change should be staged (a fade-out, then a layout, then a fade-in) rather than animated as a single curve.

Concrete heuristic: if you find yourself reaching for `400ms` or longer on anything that isn't a modal-class component, the motion is probably overdesigned. Cut it in half and ask whether the result still communicates the state change.

## Scale specifics

When using `transform: scale(...)` for entrances or press states:

- **Entrance scale floors at `0.95`, not `0`.** A modal that scales from 0 looks like a black hole opening; from `0.95` it looks like a card stepping forward. The opacity transition from 0 to 1 carries the "wasn't here, now is" semantic; the scale carries depth.
- **Press feedback uses `:active { scale: 0.97; }` (or thereabouts).** A 3% reduction is enough for the user to feel the press without changing the layout enough to misregister adjacent hit targets.
- **Popover scale origins.** A popover that scales-in from its center looks unanchored. Set the scale origin to the side closest to its anchor element. If using a primitive that exposes a CSS variable for this (Radix UI exposes `--radix-popover-content-transform-origin` and equivalents on its other content components), use it; otherwise compute the origin from the anchor's bounding rect.

## Hover, pointer, and reduced motion

Three accessibility-shaped rules:

1. **Gate `:hover` states behind `@media (hover: hover) and (pointer: fine)`.** A `:hover` rule applied unconditionally fires on touch devices when the user taps, then sticks until the user taps somewhere else, producing "stuck hover" UI states. The media query restricts hover-affordance behavior to devices with a real cursor.
2. **Respect `prefers-reduced-motion: reduce`, but do not interpret it as zero motion.** Users who set the OS-level reduced-motion preference are saying "do not parallax-scroll my screen" or "do not slide the modal across the viewport," not "freeze everything." Acceptable response: shorten durations to roughly 100 ms, drop scale transforms to 1 (or near-1), keep opacity transitions, and remove any non-essential motion (background animations, decorative micro-interactions, animated illustrations). The interface still moves; it moves less.
3. **Touch press feedback differs from hover feedback.** On touch, the user gets no hover preview, so the press itself has to carry more weight. Pair the `:active` scale with a brief `opacity` dip (e.g., 0.85 for 80 ms) so the press is perceptible even when the user's finger occludes the button.

## Interruptibility: prefer CSS transitions over keyframes

For state-driven motion (a class is added or removed; a property switches; an element mounts or unmounts), prefer `transition` over `@keyframes`. The reason is interruptibility. If the user clicks "Open" and immediately clicks "Close" before the open animation finishes, a CSS `transition` automatically interpolates from the current visual state to the new target state �� the motion reverses smoothly. A `@keyframes` animation has to play out or be aborted abruptly; reversing requires a separate keyframe definition or a JS controller.

Reserve `@keyframes` for: looping background motion, complex multi-stage animations the user cannot interrupt (a confetti burst, a check-mark draw), and decorative moments that exist for delight rather than for state communication.

## Things that look like motion but are really layout

Resist the temptation to animate layout. If a list reorders, the *items themselves* should appear to move (FLIP technique: snapshot positions before, snapshot after, compute the delta, apply an inverse `transform`, transition `transform` to identity). Animating `top`/`left` to fake the same effect produces relayout-induced jank.

Same rule for accordion expanders: the height change should be communicated by the *content* settling into place, not by an animated `height` property. If an accordion absolutely must animate height, animate `max-height` with a generous ceiling and accept that it will not feel as crisp as the FLIP approach.

## Motion budget per interaction

A single user interaction — one click, one tap, one drag-end — should produce **one** load-bearing motion. If a click both opens a modal *and* slides a sidebar *and* fades a backdrop *and* repositions a tooltip, the user cannot tell which motion is the consequence of their action. Pick the most informative motion (usually the modal entrance), let it carry the meaning, and play the others as silently as possible (instantaneous opacity changes, no transforms).

## When the rules conflict

If you have to choose between *correct curve* and *correct duration*, choose the duration. A 200 ms `linear` transition reads as fine; a 600 ms `ease-out` transition reads as slow. If you have to choose between *animating layout* and *not animating at all*, choose not animating. A list whose items snap to new positions is fine; a list whose items jankily slide is not.

## Cross-references

- For component-level UI patterns (dropdown structure, modal anatomy, sheet behavior on mobile), see the `ui-ux-pro-max` bundle.
- For the underlying design system (palettes, typography pairings, product-type reasoning rules), see the atv-design built-in skills and the `ui-ux-pro-max` data files.
- For the upstream that inspired this skill, see https://github.com/emilkowalski/skill.
