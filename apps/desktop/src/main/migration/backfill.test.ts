/**
 * Integration tests for the Phase A backfill runner.
 *
 * Seeds an in-memory SQLite with v0.1 data, runs the backfill, and asserts
 * the resulting workspace-file state. Also tests idempotency.
 */

import { mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createComment,
  createDesign,
  createSnapshot,
  initInMemoryDb,
  recordDiagnosticEvent,
  updateDesignWorkspace,
} from '../snapshots-db';
import { listCommentsFromStore } from '../stores/comments-store';
import { listDiagnosticEventsFromStore } from '../stores/diagnostics-store';
import { runBackfillIfNeeded } from './backfill';
import { readSchemaVersion } from './schema-version';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDiagnosticInput() {
  return {
    level: 'error' as const,
    code: 'TEST_ERR',
    scope: 'test',
    runId: undefined,
    fingerprint: `fp-${crypto.randomUUID()}`,
    message: 'test error message',
    stack: undefined,
    transient: false,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('backfill', () => {
  let workspacePath: string;

  beforeEach(async () => {
    workspacePath = path.join(os.tmpdir(), `backfill-test-${crypto.randomUUID()}`);
    await mkdir(workspacePath, { recursive: true });
  });

  it('backfills 3 diagnostic events into JSONL', async () => {
    const db = initInMemoryDb();
    recordDiagnosticEvent(db, makeDiagnosticInput());
    recordDiagnosticEvent(db, makeDiagnosticInput());
    recordDiagnosticEvent(db, makeDiagnosticInput());

    await runBackfillIfNeeded(workspacePath, db);

    const events = await listDiagnosticEventsFromStore(workspacePath);
    expect(events).toHaveLength(3);
  });

  it('backfills comments into per-design sidecar files', async () => {
    const db = initInMemoryDb();

    // Two designs each with their own workspace sub-directory
    const ws1 = path.join(workspacePath, 'design-a');
    const ws2 = path.join(workspacePath, 'design-b');
    await mkdir(ws1, { recursive: true });
    await mkdir(ws2, { recursive: true });

    const d1 = createDesign(db, 'Design A');
    // Set workspace path AFTER creating comments so the async dual-write
    // in createComment doesn't race with the backfill on the same file.
    const s1 = createSnapshot(db, {
      designId: d1.id,
      parentId: null,
      type: 'initial',
      prompt: null,
      artifactType: 'html',
      artifactSource: '<html/>',
    });
    createComment(db, {
      designId: d1.id,
      snapshotId: s1.id,
      kind: 'note',
      selector: 'h1',
      tag: 'h1',
      outerHTML: '<h1/>',
      rect: { top: 0, left: 0, width: 0, height: 0 },
      text: 'comment 1',
    });
    createComment(db, {
      designId: d1.id,
      snapshotId: s1.id,
      kind: 'edit',
      selector: 'p',
      tag: 'p',
      outerHTML: '<p/>',
      rect: { top: 10, left: 0, width: 0, height: 0 },
      text: 'comment 2',
    });
    updateDesignWorkspace(db, d1.id, ws1);

    const d2 = createDesign(db, 'Design B');
    const s2 = createSnapshot(db, {
      designId: d2.id,
      parentId: null,
      type: 'initial',
      prompt: null,
      artifactType: 'html',
      artifactSource: '<html/>',
    });
    createComment(db, {
      designId: d2.id,
      snapshotId: s2.id,
      kind: 'note',
      selector: 'div',
      tag: 'div',
      outerHTML: '<div/>',
      rect: { top: 0, left: 0, width: 0, height: 0 },
      text: 'comment 3',
    });
    updateDesignWorkspace(db, d2.id, ws2);

    await runBackfillIfNeeded(workspacePath, db);

    const d1Comments = await listCommentsFromStore(ws1, d1.id);
    const d2Comments = await listCommentsFromStore(ws2, d2.id);

    expect(d1Comments).toHaveLength(2);
    expect(d2Comments).toHaveLength(1);
    expect(d1Comments.map((c) => c.text).sort()).toEqual(['comment 1', 'comment 2']);
    expect(d2Comments[0]?.text).toBe('comment 3');
  });

  it('writes schema-version.json after backfill', async () => {
    const db = initInMemoryDb();
    await runBackfillIfNeeded(workspacePath, db);

    const version = await readSchemaVersion(workspacePath);
    expect(version).not.toBeNull();
    expect(version?.version).toBe(1);
  });

  it('is idempotent — running twice produces no duplicates', async () => {
    const db = initInMemoryDb();
    recordDiagnosticEvent(db, makeDiagnosticInput());
    recordDiagnosticEvent(db, makeDiagnosticInput());

    const ws1 = path.join(workspacePath, 'design-idem');
    await mkdir(ws1, { recursive: true });
    const d1 = createDesign(db, 'Design Idem');
    const s1 = createSnapshot(db, {
      designId: d1.id,
      parentId: null,
      type: 'initial',
      prompt: null,
      artifactType: 'html',
      artifactSource: '<html/>',
    });
    createComment(db, {
      designId: d1.id,
      snapshotId: s1.id,
      kind: 'note',
      selector: 'h1',
      tag: 'h1',
      outerHTML: '<h1/>',
      rect: { top: 0, left: 0, width: 0, height: 0 },
      text: 'idempotent comment',
    });
    updateDesignWorkspace(db, d1.id, ws1);

    // First run
    await runBackfillIfNeeded(workspacePath, db);

    // Reset schema-version to force a second run
    const { writeFile } = await import('node:fs/promises');
    await writeFile(
      path.join(workspacePath, '.codesign', 'schema-version.json'),
      JSON.stringify({ version: 0, appliedAt: new Date().toISOString() }),
      'utf-8',
    );

    // Second run
    await runBackfillIfNeeded(workspacePath, db);

    const events = await listDiagnosticEventsFromStore(workspacePath);
    expect(events).toHaveLength(2); // not 4

    const comments = await listCommentsFromStore(ws1, d1.id);
    expect(comments).toHaveLength(1); // not 2
  });

  it('skips backfill when schema-version is already current', async () => {
    const db = initInMemoryDb();
    recordDiagnosticEvent(db, makeDiagnosticInput());

    // Run once to completion
    await runBackfillIfNeeded(workspacePath, db);

    // Add another event to SQLite — backfill should NOT pick it up on second call
    // because schema-version is already v1
    recordDiagnosticEvent(db, makeDiagnosticInput());
    await runBackfillIfNeeded(workspacePath, db);

    const events = await listDiagnosticEventsFromStore(workspacePath);
    expect(events).toHaveLength(1); // only the first run's event
  });
});
