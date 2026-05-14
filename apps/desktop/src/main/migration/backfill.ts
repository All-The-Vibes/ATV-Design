/**
 * Phase A backfill runner.
 *
 * On app start, checks the schema-version marker in the workspace. If the
 * marker is absent or older than CURRENT_SCHEMA_VERSION, backfills v0.1 SQLite
 * data into the new workspace-file substrate, then writes the version marker.
 *
 * Idempotent: safe to run multiple times. Each backfill step merges by id so
 * duplicate runs produce no duplicate entries.
 *
 * Phase A scope: diagnostics + comments only.
 * Snapshots + chat messages are separate later PRs.
 */

import type { CommentRow, DiagnosticEventRow, DiagnosticLevel } from '@atv-design/shared';
import type BetterSqlite3 from 'better-sqlite3';
import { getLogger } from '../logger';
import { appendComment } from '../stores/comments-store';
import { appendDiagnosticEvent } from '../stores/diagnostics-store';
import { CURRENT_SCHEMA_VERSION, readSchemaVersion, writeSchemaVersion } from './schema-version';

type Database = BetterSqlite3.Database;

const logger = getLogger('migration-phase-a');

// ---------------------------------------------------------------------------
// Internal DB row types — mirrors snapshots-db.ts but kept local to avoid
// exporting internals from the main DB module.
// ---------------------------------------------------------------------------

interface DiagnosticEventRowDb {
  id: number;
  schema_version: number;
  ts: number;
  level: string;
  code: string;
  scope: string;
  run_id: string | null;
  fingerprint: string;
  message: string;
  stack: string | null;
  transient: number;
  count: number;
  context_json: string | null;
}

interface CommentRowDb {
  id: string;
  schema_version: number;
  design_id: string;
  snapshot_id: string;
  kind: string;
  selector: string;
  tag: string;
  outer_html: string;
  rect: string;
  text: string;
  status: string;
  created_at: string;
  applied_in_snapshot_id: string | null;
  scope: string | null;
  parent_outer_html: string | null;
}

interface DesignRowDb {
  id: string;
  workspace_path: string | null;
}

// ---------------------------------------------------------------------------
// Row mappers
// ---------------------------------------------------------------------------

function dbRowToDiagnosticEvent(row: DiagnosticEventRowDb): DiagnosticEventRow {
  let context: Record<string, unknown> | undefined;
  if (row.context_json !== null && row.context_json.length > 0) {
    try {
      const parsed: unknown = JSON.parse(row.context_json);
      if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
        context = parsed as Record<string, unknown>;
      }
    } catch {
      // corrupt — skip
    }
  }
  return {
    id: row.id,
    schemaVersion: 1,
    ts: row.ts,
    level: row.level as DiagnosticLevel,
    code: row.code,
    scope: row.scope,
    runId: row.run_id ?? undefined,
    fingerprint: row.fingerprint,
    message: row.message,
    stack: row.stack ?? undefined,
    transient: row.transient === 1,
    count: row.count,
    context,
  };
}

function dbRowToCommentRow(row: CommentRowDb): CommentRow {
  let rect = { top: 0, left: 0, width: 0, height: 0 };
  try {
    const parsed = JSON.parse(row.rect) as Partial<typeof rect>;
    rect = {
      top: typeof parsed.top === 'number' ? parsed.top : 0,
      left: typeof parsed.left === 'number' ? parsed.left : 0,
      width: typeof parsed.width === 'number' ? parsed.width : 0,
      height: typeof parsed.height === 'number' ? parsed.height : 0,
    };
  } catch {
    /* keep zero rect */
  }
  return {
    schemaVersion: 1,
    id: row.id,
    designId: row.design_id,
    snapshotId: row.snapshot_id,
    kind: row.kind as CommentRow['kind'],
    selector: row.selector,
    tag: row.tag,
    outerHTML: row.outer_html,
    rect,
    text: row.text,
    status: row.status as CommentRow['status'],
    createdAt: row.created_at,
    appliedInSnapshotId: row.applied_in_snapshot_id,
    scope: (row.scope === 'global' ? 'global' : 'element') as CommentRow['scope'],
    ...(row.parent_outer_html !== null && row.parent_outer_html !== undefined
      ? { parentOuterHTML: row.parent_outer_html }
      : {}),
  };
}

// ---------------------------------------------------------------------------
// Backfill steps
// ---------------------------------------------------------------------------

/**
 * Backfill all diagnostic_events rows from SQLite into the workspace JSONL.
 * appendDiagnosticEvent is idempotent by design (append-only) but we avoid
 * duplicating by reading existing ids first.
 */
async function backfillDiagnostics(workspacePath: string, db: Database): Promise<void> {
  const rows = db
    .prepare('SELECT * FROM diagnostic_events ORDER BY ts ASC')
    .all() as DiagnosticEventRowDb[];

  if (rows.length === 0) return;

  // Read existing ids to avoid duplicates on re-run.
  const { listDiagnosticEventsFromStore } = await import('../stores/diagnostics-store');
  const existing = await listDiagnosticEventsFromStore(workspacePath);
  const existingIds = new Set(existing.map((e) => e.id));

  let written = 0;
  for (const row of rows) {
    if (existingIds.has(row.id)) continue;
    const event = dbRowToDiagnosticEvent(row);
    await appendDiagnosticEvent(workspacePath, event);
    written++;
  }
  logger.info('backfill.diagnostics.done', { total: rows.length, written });
}

/**
 * Backfill all comments rows from SQLite into per-design JSON sidecars.
 * Groups by design_id; skips designs whose workspacePath is null (legacy).
 */
async function backfillComments(workspacePath: string, db: Database): Promise<void> {
  // Get all designs that have a workspace_path set.
  const designs = db
    .prepare('SELECT id, workspace_path FROM designs WHERE workspace_path IS NOT NULL')
    .all() as DesignRowDb[];

  let totalWritten = 0;
  for (const design of designs) {
    if (design.workspace_path === null) continue;

    const rows = db
      .prepare('SELECT * FROM comments WHERE design_id = ? ORDER BY created_at ASC')
      .all(design.id) as CommentRowDb[];

    for (const row of rows) {
      const comment = dbRowToCommentRow(row);
      // appendComment is idempotent: skips if id already present.
      await appendComment(design.workspace_path, design.id, comment);
      totalWritten++;
    }
  }
  logger.info('backfill.comments.done', { designs: designs.length, written: totalWritten });
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Run the Phase A backfill if the workspace schema-version is absent or stale.
 * Safe to call on every app start — gated by the version marker.
 */
export async function runBackfillIfNeeded(workspacePath: string, db: Database): Promise<void> {
  const current = await readSchemaVersion(workspacePath);
  if (current !== null && current.version >= CURRENT_SCHEMA_VERSION) {
    return; // Already up to date.
  }

  const startMs = Date.now();
  logger.info('backfill.start', {
    workspacePath,
    fromVersion: current?.version ?? null,
    targetVersion: CURRENT_SCHEMA_VERSION,
  });

  try {
    await backfillDiagnostics(workspacePath, db);
    await backfillComments(workspacePath, db);
    await writeSchemaVersion(workspacePath, CURRENT_SCHEMA_VERSION);

    const elapsedMs = Date.now() - startMs;
    logger.info('backfill.done', { elapsedMs, version: CURRENT_SCHEMA_VERSION });
  } catch (err) {
    logger.warn('backfill.fail', {
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    // Do NOT write the schema-version marker on failure — next start will retry.
  }
}
