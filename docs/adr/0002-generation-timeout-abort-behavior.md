# ADR 0002 — Generation Timeout, Abort, and Completion Guardrails

**Status:** Accepted
**Date:** 2026-05-13
**Context:** Read-only investigation of ATV Design generation hangs, premature timeout failures, and post-`done` continuation behavior.

## Problem statement

ATV Design currently has several distinct failure modes that can all look like a single "generation got stuck" report:

1. **The desktop timeout is a hard wall-clock cap, not an idle timeout.**
   A generation can be actively streaming and still be aborted exactly when the configured timeout expires.
2. **Abort depends on the underlying agent becoming idle.**
   If `agent.abort()` does not cause `waitForIdle()` to settle, the outer request can remain hung.
3. **Completion-loop guardrails only help between turns.**
   They do not protect a single turn that never finishes, a tool that never returns, or a provider stream that never reaches turn end.
4. **Context pruning enforces an aggregate cap, but preservation of the latest user/current prompt is fragile.**
5. **Renderer cancellation can clear top-level generation state while leaving an in-flight tool row visually stuck in `running`.**

These are related but not identical issues. The fix strategy should keep them separated so we do not over-credit one patch for solving the whole class.

## Confirmed findings

### 1) Desktop timeout is currently a hard max duration

Observed in:

- `apps/desktop/src/main/generation-ipc.ts`
- `apps/desktop/src/main/index.ts`
- `apps/desktop/src/main/preferences-ipc.ts`

The timeout is armed once at generation start and currently behaves like a **single wall-clock deadline**. It is **not reset** by stream progress, tool progress, filesystem updates, or agent events.

**Implication:** healthy long-running generations can still die at the configured timeout.

### 2) Abort propagation is not explicitly raced against `agent.waitForIdle()`

Observed in:

- `packages/core/src/agent.ts`

The core generation flow wires the abort signal into the agent, but the awaited `agent.prompt(...)` + `agent.waitForIdle()` sequences are not consistently wrapped in an explicit abort race.

**Implication:** if the underlying provider or agent becomes stuck and `agent.abort()` does not promptly resolve or reject the pending wait, the IPC layer can stay hung even after timeout or manual cancel.

### 3) Completion guardrails are useful but limited in scope

Observed in:

- `packages/core/src/agent.ts`
- `packages/core/src/agent.test.ts`
- `packages/core/src/tools/done.ts`
- `packages/core/src/tools/done.test.ts`

The current source includes meaningful loop controls, including separate handling for failed `done` repair attempts, incomplete-run continuation caps, and termination on successful `done`.

**Implication:** these protections help after a turn completes and the system can assess the next step. They do **not** stop a single turn that streams forever or a tool call that never finishes.

### 4) Context pruning hard-caps total payload but needs stronger latest-user preservation

Observed in:

- `packages/core/src/context-prune.ts`
- `packages/core/src/context-prune.test.ts`

The pruning logic now compacts payloads and tail-prunes to enforce an aggregate cap. That is useful protection against runaway context growth.

**Implication:** the newest user/current prompt should be explicitly preserved, even when oversized, by compacting or stubbing it rather than risking an empty or near-empty effective context.

### 5) Cancel/timeout UX can leave pending tool rows inconsistent

Observed in:

- `apps/desktop/src/renderer/src/store.ts`
- `apps/desktop/src/renderer/src/hooks/useAgentStream.ts`
- `apps/desktop/src/main/index.ts`

The renderer clears generation state on cancel, but pending tool rows are mainly finalized on stream events such as `turn_end`, `agent_end`, or `error`.

**Implication:** if cancellation happens mid-tool or mid-turn and no explicit terminal event is emitted for the stream, the chat UI can retain a stale `running` tool row.

## Decision

We will treat generation stability as **three separate guardrail layers**, not a single timeout tweak:

1. **Idle watchdog** — reset on meaningful generation progress.
2. **Hard max wall-clock cap** — optional higher ceiling that protects against truly unbounded runs.
3. **Abort-race enforcement in core** — every awaited agent turn must settle promptly when the signal aborts.

