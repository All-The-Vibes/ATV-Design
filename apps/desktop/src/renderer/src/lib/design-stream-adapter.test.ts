import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentStreamEvent } from '../../../preload/index';
import {
  type DesignStreamCallbacks,
  type DesignVersion,
  createDesignStreamAdapter,
} from './design-stream-adapter';

/**
 * T1 — Data-model + event translation layer (Phase 2 of the merge plan).
 *
 * This is the merge's identified "real core work": the two apps semantically
 * disagree about what a "design" is.
 *
 *   ATV  → one inline snapshot; emits `fs_updated { path, content }`, one file
 *          at a time, as the agent's text_editor mutates the virtual fs.
 *   T42  → multi-version files on disk; its DesignCanvas consumes
 *          `onVersion { latest, versions[] }` — a full list every time.
 *
 * The adapter is therefore a STATEFUL reconstruction (plan finding A-F2): it
 * accumulates per-path file state across many `fs_updated` events and projects
 * the T42-shaped `{ latest, versions[] }` list the ported UI expects. It also
 * normalizes ATV's lifecycle events into T42's onStart/onPhase/onDone, and
 * degrades to DB polling when the agent runtime does not emit fs events
 * (USE_AGENT_RUNTIME=0, plan finding A-F1).
 */

const DESIGN = 'design-1';
const GEN = 'gen-1';

function ev(
  partial: Partial<AgentStreamEvent> & { type: AgentStreamEvent['type'] },
): AgentStreamEvent {
  return { designId: DESIGN, generationId: GEN, ...partial } as AgentStreamEvent;
}

