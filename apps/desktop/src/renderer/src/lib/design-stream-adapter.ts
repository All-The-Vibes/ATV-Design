import type { AgentStreamEvent } from '../../../preload/index';

/**
 * T1 — Data-model + event translation layer (Phase 2 of the ATV × Terminal 42
 * merge plan). See `analysis/MERGE-ARCHITECTURE.md`.
 *
 * Terminal 42's ported UI (DesignCanvas, DesignChatRail) is written against a
 * file-versions data model and a callback contract:
 *
 *   onStart   { designId }
 *   onPhase   { designId, phase }
 *   onDelta   { designId, delta }
 *   onVersion { designId, latest, versions[] }   ← a FULL list every time
 *   onDone    { designId, exitCode }
 *
 * ATV's backend speaks a different language: a single inline snapshot, streamed
 * as `AgentStreamEvent`s where each `fs_updated { path, content }` reports ONE
 * file mutation at a time. This module is the stateful bridge between them.
 *
 * Responsibilities (each maps to an eng-review finding folded into the plan):
 *   - A-F2  Reconstruct T42's `{ latest, versions[] }` by accumulating per-path
 *           file state across many fs_updated events: dedupe repeated writes to
 *           a path, order by modifiedAt (arrival order under the ordered IPC
 *           transport; a monotonic guard keeps modifiedAt stable).
 *   - P-F5  Throttle the authoritative DB re-query so a flurry of fs_updated
 *           events (10+/turn is normal) doesn't issue N synchronous SQLite
 *           reads mid-generation. Optimistic in-memory projection lands
 *           immediately; DB truth reconciles on the trailing edge.
 *   - A-F1  Degrade to polling: when the legacy runtime (USE_AGENT_RUNTIME=0)
 *           emits lifecycle events but never fs_updated, fall back to a
 *           fetchVersions() poll at turn_end/agent_end so the live preview still
 *           updates.
 *
 * The module is intentionally framework-free (no React, no Electron) so it is
 * unit-testable in isolation and reusable from useAgentStream or a future hook.
 */

/** T42-shaped version record. Mirrors terminal42 `DesignVersion`. */
export interface DesignVersion {
  id: string;
  designId: string;
  fileName: string;
  filePath: string;
  fileUrl: string;
  size: number;
  modifiedAt: number;
  kind?: 'html' | 'pptx';
  previewUrl?: string | null;
}

export interface DesignVersionList {
  designId: string;
  latest: DesignVersion | null;
  versions: DesignVersion[];
}

export interface DesignStreamCallbacks {
  onStart?: (d: { designId: string }) => void;
  onPhase?: (d: { designId: string; phase: string }) => void;
  onDelta?: (d: { designId: string; delta: string }) => void;
  onVersion?: (d: DesignVersionList) => void;
  onDone?: (d: { designId: string; exitCode: number }) => void;
}

export interface DesignStreamAdapterOptions {
  callbacks: DesignStreamCallbacks;
  /**
   * Authoritative re-query against the persisted snapshot/files store
   * (ATV `snapshots.list()` / files IPC). When provided, the adapter reconciles
   * its optimistic in-memory projection with DB truth on a throttled trailing
   * edge, and uses it as the degrade path when no fs_updated events arrive.
   */
  fetchVersions?: (designId: string) => Promise<DesignVersion[]>;
  /** Throttle window for the DB re-query, ms. Mirrors useAgentStream's 250ms. */
  throttleMs?: number;
  /** Injectable clock for deterministic ordering in tests. */
  now?: () => number;
}

export interface DesignStreamAdapter {
  handleEvent: (event: AgentStreamEvent) => void;
  reset: (designId?: string) => void;
}

interface PerPathState {
  fileName: string;
  size: number;
  modifiedAt: number;
}

interface DesignState {
  designId: string;
  started: boolean;
  /**
   * Fired the one-shot terminal onDone for this generation. The run-terminal
   * events are `agent_end` (success) and `error`; `turn_end` is a per-turn
   * checkpoint and does NOT set this. Re-armed on the next `turn_start` (a new
   * generation for the same design) and by reset(), so onDone is delivered
   * exactly once per generation.
   */
  done: boolean;
  /** Saw at least one fs_updated this run — decides whether degrade-poll runs. */
  sawFsEvent: boolean;
  /**
   * A degrade DB poll already ran this generation. The legacy runtime emits both
   * a per-turn `turn_end` and a final `agent_end`; without this flag a multi-turn
   * degraded run would poll the DB on every one. Re-armed with the generation.
   */
  degradePolled: boolean;
  /** path → latest known state for that path (dedupe + newest-wins). */
  files: Map<string, PerPathState>;
  /**
   * Monotonic generation counter, bumped on reset(). An in-flight async
   * reconcile captures the epoch it started under and drops its result if the
   * design was reset (or replaced) while fetchVersions was pending — so a
   * late-resolving DB read never emits onVersion for a navigated-away design.
   */
  epoch: number;
  /** Trailing-edge re-query throttle bookkeeping. */
  throttle: {
    timer: ReturnType<typeof setTimeout> | null;
    lastFlushAt: number;
    dirty: boolean;
  };
}