In parallel, we will keep:

- bounded completion-repair loops,
- bounded context size with explicit latest-user preservation,
- explicit renderer/main-process terminal signaling on cancel and timeout.

## Smallest recommended implementation set

### A. Make timeout semantics explicit

Preferred approach:

- keep the current wall-clock timeout only as a **hard maximum**, and
- add a separate **idle timeout** that resets on meaningful progress such as:
  - `turn_start`
  - `text_delta`
  - `tool_execution_*`
  - `fs_updated`

If we do not add idle behavior immediately, the setting and UI copy should explicitly say it is a **hard max duration**, not an inactivity timeout.

### B. Race every agent turn against abort

In `packages/core/src/agent.ts`, wrap each `agent.prompt(...)` + `agent.waitForIdle()` pair in a helper that rejects promptly when `input.signal` aborts.

Target behavior:

- manual cancel rejects promptly,
- timeout abort rejects promptly,
- `agent.abort()` is still invoked,
- the outer IPC promise does not hang waiting for provider cooperation.

### C. Keep the current completion loop limits, but do not rely on them alone

The existing `done`/continuation protections should remain in place because they solve a real class of between-turn runaway behavior. They are necessary, but not sufficient.

### D. Preserve the latest user/current prompt during hard-cap pruning

If the newest user message alone exceeds the cap, compact or stub it rather than dropping it entirely.

### E. Emit explicit terminal stream state for cancel/timeout

On main-process cancellation or timeout, emit a stream event that lets the renderer finalize pending tool rows as `cancelled` or `error` rather than leaving them `running`.

## Minimum regression tests

1. **Abort-race test**
   - file: `packages/core/src/agent.test.ts`
   - simulate `waitForIdle()` never resolving
   - abort the signal
   - assert generation rejects promptly and `agent.abort()` is called

2. **Idle-timeout test**
   - file: `apps/desktop/src/main/generation-ipc` tests or equivalent
   - assert progress resets idle timeout
   - assert timeout fires only after inactivity

3. **Context-prune preservation test**
   - file: `packages/core/src/context-prune.test.ts`
   - latest user message exceeds hard cap
   - assert transformed context still preserves a compacted latest user prompt

4. **Renderer cancel/tool-row test**
   - file: renderer stream/store tests
   - start a tool row, cancel before `turn_end`
   - assert no tool row remains `running`

5. **Done-repair bounded-loop test**
   - already relevant in `packages/core/src/agent.test.ts`
   - retain coverage proving failed `done` repairs stop after the bounded count rather than running until the global timeout

## Scope note

This ADR documents the failure modes and the recommended implementation order. It does **not** claim that all fixes are already landed.

At the time of writing, the most relevant already-observed source changes are:

- `done` success now terminating correctly,
- bounded failed-`done` repair attempts,
- aggregate context hard cap enforcement.

Those are valuable, but they do not by themselves solve idle hangs or abort propagation.

## Recommended implementation order

1. Add abort-race enforcement in core.
2. Add true idle-timeout behavior or relabel the existing timeout as hard max only.
3. Add explicit cancel/error terminal signaling for the renderer stream.
4. Strengthen latest-user preservation in context pruning.
5. Keep and extend loop-bound tests around `done`/continuation repair.

## References

- `packages/core/src/agent.ts`
- `packages/core/src/agent.test.ts`
- `packages/core/src/context-prune.ts`
- `packages/core/src/context-prune.test.ts`
- `packages/core/src/tools/done.ts`
- `packages/core/src/tools/done.test.ts`
- `apps/desktop/src/main/generation-ipc.ts`
- `apps/desktop/src/main/index.ts`
- `apps/desktop/src/main/preferences-ipc.ts`
- `apps/desktop/src/renderer/src/store.ts`
- `apps/desktop/src/renderer/src/hooks/useAgentStream.ts`
