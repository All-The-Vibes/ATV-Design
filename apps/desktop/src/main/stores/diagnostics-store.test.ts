/**
 * Tests for the diagnostics JSONL store.
 */

import { appendFile, mkdir, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { DiagnosticEventRow } from '@atv-design/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appendDiagnosticEvent, listDiagnosticEventsFromStore } from './diagnostics-store';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEvent(overrides: Partial<DiagnosticEventRow> = {}): DiagnosticEventRow {
  return {
    id: 1,
    schemaVersion: 1,
    ts: Date.now(),
    level: 'error',
    code: 'TEST_CODE',
    scope: 'test',
    runId: undefined,
    fingerprint: 'fp-abc123',
    message: 'Something went wrong',
    stack: undefined,
    transient: false,
    count: 1,
    context: undefined,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('diagnostics-store', () => {
  let workspacePath: string;

  beforeEach(async () => {
    workspacePath = path.join(os.tmpdir(), `diagnostics-store-test-${crypto.randomUUID()}`);
    await mkdir(workspacePath, { recursive: true });
  });

  it('returns [] when no file exists', async () => {
    const result = await listDiagnosticEventsFromStore(workspacePath);
    expect(result).toEqual([]);
  });

  it('append + list roundtrip', async () => {
    const event = makeEvent({ id: 42, message: 'test message' });
    await appendDiagnosticEvent(workspacePath, event);

    const result = await listDiagnosticEventsFromStore(workspacePath);
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe(42);
    expect(result[0]?.code).toBe('TEST_CODE');
  });

  it('appends multiple events and preserves order', async () => {
    await appendDiagnosticEvent(workspacePath, makeEvent({ id: 1, ts: 1000 }));
    await appendDiagnosticEvent(workspacePath, makeEvent({ id: 2, ts: 2000 }));
    await appendDiagnosticEvent(workspacePath, makeEvent({ id: 3, ts: 3000 }));

    const result = await listDiagnosticEventsFromStore(workspacePath);
    expect(result).toHaveLength(3);
    expect(result.map((e) => e.id)).toEqual([1, 2, 3]);
  });

  it('redacts file paths in message before persisting', async () => {
    const event = makeEvent({
      id: 10,
      message: 'Error in /Users/alice/projects/myapp/src/main.ts',
    });
    await appendDiagnosticEvent(workspacePath, event);

    const result = await listDiagnosticEventsFromStore(workspacePath);
    expect(result).toHaveLength(1);
    // The path should be redacted — the raw path should not appear in the stored message
    expect(result[0]?.message).not.toContain('/Users/alice/projects/myapp/src/main.ts');
    expect(result[0]?.message).toContain('[path omitted]');
  });

  it('redacts URLs in stack before persisting', async () => {
    const event = makeEvent({
      id: 11,
      stack: 'at fetch (https://api.example.com/v1/secret-token)',
    });
    await appendDiagnosticEvent(workspacePath, event);

    const result = await listDiagnosticEventsFromStore(workspacePath);
    expect(result[0]?.stack).not.toContain('https://api.example.com/v1/secret-token');
    expect(result[0]?.stack).toContain('[url omitted]');
  });

  it('rotates file when it exceeds 50 MB', async () => {
    const codesignDir = path.join(workspacePath, '.codesign');
    const diagnosticsFile = path.join(codesignDir, 'diagnostics.jsonl');

    // Create a pre-existing oversized file
    await mkdir(codesignDir, { recursive: true });
    await writeFile(diagnosticsFile, 'x'.repeat(51 * 1024 * 1024), 'utf-8');

    await appendDiagnosticEvent(workspacePath, makeEvent({ id: 99 }));

    // Original file should have been rotated away; the new file should be small
    const newStat = await stat(diagnosticsFile);
    expect(newStat.size).toBeLessThan(10 * 1024); // much smaller than 50 MB

    // The directory should contain a rotated file
    const { readdir } = await import('node:fs/promises');
    const files = await readdir(codesignDir);
    const rotated = files.filter((f) => f.startsWith('diagnostics-') && f.endsWith('.jsonl'));
    expect(rotated).toHaveLength(1);
  });

  it('creates .codesign dir automatically', async () => {
    // workspacePath exists but .codesign does not
    await appendDiagnosticEvent(workspacePath, makeEvent({ id: 1 }));

    const { access } = await import('node:fs/promises');
    await expect(access(path.join(workspacePath, '.codesign'))).resolves.toBeUndefined();
  });
});
