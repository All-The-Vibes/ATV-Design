/**
 * Schema-version marker for the workspace-file migration.
 *
 * Written to: <workspacePath>/.codesign/schema-version.json
 *
 * Phase A establishes version 1.
 * Gates the backfill runner so it only runs once per workspace.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const CODESIGN_DIR = '.codesign';
const SCHEMA_VERSION_FILE = 'schema-version.json';

export interface SchemaVersion {
  version: number;
  appliedAt: string;
}

function schemaVersionPath(workspacePath: string): string {
  return path.join(workspacePath, CODESIGN_DIR, SCHEMA_VERSION_FILE);
}

/**
 * Read the schema-version marker. Returns null if the file does not exist.
 */
export async function readSchemaVersion(workspacePath: string): Promise<SchemaVersion | null> {
  const filePath = schemaVersionPath(workspacePath);
  let raw: string;
  try {
    raw = await readFile(filePath, 'utf-8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
  try {
    return JSON.parse(raw) as SchemaVersion;
  } catch {
    return null;
  }
}

/**
 * Write (or overwrite) the schema-version marker.
 */
export async function writeSchemaVersion(workspacePath: string, version: number): Promise<void> {
  const dir = path.join(workspacePath, CODESIGN_DIR);
  await mkdir(dir, { recursive: true });
  const payload: SchemaVersion = {
    version,
    appliedAt: new Date().toISOString(),
  };
  await writeFile(schemaVersionPath(workspacePath), JSON.stringify(payload, null, 2), 'utf-8');
}

/** The current migration version this codebase targets. */
export const CURRENT_SCHEMA_VERSION = 1;
