/**
 * Unit tests for the comments table helpers (Workstream D).
 */

import { describe, expect, it } from 'vitest';
import {
  createComment,
  createDesign,
  createSnapshot,
  deleteComment,
  initInMemoryDb,
  listComments,
  listPendingEdits,
  markCommentsApplied,
  updateComment,
} from './snapshots-db';

function makeFixture() {
  const db = initInMemoryDb();
  const design = createDesign(db, 'D');
  const snapshot = createSnapshot(db, {
    designId: design.id,
    parentId: null,
    type: 'initial',
    prompt: 'p',
    artifactType: 'html',
    artifactSource: '<html/>',
  });
  return { db, design, snapshot };
}

describe('comments table', () => {
  it('creates and lists a note round-trip', () => {
    const { db, design, snapshot } = makeFixture();
    const c = createComment(db, {
      designId: design.id,
      snapshotId: snapshot.id,
      kind: 'note',
      selector: 'h1',
      tag: 'h1',
      outerHTML: '<h1>hi</h1>',
      rect: { top: 10, left: 20, width: 100, height: 30 },
      text: 'smaller',
    });
    expect(c.status).toBe('pending');
    expect(c.kind).toBe('note');
    expect(c.rect.left).toBe(20);

    const all = listComments(db, design.id);
    expect(all).toHaveLength(1);
    expect(all[0]?.id).toBe(c.id);
  });

  it('filters listComments by snapshotId', () => {
    const { db, design, snapshot } = makeFixture();
    const snapshot2 = createSnapshot(db, {
      designId: design.id,
      parentId: snapshot.id,
      type: 'edit',
      prompt: 'p2',
      artifactType: 'html',
      artifactSource: '<html/>',
    });
    createComment(db, {
      designId: design.id,
      snapshotId: snapshot.id,
      kind: 'note',
      selector: 'h1',
      tag: 'h1',
      outerHTML: '<h1/>',
      rect: { top: 0, left: 0, width: 0, height: 0 },
      text: 'a',
    });
    createComment(db, {
      designId: design.id,
      snapshotId: snapshot2.id,
      kind: 'note',
      selector: 'h2',
      tag: 'h2',
      outerHTML: '<h2/>',
      rect: { top: 0, left: 0, width: 0, height: 0 },
      text: 'b',
    });
    expect(listComments(db, design.id)).toHaveLength(2);
    expect(listComments(db, design.id, snapshot.id)).toHaveLength(1);
    expect(listComments(db, design.id, snapshot2.id)[0]?.text).toBe('b');
  });

  it('listPendingEdits returns only pending edit comments', () => {
    const { db, design, snapshot } = makeFixture();
    const note = createComment(db, {
      designId: design.id,
      snapshotId: snapshot.id,
      kind: 'note',
      selector: 'h1',
      tag: 'h1',
      outerHTML: '<h1/>',
      rect: { top: 0, left: 0, width: 0, height: 0 },
      text: 'note',
    });
    const edit = createComment(db, {
      designId: design.id,
      snapshotId: snapshot.id,
      kind: 'edit',
      selector: 'button',
      tag: 'button',
      outerHTML: '<button/>',
      rect: { top: 0, left: 0, width: 0, height: 0 },
      text: 'darker',
    });
    expect(note.kind).toBe('note');
    const pending = listPendingEdits(db, design.id);
    expect(pending).toHaveLength(1);
    expect(pending[0]?.id).toBe(edit.id);
  });

  it('updateComment patches text and status', () => {
    const { db, design, snapshot } = makeFixture();
    const c = createComment(db, {
      designId: design.id,
      snapshotId: snapshot.id,
      kind: 'note',
      selector: 'h1',
      tag: 'h1',
      outerHTML: '<h1/>',
      rect: { top: 0, left: 0, width: 0, height: 0 },
      text: 'a',
    });
    const patched = updateComment(db, c.id, { text: 'b', status: 'dismissed' });
    expect(patched?.text).toBe('b');
    expect(patched?.status).toBe('dismissed');
  });

  it('deleteComment removes the row', () => {
    const { db, design, snapshot } = makeFixture();
    const c = createComment(db, {
      designId: design.id,
      snapshotId: snapshot.id,
      kind: 'note',
      selector: 'h1',
      tag: 'h1',
      outerHTML: '<h1/>',
      rect: { top: 0, left: 0, width: 0, height: 0 },
      text: 'a',
    });
    expect(deleteComment(db, c.id)).toBe(true);
    expect(listComments(db, design.id)).toHaveLength(0);
  });

  it('markCommentsApplied flips status and stores applied snapshot', () => {
    const { db, design, snapshot } = makeFixture();
    const e1 = createComment(db, {
      designId: design.id,
      snapshotId: snapshot.id,
      kind: 'edit',
      selector: 'button',
      tag: 'button',
      outerHTML: '<button/>',
      rect: { top: 0, left: 0, width: 0, height: 0 },
      text: 'darker',
    });
    const newSnapshot = createSnapshot(db, {
      designId: design.id,
      parentId: snapshot.id,
      type: 'edit',
      prompt: 'p2',
      artifactType: 'html',
      artifactSource: '<html/>',
    });
    const updated = markCommentsApplied(db, [e1.id], newSnapshot.id);
    expect(updated).toHaveLength(1);
    expect(updated[0]?.status).toBe('applied');
    expect(updated[0]?.appliedInSnapshotId).toBe(newSnapshot.id);
    expect(listPendingEdits(db, design.id)).toHaveLength(0);
  });

  it('cascades on design delete', () => {
    const { db, design, snapshot } = makeFixture();
    createComment(db, {
      designId: design.id,
      snapshotId: snapshot.id,
      kind: 'note',
      selector: 'h1',
      tag: 'h1',
      outerHTML: '<h1/>',
      rect: { top: 0, left: 0, width: 0, height: 0 },
      text: 'a',
    });
    db.prepare('DELETE FROM designs WHERE id = ?').run(design.id);
    expect(listComments(db, design.id)).toHaveLength(0);
  });

  it('persists scope and parentOuterHTML and defaults scope to element', () => {
    const { db, design, snapshot } = makeFixture();
    const elementOnly = createComment(db, {
      designId: design.id,
      snapshotId: snapshot.id,
      kind: 'edit',
      selector: 'button',
      tag: 'button',
      outerHTML: '<button/>',
      rect: { top: 0, left: 0, width: 0, height: 0 },
      text: 'tighter',
    });
    expect(elementOnly.scope).toBe('element');
    expect(elementOnly.parentOuterHTML).toBeUndefined();

    const global = createComment(db, {
      designId: design.id,
      snapshotId: snapshot.id,
      kind: 'edit',
      selector: 'h1',
      tag: 'h1',
      outerHTML: '<h1/>',
      rect: { top: 0, left: 0, width: 0, height: 0 },
      text: 'apply everywhere',
      scope: 'global',
      parentOuterHTML: '<header><h1/></header>',
    });
    expect(global.scope).toBe('global');
    expect(global.parentOuterHTML).toBe('<header><h1/></header>');
  });

  it('truncates parentOuterHTML to 600 chars on insert', () => {
    const { db, design, snapshot } = makeFixture();
    const big = 'x'.repeat(2000);
    const c = createComment(db, {
      designId: design.id,
      snapshotId: snapshot.id,
      kind: 'edit',
      selector: 'a',
      tag: 'a',
      outerHTML: '<a/>',
      rect: { top: 0, left: 0, width: 0, height: 0 },
      text: 'go',
      parentOuterHTML: big,
    });
    expect(c.parentOuterHTML?.length).toBe(600);
  });
});
