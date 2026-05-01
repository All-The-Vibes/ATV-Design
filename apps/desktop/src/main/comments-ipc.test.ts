/**
 * IPC validation tests for comments:v1:* channels. Exercises the parsing
 * + schemaVersion guard without spinning up Electron by mocking
 * electron-runtime and invoking the registered handlers directly.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const handlers = new Map<string, (...args: unknown[]) => unknown>();

vi.mock('./electron-runtime', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, fn: (...args: unknown[]) => unknown) => {
      handlers.set(channel, fn);
    }),
  },
}));

vi.mock('./logger', () => ({
  getLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() }),
}));

import { CodesignError } from '@open-codesign/shared';
import {
  COMMENTS_CHANNELS_V1,
  registerCommentsIpc,
  registerCommentsUnavailableIpc,
} from './comments-ipc';
import { createDesign, createSnapshot, initInMemoryDb } from './snapshots-db';

function invoke(channel: string, payload: unknown): unknown {
  const fn = handlers.get(channel);
  if (!fn) throw new Error(`No handler registered for ${channel}`);
  return fn({}, payload);
}

function baseFixture() {
  const db = initInMemoryDb();
  const design = createDesign(db, 'T');
  const snapshot = createSnapshot(db, {
    designId: design.id,
    parentId: null,
    type: 'initial',
    prompt: 'p',
    artifactType: 'html',
    artifactSource: '<html/>',
  });
  return { db, designId: design.id, snapshotId: snapshot.id };
}

beforeEach(() => {
  handlers.clear();
});

afterEach(() => {
  handlers.clear();
});

describe('comments-ipc validation', () => {
  it('rejects add without schemaVersion', () => {
    const { db } = baseFixture();
    registerCommentsIpc(db);
    expect(() => invoke('comments:v1:add', { designId: 'd' })).toThrow(CodesignError);
  });

  it('rejects add with unknown kind', () => {
    const { db, designId, snapshotId } = baseFixture();
    registerCommentsIpc(db);
    expect(() =>
      invoke('comments:v1:add', {
        schemaVersion: 1,
        designId,
        snapshotId,
        kind: 'bogus',
        selector: 'h1',
        tag: 'h1',
        outerHTML: '<h1/>',
        rect: { top: 0, left: 0, width: 0, height: 0 },
        text: 'x',
      }),
    ).toThrow(/kind must be one of/);
  });

  it('rejects add with non-finite rect coords', () => {
    const { db, designId, snapshotId } = baseFixture();
    registerCommentsIpc(db);
    expect(() =>
      invoke('comments:v1:add', {
        schemaVersion: 1,
        designId,
        snapshotId,
        kind: 'note',
        selector: 'h1',
        tag: 'h1',
        outerHTML: '<h1/>',
        rect: { top: Number.NaN, left: 0, width: 0, height: 0 },
        text: 'x',
      }),
    ).toThrow(/rect\.top/);
  });

  it('round-trips add + list', () => {
    const { db, designId, snapshotId } = baseFixture();
    registerCommentsIpc(db);
    invoke('comments:v1:add', {
      schemaVersion: 1,
      designId,
      snapshotId,
      kind: 'edit',
      selector: 'button',
      tag: 'button',
      outerHTML: '<button/>',
      rect: { top: 1, left: 2, width: 3, height: 4 },
      text: 'darker',
    });
    const rows = invoke('comments:v1:list', {
      schemaVersion: 1,
      designId,
    }) as Array<{ kind: string; text: string }>;
    expect(rows).toHaveLength(1);
    expect(rows[0]?.text).toBe('darker');
  });

  it('list-pending-edits excludes notes', () => {
    const { db, designId, snapshotId } = baseFixture();
    registerCommentsIpc(db);
    invoke('comments:v1:add', {
      schemaVersion: 1,
      designId,
      snapshotId,
      kind: 'note',
      selector: 'h1',
      tag: 'h1',
      outerHTML: '<h1/>',
      rect: { top: 0, left: 0, width: 0, height: 0 },
      text: 'a',
    });
    invoke('comments:v1:add', {
      schemaVersion: 1,
      designId,
      snapshotId,
      kind: 'edit',
      selector: 'button',
      tag: 'button',
      outerHTML: '<button/>',
      rect: { top: 0, left: 0, width: 0, height: 0 },
      text: 'b',
    });
    const rows = invoke('comments:v1:list-pending-edits', {
      schemaVersion: 1,
      designId,
    }) as Array<{ text: string }>;
    expect(rows).toHaveLength(1);
    expect(rows[0]?.text).toBe('b');
  });

  it('mark-applied flips status', () => {
    const { db, designId, snapshotId } = baseFixture();
    registerCommentsIpc(db);
    const row = invoke('comments:v1:add', {
      schemaVersion: 1,
      designId,
      snapshotId,
      kind: 'edit',
      selector: 'button',
      tag: 'button',
      outerHTML: '<button/>',
      rect: { top: 0, left: 0, width: 0, height: 0 },
      text: 'b',
    }) as { id: string };
    const applied = invoke('comments:v1:mark-applied', {
      schemaVersion: 1,
      ids: [row.id],
      snapshotId,
    }) as Array<{ status: string }>;
    expect(applied[0]?.status).toBe('applied');
  });

  it('remove returns {removed:true} when hit', () => {
    const { db, designId, snapshotId } = baseFixture();
    registerCommentsIpc(db);
    const row = invoke('comments:v1:add', {
      schemaVersion: 1,
      designId,
      snapshotId,
      kind: 'note',
      selector: 'h1',
      tag: 'h1',
      outerHTML: '<h1/>',
      rect: { top: 0, left: 0, width: 0, height: 0 },
      text: 'a',
    }) as { id: string };
    const result = invoke('comments:v1:remove', {
      schemaVersion: 1,
      id: row.id,
    }) as { removed: boolean };
    expect(result.removed).toBe(true);
  });

  it('unavailable stub throws SNAPSHOTS_UNAVAILABLE on every channel', () => {
    registerCommentsUnavailableIpc('boom');
    for (const channel of COMMENTS_CHANNELS_V1) {
      const fn = handlers.get(channel);
      expect(fn).toBeDefined();
      expect(() => fn?.({}, {})).toThrow(/Comments are unavailable/);
    }
  });
});
