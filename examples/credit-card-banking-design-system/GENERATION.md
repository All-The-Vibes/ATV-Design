# ATV Generation Provenance

This example's `index.html` was generated through the ATV Design core agent runtime.

- Generated at: 2026-05-06T18:29:41.603Z
- Run id: atv-credit-card-1778092181589
- Entrypoint: `@atv-design/core.generateViaAgent()`
- Provider: chatgpt-codex
- Wire: openai-codex-responses
- Base URL: https://chatgpt.com/backend-api
- Model: gpt-5.3-codex
- Prompt: see below
- Output: `index.html`
- Token usage: input=19991, output=110, costUsd=0

## Prompt

```text
Create a polished, production-quality design system specimen for a credit-card banking app.

Product: Vaultline Card, a premium mobile-first credit card and banking experience.

The generated artifact must be a design-system showcase, not a generic banking dashboard. It should include:
- Foundation tokens: color, typography, spacing, radius, shadow/elevation, motion, data-viz colors.
- Semantic banking tokens: available credit, utilization, due soon, pending, fraud risk, autopay, rewards.
- Component specimens: credit card hero, balance summary, payment due module, transaction row states, reward meter, card controls, fraud alert, statement chip, secure form fields, status banners.
- Interaction states: default, hover/focus, disabled, loading/skeleton, error, success, pending.
- Accessibility/compliance notes embedded in the UI: visible focus, non-color-only risk states, minimum contrast, clear APR/fee disclosure hierarchy, reduced-motion support.
- A distinctive visual direction: premium dark graphite + luminous mint/blue security accents, restrained glass surfaces, editorial financial typography.

Use ATV Design's agentic artifact format: write the complete artifact to index.html via the text editor tool, include tweakable design tokens, and call done when complete.
```

## Assistant summary

Done — I created a full design-system specimen for Vaultline Card in `index.html` with premium dark graphite styling, luminous mint/blue security accents, and editorial financial typography.  
I separated foundation and semantic banking tokens, then paired them with concrete component specimens and a dedicated interaction-state matrix (including loading, empty, success/error, and pending variants).  
I also embedded compliance/accessibility behavior directly in the UI: visible focus rings, non-color-only risk signals, APR/fee disclosure hierarchy, and a reduced-motion control.