const DEFAULT_THROTTLE_MS = 250;

function fileNameOf(path: string): string {
  // Basename for both POSIX and Windows-style separators (Electron may surface
  // either). Split on / and \, take the last non-empty segment.
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || path;
}

export function createDesignStreamAdapter(
  options: DesignStreamAdapterOptions,
): DesignStreamAdapter {
  const { callbacks, fetchVersions } = options;
  const throttleMs = options.throttleMs ?? DEFAULT_THROTTLE_MS;
  const now = options.now ?? (() => Date.now());

  const states = new Map<string, DesignState>();

  function getState(designId: string): DesignState {
    let s = states.get(designId);
    if (!s) {
      s = {
        designId,
        started: false,
        done: false,
        sawFsEvent: false,
        degradePolled: false,
        files: new Map(),
        epoch: 0,
        throttle: { timer: null, lastFlushAt: 0, dirty: false },
      };
      states.set(designId, s);
    }
    return s;
  }

  /** Project the current in-memory file map into a T42 version list. */
  function projectFromMemory(s: DesignState): DesignVersionList {
    const versions: DesignVersion[] = [...s.files.entries()]
      .map(([path, st]) => ({
        id: `mem:${s.designId}:${path}`,
        designId: s.designId,
        fileName: st.fileName,
        filePath: path,
        fileUrl: path,
        size: st.size,
        modifiedAt: st.modifiedAt,
        kind: 'html' as const,
      }))
      .sort((a, b) => a.modifiedAt - b.modifiedAt);
    const latest = versions.length > 0 ? (versions[versions.length - 1] ?? null) : null;
    return { designId: s.designId, latest, versions };
  }

  /** Emit the optimistic, in-memory view immediately (no DB round-trip). */
  function emitOptimistic(s: DesignState): void {
    callbacks.onVersion?.(projectFromMemory(s));
  }

  /** Reconcile against persisted DB truth and emit the authoritative list. */
  async function reconcileFromDb(s: DesignState): Promise<void> {
    if (!fetchVersions) return;
    // Capture the epoch + identity we started under. If reset() bumps the epoch
    // or the state is evicted while fetchVersions is pending, drop the result so
    // a late DB read never emits onVersion for a navigated-away design (M1).
    const startedEpoch = s.epoch;
    const rows = await fetchVersions(s.designId);
    if (states.get(s.designId) !== s || s.epoch !== startedEpoch) return;
    const sorted = [...rows].sort((a, b) => a.modifiedAt - b.modifiedAt);
    const latest = sorted.length > 0 ? (sorted[sorted.length - 1] ?? null) : null;
    callbacks.onVersion?.({ designId: s.designId, latest, versions: sorted });
  }

  /** Schedule a throttled trailing-edge DB re-query (plan finding P-F5). */
  function scheduleReconcile(s: DesignState): void {
    if (!fetchVersions) return;
    s.throttle.dirty = true;
    const since = now() - s.throttle.lastFlushAt;
    const fire = () => {
      s.throttle.timer = null;
      if (!s.throttle.dirty) return;
      s.throttle.dirty = false;
      s.throttle.lastFlushAt = now();
      void reconcileFromDb(s);
    };
    if (since >= throttleMs && s.throttle.timer === null) {
      // Leading edge: fire immediately, coalesce the rest of the burst.
      fire();
      return;
    }
    if (s.throttle.timer !== null) return;
    s.throttle.timer = setTimeout(fire, Math.max(throttleMs - since, 0));
  }

  function handleFsUpdated(event: AgentStreamEvent): void {
    if (typeof event.path !== 'string') return;
    const s = getState(event.designId);
    s.sawFsEvent = true;
    const content = typeof event.content === 'string' ? event.content : '';
    const prev = s.files.get(event.path);
    const ts = now();
    // Last-write-wins by arrival order: `ts` is the arrival timestamp (AgentStreamEvent
    // carries no source mtime), and IPC delivery for a single design is ordered,
    // so the newest event for a path is the one that arrives last. The
    // `ts >= prev.modifiedAt` guard keeps the recorded modifiedAt monotonic and
    // makes the accumulator resilient to a non-monotonic `now` (e.g. an injected
    // clock in tests); it is not a guarantee against genuinely reordered delivery,
    // which the ordered transport does not produce.
    if (!prev || ts >= prev.modifiedAt) {
      s.files.set(event.path, {
        fileName: fileNameOf(event.path),
        size: content.length,
        modifiedAt: ts,
      });
    }
    emitOptimistic(s);
    scheduleReconcile(s);
  }

  /**
   * Degrade path (A-F1): under USE_AGENT_RUNTIME=0 the legacy runtime emits
   * lifecycle events but never fs_updated, so poll the DB so the live preview
   * still receives a version. Guarded to run at most once per generation (both a
   * per-turn turn_end and the run's agent_end reach here).
   */
  function degradePoll(s: DesignState): void {
    if (s.degradePolled || s.sawFsEvent || !fetchVersions) return;
    s.degradePolled = true;
    void reconcileFromDb(s);
  }

  /**
   * Fire the one-shot terminal onDone (once per generation).
   *
   * Ordering contract: in the fs path every `fs_updated` synchronously emits an
   * optimistic `onVersion`, so by the time a run reaches its terminal event the
   * latest version has already been delivered — onDone never precedes it. The
   * throttled DB reconcile may emit one more authoritative `onVersion` shortly
   * AFTER onDone; that is an intended late refinement (optimistic-UI pattern),
   * not an early "done". In the degrade path (legacy runtime, no `fs_updated`)
   * the only version comes from the async `degradePoll`, which may resolve just
   * after onDone — acceptable for that path.
   */
  function finalize(s: DesignState, exitCode: number): void {
    if (s.done) return;
    s.done = true;
    callbacks.onDone?.({ designId: s.designId, exitCode });
  }

  function handleEvent(event: AgentStreamEvent): void {
    switch (event.type) {
      case 'turn_start': {
        const s = getState(event.designId);
        // A `turn_start` after a terminal event begins a NEW generation for the
        // same design (e.g. a follow-up prompt with no intervening reset()).
        // Re-arm the per-run one-shots so onStart/onDone fire again for it.
        if (s.done) {
          s.started = false;
          s.done = false;
          s.sawFsEvent = false;
          s.degradePolled = false;
        }
        if (!s.started) {
          s.started = true;
          callbacks.onStart?.({ designId: event.designId });
        }
        break;
      }
      case 'text_delta': {
        if (typeof event.delta === 'string') {
          callbacks.onDelta?.({ designId: event.designId, delta: event.delta });
        }
        break;
      }
      case 'tool_call_start': {
        const phase = event.verbGroup ?? event.toolName;
        if (typeof phase === 'string' && phase.length > 0) {
          callbacks.onPhase?.({ designId: event.designId, phase });
        }
        break;
      }
      case 'fs_updated': {
        handleFsUpdated(event);
        break;
      }
      case 'turn_end': {
        // `turn_end` is a PER-TURN checkpoint (pi emits one after every turn),
        // NOT the run boundary — so it must not fire onDone (doing so would
        // signal "finished" after turn 1 of a multi-turn run). This mirrors the
        // canonical useAgentStream, where handleTurnEnd does not clear
        // isGenerating. It only drives the (one-shot) degrade poll.
        degradePoll(getState(event.designId));
        break;
      }
      case 'agent_end': {
        // `agent_end` is the run-terminal boundary: final-safety degrade poll,
        // then the one-shot terminal onDone (with a version guaranteed first).
        const s = getState(event.designId);
        degradePoll(s);
        finalize(s, 0);
        break;
      }
      case 'error': {
        finalize(getState(event.designId), 1);
        break;
      }
      default:
        // Unknown event types are ignored (forward-compat, mirrors
        // useAgentStream's tolerance for evolving event shapes).
        break;
    }
  }

  function reset(designId?: string): void {
    if (designId === undefined) {
      for (const s of states.values()) {
        s.epoch += 1;
        if (s.throttle.timer) clearTimeout(s.throttle.timer);
      }
      states.clear();
      return;
    }
    const s = states.get(designId);
    if (s) {
      // Bump the epoch so any in-flight reconcile for this design is dropped on
      // resolve, even if the design is re-opened before the fetch settles.
      s.epoch += 1;
      if (s.throttle.timer) clearTimeout(s.throttle.timer);
    }
    states.delete(designId);
  }

  return { handleEvent, reset };
}
