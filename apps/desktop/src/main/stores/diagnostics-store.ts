/**
 * Workspace-level diagnostics JSONL store.
 *
 * New substrate for Phase A dual-write. Writes to:
 *   <workspacePath>/.codesign/diagnostics.jsonl
 *
 * Rotation: when the file exceeds ROTATION_THRESHOLD_BYTES it is renamed to
 * diagnostics-<YYYY-MM-DD>.jsonl and a fresh file is started.
 *
 * Redaction: message and stack fields are scrubbed with redactPathsAndUrls
 * from diagnostic-summary.ts before persistence — same invariant as the
 * SQLite path's report flow.
 */

import { appendFile, mkdir, readFile, rename, stat } from 'node:fs/promises';
import path from 'node:path';
import type { DiagnosticEventRow } from '@atv-design/shared';
import { redactPathsAndUrls } from '../diagnostic-summary';
import { getLogger } from '../logger';

const logger = getLogger('diagnostics-store');

const CODESIGN_DIR = '.codesign';
const DIAGNOSTICS_FILE = 'diagnostics.jsonl';
const ROTATION_THRESHOLD_BYTES = 50 * 1024 * 1024; // 50 MB

function codesignDir(workspacePath: string): string {
  return path.join(workspacePath, CODESIGN_DIR);
}

function diagnosticsFilePath(workspacePath: string): string {
  return path.join(codesignDir(workspacePath), DIAGNOSTICS_FILE);
}

/**
 * Apply path/URL redaction to the free-text fields of a diagnostic event
 * before writing to disk. Numeric/structured fields are kept as-is.
 */
function redactEvent(event: DiagnosticEventRow): DiagnosticEventRow {
  const opts = { includePaths: false, includeUrls: false };
  return {
    ...event,
    message: redactPathsAndUrls(event.message, opts),
    stack: event.stack !== undefined ? redactPathsAndUrls(event.stack, opts) : undefined,
  };
}

/**
 * Rotate the diagnostics file if it exceeds the size threshold.
 * The current file is renamed to diagnostics-<date>.jsonl; subsequent appends
 * create a fresh diagnostics.jsonl.
 */
async function maybeRotate(filePath: string): Promise<void> {
  let size: number;
  try {
    const s = await stat(filePath);
    size = s.size;
  } catch {
    // File doesn't exist yet — nothing to rotate.
    return;
  }
  if (size < ROTATION_THRESHOLD_BYTES) return;

  const dateSuffix = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const dir = path.dirname(filePath);
  const rotatedPath = path.join(dir, `diagnostics-${dateSuffix}.jsonl`);
  try {
    await rename(filePath, rotatedPath);
    logger.info('diagnostics.rotated', { from: filePath, to: rotatedPath });
  } catch (err) {
    logger.warn('diagnostics.rotate.fail', {
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Append one diagnostic event to the workspace JSONL log.
 * Creates the .codesign directory and file if they don't exist.
 */
export async function appendDiagnosticEvent(
  workspacePath: string,
  event: DiagnosticEventRow,
): Promise<void> {
  const dir = codesignDir(workspacePath);
  const filePath = diagnosticsFilePath(workspacePath);

  await mkdir(dir, { recursive: true });
  await maybeRotate(filePath);

  const redacted = redactEvent(event);
  const line = `${JSON.stringify(redacted)}\n`;
  await appendFile(filePath, line, 'utf-8');
}

/**
 * Read and parse all diagnostic events from the workspace JSONL log.
 * Returns [] if the file does not exist or is empty.
 */
export async function listDiagnosticEventsFromStore(
  workspacePath: string,
): Promise<DiagnosticEventRow[]> {
  const filePath = diagnosticsFilePath(workspacePath);
  let raw: string;
  try {
    raw = await readFile(filePath, 'utf-8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }

  const results: DiagnosticEventRow[] = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    try {
      results.push(JSON.parse(trimmed) as DiagnosticEventRow);
    } catch {
      logger.warn('diagnostics.parse.fail', { line: trimmed.slice(0, 120) });
    }
  }
  return results;
}
