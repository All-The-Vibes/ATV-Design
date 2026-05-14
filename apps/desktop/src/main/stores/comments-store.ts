/**
 * Per-design comments JSON sidecar store.
 *
 * New substrate for Phase A dual-write. Writes to:
 *   <workspacePath>/<designId>/.codesign/comments.json
 *
 * Uses write-to-tmp + rename for atomicity (prevents partial reads on crash).
 */

import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { CommentRow } from '@atv-design/shared';
import { getLogger } from '../logger';

const logger = getLogger('comments-store');

const CODESIGN_DIR = '.codesign';
const COMMENTS_FILE = 'comments.json';

function commentsFilePath(workspacePath: string, designId: string): string {
  return path.join(workspacePath, designId, CODESIGN_DIR, COMMENTS_FILE);
}

function commentsDirPath(workspacePath: string, designId: string): string {
  return path.join(workspacePath, designId, CODESIGN_DIR);
}

/**
 * Read the comments array for a design. Returns [] if file does not exist.
 */
export async function listCommentsFromStore(
  workspacePath: string,
  designId: string,
): Promise<CommentRow[]> {
  const filePath = commentsFilePath(workspacePath, designId);
  let raw: string;
  try {
    raw = await readFile(filePath, 'utf-8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      logger.warn('comments-store.parse.notArray', { designId });
      return [];
    }
    return parsed as CommentRow[];
  } catch {
    logger.warn('comments-store.parse.fail', { designId });
    return [];
  }
}

/**
 * Atomically write the comments array back to disk.
 */
async function writeComments(
  workspacePath: string,
  designId: string,
  comments: CommentRow[],
): Promise<void> {
  const dir = commentsDirPath(workspacePath, designId);
  const filePath = commentsFilePath(workspacePath, designId);
  await mkdir(dir, { recursive: true });

  const tmpPath = `${filePath}.tmp.${randomUUID()}`;
  await writeFile(tmpPath, JSON.stringify(comments, null, 2), 'utf-8');
  await rename(tmpPath, filePath);
}

/**
 * Append a comment to the per-design sidecar.
 * If a comment with the same id already exists it is not duplicated.
 */
export async function appendComment(
  workspacePath: string,
  designId: string,
  comment: CommentRow,
): Promise<void> {
  const existing = await listCommentsFromStore(workspacePath, designId);
  if (existing.some((c) => c.id === comment.id)) {
    return; // idempotent — already present
  }
  await writeComments(workspacePath, designId, [...existing, comment]);
}

/**
 * Mark a comment as applied (update appliedInSnapshotId + status in-place).
 */
export async function markCommentApplied(
  workspacePath: string,
  designId: string,
  commentId: string,
  snapshotId: string,
): Promise<void> {
  const existing = await listCommentsFromStore(workspacePath, designId);
  const updated = existing.map((c) => {
    if (c.id !== commentId) return c;
    return { ...c, status: 'applied' as const, appliedInSnapshotId: snapshotId };
  });
  await writeComments(workspacePath, designId, updated);
}
