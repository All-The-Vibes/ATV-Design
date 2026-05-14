/**
 * Tests for the per-design comments JSON sidecar store.
 */

import { mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { CommentRow } from '@atv-design/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { appendComment, listCommentsFromStore, markCommentApplied } from './comments-store';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeComment(overrides: Partial<CommentRow> = {}): CommentRow {
  return {
    schemaVersion: 1,
    id: crypto.randomUUID(),
    designId: 'design-1',
    snapshotId: 'snap-1',
    kind: 'note',
    selector: 'h1',
    tag: 'h1',
    outerHTML: '<h1>Hello</h1>',
    rect: { top: 0, left: 0, width: 100, height: 30 },
    text: 'Change this heading',
    status: 'pending',
    createdAt: new Date().toISOString(),
    appliedInSnapshotId: null,
    scope: 'element',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('comments-store', () => {
  let workspacePath: string;

  beforeEach(async () => {
    workspacePath = path.join(os.tmpdir(), `comments-store-test-${crypto.randomUUID()}`);
    await mkdir(workspacePath, { recursive: true });
  });

  it('returns [] when no file exists', async () => {
    const result = await listCommentsFromStore(workspacePath, 'design-1');
    expect(result).toEqual([]);
  });

  it('append + list roundtrip', async () => {
    const comment = makeComment({ id: 'c-1', text: 'Fix this' });
    await appendComment(workspacePath, 'design-1', comment);

    const result = await listCommentsFromStore(workspacePath, 'design-1');
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('c-1');
    expect(result[0]?.text).toBe('Fix this');
  });

  it('append is idempotent — no duplicates on re-append', async () => {
    const comment = makeComment({ id: 'c-dup' });
    await appendComment(workspacePath, 'design-1', comment);
    await appendComment(workspacePath, 'design-1', comment);

    const result = await listCommentsFromStore(workspacePath, 'design-1');
    expect(result).toHaveLength(1);
  });

  it('markCommentApplied flips status and sets appliedInSnapshotId', async () => {
    const comment = makeComment({ id: 'c-apply', status: 'pending' });
    await appendComment(workspacePath, 'design-1', comment);

    await markCommentApplied(workspacePath, 'design-1', 'c-apply', 'snap-applied');

    const result = await listCommentsFromStore(workspacePath, 'design-1');
    expect(result[0]?.status).toBe('applied');
    expect(result[0]?.appliedInSnapshotId).toBe('snap-applied');
  });

  it('multiple designs do not clobber each other', async () => {
    const c1 = makeComment({ id: 'c-d1', designId: 'design-1' });
    const c2 = makeComment({ id: 'c-d2', designId: 'design-2' });

    await appendComment(workspacePath, 'design-1', c1);
    await appendComment(workspacePath, 'design-2', c2);

    const d1 = await listCommentsFromStore(workspacePath, 'design-1');
    const d2 = await listCommentsFromStore(workspacePath, 'design-2');

    expect(d1).toHaveLength(1);
    expect(d1[0]?.id).toBe('c-d1');
    expect(d2).toHaveLength(1);
    expect(d2[0]?.id).toBe('c-d2');
  });

  it('preserves multiple comments in insertion order', async () => {
    await appendComment(workspacePath, 'design-1', makeComment({ id: 'c-1' }));
    await appendComment(workspacePath, 'design-1', makeComment({ id: 'c-2' }));
    await appendComment(workspacePath, 'design-1', makeComment({ id: 'c-3' }));

    const result = await listCommentsFromStore(workspacePath, 'design-1');
    expect(result.map((c) => c.id)).toEqual(['c-1', 'c-2', 'c-3']);
  });

  it('creates nested .codesign dir automatically', async () => {
    await appendComment(workspacePath, 'design-new', makeComment({ id: 'c-x' }));

    const { access } = await import('node:fs/promises');
    await expect(
      access(path.join(workspacePath, 'design-new', '.codesign', 'comments.json')),
    ).resolves.toBeUndefined();
  });
});
