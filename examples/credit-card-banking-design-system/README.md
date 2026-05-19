# Vaultline Card design system

This ATV Design example contains a complete design-system handoff for a fictional credit-card banking app.

`index.html` was generated through the actual ATV Design core agent runtime. See `GENERATION.md` for the exact entrypoint, provider wire, model, prompt, timestamp, and token usage.

## Files

- `DESIGN.md` — product principles, token rules, component specs, motion, accessibility, and copy guidance.
- `tokens.json` — machine-readable primitive → semantic → component token contract.
- `GENERATION.md` — provenance for the ATV Design generation run.
- `index.html` — ATV-generated visual specimen that demonstrates the design system in an interactive banking app surface.

## Use with ATV Design

Use `DESIGN.md` as authoritative brand/context input when prompting ATV Design to generate card, payment, transaction, rewards, or security screens. The app should treat the workspace files as the design source of truth rather than relying on model memory.

Example prompt:

> Use this workspace's DESIGN.md and tokens.json to design a mobile credit-card banking home screen for Vaultline Card. Show current balance, payment timeline, freeze-card control, transaction rows, rewards, and visible security state.

## Safety and brand notes

Vaultline Card is fictional and is not affiliated with any issuer, payment network, bank, or device platform. The system avoids copied trade dress, dark-pattern rewards, hidden APR/fee states, and color-only risk indicators.
