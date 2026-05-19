# Workspace Parity Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the smallest high-impact Open CoDesign v0.2 / workspace-UX slice into ATV Design so workspace-backed sessions feel more Claude-Design-like via a pinned canvas tab, always-visible workspace tabs, and an inline expandable prompt composer.

**Architecture:** Keep ATV Design's existing per-design workspace/session model and file-tab system, then layer in one new persisted canvas surface plus a prompt-expansion UI state. Reuse the current snapshot/workspace plumbing instead of importing the larger upstream workspace stack.

**Tech Stack:** Electron, React, Zustand, Vitest, pnpm, Excalidraw (lazy user-facing canvas runtime with test shim).

---

### Task 1: Lock the UI/state slice and wire the plan files

**Files:**
- Create: `C:\Users\shyamsridhar\code\atv-design\.worktrees\parity-v02\docs\superpowers\plans\2026-05-10-workspace-parity-slice.md`
- Modify: `C:\Users\shyamsridhar\code\atv-design\.worktrees\parity-v02\apps\desktop\src\renderer\src\store.ts`

- [ ] Confirm the state slice to port: `isPromptExpanded`, `canvasTabs` with a pinned canvas tab, persisted canvas scene/imports, and `lastGeneratedCanvasRevision` bookkeeping.
- [ ] Keep ATV-specific provider/auth/session code untouched; avoid the broad upstream config persistence and top-bar refactors.
- [ ] Preserve the existing workspace-backed design model (`workspacePath` on `Design`) and treat this task as a surface upgrade, not a storage rewrite.

### Task 2: Add pinned canvas tab + persisted context plumbing

**Files:**
- Modify: `C:\Users\shyamsridhar\code\atv-design\.worktrees\parity-v02\apps\desktop\package.json`
- Create: `C:\Users\shyamsridhar\code\atv-design\.worktrees\parity-v02\apps\desktop\src\main\canvas-ipc.ts`
- Modify: `C:\Users\shyamsridhar\code\atv-design\.worktrees\parity-v02\apps\desktop\src\main\index.ts`
- Modify: `C:\Users\shyamsridhar\code\atv-design\.worktrees\parity-v02\apps\desktop\src\preload\index.ts`
- Create: `C:\Users\shyamsridhar\code\atv-design\.worktrees\parity-v02\apps\desktop\src\renderer\src\components\CanvasSketchView.tsx`
- Create: `C:\Users\shyamsridhar\code\atv-design\.worktrees\parity-v02\apps\desktop\src\renderer\src\lib\canvasContext.ts`
- Modify: `C:\Users\shyamsridhar\code\atv-design\.worktrees\parity-v02\apps\desktop\src\renderer\src\components\CanvasTabBar.tsx`
- Modify: `C:\Users\shyamsridhar\code\atv-design\.worktrees\parity-v02\apps\desktop\src\renderer\src\components\PreviewPane.tsx`
- Modify: `C:\Users\shyamsridhar\code\atv-design\.worktrees\parity-v02\apps\desktop\src\renderer\src\store.ts`

- [ ] Add `@excalidraw/excalidraw@^0.18.1` after verifying the MIT license.
- [ ] Register a dedicated `canvas:v1:*` IPC surface for per-design scene persistence and generated canvas-context temp files.
- [ ] Extend the renderer store with pinned `Canvas` tab state, scene/import tracking, revision counters, and `buildCanvasContextFiles()`.
- [ ] Render `CanvasSketchView` when the pinned tab is active and keep the workspace tab bar visible even before a first preview exists.
- [ ] Feed fresh canvas context into `sendPrompt()` only when the canvas changed since the last generation so repeated follow-ups stay lean.

### Task 3: Add inline prompt expansion and surface canvas context in chat UI

**Files:**
- Modify: `C:\Users\shyamsridhar\code\atv-design\.worktrees\parity-v02\apps\desktop\src\renderer\src\App.tsx`
- Modify: `C:\Users\shyamsridhar\code\atv-design\.worktrees\parity-v02\apps\desktop\src\renderer\src\components\Sidebar.tsx`
- Modify: `C:\Users\shyamsridhar\code\atv-design\.worktrees\parity-v02\apps\desktop\src\renderer\src\components\chat\PromptInput.tsx`
- Modify: `C:\Users\shyamsridhar\code\atv-design\.worktrees\parity-v02\apps\desktop\src\renderer\src\components\chat\UserMessage.tsx`
- Modify: `C:\Users\shyamsridhar\code\atv-design\.worktrees\parity-v02\packages\shared\src\snapshot.ts`
- Modify: `C:\Users\shyamsridhar\code\atv-design\.worktrees\parity-v02\packages\i18n\src\locales\en.json`
- Modify: `C:\Users\shyamsridhar\code\atv-design\.worktrees\parity-v02\packages\i18n\src\locales\pt-BR.json`
- Modify: `C:\Users\shyamsridhar\code\atv-design\.worktrees\parity-v02\packages\i18n\src\locales\zh-CN.json`

- [ ] Add a store-backed prompt expansion toggle and widen the sidebar while expanded.
- [ ] Port the inline expand/collapse affordance into `PromptInput` without changing existing send/stop semantics.
- [ ] Show canvas-import chips and a small “canvas context ready / unchanged” status in the sidebar.
- [ ] Extend `ChatUserPayload` and `UserMessage` so sent canvas context is visible in the transcript as metadata, not hidden behavior.

### Task 4: Test and prove the slice

**Files:**
- Create: `C:\Users\shyamsridhar\code\atv-design\.worktrees\parity-v02\apps\desktop\vitest.config.ts`
- Create: `C:\Users\shyamsridhar\code\atv-design\.worktrees\parity-v02\apps\desktop\src\renderer\test\excalidraw-shim.tsx`
- Create: `C:\Users\shyamsridhar\code\atv-design\.worktrees\parity-v02\apps\desktop\src\renderer\test\excalidraw-shim.css`
- Modify: `C:\Users\shyamsridhar\code\atv-design\.worktrees\parity-v02\apps\desktop\src\renderer\src\store.test.ts`

- [ ] Add a Vitest alias shim so renderer tests do not load the real Excalidraw runtime.
- [ ] Add store tests for dirty-vs-clean canvas context attachment behavior.
- [ ] Run focused checks: `pnpm --filter @atv-design/desktop test`, `pnpm --filter @atv-design/desktop typecheck`, and a focused renderer smoke run if needed.
- [ ] Capture the exact changed files and user-facing test flow in the final handoff.
