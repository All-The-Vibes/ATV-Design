/**
 * Unit tests for the chat_messages table helpers.
 */

import { describe, expect, it } from 'vitest';
import {
  appendChatMessage,
  clearChatMessages,
  createDesign,
  createSnapshot,
  initInMemoryDb,
  listChatMessages,
  seedChatFromSnapshots,
} from './snapshots-db';

function makeDb() {
  return initInMemoryDb();
}

describe('chat_messages table', () => {
  it('appends rows with auto-incrementing seq', () => {
    const db = makeDb();
    const d = createDesign(db);
    const a = appendChatMessage(db, {
      designId: d.id,
      kind: 'user',
      payload: { text: 'hello' },
    });
    const b = appendChatMessage(db, {
      designId: d.id,
      kind: 'assistant_text',
      payload: { text: 'world' },
    });
    expect(a.seq).toBe(0);
    expect(b.seq).toBe(1);
    const list = listChatMessages(db, d.id);
    expect(list).toHaveLength(2);
    expect(list[0]?.kind).toBe('user');
    expect((list[0]?.payload as { text: string }).text).toBe('hello');
    expect(list[1]?.kind).toBe('assistant_text');
  });

  it('isolates rows per design', () => {
    const db = makeDb();
    const d1 = createDesign(db, 'A');
    const d2 = createDesign(db, 'B');
    appendChatMessage(db, { designId: d1.id, kind: 'user', payload: { text: '1' } });
    appendChatMessage(db, { designId: d2.id, kind: 'user', payload: { text: '2' } });
    expect(listChatMessages(db, d1.id)).toHaveLength(1);
    expect(listChatMessages(db, d2.id)).toHaveLength(1);
    // each design starts seq at 0
    expect(listChatMessages(db, d2.id)[0]?.seq).toBe(0);
  });

  it('clears rows', () => {
    const db = makeDb();
    const d = createDesign(db);
    appendChatMessage(db, { designId: d.id, kind: 'user', payload: { text: 'x' } });
    clearChatMessages(db, d.id);
    expect(listChatMessages(db, d.id)).toHaveLength(0);
  });
});

describe('seedChatFromSnapshots', () => {
  it('is a no-op when chat_messages already has rows', () => {
    const db = makeDb();
    const d = createDesign(db);
    appendChatMessage(db, { designId: d.id, kind: 'user', payload: { text: 'existing' } });
    const inserted = seedChatFromSnapshots(db, d.id);
    expect(inserted).toBe(0);
    expect(listChatMessages(db, d.id)).toHaveLength(1);
  });

  it('is a no-op when there are no snapshots', () => {
    const db = makeDb();
    const d = createDesign(db);
    expect(seedChatFromSnapshots(db, d.id)).toBe(0);
  });

  it('seeds (user, artifact_delivered) pairs per snapshot in chronological order', () => {
    const db = makeDb();
    const d = createDesign(db);
    const first = createSnapshot(db, {
      designId: d.id,
      parentId: null,
      type: 'initial',
      prompt: 'first prompt',
      artifactType: 'html',
      artifactSource: '<html/>',
    });
    const second = createSnapshot(db, {
      designId: d.id,
      parentId: first.id,
      type: 'edit',
      prompt: 'second prompt',
      artifactType: 'html',
      artifactSource: '<html/>',
    });
    const inserted = seedChatFromSnapshots(db, d.id);
    expect(inserted).toBe(4);
    const list = listChatMessages(db, d.id);
    expect(list.map((m) => m.kind)).toEqual([
      'user',
      'artifact_delivered',
      'user',
      'artifact_delivered',
    ]);
    expect((list[0]?.payload as { text: string }).text).toBe('first prompt');
    expect(list[1]?.snapshotId).toBe(first.id);
    expect(list[3]?.snapshotId).toBe(second.id);
  });

  it('is idempotent across repeated calls', () => {
    const db = makeDb();
    const d = createDesign(db);
    createSnapshot(db, {
      designId: d.id,
      parentId: null,
      type: 'initial',
      prompt: 'p',
      artifactType: 'html',
      artifactSource: '<html/>',
    });
    const first = seedChatFromSnapshots(db, d.id);
    const second = seedChatFromSnapshots(db, d.id);
    expect(first).toBe(2);
    expect(second).toBe(0);
    expect(listChatMessages(db, d.id)).toHaveLength(2);
  });

  it('skips the user row when a snapshot has a null or empty prompt', () => {
    const db = makeDb();
    const d = createDesign(db);
    createSnapshot(db, {
      designId: d.id,
      parentId: null,
      type: 'initial',
      prompt: null,
      artifactType: 'html',
      artifactSource: '<html/>',
    });
    const inserted = seedChatFromSnapshots(db, d.id);
    expect(inserted).toBe(1);
    const list = listChatMessages(db, d.id);
    expect(list.map((m) => m.kind)).toEqual(['artifact_delivered']);
  });
});
