import { CodesignError } from '@atv-design/shared';
import { describe, expect, it } from 'vitest';
import { parseRequest } from './exporter-ipc';

const HTML = { kind: 'html' as const, source: '<html/>' };

describe('parseRequest', () => {
  it('rejects a null payload with IPC_BAD_INPUT', () => {
    expect(() => parseRequest(null)).toThrow(CodesignError);
    expect(() => parseRequest(null)).toThrowError(
      expect.objectContaining({ code: 'IPC_BAD_INPUT' }),
    );
  });

  it('rejects an unknown format with EXPORTER_UNKNOWN', () => {
    expect(() => parseRequest({ format: 'docx', artifactSource: HTML })).toThrowError(
      expect.objectContaining({ code: 'EXPORTER_UNKNOWN' }),
    );
  });

  it('rejects a missing artifactSource with IPC_BAD_INPUT', () => {
    expect(() => parseRequest({ format: 'pdf' })).toThrowError(
      expect.objectContaining({ code: 'IPC_BAD_INPUT' }),
    );
  });

  // `typeof [] === 'object'` and `typeof new Date() === 'object'`, so these
  // slip past the object check and must be caught by the kind/source checks.
  it.each([
    ['an array', []],
    ['a Date', new Date()],
    ['a string', 'not-an-object'],
  ])('rejects %s as artifactSource with IPC_BAD_INPUT', (_label, artifactSource) => {
    expect(() => parseRequest({ format: 'pdf', artifactSource })).toThrowError(
      expect.objectContaining({ code: 'IPC_BAD_INPUT' }),
    );
  });

  it('rejects an empty artifactSource.source with IPC_BAD_INPUT', () => {
    expect(() =>
      parseRequest({ format: 'pdf', artifactSource: { kind: 'html', source: '' } }),
    ).toThrowError(expect.objectContaining({ code: 'IPC_BAD_INPUT' }));
  });

  it('rejects an unknown artifactSource.kind with IPC_BAD_INPUT', () => {
    expect(() =>
      parseRequest({ format: 'pdf', artifactSource: { kind: 'wat', source: '<p/>' } }),
    ).toThrowError(expect.objectContaining({ code: 'IPC_BAD_INPUT' }));
  });

  // The N0 guard: uncompiled JSX must never reach an exporter. The renderer
  // compiles via `buildSrcdoc` before invoking; anything still tagged 'jsx'
  // here means that step was skipped.
  it('rejects uncompiled JSX with EXPORTER_COMPILE_FAILED', () => {
    expect(() =>
      parseRequest({
        format: 'html',
        artifactSource: { kind: 'jsx', source: 'function App() { return <div/>; }' },
      }),
    ).toThrowError(expect.objectContaining({ code: 'EXPORTER_COMPILE_FAILED' }));
  });

  it('accepts a valid pdf request', () => {
    const result = parseRequest({
      format: 'pdf',
      artifactSource: HTML,
      defaultFilename: 'report.pdf',
    });
    expect(result.format).toBe('pdf');
    expect(result.artifactSource).toEqual({ kind: 'html', source: '<html/>' });
    expect(result.defaultFilename).toBe('report.pdf');
  });
});
