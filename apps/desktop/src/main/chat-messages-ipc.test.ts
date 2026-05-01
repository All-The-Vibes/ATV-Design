/**
 * IPC tests for chat:v1:* and chat:update-tool-status:v1 — exercises the
 * payload validation and DB round-trip without spinning up Electron.
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
import { registerChatMessagesIpc } from './chat-messages-ipc';
import { appendChatMessage, createDesign, initInMemoryDb, listChatMessages } from './snapshots-db';

function invoke(channel: string, payload: unknown): unknown {
  const fn = handlers.get(channel);
  if (!fn) throw new Error(`No handler registered for ${channel}`);
  return fn({}, payload);
}

beforeEach(() => {
  handlers.clear();
});

afterEach(() => {
  handlers.clear();
});

describe('chat:update-tool-status:v1', () => {
  it('flips a running tool_call row to done', () => {
    const db = initInMemoryDb();
    const design = createDesign(db, 'T');
    registerChatMessagesIpc(db);

    const row = appendChatMessage(db, {
      designId: design.id,
      kind: 'tool_call',
      payload: {
        toolName: 'text_editor',
        args: {},
        status: 'running',
        startedAt: new Date().toISOString(),
        verbGroup: 'Working',
      },
    });

    const result = invoke('chat:update-tool-status:v1', {
      schemaVersion: 1,
      designId: design.id,
      seq: row.seq,
      status: 'done',
    });
    expect(result).toEqual({ ok: true });

    const list = listChatMessages(db, design.id);
    expect(list).toHaveLength(1);
    const payload = list[0]?.payload as { status: string };
    expect(payload.status).toBe('done');
  });

  it('records errorMessage when status is error', () => {
    const db = initInMemoryDb();
    const design = createDesign(db, 'T');
    registerChatMessagesIpc(db);

    const row = appendChatMessage(db, {
      designId: design.id,
      kind: 'tool_call',
      payload: {
        toolName: 'text_editor',
        args: {},
        status: 'running',
        startedAt: new Date().toISOString(),
        verbGroup: 'Working',
      },
    });

    invoke('chat:update-tool-status:v1', {
      schemaVersion: 1,
      designId: design.id,
      seq: row.seq,
      status: 'error',
      errorMessage: 'boom',
    });

    const list = listChatMessages(db, design.id);
    const payload = list[0]?.payload as { status: string; errorMessage?: string };
    expect(payload.status).toBe('error');
    expect(payload.errorMessage).toBe('boom');
  });

  it('rejects payload missing schemaVersion', () => {
    const db = initInMemoryDb();
    registerChatMessagesIpc(db);
    expect(() =>
      invoke('chat:update-tool-status:v1', { designId: 'd', seq: 0, status: 'done' }),
    ).toThrow(CodesignError);
  });

  it('rejects unknown status', () => {
    const db = initInMemoryDb();
    registerChatMessagesIpc(db);
    expect(() =>
      invoke('chat:update-tool-status:v1', {
        schemaVersion: 1,
        designId: 'd',
        seq: 0,
        status: 'pending',
      }),
    ).toThrow(/status must be/);
  });

  it('is a silent no-op when the row does not exist', () => {
    const db = initInMemoryDb();
    const design = createDesign(db, 'T');
    registerChatMessagesIpc(db);
    expect(() =>
      invoke('chat:update-tool-status:v1', {
        schemaVersion: 1,
        designId: design.id,
        seq: 999,
        status: 'done',
      }),
    ).not.toThrow();
  });
});