function makeCallbacks(): {
  callbacks: DesignStreamCallbacks;
  starts: Array<{ designId: string }>;
  phases: Array<{ designId: string; phase: string }>;
  versions: Array<{ designId: string; latest: DesignVersion | null; versions: DesignVersion[] }>;
  deltas: Array<{ designId: string; delta: string }>;
  dones: Array<{ designId: string; exitCode: number }>;
} {
  const starts: Array<{ designId: string }> = [];
  const phases: Array<{ designId: string; phase: string }> = [];
  const versions: Array<{
    designId: string;
    latest: DesignVersion | null;
    versions: DesignVersion[];
  }> = [];
  const deltas: Array<{ designId: string; delta: string }> = [];
  const dones: Array<{ designId: string; exitCode: number }> = [];
  return {
    starts,
    phases,
    versions,
    deltas,
    dones,
    callbacks: {
      onStart: (d) => starts.push(d),
      onPhase: (d) => phases.push(d),
      onVersion: (d) => versions.push(d),
      onDelta: (d) => deltas.push(d),
      onDone: (d) => dones.push(d),
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
});

describe('createDesignStreamAdapter — lifecycle normalization', () => {
  it('translates turn_start into onStart with the designId', () => {
    const h = makeCallbacks();
    const adapter = createDesignStreamAdapter({ callbacks: h.callbacks });

    adapter.handleEvent(ev({ type: 'turn_start' }));

    expect(h.starts).toEqual([{ designId: DESIGN }]);
  });

  it('emits onStart only once per generation even across multiple turn_start events', () => {
    const h = makeCallbacks();
    const adapter = createDesignStreamAdapter({ callbacks: h.callbacks });

    adapter.handleEvent(ev({ type: 'turn_start' }));
    adapter.handleEvent(ev({ type: 'turn_start' }));

    expect(h.starts).toHaveLength(1);
  });

  it('forwards text_delta as onDelta with accumulated-free single delta', () => {
    const h = makeCallbacks();
    const adapter = createDesignStreamAdapter({ callbacks: h.callbacks });

    adapter.handleEvent(ev({ type: 'text_delta', delta: 'Hello ' }));
    adapter.handleEvent(ev({ type: 'text_delta', delta: 'world' }));

    expect(h.deltas).toEqual([
      { designId: DESIGN, delta: 'Hello ' },
      { designId: DESIGN, delta: 'world' },
    ]);
  });

  it('maps tool_call_start to onPhase using the verbGroup', () => {
    const h = makeCallbacks();
    const adapter = createDesignStreamAdapter({ callbacks: h.callbacks });

    adapter.handleEvent(
      ev({
        type: 'tool_call_start',
        toolName: 'str_replace_based_edit_tool',
        verbGroup: 'Editing',
      }),
    );

    expect(h.phases).toEqual([{ designId: DESIGN, phase: 'Editing' }]);
  });

  it('translates agent_end into onDone with exitCode 0', () => {
    const h = makeCallbacks();
    const adapter = createDesignStreamAdapter({ callbacks: h.callbacks });

    adapter.handleEvent(ev({ type: 'turn_start' }));
    adapter.handleEvent(ev({ type: 'agent_end' }));

    expect(h.dones).toEqual([{ designId: DESIGN, exitCode: 0 }]);
  });

  it('translates an error event into onDone with a non-zero exitCode', () => {
    const h = makeCallbacks();
    const adapter = createDesignStreamAdapter({ callbacks: h.callbacks });

    adapter.handleEvent(ev({ type: 'turn_start' }));
    adapter.handleEvent(ev({ type: 'error', message: 'boom' }));

    expect(h.dones).toHaveLength(1);
    expect(h.dones[0]?.exitCode).not.toBe(0);
  });

  it('does not fire onDone on turn_end — only agent_end/error are terminal', () => {
    // `turn_end` is a per-turn checkpoint (pi emits one after EVERY turn); the
    // run-terminal event is `agent_end`. Firing onDone on turn_end would signal
    // "generation finished" after turn 1 of a multi-turn run. This mirrors the
    // canonical useAgentStream, where handleTurnEnd does NOT clear isGenerating
    // but handleAgentEnd does.
    const h = makeCallbacks();
    const adapter = createDesignStreamAdapter({ callbacks: h.callbacks });

    adapter.handleEvent(ev({ type: 'turn_start' }));
    adapter.handleEvent(ev({ type: 'turn_end', finalText: 'turn 1 done' }));

    expect(h.dones).toEqual([]);
  });

  it('fires a single onDone on agent_end after any number of turns', () => {
    const h = makeCallbacks();
    const adapter = createDesignStreamAdapter({ callbacks: h.callbacks });

    adapter.handleEvent(ev({ type: 'turn_start' }));
    adapter.handleEvent(ev({ type: 'turn_end', finalText: 'turn done' }));
    adapter.handleEvent(ev({ type: 'agent_end' }));

    expect(h.dones).toEqual([{ designId: DESIGN, exitCode: 0 }]);
  });

  it('delivers onDone only after the final turn — not mid-run in a multi-turn run', () => {
    // Regression guard for the premature-terminal bug: in a 2-turn run the agent
    // is still writing files during turn 2, so onDone must come AFTER the last
    // turn's onVersion, not after turn 1.
    const h = makeCallbacks();
    const events: string[] = [];
    const adapter = createDesignStreamAdapter({
      callbacks: {
        onVersion: (d) => events.push(`version:${d.latest?.fileName ?? 'none'}`),
        onDone: () => events.push('done'),
      },
    });

    adapter.handleEvent(ev({ type: 'turn_start' }));
    adapter.handleEvent(ev({ type: 'fs_updated', path: 'index.html', content: '<h1>t1</h1>' }));
    adapter.handleEvent(ev({ type: 'turn_end', finalText: 't1' }));
    adapter.handleEvent(ev({ type: 'turn_start' }));
    adapter.handleEvent(ev({ type: 'fs_updated', path: 'about.html', content: '<h1>t2</h1>' }));
    adapter.handleEvent(ev({ type: 'turn_end', finalText: 't2' }));
    adapter.handleEvent(ev({ type: 'agent_end' }));

    // Each fs_updated emitted an optimistic version as it arrived, so the turn-2
    // file was projected before the single terminal done.
    expect(events).toEqual(['version:index.html', 'version:about.html', 'done']);
    expect(events.indexOf('done')).toBe(events.length - 1);
    expect(events.filter((e) => e === 'done')).toHaveLength(1);
  });

  it('emits a version before onDone even when fetchVersions is provided', async () => {
    // In production the adapter is built WITH fetchVersions (the throttled DB
    // reconcile). onDone must still be preceded by a version carrying the state:
    // each fs_updated emits an optimistic version synchronously as it arrives, so
    // the version is delivered before the terminal onDone without waiting for the
    // async DB reconcile. (The DB reconcile may emit one more authoritative
    // onVersion afterward; that late refinement is intended.)
    const order: string[] = [];
    const fetchVersions = vi.fn(async () => [] as DesignVersion[]);
    const adapter = createDesignStreamAdapter({
      callbacks: {
        onVersion: () => order.push('version'),
        onDone: () => order.push('done'),
      },
      fetchVersions,
      throttleMs: 250,
    });

    adapter.handleEvent(ev({ type: 'turn_start' }));
    adapter.handleEvent(ev({ type: 'fs_updated', path: 'index.html', content: '<h1>hi</h1>' }));
    adapter.handleEvent(ev({ type: 'agent_end' }));

    // Synchronously (before any throttle timer resolves) a version has already
    // been delivered and done is last.
    expect(order.filter((e) => e === 'done')).toHaveLength(1);
    expect(order.indexOf('version')).toBeLessThan(order.indexOf('done'));
    expect(order[order.length - 1]).toBe('done');
  });

  it('degrade path polls the DB at most once across turn_end + agent_end', async () => {
    // Legacy runtime (no fs_updated): both a per-turn turn_end and the run's
    // agent_end reach the degrade poll. It must fire at most once per generation,
    // not N+1 times.
    const h = makeCallbacks();
    const fetchVersions = vi.fn(async () => [] as DesignVersion[]);
    const adapter = createDesignStreamAdapter({
      callbacks: h.callbacks,
      fetchVersions,
      throttleMs: 250,
    });

    adapter.handleEvent(ev({ type: 'turn_start' }));
    adapter.handleEvent(ev({ type: 'turn_end', finalText: 't1' }));
    adapter.handleEvent(ev({ type: 'turn_start' }));
    adapter.handleEvent(ev({ type: 'turn_end', finalText: 't2' }));
    adapter.handleEvent(ev({ type: 'agent_end' }));
    await vi.advanceTimersByTimeAsync(10);

    expect(fetchVersions).toHaveBeenCalledTimes(1);
  });

  it('re-arms the degrade poll for a second generation on the same design (no reset)', async () => {
    // The one-shot degrade guard must re-arm on the next turn_start so a second
    // degraded generation polls the DB again (once), rather than being suppressed
    // by the first generation's flag.
    const h = makeCallbacks();
    const fetchVersions = vi.fn(async () => [] as DesignVersion[]);
    const adapter = createDesignStreamAdapter({
      callbacks: h.callbacks,
      fetchVersions,
      throttleMs: 250,
    });

    // Generation 1 (degraded).
    adapter.handleEvent(ev({ type: 'turn_start' }));
    adapter.handleEvent(ev({ type: 'agent_end' }));
    await vi.advanceTimersByTimeAsync(10);
    expect(fetchVersions).toHaveBeenCalledTimes(1);

    // Generation 2 (degraded) — no reset() in between.
    adapter.handleEvent(ev({ type: 'turn_start' }));
    adapter.handleEvent(ev({ type: 'agent_end' }));
    await vi.advanceTimersByTimeAsync(10);
    expect(fetchVersions).toHaveBeenCalledTimes(2);
  });

  it('does not emit a second onDone when error follows a terminal agent_end', () => {
    // Once a generation has reported done, a trailing error for the same run
    // must not double-fire the terminal callback.
    const h = makeCallbacks();
    const adapter = createDesignStreamAdapter({ callbacks: h.callbacks });

    adapter.handleEvent(ev({ type: 'turn_start' }));
    adapter.handleEvent(ev({ type: 'agent_end' }));
    adapter.handleEvent(ev({ type: 'error', message: 'late boom' }));

    expect(h.dones).toEqual([{ designId: DESIGN, exitCode: 0 }]);
  });

  it('re-arms onDone for a fresh generation after reset', () => {
    // reset() starts a new generation; the one-shot done guard must re-arm so
    // the next run's terminal event is delivered.
    const h = makeCallbacks();
    const adapter = createDesignStreamAdapter({ callbacks: h.callbacks });

    adapter.handleEvent(ev({ type: 'turn_start' }));
    adapter.handleEvent(ev({ type: 'agent_end' }));
    adapter.reset(DESIGN);
    adapter.handleEvent(ev({ type: 'turn_start' }));
    adapter.handleEvent(ev({ type: 'agent_end' }));

    expect(h.dones).toHaveLength(2);
  });

  it('re-arms onStart and onDone for a second generation on the same designId without reset', () => {
    // The agent can start a new run for the same design (e.g. a follow-up
    // prompt) without the renderer calling reset(). A `turn_start` after a
    // terminal agent_end must begin a fresh generation: onStart fires again and
    // the next agent_end delivers a second onDone.
    const h = makeCallbacks();
    const adapter = createDesignStreamAdapter({ callbacks: h.callbacks });

    adapter.handleEvent(ev({ type: 'turn_start' }));
    adapter.handleEvent(ev({ type: 'agent_end' }));
    // Second run — no reset() in between.
    adapter.handleEvent(ev({ type: 'turn_start' }));
    adapter.handleEvent(ev({ type: 'agent_end' }));

    expect(h.starts).toHaveLength(2);
    expect(h.dones).toHaveLength(2);
  });
});

describe('createDesignStreamAdapter — onVersion accumulation (plan finding A-F2)', () => {
  it('projects a single fs_updated into a one-entry versions list with that file as latest', () => {
    const h = makeCallbacks();
    const adapter = createDesignStreamAdapter({ callbacks: h.callbacks });

    adapter.handleEvent(ev({ type: 'turn_start' }));
    adapter.handleEvent(ev({ type: 'fs_updated', path: 'index.html', content: '<h1>v1</h1>' }));

    expect(h.versions).toHaveLength(1);
    const last = h.versions.at(-1);
    expect(last?.versions.map((v) => v.fileName)).toEqual(['index.html']);
    expect(last?.latest?.fileName).toBe('index.html');
  });

  it('accumulates multiple distinct paths into a growing versions list', () => {
    const h = makeCallbacks();
    const adapter = createDesignStreamAdapter({ callbacks: h.callbacks });

    adapter.handleEvent(ev({ type: 'turn_start' }));
    adapter.handleEvent(ev({ type: 'fs_updated', path: 'index.html', content: '<h1>hi</h1>' }));
    adapter.handleEvent(ev({ type: 'fs_updated', path: 'styles.css', content: 'body{}' }));

    const last = h.versions.at(-1);
    expect(last?.versions.map((v) => v.fileName).sort()).toEqual(['index.html', 'styles.css']);
  });

  it('dedupes repeated writes to the same path — no duplicate version entries', () => {
    const h = makeCallbacks();
    const adapter = createDesignStreamAdapter({ callbacks: h.callbacks });

    adapter.handleEvent(ev({ type: 'turn_start' }));
    adapter.handleEvent(ev({ type: 'fs_updated', path: 'index.html', content: '<h1>v1</h1>' }));
    adapter.handleEvent(ev({ type: 'fs_updated', path: 'index.html', content: '<h1>v2</h1>' }));
    adapter.handleEvent(ev({ type: 'fs_updated', path: 'index.html', content: '<h1>v3</h1>' }));

    const last = h.versions.at(-1);
    expect(last?.versions.filter((v) => v.fileName === 'index.html')).toHaveLength(1);
  });

  it('reflects the newest content for a repeatedly-written path in modifiedAt ordering', () => {
    const h = makeCallbacks();
    const adapter = createDesignStreamAdapter({ callbacks: h.callbacks });

    adapter.handleEvent(ev({ type: 'turn_start' }));
    adapter.handleEvent(ev({ type: 'fs_updated', path: 'index.html', content: 'a' }));
    vi.advanceTimersByTime(5);
    adapter.handleEvent(ev({ type: 'fs_updated', path: 'index.html', content: 'bb' }));

    const last = h.versions.at(-1);
    const entry = last?.versions.find((v) => v.fileName === 'index.html');
    // size tracks the most recent write (2 bytes), not the first (1 byte)
    expect(entry?.size).toBe(2);
  });

  it('keeps the most-recently-written file as `latest` even when earlier paths exist', () => {
    const h = makeCallbacks();
    const adapter = createDesignStreamAdapter({ callbacks: h.callbacks });

    adapter.handleEvent(ev({ type: 'turn_start' }));
    adapter.handleEvent(ev({ type: 'fs_updated', path: 'index.html', content: 'x' }));
    vi.advanceTimersByTime(5);
    adapter.handleEvent(ev({ type: 'fs_updated', path: 'about.html', content: 'y' }));

    expect(h.versions.at(-1)?.latest?.fileName).toBe('about.html');
  });

  it('orders versions by the injected modifiedAt clock, not by arrival, when the clock is non-monotonic', () => {
    const h = makeCallbacks();
    let clock = 1000;
    const adapter = createDesignStreamAdapter({
      callbacks: h.callbacks,
      now: () => clock,
    });

    adapter.handleEvent(ev({ type: 'turn_start' }));
    // Two distinct files stamped with an explicit, non-monotonic clock. The
    // monotonic guard means the later-stamped write stays `latest` even if a
    // lower-stamped write for a different path is processed afterwards.
    clock = 2000;
    adapter.handleEvent(ev({ type: 'fs_updated', path: 'a.html', content: 'a' }));
    clock = 1500; // lower stamp processed after the higher one
    adapter.handleEvent(ev({ type: 'fs_updated', path: 'b.html', content: 'b' }));

    const last = h.versions.at(-1);
    // latest must remain a.html (modifiedAt 2000) despite b being processed later.
    expect(last?.latest?.fileName).toBe('a.html');
  });

  it('does not regress a file’s size when a lower-stamped write for the same path is processed late', () => {
    // Regression guard (review H1): the monotonic modifiedAt guard must protect
    // content/size, not just modifiedAt. A lower-stamped write to a path must not
    // clobber the higher-stamped content already recorded for it. (In production
    // `now` is Date.now() and IPC delivery is ordered, so this guard's job is
    // resilience to a non-monotonic clock rather than reordered transport.)
    const h = makeCallbacks();
    let clock = 1000;
    const adapter = createDesignStreamAdapter({ callbacks: h.callbacks, now: () => clock });

    adapter.handleEvent(ev({ type: 'turn_start' }));
    clock = 2000;
    adapter.handleEvent(
      ev({ type: 'fs_updated', path: 'index.html', content: 'NEWER-5000-bytes-of-content' }),
    );
    const newerSize = h.versions.at(-1)?.versions.find((v) => v.fileName === 'index.html')?.size;
    clock = 1500; // out-of-order: an older write for the SAME path arrives after the newer one
    adapter.handleEvent(ev({ type: 'fs_updated', path: 'index.html', content: 'old' }));

    const entry = h.versions.at(-1)?.versions.find((v) => v.fileName === 'index.html');
    // size must still reflect the newer content, not regress to the stale 'old'.
    expect(entry?.size).toBe(newerSize);
    expect(entry?.modifiedAt).toBe(2000);
  });

  it('derives fileName from a Windows-style backslash path', () => {
    // Review L1: Electron may surface backslash paths; the swatch label should
    // still be the basename, not the whole path.
    const h = makeCallbacks();
    const adapter = createDesignStreamAdapter({ callbacks: h.callbacks });

    adapter.handleEvent(ev({ type: 'turn_start' }));
    adapter.handleEvent(ev({ type: 'fs_updated', path: 'sub\\dir\\index.html', content: '<h1/>' }));

    expect(h.versions.at(-1)?.latest?.fileName).toBe('index.html');
  });

  it('resets accumulated version state between designs', () => {
    const h = makeCallbacks();
    const adapter = createDesignStreamAdapter({ callbacks: h.callbacks });

    adapter.handleEvent(ev({ type: 'turn_start' }));
    adapter.handleEvent(ev({ type: 'fs_updated', path: 'index.html', content: 'one' }));
    adapter.reset(DESIGN);

    const other = 'design-2';
    adapter.handleEvent(ev({ type: 'turn_start', designId: other }));
    adapter.handleEvent(
      ev({ type: 'fs_updated', designId: other, path: 'main.html', content: 'two' }),
    );

    const last = h.versions.at(-1);
    expect(last?.designId).toBe(other);
    expect(last?.versions.map((v) => v.fileName)).toEqual(['main.html']);
  });
});

describe('createDesignStreamAdapter — throttled DB re-query (plan finding P-F5)', () => {
  it('re-queries persisted versions via fetchVersions and prefers DB truth when available', async () => {
    const h = makeCallbacks();
    const dbVersions: DesignVersion[] = [
      {
        id: 'db-1',
        designId: DESIGN,
        fileName: 'index.html',
        filePath: 'index.html',
        fileUrl: 'file:///ws/index.html',
        size: 99,
        modifiedAt: 4242,
      },
    ];
    const fetchVersions = vi.fn(async () => dbVersions);
    const adapter = createDesignStreamAdapter({
      callbacks: h.callbacks,
      fetchVersions,
      throttleMs: 250,
    });

    adapter.handleEvent(ev({ type: 'turn_start' }));
    adapter.handleEvent(ev({ type: 'fs_updated', path: 'index.html', content: 'x' }));

    // Trailing-edge throttle: the re-query fires after the window.
    await vi.advanceTimersByTimeAsync(300);

    expect(fetchVersions).toHaveBeenCalledWith(DESIGN);
    const last = h.versions.at(-1);
    expect(last?.versions[0]?.fileUrl).toBe('file:///ws/index.html');
    expect(last?.versions[0]?.size).toBe(99);
  });

  it('coalesces a burst of fs_updated events into a single throttled re-query', async () => {
    const h = makeCallbacks();
    const fetchVersions = vi.fn(async () => [] as DesignVersion[]);
    const adapter = createDesignStreamAdapter({
      callbacks: h.callbacks,
      fetchVersions,
      throttleMs: 250,
    });

    adapter.handleEvent(ev({ type: 'turn_start' }));
    for (let i = 0; i < 10; i++) {
      adapter.handleEvent(ev({ type: 'fs_updated', path: `file-${i}.html`, content: `v${i}` }));
    }
    await vi.advanceTimersByTimeAsync(300);

    // 10 events, but the DB is hit at most twice (leading + trailing), never 10x.
    expect(fetchVersions.mock.calls.length).toBeLessThanOrEqual(2);
  });

  it('still projects optimistic in-memory versions before the DB re-query resolves', () => {
    const h = makeCallbacks();
    const fetchVersions = vi.fn(async () => [] as DesignVersion[]);
    const adapter = createDesignStreamAdapter({
      callbacks: h.callbacks,
      fetchVersions,
      throttleMs: 250,
    });

    adapter.handleEvent(ev({ type: 'turn_start' }));
    adapter.handleEvent(ev({ type: 'fs_updated', path: 'index.html', content: 'live' }));

    // Synchronously — before any timer — the UI already has an optimistic version.
    expect(h.versions.at(-1)?.versions.map((v) => v.fileName)).toEqual(['index.html']);
  });

  it('does not emit a stale onVersion when the design is reset before the throttled re-query resolves', async () => {
    // Regression guard (review M1): reset() mid-throttle must cancel an in-flight
    // DB reconcile so a late-resolving fetchVersions never pushes a version for a
    // design the user already navigated away from.
    const h = makeCallbacks();
    let resolveFetch: (rows: DesignVersion[]) => void = () => {};
    const fetchVersions = vi.fn(
      () =>
        new Promise<DesignVersion[]>((res) => {
          resolveFetch = res;
        }),
    );
    const adapter = createDesignStreamAdapter({
      callbacks: h.callbacks,
      fetchVersions,
      throttleMs: 250,
    });

    adapter.handleEvent(ev({ type: 'turn_start' }));
    adapter.handleEvent(ev({ type: 'fs_updated', path: 'index.html', content: 'x' }));
    await vi.advanceTimersByTimeAsync(300); // fire the throttled reconcile (now awaiting fetch)
    const versionsBeforeReset = h.versions.length;

    adapter.reset(DESIGN); // user navigates away mid-flight
    resolveFetch([
      {
        id: 'late',
        designId: DESIGN,
        fileName: 'index.html',
        filePath: 'index.html',
        fileUrl: 'file:///ws/index.html',
        size: 1,
        modifiedAt: 1,
      },
    ]);
    await Promise.resolve();
    await Promise.resolve();

    // No new onVersion fired for the reset design after the late fetch resolved.
    expect(h.versions.length).toBe(versionsBeforeReset);
  });
});

describe('createDesignStreamAdapter — dual-runtime degrade (plan finding A-F1)', () => {
  it('falls back to polling fetchVersions when turn_end arrives with no fs_updated seen', async () => {
    const h = makeCallbacks();
    const dbVersions: DesignVersion[] = [
      {
        id: 'poll-1',
        designId: DESIGN,
        fileName: 'index.html',
        filePath: 'index.html',
        fileUrl: 'file:///ws/index.html',
        size: 10,
        modifiedAt: 1,
      },
    ];
    const fetchVersions = vi.fn(async () => dbVersions);
    const adapter = createDesignStreamAdapter({
      callbacks: h.callbacks,
      fetchVersions,
      throttleMs: 250,
    });

    // Legacy runtime (USE_AGENT_RUNTIME=0): lifecycle events but NO fs_updated.
    adapter.handleEvent(ev({ type: 'turn_start' }));
    adapter.handleEvent(ev({ type: 'turn_end', finalText: 'made it' }));
    await vi.advanceTimersByTimeAsync(10);

    // The adapter must have polled the DB so the live preview still gets a version.
    expect(fetchVersions).toHaveBeenCalledWith(DESIGN);
    expect(h.versions.at(-1)?.versions.map((v) => v.fileName)).toEqual(['index.html']);
  });

  it('does NOT redundantly poll on turn_end when fs_updated already populated versions', async () => {
    const h = makeCallbacks();
    const fetchVersions = vi.fn(async () => [] as DesignVersion[]);
    const adapter = createDesignStreamAdapter({
      callbacks: h.callbacks,
      fetchVersions,
      throttleMs: 250,
    });

    adapter.handleEvent(ev({ type: 'turn_start' }));
    adapter.handleEvent(ev({ type: 'fs_updated', path: 'index.html', content: 'x' }));
    await vi.advanceTimersByTimeAsync(300);
    const callsAfterFsPath = fetchVersions.mock.calls.length;

    adapter.handleEvent(ev({ type: 'turn_end', finalText: 'ok' }));
    await vi.advanceTimersByTimeAsync(300);

    // turn_end must not trigger an *extra* degrade poll when fs events were live.
    expect(fetchVersions.mock.calls.length).toBe(callsAfterFsPath);
  });

  it('works with no fetchVersions provided (pure in-memory projection)', () => {
    const h = makeCallbacks();
    const adapter = createDesignStreamAdapter({ callbacks: h.callbacks });

    adapter.handleEvent(ev({ type: 'turn_start' }));
    adapter.handleEvent(ev({ type: 'fs_updated', path: 'index.html', content: 'x' }));
    adapter.handleEvent(ev({ type: 'turn_end' }));
    adapter.handleEvent(ev({ type: 'agent_end' }));

    // No throw, and the version list is still projected from memory.
    expect(h.versions.at(-1)?.versions.map((v) => v.fileName)).toEqual(['index.html']);
    expect(h.dones).toHaveLength(1);
  });
});
