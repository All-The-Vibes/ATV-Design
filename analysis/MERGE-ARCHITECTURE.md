# Merge Architecture — ATV Design × Terminal 42

> Contributor-facing guide to how Terminal 42's frontend is grafted onto ATV
> Design's backend. Read this before touching the canvas, the generation stream,
> or the design-token plumbing. Companion to `analysis/T42-ON-ATV-ASSESSMENT.md`.

## The one thing to understand first

**The two apps semantically disagree about what a "design" is.** Almost every
piece of merge complexity flows from this single fact.

| | ATV Design (the trunk) | Terminal 42 (the donor) |
|---|---|---|
| A design is… | **one inline `index.html` snapshot** (`DesignSnapshot`, a DB row with `artifactSource`) | **multi-version files on disk** (`DesignVersion[]`: fileName / fileUrl / kind / previewUrl) |
| Generation emits… | `agent:event:v1` events — `fs_updated { path, content }`, **one file at a time** | `onVersion { latest, versions[] }` — **a full list, every render** |
| Preview iframe | sandboxed, null-origin `srcdoc` (postMessage) | same-origin `srcDoc` (direct `contentDocument` access) |
| Drive model | synchronous request/response | fire-and-forget chat queue |

ATV's backend is the keeper (tested, secure, provider-rich, license-clean). T42's
frontend is the asset. So the merge is a **backend-preserving, feature-by-feature
port behind a translation layer** — not a frontend swap.

## The translation layer (the merge's core)

`apps/desktop/src/renderer/src/lib/design-stream-adapter.ts`

This is where the two data models are reconciled. It is **not glue** — it is a
stateful data-model translation (eng-review tension XM-T2). It consumes ATV's
`AgentStreamEvent`s and projects the T42-shaped callback contract the ported UI
expects:

```
ATV AgentStreamEvent            DesignStreamAdapter            T42 UI callback
─────────────────────           ───────────────────            ───────────────
turn_start              ──▶                            ──▶     onStart { designId }
text_delta              ──▶                            ──▶     onDelta { designId, delta }
tool_call_start         ──▶     (verbGroup → phase)    ──▶     onPhase { designId, phase }
fs_updated {path,content}──▶    ★ STATEFUL ACCUMULATION ──▶    onVersion { latest, versions[] }
turn_end / agent_end    ──▶                            ──▶     onDone { designId, exitCode }
error                   ──▶                            ──▶     onDone { exitCode: 1 }
```

### Why `onVersion` is the hard part (finding A-F2)

T42's canvas wants the **whole** `versions[]` list on every update. ATV hands you
**one** `fs_updated` at a time. So the adapter keeps a per-design `Map<path,state>`
and rebuilds the list as events arrive. It must:

- **dedupe** repeated writes to the same path (10+ edits/turn is normal) into one
  version entry carrying the final state — no strobing, no duplicates;
- order **newest-wins** so a late-delivered older write never clobbers a newer one
  (tolerant of out-of-order delivery);
- emit an **optimistic in-memory projection immediately** (live preview), then
  reconcile against DB truth.

### Two more findings the adapter folds in

- **P-F5 (throttled re-query):** the authoritative DB re-query (`fetchVersions`)
  is throttled (leading + trailing edge, 250 ms — the same shape as ATV's
  existing `fsThrottle` in `useAgentStream`). A burst of `fs_updated` events
  fires **at most two** SQLite reads, never N.
- **A-F1 (dual-runtime degrade):** ATV has two generation runtimes behind
  `USE_AGENT_RUNTIME`. Only the agent branch emits `fs_updated`. When the legacy
  branch (`=0`) runs — lifecycle events but no `fs_updated` — the adapter falls
  back to a single `fetchVersions()` poll at `turn_end`, so the live preview
  still updates. The path is **degraded, not dropped**.

All of the above is locked by `design-stream-adapter.test.ts` (28 tests), which
double as the plan's mandatory regression guards.

## The DesignCanvas split (finding CQ-F4)

T42's `DesignCanvas.tsx` is a 2,249-line god-component — far past ATV's <800-line
standard. It is **split during the port**, not transplanted, into composable
units. Landed so far (pure, paradigm-neutral, fully tested):

| Unit | File | What it is |
|---|---|---|
| ViewportFrame core | `lib/viewport-profiles.ts` | Kind-aware `PROFILES` registry + `profileForKind()` — DesignKind → viewport set (web / slides / print / social / docs / designRef…). |
| TokenInspector core | `lib/token-inspector.ts` | `parseRootTokens()` — extracts `:root` `--custom-props` from a design, classifies each color/number/text for the live swatch inspector. Pure (no DOM) so it runs in the desktop node test env; `readProjectTokens(doc)` is the thin DOM wrapper. |

Remaining split targets (planned): `useDesignStream` (subscribes the adapter),
`useAnnotations` (annotate→AI), and the `Canvas` shell that composes them.

## The same-origin Canvas iframe (cross-model tension XM-T1)

ATV's preview iframe is **sandboxed** (`allow-scripts`, null origin) — the right
default. But T42's token inspector and annotator are built on **same-origin
`contentDocument` access**, which a sandbox without `allow-same-origin` removes.

Resolution: the **Canvas iframe only** keeps `sandbox="allow-scripts
allow-same-origin"` (its content is agent-generated and local). This is a
**documented exception** to ATV's stricter default, justified because the
inspector/annotator need to read the rendered document's computed styles and DOM.
ATV's other preview surfaces keep the stricter `allow-scripts`-only sandbox.

## The design system (Q1)

Single dark identity: **Terminal 42's dark pro-tool ladder** (`--bg 8 8 10`),
recolored into ATV's existing token plumbing. `packages/ui/src/tokens.css`
`.dark` keeps ATV's `--color-*` names (9 consumers unchanged) and swaps the
values to T42's ladder, converted sRGB → OKLCH. ATV's warm-editorial theme is
dropped, not kept as an alternate. `dark-token-reskin.test.ts` pins the merged
theme so a drift back to warm editorial fails loudly.

## What was dropped (do not reintroduce)

The 37-channel `window.terminal42` shim (a faithful replica of a backend being
deleted), the Copilot-CLI backend, `~/.copilot/session-state` coupling,
Brain-via-PTY, the raw xterm terminal, and T42 dead code. See
`ATTRIBUTION.md` → "What atv-design did NOT take".
