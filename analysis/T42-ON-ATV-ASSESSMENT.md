# Assessment: "Terminal 42 frontend + UX on the ATV Design backend"

> Requested framing: *we are taking the frontend of Terminal 42 and the user
> experience from Terminal 42 and making it functional with the backend that
> was created in ATV Design.*
>
> This document states, honestly, **how close that framing is to what the code
> actually does today** — so the PR back to `All-The-Vibes/ATV-Design` describes
> reality, not aspiration.

## Verdict

The framing is **directionally correct but overstated as a literal description.**

What actually shipped is a **selective, feature-by-feature port of Terminal 42's
best frontend assets onto ATV Design's backend, reconciled through a translation
layer** — not a wholesale frontend swap where T42's UI runs unchanged on ATV's
backend.

A precise one-line version, safe to put in the PR:

> *"Port Terminal 42's design-canvas UX and dark pro-tool visual language onto
> ATV Design's tested, secure, provider-rich backend — behind a data-model
> translation layer, keeping ATV's trunk intact."*

## Why it isn't a literal frontend swap

The two apps disagree at the data-model level. That single fact (documented in
`analysis/MERGE-ARCHITECTURE.md`) is why a swap is impossible without adaptation:

| | ATV Design (kept as trunk) | Terminal 42 (parts donor) |
|---|---|---|
| A "design" is | one inline `index.html` snapshot (DB row) | multi-version files on disk |
| Generation emits | `agent:event:v1` — one file at a time | `onVersion { latest, versions[] }` — full list each render |
| Preview iframe | sandboxed null-origin `srcdoc` (postMessage) | same-origin `srcDoc` (direct DOM access) |
| Drive model | synchronous request/response | fire-and-forget chat queue |
| Copilot integration | **client-side HTTP/SDK** (app is the client) | **CLI-subprocess** wrapper (`copilot` binary is the client) |

Because generation, storage, and the Copilot integration differ, T42's frontend
cannot bind directly to ATV's backend. The port routes T42's UI callbacks
through an adapter that projects ATV's event stream into the shape T42's canvas
expects.

## What was actually taken from Terminal 42

Carried over (the genuine T42 assets):

1. **Data-model + event translation layer** —
   `apps/desktop/src/renderer/src/lib/design-stream-adapter.ts`. Consumes ATV's
   `AgentStreamEvent`s and emits T42's `onStart/onDelta/onPhase/onVersion/onDone`
   callback contract. Stateful `fs_updated` → `versions[]` accumulation with
   dedupe + modified-time ordering. Locked by 30 tests.
2. **DesignCanvas split units** — `token-inspector.ts` (live CSS-var inspection)
   and `viewport-profiles.ts` (responsive viewport registry). These are the two
   most valuable pieces of T42's canvas, extracted as testable units.
3. **Dark pro-tool reskin** — `packages/ui/src/tokens.css` `.dark` block. T42's
   cool near-black canvas, three-step surface ladder, sky-blue accent, mapped to
   OKLCH. **ATV's token *names* are preserved**, so the ~9 consumers need no
   edits — only the values change. The light theme stays ATV's warm cream.

Explicitly **not** taken (documented in `ATTRIBUTION.md`):

- T42's Copilot-CLI backend and `~/.copilot/session-state` coupling
- The Brain-via-PTY mechanism
- The raw terminal surface
- Dead code and hardcoded personal assets

## What is ATV Design's backend (kept intact)

Everything security- and correctness-critical stays ATV's:

- Providers (Copilot SDK via OAuth+PKCE, Azure OpenAI/Foundry via Entra ID, and
  BYOK for Claude/GPT/Gemini/DeepSeek/Kimi/GLM/Ollama)
- Agent orchestration, prompt intelligence, skills system
- Storage (SQLite snapshots + workspace files)
- Security posture (forbidden-endpoints CI, documented OAuth flow)
- The full test suite and CI

## Honest gaps vs. the aspiration

Where "T42 UX made functional on ATV" is **not yet** fully realized:

- **The canvas is ported as units, not as T42's whole screen.** `token-inspector`
  and `viewport-profiles` are in and tested; the complete T42 DesignCanvas
  composite (command palette, chat-queue + PlanChecklist, VizTweak, voice) is
  **not** all wired into the live renderer yet. Those remain donor parts for
  follow-up slices.
- **End-to-end generation was not exercised with a live provider key in this
  pass.** The translation layer is unit-proven (30 tests) and the UI renders, but
  a full prompt→artifact round trip through a real Copilot/Azure key is a
  separate verification.
- **The reskin is a token-value remap, not a component-level redesign.** It
  changes how the app *looks* in dark mode; it does not restructure ATV's
  component tree to match T42's layout everywhere.

## Bottom line for the PR

State it as a **port behind a translation layer**, list the three concrete assets
taken, and name the parts still on the donor bench. That is accurate, defensible,
and still tells the "T42 look and canvas UX, ATV engine" story the goal intends.
